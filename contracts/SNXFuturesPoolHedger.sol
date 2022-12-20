//SPDX-License-Identifier: ISC

//
//  ___    _____     _   _  _____  _____     ___    ___    _   _  _  ___    _       _
// (  _`\ (  _  )   ( ) ( )(  _  )(_   _)   |  _`\ (  _`\ ( ) ( )(_)(  _`\ ( )  _  ( )
// | | ) || ( ) |   | `\| || ( ) |  | |     | (_) )| (_(_)| | | || || (_(_)| | ( ) | |
// | | | )| | | |   | , ` || | | |  | |     | ,  / |  _)_ | | | || ||  _)_ | | | | | |
// | |_) || (_) |   | |`\ || (_) |  | |     | |\ \ | (_( )| \_/ || || (_( )| (_/ \_) |
// (____/'(_____)   (_) (_)(_____)  (_)     (_) (_)(____/'`\___/'(_)(____/'`\___x___/'
//

pragma solidity 0.8.16;

// Libraries
import "./synthetix/DecimalMath.sol";
import "openzeppelin-contracts-4.4.1/utils/math/SafeCast.sol";

// Inherited
import "./synthetix/Owned.sol";
import "./libraries/SimpleInitializable.sol";
import "./libraries/PoolHedger.sol";
import "openzeppelin-contracts-4.4.1/security/ReentrancyGuard.sol";

// Interfaces
import "openzeppelin-contracts-4.4.1/token/ERC20/ERC20.sol";
import "./interfaces/IFuturesMarket.sol";
import "./interfaces/IFuturesMarketSettings.sol";
import "./LiquidityPool.sol";
import "./interfaces/ISynthetix.sol";
import "./interfaces/ICollateralShort.sol";
import "./SynthetixAdapter.sol";
import "./OptionMarket.sol";
import "./OptionGreekCache.sol";
import "./interfaces/IFuturesMarketManager.sol";

/**
 * @title SNXFuturesPoolHedger
 * @author Lyra
 */
contract SNXFuturesPoolHedger is PoolHedger, Owned, SimpleInitializable, ReentrancyGuard {
  using DecimalMath for uint;

  struct FuturesPoolHedgerParameters {
    uint maximumDelta; // the greatest magnitude of delta that the pool can take
    int maximumFundingRatePerDelta; // the maximum funding rate per delta that the futures pool hedger is willing to pay.
    uint deltaThreshold; // Bypass interaction delay if delate is outside of a certain range.
    uint marketDepthBuffer; // percentage buffer. toBN(1.1) -> 10% buffer.
  }

  uint UNIT = 1e18; // For decimal math.

  SynthetixAdapter internal synthetixAdapter;
  OptionMarket internal optionMarket;
  OptionGreekCache internal optionGreekCache;
  ERC20 internal quoteAsset;

  IFuturesMarket public futuresMarket;
  IFuturesMarketSettings public futuresMarketSettings;
  IFuturesMarketManager public futuresMarketManager;

  // @dev Tracking code for Synthetix-tracking purposes
  bytes32 constant trackingCode = bytes32("LYRA");
  bytes32 constant FUTURES_MARKET_MANAGER = bytes32("FuturesMarketManager"); // one to many markets
  bytes32 constant FUTURES_CONTRACT_BASE = bytes32("FuturesMarket"); // the interface for the market
  bytes32 constant FUTURES_SETTINGS_CONTRACT = bytes32("FuturesMarketSettings"); // the futuresMarketSettings contract that has a one to many with that market

  // e.g. sETH
  bytes32 public marketKey;

  // Represented by a number that has 18 decimals of precision (1e18 unit), like the Synthetix contracts
  uint public targetLeverage;

  // FuturesMarket Parameters
  // used for managing the exposure and minimum liquidity of the hedger.
  FuturesPoolHedgerParameters public futuresPoolHedgerParams;

  ///////////
  // Setup //
  ///////////

  constructor() Owned() {}

  /**
   * @dev Initialize the contract.
   *
   * @param _synthetixAdapter SynthetixAdapter address
   * @param _optionMarket OptionMarket address
   * @param _liquidityPool LiquidityPool address
   * @param _quoteAsset Quote asset address
   * @param _futuresMarketName Market name; e.g. ETH -- Markets for the FuturesMarket contract all have different deployments and the SNX Resolver resolves
   *          the addresses by their name, prefixed by FuturesMarket (FuturesMarketETH, for example). This will concatenate the market onto the base name.
   */
  function init(
    SynthetixAdapter _synthetixAdapter,
    OptionMarket _optionMarket,
    OptionGreekCache _optionGreekCache,
    LiquidityPool _liquidityPool,
    ERC20 _quoteAsset,
    string memory _futuresMarketName
  ) external onlyOwner initializer {
    synthetixAdapter = _synthetixAdapter;
    optionMarket = _optionMarket;
    optionGreekCache = _optionGreekCache;
    liquidityPool = _liquidityPool;
    quoteAsset = _quoteAsset;
    futuresMarketSettings = IFuturesMarketSettings(
      synthetixAdapter.addressResolver().getAddress(FUTURES_SETTINGS_CONTRACT)
    );

    marketKey = bytes32(bytes(_futuresMarketName));
    synthetixAdapter.delegateApprovals().approveExchangeOnBehalf(address(synthetixAdapter));
    futuresMarketManager = IFuturesMarketManager(synthetixAdapter.addressResolver().getAddress(FUTURES_MARKET_MANAGER)); // e.g. FuturesMarketETH

    futuresMarket = IFuturesMarket(futuresMarketManager.marketForKey(marketKey));
    // TODO: removed for integration testing
    // quoteAsset.approve(address(futuresMarket), type(uint).max);
    targetLeverage = UNIT;
  }

  ///////////
  // Admin //
  ///////////

  /**
   * @dev Update pool hedger parameters.
   */
  function setPoolHedgerParams(PoolHedgerParameters memory _poolHedgerParams) external onlyOwner {
    _setPoolHedgerParams(_poolHedgerParams);
  }

  /**
   * @dev updates the futures hedger parameters, these parameters are not applicable to the shortPoolHedger
   */
  function setFuturesPoolHedgerParams(FuturesPoolHedgerParameters memory _futuresPoolHedgerParams) external onlyOwner {
    futuresPoolHedgerParams = _futuresPoolHedgerParams;
  }

  /* @dev Sets a new max leverage for the contracts.
   *
   * @param _maxLeverage sets the leverage if within the bounds
   */
  function setMaxLeverage(uint _maxLeverage) external onlyOwner {
    if (_maxLeverage == 0 || _maxLeverage > futuresMarketSettings.maxLeverage(marketKey)) {
      revert InvalidMaxLeverage(address(this), _maxLeverage);
    }
    targetLeverage = _maxLeverage;
    emit MaxLeverageSet(_maxLeverage);
  }

  /// @dev update the futuresMarket address based on the synthetix addressResolver
  function updateFuturesMarketAddress() external {
    futuresMarketManager = IFuturesMarketManager(synthetixAdapter.addressResolver().getAddress(FUTURES_MARKET_MANAGER));
    futuresMarket = IFuturesMarket(futuresMarketManager.marketForKey(bytes32(marketKey)));
    emit FuturesMarketManagerSet(futuresMarketManager);
    emit FuturesMarketSet(futuresMarket);
  }

  /////////////
  // Getters //
  /////////////

  /**
   * @dev Returns the current hedged netDelta position.
   */
  function _getCurrentHedgedNetDelta() internal pure returns (int) {
    return 0;
    // (, , , , int128 size) = futuresMarket.positions(address(this));
    // return size;
  }

  function getCurrentHedgedNetDelta() external pure override returns (int) {
    return _getCurrentHedgedNetDelta();
  }

  /// @notice Returns pending delta hedge liquidity and used delta hedge liquidity
  /// @dev include funds potentially transferred to the contract
  function getHedgingLiquidity(
    uint spotPrice
  ) external view override returns (uint pendingDeltaLiquidity, uint usedDeltaLiquidity) {
    int hedgedPositionSize = _getCurrentHedgedNetDelta();

    if (hedgedPositionSize == 0) {
      usedDeltaLiquidity = 0;
    } else {
      (, , usedDeltaLiquidity, , ) = futuresMarket.positions(address(this));
    }

    int expectedHedge = _getCappedExpectedHedge() - hedgedPositionSize;
    pendingDeltaLiquidity = Math.abs(expectedHedge).multiplyDecimal(spotPrice).divideDecimal(targetLeverage);
  }

  /**
   * @dev View that returns the position
   */
  function getPositions()
    public
    view
    returns (uint64 id, uint64 fundingIndex, uint128 margin, uint128 lastPrice, int128 size)
  {
    return _getPositions();
  }

  function _getPositions()
    internal
    view
    returns (uint64 id, uint64 fundingIndex, uint128 margin, uint128 lastPrice, int128 size)
  {
    return futuresMarket.positions(address(this));
  }

  //////////////
  // External //
  //////////////

  /**
   * @dev Retrieves the netDelta from the OptionGreekCache and updates the hedge position based off base
   *      asset balance of the liquidityPool minus netDelta (from OptionGreekCache)
   */
  function hedgeDelta() external payable override nonReentrant {
    // Subtract the baseAsset balance from netDelta, to account for the variance from collateral held by LP.
    int expectedHedge = _getCappedExpectedHedge();
    // Bypass interactionDelay if we want to set netDelta to 0
    // TODO: get rid of nested ifs
    if (expectedHedge != 0 && poolHedgerParams.interactionDelay != 0) {
      if (
        lastInteraction + poolHedgerParams.interactionDelay > block.timestamp &&
        Math.abs(expectedHedge) < futuresPoolHedgerParams.deltaThreshold
      ) {
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
   * @dev Restricted to only owner as there is potential for an attack when updating collateral over and over.
   */
  function updateCollateral() external payable override nonReentrant onlyOwner {
    // needs to look at the current collat and either return to lp pool if it has too much
    // needs to get more collat and add it to the margin acount.
    uint spotPrice = _getPrice();
    (uint margin, bool invalid) = futuresMarket.remainingMargin(address(this));

    if (invalid) {
      revert CollateralUpdateError(margin);
    }

    uint newCollateral = _updateCollateral(spotPrice, margin, _getCurrentHedgedNetDelta());
    _sendAllQuoteToLP();
    emit CollateralUpdated(newCollateral, margin);
  }

  function canHedge(uint, bool deltaIncrease) external view override returns (bool) {
    int expectedHedge = _getCappedExpectedHedge();
    int currentHedge = _getCurrentHedgedNetDelta();

    bool upExposure = false;
    // if pool is short and the delta is decreasing then flag increase
    if (!deltaIncrease && expectedHedge <= 0) {
      upExposure = true;
    } else if (deltaIncrease && expectedHedge >= 0) {
      upExposure = true;
    }

    // if this is beyond some number and the trade continues to carry pass the value block the delta
    if (Math.abs(expectedHedge + currentHedge) > futuresPoolHedgerParams.maximumDelta && upExposure) {
      return false;
    }

    // Checks that if the expected hedge is increasing the deltas owned by the pool SNX can take on the risk
    if (Math.abs(expectedHedge) > Math.abs(currentHedge) && upExposure) {
      uint spot = _getPrice();
      uint maxSize = futuresMarketSettings.maxMarketValueUSD(marketKey);
      int marketSkew = futuresMarket.marketSkew();
      // need to calculate if the newMarketSize is bigger than the allowed maximum size.
      // maxMarketValueUSD(marketKey) / price - market.marketSkew
      // returns remaining size.
      int remaining = SafeCast.toInt256(maxSize.divideDecimal(spot)) - marketSkew;
      if (Math.abs(remaining) < Math.abs(expectedHedge).multiplyDecimal(futuresPoolHedgerParams.marketDepthBuffer)) {
        return false;
      }
    }

    // checks for funding rate if it exceeds a configured maximum acceptable funding rate.
    // If this is positive, shorts pay longs, if it is negative, longs pay shorts.
    int fundingRate = futuresMarket.currentFundingRate();

    // need to consider if shorts are paying longs and the pool is going long or vice versa.
    if ((fundingRate > 0 && expectedHedge < 0) || (fundingRate < 0 && expectedHedge > 0)) {
      int fundingPerDelta = (expectedHedge / futuresMarket.currentFundingRate()) * 1e18; // as the ints dont have .divideDecimal()
      if (fundingPerDelta > futuresPoolHedgerParams.maximumFundingRatePerDelta && Math.abs(fundingPerDelta) > 0) {
        return false;
      }
    }

    return true;
  }

  //////////////
  // Internal //
  //////////////

  function _updateCollateral(uint spotPrice, uint currentCollateral, int size) internal returns (uint) {
    uint desiredCollateral = Math.abs(size).multiplyDecimal(spotPrice).divideDecimal(targetLeverage);

    if (currentCollateral < desiredCollateral) {
      uint received = liquidityPool.transferQuoteToHedge(desiredCollateral - currentCollateral);
      if (received > 0) {
        futuresMarket.transferMargin(int(received));
      }
    } else if (currentCollateral > desiredCollateral) {
      futuresMarket.transferMargin(int(desiredCollateral) - int(currentCollateral));
    }

    // margin within the account to cover the delta at that leverage
    (, , uint newCollateral, , ) = futuresMarket.positions(address(this));
    return newCollateral;
  }

  /**
   * @dev Updates the hedge position.
   *
   * @param expectedHedge The expected final hedge value.
   */
  function _hedgeDelta(int expectedHedge) internal {
    int currHedgedNetDelta = _getCurrentHedgedNetDelta();

    if (expectedHedge == currHedgedNetDelta) {
      return;
    }

    int modifiedPositionAmount = expectedHedge - currHedgedNetDelta;
    int notional; // margin * leverage give the notional amount of margin required.

    if (modifiedPositionAmount < 0) {
      notional = -SafeCast.toInt256(Math.abs(modifiedPositionAmount).multiplyDecimal(targetLeverage));
    } else {
      notional = SafeCast.toInt256(Math.abs(modifiedPositionAmount).multiplyDecimal(targetLeverage));
    }

    (uint feeDollars, ) = futuresMarket.orderFee(notional);
    uint spot = _getPrice();
    uint requiredMargin = Math.abs(expectedHedge).multiplyDecimal(spot).divideDecimal(targetLeverage) + feeDollars;

    // two cases either we increase the delta exposure or decrease and need to refund quote
    if (Math.abs(expectedHedge) >= Math.abs(currHedgedNetDelta)) {
      // TODO: add parameter to ensure fees are within certain bounds, percentage fee per delta
      // absolute number  of deltas increases

      uint minMargin = futuresMarketSettings.minInitialMargin();
      if (requiredMargin < minMargin) {
        requiredMargin = minMargin;
      }

      (, , uint128 curMargin, , ) = _getPositions();

      // check this line here as it may be causing problems
      if (requiredMargin > curMargin) {
        liquidityPool.transferQuoteToHedge(requiredMargin - curMargin);
        futuresMarket.transferMargin(SafeCast.toInt256(requiredMargin - curMargin));
      }

      futuresMarket.modifyPosition(modifiedPositionAmount);
    } else if (expectedHedge == 0) {
      // hold 0 deltas edge case
      futuresMarket.closePosition();
      futuresMarket.withdrawAllMargin();
      _sendAllQuoteToLP();
    } else {
      // remove margin

      futuresMarket.modifyPosition(modifiedPositionAmount); // fee issues here somewhere.
      (, , uint128 curMargin, , ) = _getPositions();

      // 50 dollars should almost always remain in the pool.
      // currMargin is larger than required Margin.
      int spare = SafeCast.toInt256(requiredMargin) - SafeCast.toInt256(curMargin);
      uint minMargin = futuresMarketSettings.minInitialMargin();
      if (requiredMargin <= minMargin) {
        // pad out spare the minimum margin required.
        spare = spare + (SafeCast.toInt256(minMargin - requiredMargin));
      }

      futuresMarket.transferMargin(spare); // reduces the margin as less is required due to reduce deltas.
      _sendAllQuoteToLP(); // returns excess quote to lp.
    }

    if (modifiedPositionAmount != 0 && modifiedPositionAmount != currHedgedNetDelta) {
      lastInteraction = block.timestamp;
    }

    emit PositionUpdated(currHedgedNetDelta, modifiedPositionAmount, expectedHedge);
  }

  /**
   * @dev Calculates the expected delta hedge that hedger must perform and
   * adjusts the result down to the hedgeCap param if needed.
   */
  function _getCappedExpectedHedge() internal view returns (int cappedExpectedHedge) {
    // Update any stale boards to get an accurate netDelta value
    // from the traders perspective - DOMROM
    int expectedHedge = optionGreekCache.getGlobalNetDelta();
    bool exceedsCap = Math.abs(expectedHedge) > poolHedgerParams.hedgeCap;

    // Cap expected hedge & based on maxValueUSD
    if (expectedHedge < 0 && exceedsCap) {
      cappedExpectedHedge = -SafeCast.toInt256(poolHedgerParams.hedgeCap);
    } else if (expectedHedge >= 0 && exceedsCap) {
      cappedExpectedHedge = SafeCast.toInt256(poolHedgerParams.hedgeCap);
    } else {
      cappedExpectedHedge = expectedHedge;
    }
  }

  /**
   * @dev View to return the expected delta hedge that the hedger must perfom.
   */
  function getCappedExpectedHedge() public view override returns (int) {
    return _getCappedExpectedHedge();
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

  function _getPrice() internal view returns (uint) {
    // get the lean of the pool??
    return synthetixAdapter.getSpotPriceForMarket(address(optionMarket), BaseExchangeAdapter.PriceType.REFERENCE);
  }

  ////////////
  // Events //
  ////////////
  /**
   * @dev Emitted when the FuturesMarket address is updated
   */
  event FuturesMarketSet(IFuturesMarket futuresMarket);
  /**
   * @dev Emitted when the futuresMarketManger address is updated
   */
  event FuturesMarketManagerSet(IFuturesMarketManager futuresMarketManager);
  /**
   * @dev Emitted when the max leverage parameter is updated.
   */
  event MaxLeverageSet(uint newShortBuffer);
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
  /**
   * @dev Emitted when delegation approvals change
   */
  event ApprovalsUpdated(bool state);
  /**
   * @dev Emitted when delegation approvals change
   */
  event CollateralUpdated(uint newCollat, uint oldCollat);

  ////////////
  // Errors //
  ////////////
  // Admin
  error InvalidMaxLeverage(address thrower, uint newMaxLeverage);

  error NotEnoughQuoteForMinCollateral(address thrower, uint quoteReceived, uint minCollateral);

  // Hedging
  error InteractionDelayNotExpired(address thrower, uint lastInteraction, uint interactionDelta, uint currentTime);

  // Token transfers
  error QuoteApprovalFailure(address thrower, address approvee, uint amount);
  error QuoteTransferFailed(address thrower, address from, address to, uint amount);

  error MarginError();

  error CollateralUpdateError(uint margin);
}
