//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

// Libraries
import "./libraries/Math.sol";

// Inherited
import "./synthetix/Owned.sol";
import "./libraries/SimpleInitializable.sol";
import "./libraries/PoolHedger.sol";
import "openzeppelin-contracts-4.4.1/security/ReentrancyGuard.sol";

// Interfaces
import "./interfaces/gmx/IPositionRouter.sol";
import "./interfaces/gmx/IPositionRouterCallbackReceiver.sol";
import "./interfaces/gmx/IRouter.sol";
import "./interfaces/gmx/IVault.sol";
import "./interfaces/IERC20Decimals.sol";
import "./OptionGreekCache.sol";
import "./LiquidityPool.sol";

/**
 * @title GMXFuturesPoolHedger
 * @author Lyra
 * @dev This assumes the quoteAsset is a GMX stable token. Important detail for fetching positions.
 */
contract GMXFuturesPoolHedger is
  PoolHedger,
  Owned,
  SimpleInitializable,
  ReentrancyGuard,
  IPositionRouterCallbackReceiver
{
  using DecimalMath for uint;
  using SignedDecimalMath for int;
  using SafeCast for uint;
  using SafeCast for int;

  uint256 public constant GMX_PRICE_PRECISION = 10 ** 30;
  uint256 public constant BASIS_POINTS_DIVISOR = 10000;

  struct FuturesPoolHedgerParameters {
    uint acceptableSpotSlippage;
    uint deltaThreshold; // Bypass interaction delay if delta is outside of a certain range.
    uint marketDepthBuffer; // delta buffer. 50 -> 50 eth buffer
    uint targetLeverage; // target leverage ratio
    uint leverageBuffer; // leverage tolerance before allowing collateral updates
    uint minCancelDelay; // seconds until an order can be cancelled
    bool vaultLiquidityCheckEnabled; // if true, block opening trades if the vault is low on liquidity
  }

  // Note: whenever these values are used, they have already been normalised to 1e18
  // exception: entryFundingRate
  struct PositionDetails {
    uint256 size;
    uint256 collateral;
    uint256 averagePrice;
    uint256 entryFundingRate;
    // int256 realisedPnl;
    int256 unrealisedPnl;
    uint256 lastIncreasedTime;
    bool isLong;
  }

  struct CurrentPositions {
    PositionDetails longPosition;
    PositionDetails shortPosition;
    uint amountOpen;
    bool isLong; // only valid if amountOpen == 1
  }

  OptionGreekCache public greekCache;
  /// @dev Used as a key for the exchangeAdapter to fetch spot price
  address public optionMarket;

  /// @dev GMX adaptor
  BaseExchangeAdapter public exchangeAdapter;

  /// @dev approve target for GMX position router
  IRouter public router;

  /// @dev GMX position router
  IPositionRouter public positionRouter;

  /// @dev GMX vault
  IVault public vault;

  /// @dev quote asset
  IERC20Decimals public quoteAsset;

  IERC20Decimals public baseAsset;

  // Parameters for managing the exposure and minimum liquidity of the hedger
  FuturesPoolHedgerParameters public futuresPoolHedgerParams;

  bytes32 public referralCode = bytes32("LYRA");

  /// @dev key map to a GMX position. Could be key to increase or decrease position
  bytes32 public pendingOrderKey;

  /// @dev the last timestamp that we post an order. (Timestamp that pendingOrderKey got updated)
  uint public lastOrderTimestamp;

  constructor() Owned() {}

  function init(
    LiquidityPool _liquidityPool,
    address _optionMarket,
    OptionGreekCache _greekCache,
    BaseExchangeAdapter _exchangeAdapter,
    IPositionRouter _positionRouter,
    IRouter _router,
    IERC20Decimals _quoteAsset,
    IERC20Decimals _baseAsset
  ) external onlyOwner initializer {
    liquidityPool = _liquidityPool;
    optionMarket = _optionMarket;
    greekCache = _greekCache;
    exchangeAdapter = _exchangeAdapter;
    positionRouter = _positionRouter;
    router = _router;
    quoteAsset = _quoteAsset;
    baseAsset = _baseAsset;

    vault = IVault(positionRouter.vault());

    // approve position router as a plugin to enable opening positions
    _router.approvePlugin(address(positionRouter));
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
   * @param _futuresPoolHedgerParams targetLeverage needs to be higher than 1 to avoid dust error
   */
  function setFuturesPoolHedgerParams(FuturesPoolHedgerParameters memory _futuresPoolHedgerParams) external onlyOwner {
    futuresPoolHedgerParams = _futuresPoolHedgerParams;
    emit MaxLeverageSet(address(this), futuresPoolHedgerParams.targetLeverage);
  }

  function setPositionRouter(IPositionRouter _positionRouter) external onlyOwner {
    positionRouter = _positionRouter;
    emit PositionRouterSet(address(this), _positionRouter);
  }

  /**
   * @notice send eth balanc of the contract to someone else.
   * @dev the contract need to keep some eth to pay GMX fee
   */
  function recoverEth(address payable receiver) external onlyOwner {
    Address.sendValue(receiver, address(this).balance);
  }

  function setReferralCode(bytes32 _referralCode) external onlyOwner {
    referralCode = _referralCode;
  }

  /**
   * @dev Sends all quote and base asset in this contract to the `LiquidityPool`. Helps in case of trapped funds.
   */
  function sendAllFundsToLP() external {
    uint quoteBal = quoteAsset.balanceOf(address(this));
    if (quoteBal > 0) {
      if (!quoteAsset.transfer(address(liquidityPool), quoteBal)) {
        revert AssetTransferFailed(address(this), quoteAsset, quoteBal, address(liquidityPool));
      }
      emit QuoteReturnedToLP(address(this), quoteBal);
    }
    uint baseBal = baseAsset.balanceOf(address(this));
    if (baseBal > 0) {
      if (!baseAsset.transfer(address(liquidityPool), baseBal)) {
        revert AssetTransferFailed(address(this), baseAsset, baseBal, address(liquidityPool));
      }
      emit BaseReturnedToLP(address(this), baseBal);
    }
  }

  /// @notice Allow incorrectly sent funds to be recovered
  function recoverFunds(IERC20Decimals token, address recipient) external onlyOwner {
    if (token == quoteAsset || token == baseAsset) {
      revert OwnerCannotTransferQuoteBase(address(this));
    }
    token.transfer(recipient, token.balanceOf(address(this)));
  }

  //////////////////////////////////
  // Overrides/Required functions //
  //////////////////////////////////

  /**
   * @dev gets the current size of the hedged position.
   */
  function getCurrentHedgedNetDelta() external view virtual override returns (int) {
    // the first index is the size of the position
    CurrentPositions memory positions = _getPositions();
    return _getCurrentHedgedNetDelta(positions);
  }

  /**
   * @dev gets the current size of the hedged position. Use spot price from adaptor.
   */
  function _getCurrentHedgedNetDelta(CurrentPositions memory positions) internal view virtual returns (int) {
    if (positions.amountOpen == 0) {
      return 0;
    }
    uint spot = _getSpotPrice();
    return _getCurrentHedgedNetDeltaWithSpot(positions, spot);
  }

  /**
   * @dev gets the current size of the hedged position. Use spot price from input
   */
  function _getCurrentHedgedNetDeltaWithSpot(CurrentPositions memory positions, uint spot) internal pure returns (int) {
    if (positions.amountOpen == 0) {
      return 0;
    }

    // we shouldn't have both long and short positions open at the same time.
    // get the larger of long or short.
    int largestPosition = 0;

    if (positions.longPosition.size > 0) {
      largestPosition = positions.longPosition.size.toInt256();
    }
    if (positions.shortPosition.size > positions.longPosition.size) {
      largestPosition = -positions.shortPosition.size.toInt256();
    }

    return largestPosition.divideDecimal(spot.toInt256());
  }

  /**
   * @notice Returns pending delta hedge liquidity and used delta hedge liquidity
   * @dev include funds potentially transferred to the contract
   * @return pendingDeltaLiquidity amount USD needed to hedge. outstanding order is NOT included
   * @return usedDeltaLiquidity amount USD already used to hedge. outstanding order is NOT included
   **/
  function getHedgingLiquidity(
    uint spotPrice
  ) external view override returns (uint pendingDeltaLiquidity, uint usedDeltaLiquidity) {
    CurrentPositions memory currentPositions = _getPositions();

    usedDeltaLiquidity = _getAllPositionsValue(currentPositions);
    // pass in estimate spot price
    uint absCurrentHedgedDelta = Math.abs(_getCurrentHedgedNetDeltaWithSpot(currentPositions, spotPrice));
    uint absExpectedHedge = Math.abs(_getCappedExpectedHedge());

    if (absCurrentHedgedDelta > absExpectedHedge) {
      return (0, usedDeltaLiquidity);
    }

    pendingDeltaLiquidity = (absExpectedHedge - absCurrentHedgedDelta).multiplyDecimal(spotPrice).divideDecimal(
      futuresPoolHedgerParams.targetLeverage
    );

    return (pendingDeltaLiquidity, usedDeltaLiquidity);
  }

  /**
   * @dev return the expected delta hedge that the hedger must perfom.
   * @return amount of delta to be hedged, with 18 decimals
   */
  function getCappedExpectedHedge() public view override returns (int) {
    return _getCappedExpectedHedge();
  }

  /**
   * @dev attempts to hedge the current delta of the pool by creating a pending order
   */
  function hedgeDelta() external payable virtual override nonReentrant {
    CurrentPositions memory positions = _getPositions();
    int currentHedgedDelta = _getCurrentHedgedNetDelta(positions);
    int expectedHedge = _getCappedExpectedHedge();

    // Bypass interactionDelay if we want to set hedge to exactly 0
    if (
      expectedHedge != 0 &&
      lastInteraction + poolHedgerParams.interactionDelay > block.timestamp &&
      Math.abs(expectedHedge - currentHedgedDelta) < futuresPoolHedgerParams.deltaThreshold
    ) {
      revert InteractionDelayNotExpired(
        address(this),
        lastInteraction,
        poolHedgerParams.interactionDelay,
        block.timestamp
      );
    }
    _hedgeDelta(expectedHedge);
    _returnAllEth();
  }

  /**
   * @notice adjust collateral in GMX to match target leverage
   * @dev   if we have excess collateral: create pending order to remove collateral
   * @dev   if we need more collateral: transfer from liquidity pool
   */
  function updateCollateral() external payable virtual override nonReentrant {
    // Check pending orders first
    if (_hasPendingPositionRequest()) {
      revert PositionRequestPending(address(this), pendingOrderKey);
    }
    pendingOrderKey = bytes32(0);

    CurrentPositions memory positions = _getPositions();
    emit HedgerPosition(address(this), positions);

    if (positions.amountOpen > 1) {
      int expectedHedge = _getCappedExpectedHedge();
      _closeSecondPosition(positions, expectedHedge);
      return;
    }

    (, bool needUpdate, int collateralDelta) = _getCurrentLeverage(positions);
    if (!needUpdate) {
      return;
    }

    uint spotPrice = _getSpotPrice();

    if (collateralDelta > 0) {
      _increasePosition(
        positions.isLong ? positions.longPosition : positions.shortPosition,
        positions.isLong,
        0,
        collateralDelta.toUint256(),
        spotPrice
      );
    } else {
      // decrease position size (withdraw collateral to liquidity pool directly)
      _decreasePosition(
        positions.isLong ? positions.longPosition : positions.shortPosition,
        positions.isLong,
        0,
        (-collateralDelta).toUint256(),
        spotPrice,
        false // is not close
      );
    }

    emit CollateralOrderPosted(address(this), pendingOrderKey, positions.isLong, collateralDelta);
    // return any excess eth
    _returnAllEth();
  }

  /**
   * @dev return whether a hedge should be performed
   */
  function canHedge(uint /* amountOptions */, bool increasesPoolDelta) external view override returns (bool) {
    if (!futuresPoolHedgerParams.vaultLiquidityCheckEnabled) {
      return true;
    }

    uint spotPrice = _getSpotPrice();
    CurrentPositions memory positions = _getPositions();
    int expectedHedge = _getCappedExpectedHedge();
    int currentHedge = _getCurrentHedgedNetDeltaWithSpot(positions, spotPrice);

    if (Math.abs(expectedHedge) <= Math.abs(currentHedge)) {
      // Delta is shrinking (potentially flipping, but still smaller than current hedge), so we skip the check
      return true;
    }

    if (increasesPoolDelta && expectedHedge <= 0) {
      // expected hedge is negative, and trade increases delta of the pool
      return true;
    }

    if (!increasesPoolDelta && expectedHedge >= 0) {
      return true;
    }

    uint remainingDeltas;
    if (expectedHedge > 0) {
      // remaining is the amount of baseAsset that can be hedged
      remainingDeltas = ConvertDecimals.convertTo18(
        (vault.poolAmounts(address(baseAsset)) - vault.reservedAmounts(address(baseAsset))),
        baseAsset.decimals()
      );
    } else {
      remainingDeltas = ConvertDecimals.convertTo18(
        (vault.poolAmounts(address(quoteAsset)) - vault.reservedAmounts(address(quoteAsset))),
        baseAsset.decimals()
      );
    }
    // TODO: test both sides

    uint absHedgeDiff = (Math.abs(expectedHedge) - Math.abs(currentHedge));
    if (remainingDeltas < absHedgeDiff.multiplyDecimal(futuresPoolHedgerParams.marketDepthBuffer)) {
      return false;
    }

    return true;
  }

  //////////////////////
  // Public Functions //
  //////////////////////

  /**
   * @dev return true if there's a pending order to increase position
   */
  function hasPendingIncrease() external view returns (bool) {
    return _hasPendingIncrease();
  }

  /**
   * @dev return true if there's a pending order to decrease position
   */
  function hasPendingDecrease() external view returns (bool) {
    return _hasPendingDecrease();
  }

  /**
   * @dev returns the position array
   */
  function getPositions() external view returns (CurrentPositions memory positions) {
    return _getPositions();
  }

  /**
   * @notice return current leverage
   * @dev return 0 if no position is opened
   * @return leverage in 18 decimals
   * @return isLong true if it's a long position
   * @return needUpdate true if we should call updateCollateral to rebalance
   * @return collateralDelta how much collateral needed to bring leverage back to targetLeverage
   */
  function getCurrentLeverage()
    external
    view
    returns (uint leverage, bool isLong, bool needUpdate, int collateralDelta)
  {
    CurrentPositions memory positions = _getPositions();
    (leverage, needUpdate, collateralDelta) = _getCurrentLeverage(positions);
    return (leverage, positions.isLong, needUpdate, collateralDelta);
  }

  /**
   * @dev cancel outstanding order in case the GMX keeper bot is not working properly.
   */
  function cancelPendingOrder() external nonReentrant {
    if (lastOrderTimestamp + futuresPoolHedgerParams.minCancelDelay > block.timestamp) {
      revert CancellationDelayNotPassed(address(this));
    }

    if (_hasPendingIncrease()) {
      bool success = positionRouter.cancelIncreasePosition(pendingOrderKey, address(this));
      emit OrderCanceled(address(this), pendingOrderKey, success);
      if (!success) {
        revert OrderCancellationFailure(address(this), pendingOrderKey);
      }
    }
    if (_hasPendingDecrease()) {
      bool success = positionRouter.cancelDecreasePosition(pendingOrderKey, address(this));
      emit OrderCanceled(address(this), pendingOrderKey, success);
      if (!success) {
        revert OrderCancellationFailure(address(this), pendingOrderKey);
      }
    }

    pendingOrderKey = bytes32(0);
  }

  //////////////
  // internal //
  //////////////

  /**
   * @dev get the expected delta hedge that the hedger must perfom.
   * @return cappedExpectedHedge amount of delta to be hedged, with 18 decimals
   */
  function _getCappedExpectedHedge() internal view returns (int cappedExpectedHedge) {
    // the cache returns positive value if users are net long delta (AMM is net short)
    // so AMM will need to go long to off set the negative delta.
    // -> AMM always hedge the exact amount reported by getGlobalNetDelta
    int expectedHedge = greekCache.getGlobalNetDelta();

    bool exceedsCap = Math.abs(expectedHedge) > poolHedgerParams.hedgeCap;

    if (!exceedsCap) {
      cappedExpectedHedge = expectedHedge;
    } else if (expectedHedge < 0) {
      cappedExpectedHedge = -poolHedgerParams.hedgeCap.toInt256();
    } else {
      // expectedHedge >= 0
      cappedExpectedHedge = poolHedgerParams.hedgeCap.toInt256();
    }
    return cappedExpectedHedge;
  }

  /**
   * @dev return 0 if no position is opened
   * @return leverage in 18 decimals
   * @return needUpdate
   * @return collateralDelta how much collateral needed to bring leverage back to targetLeverage
   */
  function _getCurrentLeverage(
    CurrentPositions memory positions
  ) internal view returns (uint leverage, bool needUpdate, int collateralDelta) {
    if (positions.amountOpen == 0) {
      return (0, false, 0);
    }

    PositionDetails memory position = positions.isLong ? positions.longPosition : positions.shortPosition;

    int effectiveCollateral = _getEffectiveCollateral(position);

    // re-calculate target collateral instead of using "position.collateral"
    // just in case our collateral is off.
    int targetCollateral = _getTargetCollateral(position.size).toInt256();

    collateralDelta = targetCollateral - effectiveCollateral;

    leverage = position.size.divideDecimal(effectiveCollateral.toUint256());

    needUpdate = true;

    if (position.size == position.collateral && collateralDelta > 0) {
      // don't need to update if collateral is same as size already, and delta is positive
      needUpdate = false;
    } else if (_hasPendingPositionRequest()) {
      // set needUpdate to false if there's a pending order (either to hedge or to updateCollateral)
      needUpdate = false;
    } else if (collateralDelta == 0) {
      needUpdate = false;
    }
  }

  /**
   * @dev Updates the hedge position.
   *
   * @param expectedHedge The expected final hedge value.
   */
  function _hedgeDelta(int expectedHedge) internal {
    // Check pending orders first
    if (_hasPendingPositionRequest()) {
      revert PositionRequestPending(address(this), pendingOrderKey);
    }
    pendingOrderKey = bytes32(0);

    CurrentPositions memory positions = _getPositions();
    emit HedgerPosition(address(this), positions);

    if (positions.amountOpen > 1) {
      _closeSecondPosition(positions, expectedHedge);
      return;
    }

    // From here onwards, there can only be one position open for the hedger
    uint spot = _getSpotPrice();

    int currHedgedNetDelta = _getCurrentHedgedNetDelta(positions);

    if (expectedHedge == currHedgedNetDelta) {
      return;
    }

    // Note: position could be empty, which means this will be filled with 0s, which works fine further below.
    PositionDetails memory currentPos = positions.isLong ? positions.longPosition : positions.shortPosition;

    // Need to know if we need to flip from a long to a short (or visa versa)
    if ((expectedHedge <= 0 && currHedgedNetDelta > 0) || (expectedHedge >= 0 && currHedgedNetDelta < 0)) {
      // as we check the current is explicitly > 0, we know a position is currently open.
      // Must flip the hedge, so we will close the position and not reset the interaction delay.
      _decreasePosition(
        currentPos,
        positions.isLong,
        currentPos.size,
        // Withdraw excess collateral to make sure we aren't under leveraged and blocked
        currentPos.collateral,
        spot,
        true
      );

      emit PositionUpdated(
        address(this),
        currHedgedNetDelta,
        expectedHedge,
        currentPos.size,
        Math.abs(expectedHedge) > Math.abs(currHedgedNetDelta)
      );
      return;
    }

    // To get to this point, there is either no position open, or a position on the same side as we want.
    bool isLong = expectedHedge > 0;

    uint sizeDelta = Math.abs(expectedHedge - currHedgedNetDelta).multiplyDecimal(spot); // delta is in USD

    // calculate the expected collateral given the new expected hedge
    uint expectedCollateral = _getTargetCollateral(Math.abs(expectedHedge).multiplyDecimal(spot));

    uint collatAmount = currentPos.collateral;

    if (Math.abs(expectedHedge) > Math.abs(currHedgedNetDelta)) {
      uint collatDelta = expectedCollateral > collatAmount ? expectedCollateral - collatAmount : 0;
      _increasePosition(currentPos, isLong, sizeDelta, collatDelta, spot);
    } else {
      uint collatDelta = collatAmount > expectedCollateral ? collatAmount - expectedCollateral : 0;

      // The case of being under collateralised here can be fixed after the fact by calling updateCollateral.
      // We are de-risking here (reducing position) so we dont have to do it first.
      _decreasePosition(
        currentPos,
        isLong,
        sizeDelta,
        // Withdraw excess collateral to make sure we aren't under-leveraged and blocked
        collatDelta,
        spot,
        false
      );
    }

    emit PositionUpdated(
      address(this),
      currHedgedNetDelta,
      expectedHedge,
      sizeDelta,
      Math.abs(expectedHedge) > Math.abs(currHedgedNetDelta)
    );
    lastInteraction = block.timestamp;
    return;
  }

  function _closeSecondPosition(CurrentPositions memory positions, int expectedHedge) internal {
    uint spot = _getSpotPrice();
    // we have two positions open (one long and short); so lets close the one we dont want
    if (expectedHedge > 0) {
      _decreasePosition(
        positions.shortPosition,
        false,
        positions.shortPosition.size,
        positions.shortPosition.collateral,
        spot,
        true
      );
    } else {
      _decreasePosition(
        positions.longPosition,
        true,
        positions.longPosition.size,
        positions.longPosition.collateral,
        spot,
        true
      );
    }
  }

  // sizeDelta is the change in current delta required to get to the desired hedge

  /**
   * @dev create increase position order on GMX router
   * @dev trading fee is taken care of
   */
  function _increasePosition(
    PositionDetails memory currentPos,
    bool isLong,
    uint sizeDelta,
    uint collateralDelta,
    uint spot
  ) internal {
    if (isLong) {
      uint swapFeeBP = getSwapFeeBP(isLong, true, collateralDelta);
      collateralDelta = (collateralDelta * (BASIS_POINTS_DIVISOR + swapFeeBP)) / BASIS_POINTS_DIVISOR;
    }

    // add margin fee
    // when we increase position, fee always got deducted from collateral
    collateralDelta += _getPositionFee(currentPos.size, sizeDelta, currentPos.entryFundingRate);

    address[] memory path;
    uint acceptableSpot;

    if (isLong) {
      path = new address[](2);
      path[0] = address(quoteAsset);
      path[1] = address(baseAsset);
      acceptableSpot = _convertToGMXPrecision(spot.multiplyDecimal(futuresPoolHedgerParams.acceptableSpotSlippage));
    } else {
      path = new address[](1);
      path[0] = address(quoteAsset);
      acceptableSpot = _convertToGMXPrecision(spot.divideDecimalRound(futuresPoolHedgerParams.acceptableSpotSlippage));
    }

    // if the trade ends up with collateral > size, adjust collateral.
    // gmx restrict position to have size >= collateral, so we cap the collateral to be same as size.
    if (currentPos.collateral + collateralDelta > currentPos.size + sizeDelta) {
      collateralDelta = (currentPos.size + sizeDelta) - currentPos.collateral;
    }

    // if we get less than we want, we will just continue with the same position, but take on more leverage
    collateralDelta = liquidityPool.transferQuoteToHedge(collateralDelta);

    if (collateralDelta == 0) {
      revert NoQuoteReceivedFromLP(address(this));
    }

    // collateralDelta with decimals same as defined in ERC20
    collateralDelta = ConvertDecimals.convertFrom18(collateralDelta, quoteAsset.decimals());

    if (!quoteAsset.approve(address(router), collateralDelta)) {
      revert QuoteApprovalFailure(address(this), address(router), collateralDelta);
    }

    uint executionFee = _getExecutionFee();
    bytes32 key = positionRouter.createIncreasePosition{value: executionFee}(
      path,
      address(baseAsset), // index token
      collateralDelta, // amount in via router is in the native currency decimals
      0, // min out
      _convertToGMXPrecision(sizeDelta),
      isLong,
      acceptableSpot,
      executionFee,
      referralCode,
      address(this)
    );

    pendingOrderKey = key;
    lastOrderTimestamp = block.timestamp;

    emit OrderPosted(address(this), pendingOrderKey, collateralDelta, sizeDelta, isLong, true);
  }

  /**
   * @dev create increase position order on GMX router
   * @param sizeDelta is the change in current delta required to get to the desired hedge. in USD term
   */
  function _decreasePosition(
    PositionDetails memory currentPos,
    bool isLong,
    uint sizeDelta,
    uint collateralDelta,
    uint spot,
    bool isClose
  ) internal {
    // if realised pnl is negative, fee will be paid in collateral
    // so we can reduce less
    if (currentPos.unrealisedPnl < 0) {
      uint adjustedDelta = Math.abs(currentPos.unrealisedPnl).multiplyDecimal(sizeDelta).divideDecimal(currentPos.size);
      if (adjustedDelta > collateralDelta) {
        collateralDelta = 0;
      } else {
        collateralDelta -= adjustedDelta;
      }
    }

    address[] memory path;
    uint acceptableSpot;

    if (isLong) {
      path = new address[](2);
      path[0] = address(baseAsset);
      path[1] = address(quoteAsset);
      acceptableSpot = _convertToGMXPrecision(spot.divideDecimalRound(futuresPoolHedgerParams.acceptableSpotSlippage));
    } else {
      path = new address[](1);
      path[0] = address(quoteAsset);
      acceptableSpot = _convertToGMXPrecision(spot.multiplyDecimal(futuresPoolHedgerParams.acceptableSpotSlippage));
    }

    if (collateralDelta > currentPos.collateral) {
      collateralDelta = currentPos.collateral;
    }

    uint executionFee = _getExecutionFee();
    bytes32 key = positionRouter.createDecreasePosition{value: executionFee}(
      path,
      address(baseAsset),
      // CollateralDelta for decreases is in PRICE_PRECISION rather than asset decimals like for opens...
      // In the case of closes, 0 must be passed in
      isClose ? 0 : _convertToGMXPrecision(collateralDelta),
      _convertToGMXPrecision(sizeDelta),
      isLong,
      address(liquidityPool),
      acceptableSpot,
      0,
      executionFee,
      false,
      address(this)
    );

    pendingOrderKey = key;
    lastOrderTimestamp = block.timestamp;

    emit OrderPosted(address(this), pendingOrderKey, collateralDelta, sizeDelta, isLong, false);
  }

  function _convertFromGMXPrecision(uint amt) internal pure returns (uint) {
    return ConvertDecimals.normaliseTo18(amt, GMX_PRICE_PRECISION);
  }

  function _convertToGMXPrecision(uint amt) internal pure returns (uint) {
    return ConvertDecimals.normaliseFrom18(amt, GMX_PRICE_PRECISION);
  }

  function _getTargetCollateral(uint size) internal view returns (uint) {
    return size.divideDecimal(futuresPoolHedgerParams.targetLeverage);
  }

  /**
   * @dev get what is the collateral for the position, considering losses
   */
  function _getEffectiveCollateral(PositionDetails memory position) internal pure returns (int effectiveCollateral) {
    effectiveCollateral = int(position.collateral);
    if (position.unrealisedPnl < 0) {
      effectiveCollateral += position.unrealisedPnl;
    }
  }

  /**
   * @dev returns the additional collat required for fee
   * @dev fee is charged on the notional value of the position.
   *      notional value = position size * leverage
   * @param size size with 18 decimals. used to calculate funding fee
   * @param sizeDelta size delta with 18 decimals. used to calculate position fee
   * @param entryFundingRate original funding rate, with GMX's original precision
   * @return fee in usd term, 18 decimals
   */
  function _getPositionFee(uint size, uint sizeDelta, uint entryFundingRate) internal view returns (uint) {
    // pass in sizes in 18 decimals, will return funding fee and position fee in 18 decimals
    uint fundingFee = vault.getFundingFee(address(baseAsset), size, entryFundingRate);
    return fundingFee + vault.getPositionFee(sizeDelta);
  }

  /////////////////
  // GMX Viewers //
  /////////////////

  /**
   * @dev gets the spot price
   */
  function _getSpotPrice() internal view returns (uint) {
    return exchangeAdapter.getSpotPriceForMarket(optionMarket, BaseExchangeAdapter.PriceType.REFERENCE);
  }

  function getSwapFeeBP(bool isLong, bool isIncrease, uint amountIn) public view returns (uint feeBP) {
    if (!isLong) {
      // only relevant for longs as shorts use the stable asset as collateral
      return 0;
    }
    address inToken = isIncrease ? address(quoteAsset) : address(baseAsset);
    address outToken = isIncrease ? address(baseAsset) : address(quoteAsset);
    uint256 priceIn = vault.getMinPrice(inToken);

    // adjust usdgAmounts by the same usdgAmount as debt is shifted between the assets
    uint256 usdgAmount = _convertFromGMXPrecision(
      ConvertDecimals.convertTo18(amountIn, quoteAsset.decimals()).multiplyDecimal(priceIn)
    );

    uint256 baseBps = vault.swapFeeBasisPoints();
    uint256 taxBps = vault.taxBasisPoints();
    uint256 feesBasisPoints0 = vault.getFeeBasisPoints(inToken, usdgAmount, baseBps, taxBps, true);
    uint256 feesBasisPoints1 = vault.getFeeBasisPoints(outToken, usdgAmount, baseBps, taxBps, false);
    // use the higher of the two fee basis points
    return feesBasisPoints0 > feesBasisPoints1 ? feesBasisPoints0 : feesBasisPoints1;
  }

  /**
   * @dev get total value from long and short GMX positions.
   * @return total value in USD term.
   */
  function getAllPositionsValue() external view returns (uint) {
    CurrentPositions memory positions = _getPositions();
    return _getAllPositionsValue(positions);
  }

  /**
   * @dev No fees are added in here, as they get re-adjusted every time collateral is adjusted
   * @return value in USD term
   **/
  function _getAllPositionsValue(CurrentPositions memory positions) internal pure returns (uint) {
    uint totalValue = 0;

    if (positions.longPosition.size > 0) {
      PositionDetails memory position = positions.longPosition;
      int longPositionValue = position.collateral.toInt256() + position.unrealisedPnl;

      // Ignore the case when negative PnL covers collateral (insolvency) as the value is 0
      if (longPositionValue > 0) {
        totalValue += uint(longPositionValue);
      }
    }

    if (positions.shortPosition.size > 0) {
      PositionDetails memory position = positions.shortPosition;
      int shortPositionValue = position.collateral.toInt256() + position.unrealisedPnl;

      // Ignore the case when negative PnL covers collateral (insolvency) as the value is 0
      if (shortPositionValue > 0) {
        totalValue += uint(shortPositionValue);
      }
    }
    return totalValue;
  }

  /**
   * @dev Gets the current open positions. Will return an empty object where a position is not open. First will be long
   * Second will be short.
   */
  function _getPositions() internal view returns (CurrentPositions memory positions) {
    PositionDetails memory longResult = _getPosition(true);
    PositionDetails memory shortResult = _getPosition(false);

    uint amountOpen = 0;
    if (longResult.size > 0) {
      amountOpen += 1;
    }
    if (shortResult.size > 0) {
      amountOpen += 1;
    }

    bool isLong = longResult.size > shortResult.size;

    return
      CurrentPositions({longPosition: longResult, shortPosition: shortResult, amountOpen: amountOpen, isLong: isLong});
  }

  /**
   * @dev get position detail that includes unrealised PNL
   */
  function _getPosition(bool isLong) internal view returns (PositionDetails memory) {
    address collatToken = isLong ? address(baseAsset) : address(quoteAsset);
    (
      uint size,
      uint collateral,
      uint averagePrice,
      uint entryFundingRate, // uint reserveAmount: GMX internal variable to keep track of collateral reserved for position // uint realised profit: historical pnl // bool hasProfit: if the vault had previously realised profit or loss
      ,
      ,
      ,
      uint lastIncreasedTime
    ) = vault.getPosition(address(this), collatToken, address(baseAsset), isLong);

    int unrealisedPnl = 0;
    if (averagePrice > 0) {
      // getDelta will revert if average price == 0;
      (bool hasUnrealisedProfit, uint absUnrealisedPnl) = vault.getDelta(
        address(baseAsset),
        size,
        averagePrice,
        isLong,
        lastIncreasedTime
      );

      if (hasUnrealisedProfit) {
        unrealisedPnl = _convertFromGMXPrecision(absUnrealisedPnl).toInt256();
      } else {
        unrealisedPnl = -_convertFromGMXPrecision(absUnrealisedPnl).toInt256();
      }
    }

    return
      PositionDetails({
        size: _convertFromGMXPrecision(size),
        collateral: _convertFromGMXPrecision(collateral),
        averagePrice: _convertFromGMXPrecision(averagePrice),
        entryFundingRate: entryFundingRate, // store in initial percision, will be used in vault.getFundingFee
        unrealisedPnl: unrealisedPnl,
        lastIncreasedTime: lastIncreasedTime,
        isLong: isLong
      });
  }

  /**
   * @dev returns the execution fee plus the cost of the gas callback
   */
  function _getExecutionFee() internal view returns (uint) {
    return positionRouter.minExecutionFee();
  }

  function _hasPendingPositionRequest() internal view returns (bool) {
    if (pendingOrderKey == bytes32(0)) {
      return false;
    }
    if (_hasPendingIncrease()) {
      return true;
    }
    if (_hasPendingDecrease()) {
      return true;
    }
    return false;
  }

  /**
   * @dev returns true if there is pending increase position order on GMX
   */
  function _hasPendingIncrease() internal view returns (bool hasPending) {
    bytes memory data = abi.encodeWithSelector(positionRouter.increasePositionRequests.selector, pendingOrderKey);

    (bool success, bytes memory returndata) = address(positionRouter).staticcall(data);
    if (!success) {
      revert GetGMXVaultError(address(this));
    }

    // parse account from the first 32 bytes of returned data
    // same as: (address account,,,,,,,,,,,,) = positionRouter.increasePositionRequests(pendingOrderKey);
    address account;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      account := mload(add(returndata, 32))
    }
    return account != address(0);
  }

  /**
   * @dev returns true if there is pending decrease position order on GMX
   */
  function _hasPendingDecrease() internal view returns (bool) {
    bytes memory data = abi.encodeWithSelector(positionRouter.decreasePositionRequests.selector, pendingOrderKey);

    (bool success, bytes memory returndata) = address(positionRouter).staticcall(data);
    if (!success) {
      revert GetGMXVaultError(address(this));
    }

    // parse account from the first 32 bytes of returned data
    // same as: (address account,,,,,,,,,,,,,) = positionRouter.decreasePositionRequests(pendingOrderKey);
    address account;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      account := mload(add(returndata, 32))
    }
    return account != address(0);
  }

  //////////
  // Misc //
  //////////

  function _returnAllEth() internal {
    // return any excess eth
    (bool success, ) = msg.sender.call{value: address(this).balance}("");
    if (!success) {
      revert EthTransferFailure(address(this), msg.sender, address(this).balance);
    }
  }

  //////////////
  // Callback //
  //////////////

  function gmxPositionCallback(bytes32 positionKey, bool isExecuted, bool isIncrease) external onlyGMXKeeper {
    emit GMXPositionCallback(address(this), positionKey, isExecuted, isIncrease, _getPositions());
  }

  ///////////////
  // Modifiers //
  ///////////////

  modifier onlyGMXKeeper() {
    require(msg.sender == address(positionRouter), "GMXFuturesPoolHedger: only GMX keeper can trigger callback");
    _;
  }

  ////////////
  // Events //
  ////////////

  /**
   * @dev Emitted when the position router is updated.
   */
  event PositionRouterSet(address thrower, IPositionRouter positionRouter);

  /**
   * @dev Emitted when the max leverage parameter is updated.
   */
  event MaxLeverageSet(address thrower, uint targetLeverage);

  /**
   * @dev Emitted when the hedge position is updated.
   */
  event PositionUpdated(
    address thrower,
    int currentNetDelta,
    int expectedNetDelta,
    uint modifiedDelta,
    bool isIncrease
  );

  /**
   * @dev Emitted when proceeds of the short are sent back to the LP.
   */
  event QuoteReturnedToLP(address thrower, uint amountQuote);

  /**
   * @dev Emitted when base is returned to the LP
   */
  event BaseReturnedToLP(address thrower, uint amountBase);

  /**
   * @dev Emitted when the collateral order is posted
   */
  event CollateralOrderPosted(address thrower, bytes32 positionKey, bool isLong, int collateralDelta);

  /**
   * @dev Emitted when a either Hedgedelta is called or update collateral
   */
  event HedgerPosition(address thrower, CurrentPositions position);

  /**
   * @dev Emitted when queue order is posted
   */
  event OrderPosted(
    address thrower,
    bytes32 positionKey,
    uint collateralDelta,
    uint sizeDelta,
    bool isLong,
    bool isIncrease
  );

  /**
   * @dev call back occurs and returns the positions information
   */
  event GMXPositionCallback(
    address thrower,
    bytes32 positionKey,
    bool isExecuted,
    bool isIncrease,
    CurrentPositions positions
  );

  /**
   * @dev Emitted when an order is cancelled
   */
  event OrderCanceled(address thrower, bytes32 pendingOrderKey, bool success);

  ////////////
  // Errors //
  ////////////
  // Admin
  error InvalidMaxLeverage(address thrower, uint newMaxLeverage);
  error NotEnoughQuoteForMinCollateral(address thrower, uint quoteReceived, uint minCollateral);
  error OwnerCannotTransferQuoteBase(address thrower);

  // Hedging
  error InteractionDelayNotExpired(address thrower, uint lastInteraction, uint interactionDelta, uint currentTime);
  error PositionRequestPending(address thrower, bytes32 key);
  error OrderCancellationFailure(address thrower, bytes32 pendingOrderKey);

  // Token transfers
  error NoQuoteReceivedFromLP(address thrower);
  error EthTransferFailure(address thrower, address recipient, uint balance);
  error CancellationDelayNotPassed(address thrower);

  error GetGMXVaultError(address thrower);
  error AssetTransferFailed(address thrower, IERC20Decimals asset, uint amount, address recipient);
  error QuoteApprovalFailure(address thrower, address approvee, uint amount);
}
