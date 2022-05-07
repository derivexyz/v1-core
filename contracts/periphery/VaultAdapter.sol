//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

// Libraries
import "../lib/GWAV.sol";
import "../lib/BlackScholes.sol";
import "../synthetix/DecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interfaces
import "../OptionToken.sol";
import "../OptionMarket.sol";
import "../LiquidityPool.sol";
import "../ShortCollateral.sol";
import "../OptionGreekCache.sol";
import "../SynthetixAdapter.sol";
import "../interfaces/ICurve.sol";
import "./BasicFeeCounter.sol";

/**
 * @title VaultAdapter
 * @author Lyra
 * @dev Provides helpful functions for the vault adapter
 */

contract VaultAdapter is Ownable {
  using DecimalMath for uint;

  ///////////////////////
  // Abstract Contract //
  ///////////////////////

  struct Strike {
    uint id;
    uint expiry;
    uint strikePrice;
    uint skew;
    uint boardIv;
  }

  struct Board {
    uint id;
    uint expiry;
    uint boardIv;
    uint[] strikeIds;
  }

  struct OptionPosition {
    uint positionId;
    uint strikeId;
    OptionType optionType;
    uint amount;
    uint collateral;
    PositionState state;
  }

  enum OptionType {
    LONG_CALL,
    LONG_PUT,
    SHORT_CALL_BASE,
    SHORT_CALL_QUOTE,
    SHORT_PUT_QUOTE
  }

  enum PositionState {
    EMPTY,
    ACTIVE,
    CLOSED,
    LIQUIDATED,
    SETTLED,
    MERGED
  }

  struct TradeInputParameters {
    uint strikeId;
    uint positionId;
    uint iterations;
    OptionType optionType;
    uint amount;
    uint setCollateralTo;
    uint minTotalCost;
    uint maxTotalCost;
    address rewardRecipient;
  }

  struct TradeResult {
    uint positionId;
    uint totalCost;
    uint totalFee;
  }

  struct Liquidity {
    uint usedCollat;
    uint usedDelta;
    uint pendingDelta;
    uint freeLiquidity;
  }

  struct MarketParams {
    uint standardSize;
    uint skewAdjustmentParam;
    int rateAndCarry;
    int deltaCutOff;
    uint tradingCutoff;
    int minForceCloseDelta;
  }

  struct ExchangeRateParams {
    uint spotPrice;
    uint quoteBaseFeeRate;
    uint baseQuoteFeeRate;
  }

  ///////////////
  // Variables //
  ///////////////

  ICurve internal curveSwap;
  OptionToken internal optionToken;
  OptionMarket internal optionMarket;
  LiquidityPool internal liquidityPool;
  ShortCollateral internal shortCollateral;
  SynthetixAdapter internal synthetixAdapter;
  OptionMarketPricer internal optionPricer;
  OptionGreekCache internal greekCache;
  IERC20 internal quoteAsset;
  IERC20 internal baseAsset;
  BasicFeeCounter internal feeCounter;

  constructor() Ownable() {}

  /**
   * @dev Assigns all lyra contracts
   * @param _curveSwap Curve pool address
   * @param _optionToken OptionToken Address
   * @param _optionMarket OptionMarket Address
   * @param _liquidityPool LiquidityPool address
   * @param _shortCollateral ShortCollateral address
   * @param _synthetixAdapter SynthetixAdapter address
   * @param _optionPricer OptionMarketPricer address
   * @param _greekCache greekCache address
   * @param _quoteAsset Quote asset address
   * @param _baseAsset Base asset address
   * @param _feeCounter Fee counter address
   */
  function setLyraAddresses(
    address _curveSwap,
    address _optionToken,
    address _optionMarket,
    address _liquidityPool,
    address _shortCollateral,
    address _synthetixAdapter,
    address _optionPricer,
    address _greekCache,
    address _quoteAsset,
    address _baseAsset,
    address _feeCounter
  ) internal onlyOwner {
    if (address(quoteAsset) != address(0)) {
      quoteAsset.approve(address(optionMarket), 0);
    }
    if (address(baseAsset) != address(0)) {
      baseAsset.approve(address(optionMarket), 0);
    }

    curveSwap = ICurve(_curveSwap);
    optionToken = OptionToken(_optionToken);
    optionMarket = OptionMarket(_optionMarket);
    liquidityPool = LiquidityPool(_liquidityPool);
    shortCollateral = ShortCollateral(_shortCollateral);
    synthetixAdapter = SynthetixAdapter(_synthetixAdapter);
    optionPricer = OptionMarketPricer(_optionPricer);
    greekCache = OptionGreekCache(_greekCache);
    quoteAsset = IERC20(_quoteAsset);
    baseAsset = IERC20(_baseAsset);
    feeCounter = BasicFeeCounter(_feeCounter);

    // Do approvals
    quoteAsset.approve(address(optionMarket), type(uint).max);
    baseAsset.approve(address(optionMarket), type(uint).max);
  }

  ////////////////////
  // Market Actions //
  ////////////////////

  // setTrustedCounter must be set for approved addresses
  function _openPosition(TradeInputParameters memory params) internal returns (TradeResult memory) {
    OptionMarket.Result memory result = optionMarket.openPosition(_convertParams(params));
    if (params.rewardRecipient != address(0)) {
      feeCounter.addFees(address(optionMarket), params.rewardRecipient, result.totalFee);
    }
    return TradeResult({positionId: result.positionId, totalCost: result.totalCost, totalFee: result.totalFee});
  }

  function _closePosition(TradeInputParameters memory params) internal returns (TradeResult memory) {
    OptionMarket.Result memory result = optionMarket.closePosition(_convertParams(params));
    if (params.rewardRecipient != address(0)) {
      feeCounter.addFees(address(optionMarket), params.rewardRecipient, result.totalFee);
    }
    return TradeResult({positionId: result.positionId, totalCost: result.totalCost, totalFee: result.totalFee});
  }

  function _forceClosePosition(TradeInputParameters memory params) internal returns (TradeResult memory) {
    OptionMarket.Result memory result = optionMarket.forceClosePosition(_convertParams(params));
    if (params.rewardRecipient != address(0)) {
      feeCounter.addFees(address(optionMarket), params.rewardRecipient, result.totalFee);
    }
    return TradeResult({positionId: result.positionId, totalCost: result.totalCost, totalFee: result.totalFee});
  }

  //////////////
  // Exchange //
  //////////////

  function _exchangeFromExactQuote(uint amountQuote, uint minBaseReceived) internal returns (uint baseReceived) {
    baseReceived = synthetixAdapter.exchangeFromExactQuote(address(optionMarket), amountQuote);
    require(baseReceived >= minBaseReceived, "base received too low");
  }

  function _exchangeToExactQuote(uint amountQuote, uint maxBaseUsed) internal returns (uint quoteReceived) {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(optionMarket));
    (, quoteReceived) = synthetixAdapter.exchangeToExactQuoteWithLimit(
      exchangeParams,
      address(optionMarket),
      amountQuote,
      maxBaseUsed
    );
  }

  function _exchangeFromExactBase(uint amountBase, uint minQuoteReceived) internal returns (uint quoteReceived) {
    quoteReceived = synthetixAdapter.exchangeFromExactBase(address(optionMarket), amountBase);
    require(quoteReceived >= minQuoteReceived, "quote received too low");
  }

  function _exchangeToExactBase(uint amountBase, uint maxQuoteUsed) internal returns (uint baseReceived) {
    SynthetixAdapter.ExchangeParams memory exchangeParams = synthetixAdapter.getExchangeParams(address(optionMarket));
    (, baseReceived) = synthetixAdapter.exchangeToExactBaseWithLimit(
      exchangeParams,
      address(optionMarket),
      amountBase,
      maxQuoteUsed
    );
  }

  function _swapStables(
    address from,
    address to,
    uint amount,
    uint expected,
    address receiver
  ) internal returns (uint amountOut, int swapFee) {
    int balStart = int(ERC20(from).balanceOf(address(this)));
    amountOut = curveSwap.exchange_with_best_rate(from, to, amount, expected, receiver);
    swapFee = balStart - int(amountOut);
  }

  //////////////////////////
  // Option Token Actions //
  //////////////////////////

  // option token spilt
  function _splitPosition(
    uint positionId,
    uint newAmount,
    uint newCollateral,
    address recipient
  ) internal returns (uint newPositionId) {
    newPositionId = optionToken.split(positionId, newAmount, newCollateral, recipient);
  }

  // option token merge
  function _mergePositions(uint[] memory positionIds) internal {
    optionToken.merge(positionIds);
  }

  ////////////////////
  // Market Getters //
  ////////////////////

  function _getLiveBoards() internal view returns (uint[] memory liveBoards) {
    liveBoards = optionMarket.getLiveBoards();
  }

  // get all board related info (non GWAV)
  function _getBoard(uint boardId) internal view returns (Board memory) {
    OptionMarket.OptionBoard memory board = optionMarket.getOptionBoard(boardId);
    return Board({id: board.id, expiry: board.expiry, boardIv: board.iv, strikeIds: board.strikeIds});
  }

  // get all strike related info (non GWAV)
  function _getStrikes(uint[] memory strikeIds) internal view returns (Strike[] memory allStrikes) {
    allStrikes = new Strike[](strikeIds.length);

    for (uint i = 0; i < strikeIds.length; i++) {
      (OptionMarket.Strike memory strike, OptionMarket.OptionBoard memory board) = optionMarket.getStrikeAndBoard(
        strikeIds[i]
      );

      allStrikes[i] = Strike({
        id: strike.id,
        expiry: board.expiry,
        strikePrice: strike.strikePrice,
        skew: strike.skew,
        boardIv: board.iv
      });
    }
    return allStrikes;
  }

  // iv * skew only
  function _getVols(uint[] memory strikeIds) internal view returns (uint[] memory vols) {
    vols = new uint[](strikeIds.length);

    for (uint i = 0; i < strikeIds.length; i++) {
      (OptionMarket.Strike memory strike, OptionMarket.OptionBoard memory board) = optionMarket.getStrikeAndBoard(
        strikeIds[i]
      );

      vols[i] = board.iv.multiplyDecimal(strike.skew);
    }
    return vols;
  }

  // get deltas only
  function _getDeltas(uint[] memory strikeIds) internal view returns (int[] memory callDeltas) {
    callDeltas = new int[](strikeIds.length);
    for (uint i = 0; i < strikeIds.length; i++) {
      BlackScholes.BlackScholesInputs memory bsInput = _getBsInput(strikeIds[i]);
      (callDeltas[i], ) = BlackScholes.delta(bsInput);
    }
  }

  function _getVegas(uint[] memory strikeIds) internal view returns (uint[] memory vegas) {
    vegas = new uint[](strikeIds.length);
    for (uint i = 0; i < strikeIds.length; i++) {
      BlackScholes.BlackScholesInputs memory bsInput = _getBsInput(strikeIds[i]);
      vegas[i] = BlackScholes.vega(bsInput);
    }
  }

  // get pure black-scholes premium
  function _getPurePremium(
    uint secondsToExpiry,
    uint vol,
    uint spotPrice,
    uint strikePrice
  ) internal view returns (uint call, uint put) {
    BlackScholes.BlackScholesInputs memory bsInput = BlackScholes.BlackScholesInputs({
      timeToExpirySec: secondsToExpiry,
      volatilityDecimal: vol,
      spotDecimal: spotPrice,
      strikePriceDecimal: strikePrice,
      rateDecimal: greekCache.getGreekCacheParams().rateAndCarry
    });
    (call, put) = BlackScholes.optionPrices(bsInput);
  }

  // get pure black-scholes premium
  function _getPurePremiumForStrike(uint strikeId) internal view returns (uint call, uint put) {
    BlackScholes.BlackScholesInputs memory bsInput = _getBsInput(strikeId);
    (call, put) = BlackScholes.optionPrices(bsInput);
  }

  function _getFreeLiquidity() internal view returns (uint freeLiquidity) {
    freeLiquidity = liquidityPool.getLiquidityParams().freeLiquidity;
  }

  function _getMarketParams() internal view returns (MarketParams memory) {
    return
      MarketParams({
        standardSize: optionPricer.getPricingParams().standardSize,
        skewAdjustmentParam: optionPricer.getPricingParams().skewAdjustmentFactor,
        rateAndCarry: greekCache.getGreekCacheParams().rateAndCarry,
        deltaCutOff: optionPricer.getTradeLimitParams().minDelta,
        tradingCutoff: optionPricer.getTradeLimitParams().tradingCutoff,
        minForceCloseDelta: optionPricer.getTradeLimitParams().minForceCloseDelta
      });
  }

  // get spot price of sAsset and exchange fee percentages
  function _getExchangeParams() internal view returns (ExchangeRateParams memory) {
    SynthetixAdapter.ExchangeParams memory params = synthetixAdapter.getExchangeParams(address(optionMarket));
    return
      ExchangeRateParams({
        spotPrice: params.spotPrice,
        quoteBaseFeeRate: params.quoteBaseFeeRate,
        baseQuoteFeeRate: params.baseQuoteFeeRate
      });
  }

  /////////////////////////////
  // Option Position Getters //
  /////////////////////////////

  function _getPositions(uint[] memory positionIds) internal view returns (OptionPosition[] memory) {
    OptionToken.OptionPosition[] memory positions = optionToken.getOptionPositions(positionIds);

    OptionPosition[] memory convertedPositions = new OptionPosition[](positions.length);
    for (uint i = 0; i < positions.length; i++) {
      convertedPositions[i] = OptionPosition({
        positionId: positions[i].positionId,
        strikeId: positions[i].strikeId,
        optionType: OptionType(uint(positions[i].optionType)),
        amount: positions[i].amount,
        collateral: positions[i].collateral,
        state: PositionState(uint(positions[i].state))
      });
    }

    return convertedPositions;
  }

  function _getMinCollateral(
    OptionType optionType,
    uint strikePrice,
    uint expiry,
    uint spotPrice,
    uint amount
  ) internal view returns (uint) {
    return
      greekCache.getMinCollateral(OptionMarket.OptionType(uint(optionType)), strikePrice, expiry, spotPrice, amount);
  }

  function _getMinCollateralForPosition(uint positionId) internal view returns (uint) {
    OptionToken.PositionWithOwner memory position = optionToken.getPositionWithOwner(positionId);
    if (_isLong(OptionType(uint(position.optionType)))) return 0;

    uint strikePrice;
    uint expiry;
    (strikePrice, expiry) = optionMarket.getStrikeAndExpiry(position.strikeId);

    return
      _getMinCollateral(
        OptionType(uint(position.optionType)),
        strikePrice,
        expiry,
        synthetixAdapter.getSpotPriceForMarket(address(optionMarket)),
        position.amount
      );
  }

  function _getMinCollateralForStrike(
    OptionType optionType,
    uint strikeId,
    uint amount
  ) internal view returns (uint) {
    if (_isLong(optionType)) return 0;

    uint strikePrice;
    uint expiry;
    (strikePrice, expiry) = optionMarket.getStrikeAndExpiry(strikeId);

    return
      _getMinCollateral(
        optionType,
        strikePrice,
        expiry,
        synthetixAdapter.getSpotPriceForMarket(address(optionMarket)),
        amount
      );
  }

  //////////
  // Misc //
  //////////

  function _getBsInput(uint strikeId) internal view returns (BlackScholes.BlackScholesInputs memory bsInput) {
    (OptionMarket.Strike memory strike, OptionMarket.OptionBoard memory board) = optionMarket.getStrikeAndBoard(
      strikeId
    );
    bsInput = BlackScholes.BlackScholesInputs({
      timeToExpirySec: board.expiry - block.timestamp,
      volatilityDecimal: board.iv.multiplyDecimal(strike.skew),
      spotDecimal: synthetixAdapter.getSpotPriceForMarket(address(optionMarket)),
      strikePriceDecimal: strike.strikePrice,
      rateDecimal: greekCache.getGreekCacheParams().rateAndCarry
    });
  }

  function _isLong(OptionType optionType) internal pure returns (bool) {
    return (optionType < OptionType.SHORT_CALL_BASE);
  }

  function _convertParams(TradeInputParameters memory _params)
    internal
    pure
    returns (OptionMarket.TradeInputParameters memory)
  {
    return
      OptionMarket.TradeInputParameters({
        strikeId: _params.strikeId,
        positionId: _params.positionId,
        iterations: _params.iterations,
        optionType: OptionMarket.OptionType(uint(_params.optionType)),
        amount: _params.amount,
        setCollateralTo: _params.setCollateralTo,
        minTotalCost: _params.minTotalCost,
        maxTotalCost: _params.maxTotalCost
      });
  }
}
