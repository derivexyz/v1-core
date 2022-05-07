//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

// Libraries
import "./synthetix/DecimalMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

// Inherited
import "./synthetix/Owned.sol";
import "./lib/SimpleInitializeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// Interfaces
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./LiquidityPool.sol";
import "./interfaces/ISynthetix.sol";
import "./interfaces/ICollateralShort.sol";
import "./SynthetixAdapter.sol";
import "./OptionMarket.sol";
import "./OptionGreekCache.sol";
import "./PoolHedger.sol";

/**
 * @title PoolHedger
 * @author Lyra
 * @dev Uses the delta hedging funds from the LiquidityPool to hedge option deltas, so LPs are minimally exposed to
 * movements in the underlying asset price.
 */
contract PoolHedger is Owned, SimpleInitializeable, ReentrancyGuard {
  using DecimalMath for uint;

  struct PoolHedgerParameters {
    uint shortBuffer;
    uint interactionDelay;
    uint hedgeCap;
  }

  SynthetixAdapter internal synthetixAdapter;
  OptionMarket internal optionMarket;
  OptionGreekCache internal optionGreekCache;
  LiquidityPool internal liquidityPool;
  ERC20 internal quoteAsset;
  ERC20 internal baseAsset;

  /// @dev The ID of our short that is opened when we open short account.
  uint public shortId;
  PoolHedgerParameters public poolHedgerParams;
  /// @dev The last time a short or long position was updated
  uint public lastInteraction;

  ///////////
  // Setup //
  ///////////

  constructor() Owned() {
    poolHedgerParams.shortBuffer = (2 * DecimalMath.UNIT);
    poolHedgerParams.interactionDelay = 24 hours;
    poolHedgerParams.hedgeCap = type(uint).max;
    emit PoolHedgerParametersSet(poolHedgerParams);
  }

  /**
   * @dev Initialize the contract.
   *
   * @param _synthetixAdapter SynthetixAdapter address
   * @param _optionMarket OptionMarket address
   * @param _liquidityPool LiquidityPool address
   * @param _quoteAsset Quote asset address
   * @param _baseAsset Base asset address
   */
  function init(
    SynthetixAdapter _synthetixAdapter,
    OptionMarket _optionMarket,
    OptionGreekCache _optionGreekCache,
    LiquidityPool _liquidityPool,
    ERC20 _quoteAsset,
    ERC20 _baseAsset
  ) external onlyOwner initializer {
    synthetixAdapter = _synthetixAdapter;
    optionMarket = _optionMarket;
    optionGreekCache = _optionGreekCache;
    liquidityPool = _liquidityPool;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;

    synthetixAdapter.delegateApprovals().approveExchangeOnBehalf(address(synthetixAdapter));
  }

  ///////////
  // Admin //
  ///////////

  /**
   * @dev Update pool hedger parameters.
   */
  function setPoolHedgerParams(PoolHedgerParameters memory _poolHedgerParams) external onlyOwner {
    if (_poolHedgerParams.shortBuffer < DecimalMath.UNIT) {
      revert InvalidPoolHedgerParameters(address(this), _poolHedgerParams);
    }
    poolHedgerParams = _poolHedgerParams;
    emit PoolHedgerParametersSet(poolHedgerParams);
  }

  ///////////////////
  // Opening Short //
  ///////////////////
  /**
   * @dev Opens/reopens short account if the old one was closed or liquidated.
   */
  function openShortAccount() external nonReentrant {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(optionMarket));

    (, , , , , , , uint interestIndex, ) = exchangeParams.short.loans(shortId);
    // Cannot open a new short if the old one is still open
    if (interestIndex != 0) {
      revert ShortAccountAlreadyOpen(address(this), shortId);
    }

    _openShortAccount(exchangeParams);
  }

  /**
   * @dev Opens new short account with min collateral and 0 amount.
   *
   * @param exchangeParams The ExchangeParams.
   */
  function _openShortAccount(SynthetixAdapter.ExchangeParams memory exchangeParams) internal {
    uint minCollateral = exchangeParams.short.minCollateral();

    quoteAsset.approve(address(exchangeParams.short), type(uint).max);

    // Open a short with min collateral and 0 amount, to get a static Id for this contract to use.
    liquidityPool.transferQuoteToHedge(exchangeParams, minCollateral);

    uint currentBalance = quoteAsset.balanceOf(address(this));
    if (currentBalance < minCollateral) {
      revert NotEnoughQuoteForMinCollateral(address(this), currentBalance, minCollateral);
    }

    // This will revert if the LP did not provide enough quote
    shortId = exchangeParams.short.open(minCollateral, 0, exchangeParams.baseKey);
    _sendAllQuoteToLP();
    emit OpenedShortAccount(shortId);
    emit ShortSetTo(0, 0, 0, minCollateral);
  }

  /////////////
  // Only LP //
  /////////////
  function resetInteractionDelay() external onlyLiquidityPool {
    lastInteraction = 0;
  }

  /////////////
  // Getters //
  /////////////

  /**
   * @dev Returns short balance and collateral.
   *
   * @param short The short contract.
   */
  function getShortPosition(ICollateralShort short) public view returns (uint shortBalance, uint collateral) {
    if (shortId == 0) {
      return (0, 0);
    }
    return short.getShortAndCollateral(address(this), shortId);
  }

  /**
   * @dev Returns the current hedged netDelta position.
   */
  function getCurrentHedgedNetDelta() external view returns (int) {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(optionMarket));

    uint longBalance = baseAsset.balanceOf(address(this));
    (uint shortBalance, ) = getShortPosition(exchangeParams.short);

    return SafeCast.toInt256(longBalance) - SafeCast.toInt256(shortBalance);
  }

  function getHedgingLiquidity(ICollateralShort short, uint spotPrice)
    external
    view
    returns (uint pendingDeltaLiquidity, uint usedDeltaLiquidity)
  {
    // Get capped expected hedge
    int expectedHedge = getCappedExpectedHedge();

    // Get current hedge
    (uint shortBalance, uint shortCollateral) = getShortPosition(short);
    uint longBalance = baseAsset.balanceOf(address(this));
    uint totalBal = shortBalance + longBalance;

    // Include both long and short, to deal with "donations"
    usedDeltaLiquidity += longBalance.multiplyDecimal(spotPrice);

    uint shortOwed = shortBalance.multiplyDecimal(spotPrice);
    if (shortCollateral > shortOwed) {
      usedDeltaLiquidity += shortCollateral - shortOwed;
    }

    // Estimate value of desired hedge
    if (expectedHedge > 0) {
      if (_abs(expectedHedge) > totalBal) {
        pendingDeltaLiquidity = (_abs(expectedHedge) - totalBal).multiplyDecimal(spotPrice);
      }
    } else if (expectedHedge < 0) {
      if (_abs(expectedHedge) > totalBal) {
        pendingDeltaLiquidity = (_abs(expectedHedge) - totalBal).multiplyDecimal(spotPrice).multiplyDecimal(
          poolHedgerParams.shortBuffer
        );
      }
    }
  }

  //////////////
  // External //
  //////////////

  /**
   * @dev Retrieves the netDelta from the OptionGreekCache and updates the hedge position.
   */
  function hedgeDelta() external nonReentrant {
    // Subtract the baseAsset balance from netDelta, to account for the variance from collateral held by LP.
    int expectedHedge = getCappedExpectedHedge();

    // Bypass interactionDelay if we want to set netDelta to 0
    if (expectedHedge != 0 && poolHedgerParams.interactionDelay != 0) {
      if (lastInteraction + poolHedgerParams.interactionDelay > block.timestamp) {
        revert InteractionDelayNotExpired(
          address(this),
          lastInteraction,
          poolHedgerParams.interactionDelay,
          block.timestamp
        );
      }
    }

    _hedgeDelta(expectedHedge);
  }

  /**
   * @dev Updates the collateral held in the short to prevent liquidations and
   * return excess collateral without checking/triggering the interaction delay.
   */
  function updateCollateral() external nonReentrant {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(optionMarket));
    (uint shortBalance, uint startCollateral) = getShortPosition(exchangeParams.short);

    // do not change shortBalance
    uint newCollateral = _updateCollateral(exchangeParams, shortBalance, startCollateral);
    _sendAllQuoteToLP();
    emit ShortSetTo(shortBalance, shortBalance, startCollateral, newCollateral);
  }

  //////////////
  // Internal //
  //////////////

  /**
   * @dev Updates the hedge position. This may need to be called several times as it will only do one step at a time
   * I.e. to go from a long position to asho
   *
   * @param expectedHedge The expected final hedge value.
   */
  function _hedgeDelta(int expectedHedge) internal {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(optionMarket));
    uint longBalance = baseAsset.balanceOf(address(this));
    (uint shortBalance, uint collateral) = getShortPosition(exchangeParams.short);

    int oldHedge = longBalance != 0 ? SafeCast.toInt256(longBalance) : -SafeCast.toInt256(shortBalance);
    int newHedge = _updatePosition(exchangeParams, longBalance, shortBalance, collateral, expectedHedge);

    emit PositionUpdated(oldHedge, newHedge, expectedHedge);

    if (newHedge != 0 && newHedge != oldHedge) {
      lastInteraction = block.timestamp;
    }

    // All proceeds should be sent back to the LP
    _sendAllQuoteToLP();
  }

  /**
   * @dev Updates the hedge contract based off a new netDelta.
   *
   * @param exchangeParams Globals related to exchanging synths
   * @param longBalance The current long base balance of the PoolHedger
   * @param shortBalance The current short balance of the PoolHedger
   * @param collateral The current quote collateral for shorts of the PoolHedger
   * @param expectedHedge The amount of baseAsset exposure needed to hedge delta risk.
   */
  function _updatePosition(
    SynthetixAdapter.ExchangeParams memory exchangeParams,
    uint longBalance,
    uint shortBalance,
    uint collateral,
    int expectedHedge
  ) internal returns (int) {
    if (expectedHedge >= 0) {
      // we need to be net long the asset.
      uint expectedLong = uint(expectedHedge);
      // if we have any short open, close it all.
      if (shortBalance > 0 || collateral > 0) {
        _setShortTo(exchangeParams, 0, shortBalance, collateral);
      }

      if (expectedLong > longBalance) {
        // Must buy baseAsset
        return SafeCast.toInt256(_increaseLong(exchangeParams, expectedLong - longBalance, longBalance));
      } else if (expectedLong < longBalance) {
        // Must sell baseAsset
        return SafeCast.toInt256(_decreaseLong(longBalance - expectedLong, longBalance));
      } else {
        // longBalance == expectedLong
        return SafeCast.toInt256(longBalance);
      }
    } else {
      // we need to be net short the asset.
      uint expectedShort = uint(-expectedHedge);
      // if we have any of the spot left, sell it all.
      if (longBalance > 0) {
        _decreaseLong(longBalance, longBalance);
      }
      return -SafeCast.toInt256(_setShortTo(exchangeParams, expectedShort, shortBalance, collateral));
    }
  }

  /**
   * @dev Increases the long exposure of the hedge contract.
   *
   * @param exchangeParams The ExchangeParams.
   * @param amount The amount of baseAsset to purchase.
   */
  function _increaseLong(
    SynthetixAdapter.ExchangeParams memory exchangeParams,
    uint amount,
    uint currentBalance
  ) internal returns (uint newBalance) {
    uint base = amount.divideDecimal(DecimalMath.UNIT - exchangeParams.quoteBaseFeeRate);
    uint purchaseAmount = base.multiplyDecimal(exchangeParams.spotPrice);
    uint receivedQuote = liquidityPool.transferQuoteToHedge(exchangeParams, purchaseAmount);

    // We buy as much as is possible with the quote given
    if (receivedQuote < purchaseAmount) {
      purchaseAmount = receivedQuote;
    }
    // buy the base asset.
    synthetixAdapter.exchangeFromExactQuote(address(optionMarket), purchaseAmount);
    newBalance = baseAsset.balanceOf(address(this));
    emit LongSetTo(currentBalance, newBalance);
  }

  /**
   * @dev Decreases the long exposure of the hedge contract.
   *
   * @param amount The amount of baseAsset to sell.
   */
  function _decreaseLong(uint amount, uint currentBalance) internal returns (uint newBalance) {
    // assumption here is that we have enough to sell, will throw if not
    synthetixAdapter.exchangeFromExactBase(address(optionMarket), amount);
    newBalance = baseAsset.balanceOf(address(this));
    emit LongSetTo(currentBalance, newBalance);
  }

  /**
   * @dev Increases or decreases short to get to this amount of shorted baseAsset at the shortBuffer ratio. Note,
   * hedge() may have to be called a second time to re-balance collateral after calling `repayWithCollateral`. As that
   * disregards the desired ratio.
   *
   * @param exchangeParams The ExchangeParams.
   * @param desiredShort The desired short balance.
   * @param startShort Trusted value for current short amount, in base.
   * @param startCollateral Trusted value for current amount of collateral, in quote.
   */
  function _setShortTo(
    SynthetixAdapter.ExchangeParams memory exchangeParams,
    uint desiredShort,
    uint startShort,
    uint startCollateral
  ) internal returns (uint newShort) {
    uint newCollateral;
    if (startShort <= desiredShort) {
      newCollateral = _updateCollateral(exchangeParams, desiredShort, startCollateral);
      uint maxPossibleShort = newCollateral.divideDecimal(exchangeParams.spotPrice).divideDecimal(
        poolHedgerParams.shortBuffer
      );

      if (maxPossibleShort > startShort) {
        (newShort, ) = exchangeParams.short.draw(shortId, maxPossibleShort - startShort);
      } else {
        newShort = startShort;
      }
    } else {
      exchangeParams.short.repayWithCollateral(shortId, startShort - desiredShort);
      (newShort, newCollateral) = getShortPosition(exchangeParams.short);

      newCollateral = _updateCollateral(exchangeParams, newShort, newCollateral);
    }

    emit ShortSetTo(startShort, newShort, startCollateral, newCollateral);
    return newShort;
  }

  function _updateCollateral(
    SynthetixAdapter.ExchangeParams memory exchangeParams,
    uint shortBalance,
    uint startCollateral
  ) internal returns (uint newCollateral) {
    uint desiredCollateral = shortBalance.multiplyDecimal(exchangeParams.spotPrice).multiplyDecimal(
      poolHedgerParams.shortBuffer
    );

    if (startCollateral < desiredCollateral) {
      uint received = liquidityPool.transferQuoteToHedge(exchangeParams, desiredCollateral - startCollateral);
      if (received > 0) {
        (, newCollateral) = exchangeParams.short.deposit(address(this), shortId, received);
      } else {
        newCollateral = startCollateral;
      }
    } else if (startCollateral > desiredCollateral) {
      (, newCollateral) = exchangeParams.short.withdraw(shortId, startCollateral - desiredCollateral);
    }
  }

  /**
   * @dev Calculates the expected delta hedge that hedger must perform and
   * adjusts the result down to the hedgeCap param if needed.
   */
  function getCappedExpectedHedge() public view returns (int cappedExpectedHedge) {
    // Update any stale boards to get an accurate netDelta value
    int netOptionDelta = optionGreekCache.getGlobalNetDelta();

    // Subtract the baseAsset balance from netDelta, to account for the variance from collateral held by LP.
    int expectedHedge = netOptionDelta - int(baseAsset.balanceOf(address(liquidityPool)));
    bool exceedsCap = _abs(expectedHedge) > poolHedgerParams.hedgeCap;

    // Cap expected hedge
    if (expectedHedge < 0 && exceedsCap) {
      cappedExpectedHedge = -SafeCast.toInt256(poolHedgerParams.hedgeCap);
    } else if (expectedHedge >= 0 && exceedsCap) {
      cappedExpectedHedge = SafeCast.toInt256(poolHedgerParams.hedgeCap);
    } else {
      cappedExpectedHedge = expectedHedge;
    }
  }

  /**
   * @dev Sends all quote asset deposited in this contract to the `LiquidityPool`.
   */
  function _sendAllQuoteToLP() internal {
    uint quoteBal = quoteAsset.balanceOf(address(this));
    if (!quoteAsset.transfer(address(liquidityPool), quoteBal)) {
      revert QuoteTransferFailed(address(this), address(this), address(liquidityPool), quoteBal);
    }
    emit QuoteReturnedToLP(quoteBal);
  }

  function getPoolHedgerParams() external view returns (PoolHedgerParameters memory) {
    return poolHedgerParams;
  }

  function _abs(int val) internal pure returns (uint) {
    return val >= 0 ? uint(val) : uint(-val);
  }

  /// Modifiers

  modifier onlyLiquidityPool() {
    if (msg.sender != address(liquidityPool)) {
      revert OnlyLiquidityPool(address(this), msg.sender, address(liquidityPool));
    }
    _;
  }

  ////////////
  // Events //
  ////////////
  /**
   * @dev Emitted when pool hedger parameters are updated.
   */
  event PoolHedgerParametersSet(PoolHedgerParameters poolHedgerParams);
  /**
   * @dev Emitted when the short is initialized.
   */
  event OpenedShortAccount(uint shortId);
  /**
   * @dev Emitted when the hedge position is updated.
   */
  event PositionUpdated(int oldNetDelta, int currentNetDelta, int expectedNetDelta);
  /**
   * @dev Emitted when the long exposure of the hedge contract is adjusted.
   */
  event LongSetTo(uint oldAmount, uint newAmount);
  /**
   * @dev Emitted when short or short collateral is adjusted.
   */
  event ShortSetTo(uint oldShort, uint newShort, uint oldCollateral, uint newCollateral);
  /**
   * @dev Emitted when proceeds of the short are sent back to the LP.
   */
  event QuoteReturnedToLP(uint amountQuote);

  ////////////
  // Errors //
  ////////////
  // Admin
  error InvalidPoolHedgerParameters(address thrower, PoolHedgerParameters poolHedgerParams);

  // Initialising Short
  error ShortAccountAlreadyOpen(address thrower, uint shortId);
  error NotEnoughQuoteForMinCollateral(address thrower, uint quoteReceived, uint minCollateral);

  // Hedging
  error InteractionDelayNotExpired(address thrower, uint lastInteraction, uint interactionDelta, uint currentTime);

  // Access
  error OnlyLiquidityPool(address thrower, address caller, address liquidityPool);

  // Token transfers
  error QuoteTransferFailed(address thrower, address from, address to, uint amount);
}
