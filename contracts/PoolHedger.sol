//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";
import "./synthetix/SignedSafeDecimalMath.sol";
// Inherited
// Interfaces
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/ISynthetix.sol";
import "./interfaces/ICollateralShort.sol";
import "./interfaces/ILyraGlobals.sol";
import "./interfaces/IOptionGreekCache.sol";
import "./interfaces/IPoolHedger.sol";

/**
 * @title PoolHedger
 * @author Lyra
 * @dev Uses the delta hedging funds from the LiquidityPool to hedge option deltas,
 * so LPs are minimally exposed to movements in the underlying asset price.
 */
contract PoolHedger is IPoolHedger, Ownable {
  using SafeMath for uint;
  using SafeDecimalMath for uint;
  using SignedSafeMath for int;

  ILyraGlobals internal globals;
  IOptionMarket internal optionMarket;
  IOptionGreekCache internal optionGreekCache;
  ILiquidityPool internal liquidityPool;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;

  bool internal initialized = false;
  bool public override shortingInitialized = false;
  /// @dev The ID of our short that is opened when we init the contract.
  uint public override shortId;
  /// @dev The ratio we wish to maintain on our short position.
  uint public override shortBuffer;
  /// @dev The last time a short or long position was updated
  uint public override lastInteraction;
  /// @dev How long before balance can be updated
  uint public override interactionDelay;
  /// @dev Counter for reentrancy guard
  uint internal counter = 1;

  constructor() Ownable() {
    shortBuffer = (2 * SafeDecimalMath.UNIT);
    interactionDelay = 3 hours;
    emit ShortBufferSet(shortBuffer);
    emit InteractionDelaySet(interactionDelay);
  }

  /**
   * @dev Initialize the contract.
   *
   * @param _globals LyraGlobals address
   * @param _optionMarket OptionMarket address
   * @param _liquidityPool LiquidityPool address
   * @param _quoteAsset Quote asset address
   * @param _baseAsset Base asset address
   */
  function init(
    ILyraGlobals _globals,
    IOptionMarket _optionMarket,
    IOptionGreekCache _optionGreekCache,
    ILiquidityPool _liquidityPool,
    IERC20 _quoteAsset,
    IERC20 _baseAsset
  ) external {
    require(!initialized, "contract already initialized");
    globals = _globals;
    optionMarket = _optionMarket;
    optionGreekCache = _optionGreekCache;
    liquidityPool = _liquidityPool;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;
    initialized = true;
  }

  /**
   * @dev Initialize the contract.
   *
   * @param newShortBuffer The new short buffer for collateral to short ratio.
   */
  function setShortBuffer(uint newShortBuffer) external override onlyOwner {
    require(newShortBuffer <= (10 * SafeDecimalMath.UNIT), "buffer too high"); // 1000%
    require(newShortBuffer >= ((15 * SafeDecimalMath.UNIT) / 10), "buffer too low"); // 150%
    shortBuffer = newShortBuffer;
    emit ShortBufferSet(shortBuffer);
  }

  /**
   * @dev Set the contract interaction delay.
   *
   * @param newInteractionDelay The new interaction delay.
   */
  function setInteractionDelay(uint newInteractionDelay) external override onlyOwner {
    interactionDelay = newInteractionDelay;
    emit InteractionDelaySet(interactionDelay);
  }

  /**
   * @dev Initialises the short.
   */
  function initShort() external override onlyOwner {
    require(initialized, "contract must be initialized");
    require(!shortingInitialized, "shorting already initialized");

    ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.ALL);

    openShort(exchangeGlobals);
    shortingInitialized = true;
  }

  /**
   * @dev Reopens the short if the old one was closed or liquidated.
   */
  function reopenShort() external override onlyOwner {
    require(initialized && shortingInitialized, "not initialized");

    ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.ALL);

    (, , , , , , , uint interestIndex, ) = exchangeGlobals.short.loans(shortId);
    // Cannot open a new short if the old one is still open
    require(interestIndex == 0, "short still open");

    openShort(exchangeGlobals);
  }

  /**
   * @dev Opens the short position with 0 amount and 0 collateral.
   *
   * @param exchangeGlobals The ExchangeGlobals.
   */
  function openShort(ILyraGlobals.ExchangeGlobals memory exchangeGlobals) internal reentrancyGuard {
    uint minCollateral = exchangeGlobals.short.minCollateral();

    quoteAsset.approve(address(exchangeGlobals.short), type(uint).max);

    // Open a short with 0 collateral and 0 amount, to get a static Id for this contract to use.
    liquidityPool.transferQuoteToHedge(exchangeGlobals, minCollateral);
    // This will revert if the LP did not provide enough quote
    shortId = exchangeGlobals.short.open(minCollateral, 0, exchangeGlobals.baseKey);
    sendAllQuoteToLP();
    emit ShortInitialized(shortId);
    emit ShortSetTo(0, 0, 0, minCollateral);
  }

  /**
   * @dev Retrieves the netDelta from the OptionGreekCache and updates the hedge position.
   */
  function hedgeDelta() external override reentrancyGuard {
    require(shortingInitialized, "shorting must be initialized");

    // Update any stale boards to get an accurate netDelta value
    int netOptionDelta = optionGreekCache.getGlobalNetDelta();

    // Subtract the baseAsset balance from netDelta, to account for the variance from collateral held by LP.
    int expectedHedge = netOptionDelta.sub(int(baseAsset.balanceOf(address(liquidityPool))));

    // Bypass interactionDelay if we want to set netDelta to 0
    if (expectedHedge != 0 && interactionDelay != 0) {
      require(lastInteraction.add(interactionDelay) <= block.timestamp, "Interaction delay");
    }

    _hedgeDelta(expectedHedge);
  }

  /**
   * @dev Updates the hedge position. This may need to be called several times as it will only do one step at a time
   * I.e. to go from a long position to asho
   *
   * @param expectedHedge The expected final hedge value.
   */
  function _hedgeDelta(int expectedHedge) internal {
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.ALL);
    uint longBalance = baseAsset.balanceOf(address(this));
    (uint shortBalance, uint collateral) = getShortPosition(exchangeGlobals.short);

    int oldHedge = longBalance != 0 ? int(longBalance) : -int(shortBalance);
    int newHedge = updatePosition(exchangeGlobals, longBalance, shortBalance, collateral, expectedHedge);

    emit PositionUpdated(oldHedge, newHedge, expectedHedge);

    if (newHedge != oldHedge) {
      lastInteraction = block.timestamp;
    }

    // All proceeds should be sent back to the LP
    sendAllQuoteToLP();
  }

  /**
   * @dev Updates the hedge contract based off a new netDelta.
   *
   * @param exchangeGlobals Globals related to exchanging synths
   * @param longBalance The current long base balance of the PoolHedger
   * @param shortBalance The current short balance of the PoolHedger
   * @param collateral The current quote collateral for shorts of the PoolHedger
   * @param expectedHedge The amount of baseAsset exposure needed to hedge delta risk.
   */
  function updatePosition(
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals,
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
        return -int(setShortTo(exchangeGlobals, 0, shortBalance, collateral));
      }

      if (expectedLong > longBalance) {
        // Must buy baseAsset
        return int(increaseLong(exchangeGlobals, expectedLong.sub(longBalance), longBalance));
      } else if (longBalance > expectedLong) {
        // Must sell baseAsset
        return int(decreaseLong(exchangeGlobals, longBalance.sub(expectedLong), longBalance));
      }
      return int(longBalance);
    } else {
      // we need to be net short the asset.
      uint expectedShort = uint(-expectedHedge);
      // if we have any of the spot left, sell it all.
      if (longBalance > 0) {
        return int(decreaseLong(exchangeGlobals, longBalance, longBalance));
      }
      return -int(setShortTo(exchangeGlobals, expectedShort, shortBalance, collateral));
    }
  }

  /**
   * @dev Returns short balance and collateral.
   *
   * @param short The short contract.
   */
  function getShortPosition(ICollateralShort short) public view override returns (uint shortBalance, uint collateral) {
    if (!shortingInitialized) {
      return (0, 0);
    }
    return short.getShortAndCollateral(address(this), shortId);
  }

  /**
   * @dev Returns the current hedged netDelta position
   */
  function getCurrentHedgedNetDelta() external view override returns (int) {
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals =
      globals.getExchangeGlobals(address(optionMarket), ILyraGlobals.ExchangeType.ALL);

    uint longBalance = baseAsset.balanceOf(address(this));
    if (longBalance > 0) {
      return int(longBalance);
    }
    (uint shortBalance, ) = getShortPosition(exchangeGlobals.short);
    return -int(shortBalance);
  }

  /**
   * @dev Returns the value of the long/short position held by the PoolHedger.
   *
   * @param short The short contract.
   * @param spotPrice The price of the baseAsset.
   */
  function getValueQuote(ICollateralShort short, uint spotPrice) public view override returns (uint value) {
    uint baseBalance = baseAsset.balanceOf(address(this));
    if (baseBalance > 0) {
      return baseBalance.multiplyDecimal(spotPrice);
    } else {
      (uint shortBalance, uint collateral) = getShortPosition(short);
      uint shortOwed = shortBalance.multiplyDecimal(spotPrice);
      if (collateral > shortOwed) {
        return (collateral - shortOwed);
      }
      // If collateral value is less than the short, we want the short to be liquidated as we'd be paying more quote
      // to free the collateral than we'd get back (+ exchange fees).
      // This also handles the case where the contract is at a 0 position
      return 0;
    }
  }

  /**
   * @dev Increases the long exposure of the hedge contract.
   *
   * @param exchangeGlobals The ExchangeGlobals.
   * @param amount The amount of baseAsset to purchase.
   */
  function increaseLong(
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals,
    uint amount,
    uint currentBalance
  ) internal returns (uint newBalance) {
    uint base = amount.divideDecimal(SafeDecimalMath.UNIT.sub(exchangeGlobals.quoteBaseFeeRate));
    uint purchaseAmount = base.multiplyDecimal(exchangeGlobals.spotPrice);
    uint receivedQuote = liquidityPool.transferQuoteToHedge(exchangeGlobals, purchaseAmount);

    // We buy as much as is possible with the quote given
    if (receivedQuote < purchaseAmount) {
      purchaseAmount = receivedQuote;
    }
    // buy the base asset.
    uint receivedBase =
      exchangeGlobals.synthetix.exchange(exchangeGlobals.quoteKey, purchaseAmount, exchangeGlobals.baseKey);
    require(receivedBase > 0, "increaseLong: Received 0 from exchange");
    emit QuoteExchanged(purchaseAmount, receivedBase);
    newBalance = baseAsset.balanceOf(address(this));
    emit LongSetTo(currentBalance, newBalance);
  }

  /**
   * @dev Decreases the long exposure of the hedge contract.
   *
   * @param exchangeGlobals The ExchangeGlobals.
   * @param amount The amount of baseAsset to sell.
   */
  function decreaseLong(
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals,
    uint amount,
    uint currentBalance
  ) internal returns (uint newBalance) {
    // assumption here is that we have enough to sell, will throw if not
    uint received = exchangeGlobals.synthetix.exchange(exchangeGlobals.baseKey, amount, exchangeGlobals.quoteKey);
    require(received > 0, "decreaseLong: Received 0 from exchange");
    emit BaseExchanged(amount, received);
    newBalance = baseAsset.balanceOf(address(this));
    emit LongSetTo(currentBalance, newBalance);
  }

  /**
   * @dev Increases or decreases short to get to this amount of shorted baseAsset at the shortBuffer ratio. Note,
   * hedge() may have to be called a second time to re-balance collateral after calling `repayWithCollateral`. As that
   * disregards the desired ratio.
   *
   * @param exchangeGlobals The ExchangeGlobals.
   * @param desiredShort The desired short balance.
   * @param currentShort Trusted value for current short amount, in base.
   * @param currentCollateral Trusted value for current amount of collateral, in quote.
   */
  function setShortTo(
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals,
    uint desiredShort,
    uint currentShort,
    uint currentCollateral
  ) internal returns (uint newShortAmount) {
    require(shortingInitialized, "shorting not initialized");

    uint desiredCollateral = desiredShort.multiplyDecimal(exchangeGlobals.spotPrice).multiplyDecimal(shortBuffer);

    if (desiredShort < currentShort) {
      (uint newShort, uint newCollateral) =
        exchangeGlobals.short.repayWithCollateral(shortId, currentShort.sub(desiredShort));
      emit ShortSetTo(currentShort, newShort, currentCollateral, newCollateral);
      return newShort;
    }

    if (desiredCollateral > currentCollateral) {
      uint received = liquidityPool.transferQuoteToHedge(exchangeGlobals, desiredCollateral.sub(currentCollateral));
      if (received > 0) {
        (uint newShort, uint newCollateral) = exchangeGlobals.short.deposit(address(this), shortId, received);
        emit ShortSetTo(currentShort, newShort, currentCollateral, newCollateral);
        return newShort;
      }
    }

    if (currentCollateral > desiredCollateral) {
      (uint newShort, uint newCollateral) =
        exchangeGlobals.short.withdraw(shortId, currentCollateral.sub(desiredCollateral));
      emit ShortSetTo(currentShort, newShort, currentCollateral, newCollateral);
      return newShort;
    }

    if (currentShort < desiredShort) {
      uint shortAmount = currentCollateral.divideDecimal(exchangeGlobals.spotPrice).divideDecimal(shortBuffer);
      if (shortAmount > currentShort) {
        (uint newShort, uint newCollateral) = exchangeGlobals.short.draw(shortId, shortAmount.sub(currentShort));
        emit ShortSetTo(currentShort, newShort, currentCollateral, newCollateral);
        return newShort;
      }
    }

    // Nothing needs to be changed
    emit ShortSetTo(currentShort, currentShort, currentCollateral, currentCollateral);
    return currentShort;
  }

  /**
   * @dev Sends all quote asset deposited in this contract to the `LiquidityPool`.
   */
  function sendAllQuoteToLP() internal {
    uint quoteBal = quoteAsset.balanceOf(address(this));
    require(quoteAsset.transfer(address(liquidityPool), quoteBal), "quote transfer failed");
    emit QuoteReturnedToLP(quoteBal);
  }

  modifier reentrancyGuard virtual {
    counter = counter.add(1); // counter adds 1 to the existing 1 so becomes 2
    uint guard = counter; // assigns 2 to the "guard" variable
    _;
    require(guard == counter, "reentrancy");
  }

  /// Events
  /**
   * @dev Emitted when the short buffer ratio is set.
   */
  event ShortBufferSet(uint newShortBuffer);
  /**
   * @dev Emitted when the interaction delay is set.
   */
  event InteractionDelaySet(uint newInteractionDelay);
  /**
   * @dev Emitted when the short is initialized.
   */
  event ShortInitialized(uint shortId);
  /**
   * @dev Emitted when the hedge position is updated.
   */
  event PositionUpdated(int oldNetDelta, int currentNetDelta, int expectedNetDelta);
  /**
   * @dev Emitted when base is sold
   */
  event BaseExchanged(uint baseAmount, uint quoteReceived);
  /**
   * @dev Emitted when base is sold
   */
  event QuoteExchanged(uint quoteAmount, uint baseReceived);
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
}
