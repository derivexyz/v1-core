//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
import "./interfaces/IExchanger.sol";
import "./interfaces/ICollateralShort.sol";
import "./interfaces/ISynthetix.sol";
import "./interfaces/IExchangeRates.sol";
import "./interfaces/ILiquidityPool.sol";

/**
 * @title LyraGlobals
 * @author Lyra
 * @dev Manages variables across all OptionMarkets, along with managing access to Synthetix.
 * Groups access to variables needed during a trade to reduce the gas costs associated with repetitive
 * inter-contract calls.
 * The OptionMarket contract address is used as the key to access the variables for the market.
 */
contract LyraGlobals is ILyraGlobals, Ownable {
  using SafeDecimalMath for uint;

  ISynthetix public override synthetix;
  IExchanger public override exchanger;
  IExchangeRates public override exchangeRates;
  ICollateralShort public override collateralShort;

  /// @dev Pause the whole system. Note; this will not pause settling previously expired options.
  bool public override isPaused = false;

  /// @dev Don't sell options this close to expiry
  mapping(address => uint) public override tradingCutoff;

  // Variables related to calculating premium/fees
  mapping(address => uint) public override optionPriceFeeCoefficient;
  mapping(address => uint) public override spotPriceFeeCoefficient;
  mapping(address => uint) public override vegaFeeCoefficient;
  mapping(address => uint) public override vegaNormFactor;
  mapping(address => uint) public override standardSize;
  mapping(address => uint) public override skewAdjustmentFactor;
  mapping(address => int) public override rateAndCarry;
  mapping(address => int) public override minDelta;
  mapping(address => uint) public override volatilityCutoff;
  mapping(address => bytes32) public override quoteKey;
  mapping(address => bytes32) public override baseKey;

  constructor() Ownable() {}

  /**
   * @dev Set the globals that apply to all OptionMarkets.
   *
   * @param _synthetix The address of Synthetix.
   * @param _exchanger The address of Synthetix's Exchanger.
   * @param _exchangeRates The address of Synthetix's ExchangeRates.
   * @param _collateralShort The address of Synthetix's CollateralShort.
   */
  function setGlobals(
    ISynthetix _synthetix,
    IExchanger _exchanger,
    IExchangeRates _exchangeRates,
    ICollateralShort _collateralShort
  ) external override onlyOwner {
    synthetix = _synthetix;
    exchanger = _exchanger;
    exchangeRates = _exchangeRates;
    collateralShort = _collateralShort;

    emit GlobalsSet(_synthetix, _exchanger, _exchangeRates, _collateralShort);
  }

  /**
   * @dev Set the globals for a specific OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _tradingCutoff The time to stop trading.
   * @param pricingGlobals The PricingGlobals.
   * @param _quoteKey The key of the quoteAsset.
   * @param _baseKey The key of the baseAsset.
   */
  function setGlobalsForContract(
    address _contractAddress,
    uint _tradingCutoff,
    PricingGlobals memory pricingGlobals,
    bytes32 _quoteKey,
    bytes32 _baseKey
  ) external override onlyOwner {
    setTradingCutoff(_contractAddress, _tradingCutoff);
    setOptionPriceFeeCoefficient(_contractAddress, pricingGlobals.optionPriceFeeCoefficient);
    setSpotPriceFeeCoefficient(_contractAddress, pricingGlobals.spotPriceFeeCoefficient);
    setVegaFeeCoefficient(_contractAddress, pricingGlobals.vegaFeeCoefficient);
    setVegaNormFactor(_contractAddress, pricingGlobals.vegaNormFactor);
    setStandardSize(_contractAddress, pricingGlobals.standardSize);
    setSkewAdjustmentFactor(_contractAddress, pricingGlobals.skewAdjustmentFactor);
    setRateAndCarry(_contractAddress, pricingGlobals.rateAndCarry);
    setMinDelta(_contractAddress, pricingGlobals.minDelta);
    setVolatilityCutoff(_contractAddress, pricingGlobals.volatilityCutoff);
    setQuoteKey(_contractAddress, _quoteKey);
    setBaseKey(_contractAddress, _baseKey);
  }

  /**
   * @dev Pauses the contract.
   *
   * @param _isPaused Whether getting globals will revert or not.
   */
  function setPaused(bool _isPaused) external override onlyOwner {
    isPaused = _isPaused;

    emit Paused(isPaused);
  }

  /**
   * @dev Set the time when the OptionMarket will cease trading before expiry.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _tradingCutoff The time to stop trading.
   */
  function setTradingCutoff(address _contractAddress, uint _tradingCutoff) public override onlyOwner {
    require(_tradingCutoff >= 6 hours && _tradingCutoff <= 14 days, "tradingCutoff value out of range");
    tradingCutoff[_contractAddress] = _tradingCutoff;
    emit TradingCutoffSet(_contractAddress, _tradingCutoff);
  }

  /**
   * @notice Set the option price fee coefficient for the OptionMarket.

   * @param _contractAddress The address of the OptionMarket.
   * @param _optionPriceFeeCoefficient The option price fee coefficient.
   */
  function setOptionPriceFeeCoefficient(address _contractAddress, uint _optionPriceFeeCoefficient)
    public
    override
    onlyOwner
  {
    require(_optionPriceFeeCoefficient <= 5e17, "optionPriceFeeCoefficient value out of range");
    optionPriceFeeCoefficient[_contractAddress] = _optionPriceFeeCoefficient;
    emit OptionPriceFeeCoefficientSet(_contractAddress, _optionPriceFeeCoefficient);
  }

  /**
   * @notice Set the spot price fee coefficient for the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _spotPriceFeeCoefficient The spot price fee coefficient.
   */
  function setSpotPriceFeeCoefficient(address _contractAddress, uint _spotPriceFeeCoefficient)
    public
    override
    onlyOwner
  {
    require(_spotPriceFeeCoefficient <= 1e17, "optionPriceFeeCoefficient value out of range");
    spotPriceFeeCoefficient[_contractAddress] = _spotPriceFeeCoefficient;
    emit SpotPriceFeeCoefficientSet(_contractAddress, _spotPriceFeeCoefficient);
  }

  /**
   * @notice Set the vega fee coefficient for the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _vegaFeeCoefficient The vega fee coefficient.
   */
  function setVegaFeeCoefficient(address _contractAddress, uint _vegaFeeCoefficient) public override onlyOwner {
    require(_vegaFeeCoefficient <= 100000e18, "optionPriceFeeCoefficient value out of range");
    vegaFeeCoefficient[_contractAddress] = _vegaFeeCoefficient;
    emit VegaFeeCoefficientSet(_contractAddress, _vegaFeeCoefficient);
  }

  /**
   * @notice Set the vega normalisation factor for the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _vegaNormFactor The vega normalisation factor.
   */
  function setVegaNormFactor(address _contractAddress, uint _vegaNormFactor) public override onlyOwner {
    require(_vegaNormFactor <= 10e18, "optionPriceFeeCoefficient value out of range");
    vegaNormFactor[_contractAddress] = _vegaNormFactor;
    emit VegaNormFactorSet(_contractAddress, _vegaNormFactor);
  }

  /**
   * @notice Set the standard size for the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _standardSize The size of an average trade.
   */
  function setStandardSize(address _contractAddress, uint _standardSize) public override onlyOwner {
    require(_standardSize >= 1e15 && _standardSize <= 100000e18, "standardSize value out of range");
    standardSize[_contractAddress] = _standardSize;
    emit StandardSizeSet(_contractAddress, _standardSize);
  }

  /**
   * @notice Set the skew adjustment factor for the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _skewAdjustmentFactor The skew adjustment factor.
   */
  function setSkewAdjustmentFactor(address _contractAddress, uint _skewAdjustmentFactor) public override onlyOwner {
    require(_skewAdjustmentFactor <= 10e18, "skewAdjustmentFactor value out of range");
    skewAdjustmentFactor[_contractAddress] = _skewAdjustmentFactor;
    emit SkewAdjustmentFactorSet(_contractAddress, _skewAdjustmentFactor);
  }

  /**
   * @notice Set the rate for the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _rateAndCarry The rate.
   */
  function setRateAndCarry(address _contractAddress, int _rateAndCarry) public override onlyOwner {
    require(_rateAndCarry <= 3e18 && _rateAndCarry >= -3e18, "rateAndCarry value out of range");
    rateAndCarry[_contractAddress] = _rateAndCarry;
    emit RateAndCarrySet(_contractAddress, _rateAndCarry);
  }

  /**
   * @notice Set the minimum Delta that the OptionMarket will trade.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _minDelta The minimum delta value.
   */
  function setMinDelta(address _contractAddress, int _minDelta) public override onlyOwner {
    require(_minDelta >= 0 && _minDelta <= 2e17, "minDelta value out of range");
    minDelta[_contractAddress] = _minDelta;
    emit MinDeltaSet(_contractAddress, _minDelta);
  }

  /**
   * @notice Set the minimum volatility option that the OptionMarket will trade.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _volatilityCutoff The minimum volatility value.
   */
  function setVolatilityCutoff(address _contractAddress, uint _volatilityCutoff) public override onlyOwner {
    require(_volatilityCutoff <= 2e18, "volatilityCutoff value out of range");
    volatilityCutoff[_contractAddress] = _volatilityCutoff;
    emit VolatilityCutoffSet(_contractAddress, _volatilityCutoff);
  }

  /**
   * @notice Set the quoteKey of the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _quoteKey The key of the quoteAsset.
   */
  function setQuoteKey(address _contractAddress, bytes32 _quoteKey) public override onlyOwner {
    quoteKey[_contractAddress] = _quoteKey;
    emit QuoteKeySet(_contractAddress, _quoteKey);
  }

  /**
   * @notice Set the baseKey of the OptionMarket.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param _baseKey The key of the baseAsset.
   */
  function setBaseKey(address _contractAddress, bytes32 _baseKey) public override onlyOwner {
    baseKey[_contractAddress] = _baseKey;
    emit BaseKeySet(_contractAddress, _baseKey);
  }

  // Getters

  /**
   * @notice Returns the price of the baseAsset.
   *
   * @param _contractAddress The address of the OptionMarket.
   */
  function getSpotPriceForMarket(address _contractAddress) external view override returns (uint) {
    return getSpotPrice(baseKey[_contractAddress]);
  }

  /**
   * @notice Gets spot price of an asset.
   * @dev All rates are denominated in terms of sUSD,
   * so the price of sUSD is always $1.00, and is never stale.
   *
   * @param to The key of the synthetic asset.
   */
  function getSpotPrice(bytes32 to) public view override returns (uint) {
    (uint rate, bool invalid) = exchangeRates.rateAndInvalid(to);
    require(!invalid && rate != 0, "rate is invalid");
    return rate;
  }

  /**
   * @notice Returns a PricingGlobals struct for a given market address.
   *
   * @param _contractAddress The address of the OptionMarket.
   */
  function getPricingGlobals(address _contractAddress)
    external
    view
    override
    notPaused
    returns (PricingGlobals memory)
  {
    return
      PricingGlobals({
        optionPriceFeeCoefficient: optionPriceFeeCoefficient[_contractAddress],
        spotPriceFeeCoefficient: spotPriceFeeCoefficient[_contractAddress],
        vegaFeeCoefficient: vegaFeeCoefficient[_contractAddress],
        vegaNormFactor: vegaNormFactor[_contractAddress],
        standardSize: standardSize[_contractAddress],
        skewAdjustmentFactor: skewAdjustmentFactor[_contractAddress],
        rateAndCarry: rateAndCarry[_contractAddress],
        minDelta: minDelta[_contractAddress],
        volatilityCutoff: volatilityCutoff[_contractAddress],
        spotPrice: getSpotPrice(baseKey[_contractAddress])
      });
  }

  /**
   * @notice Returns the GreekCacheGlobals.
   *
   * @param _contractAddress The address of the OptionMarket.
   */
  function getGreekCacheGlobals(address _contractAddress)
    external
    view
    override
    notPaused
    returns (GreekCacheGlobals memory)
  {
    return
      GreekCacheGlobals({
        rateAndCarry: rateAndCarry[_contractAddress],
        spotPrice: getSpotPrice(baseKey[_contractAddress])
      });
  }

  /**
   * @notice Returns the ExchangeGlobals.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param exchangeType The ExchangeType.
   */
  function getExchangeGlobals(address _contractAddress, ExchangeType exchangeType)
    public
    view
    override
    notPaused
    returns (ExchangeGlobals memory exchangeGlobals)
  {
    exchangeGlobals = ExchangeGlobals({
      spotPrice: 0,
      quoteKey: quoteKey[_contractAddress],
      baseKey: baseKey[_contractAddress],
      synthetix: synthetix,
      short: collateralShort,
      quoteBaseFeeRate: 0,
      baseQuoteFeeRate: 0
    });

    exchangeGlobals.spotPrice = getSpotPrice(exchangeGlobals.baseKey);

    if (exchangeType == ExchangeType.BASE_QUOTE || exchangeType == ExchangeType.ALL) {
      exchangeGlobals.baseQuoteFeeRate = exchanger.feeRateForExchange(
        exchangeGlobals.baseKey,
        exchangeGlobals.quoteKey
      );
    }

    if (exchangeType == ExchangeType.QUOTE_BASE || exchangeType == ExchangeType.ALL) {
      exchangeGlobals.quoteBaseFeeRate = exchanger.feeRateForExchange(
        exchangeGlobals.quoteKey,
        exchangeGlobals.baseKey
      );
    }
  }

  /**
   * @dev Returns the globals needed to perform a trade.
   * The purpose of this function is to provide all the necessary variables in 1 call. Note that GreekCacheGlobals are a
   * subset of PricingGlobals, so we generate that struct when OptionMarketPricer calls OptionGreekCache.
   *
   * @param _contractAddress The address of the OptionMarket.
   * @param isBuy  Is the trade buying or selling options to the OptionMarket.
   */
  function getGlobalsForOptionTrade(address _contractAddress, bool isBuy)
    external
    view
    override
    notPaused
    returns (
      PricingGlobals memory pricingGlobals,
      ExchangeGlobals memory exchangeGlobals,
      uint tradeCutoff
    )
  {
    // exchangeGlobals aren't necessary apart from long calls, but since they are the most expensive transaction
    // we add this overhead to other types of calls, to save gas on long calls.
    exchangeGlobals = getExchangeGlobals(_contractAddress, isBuy ? ExchangeType.QUOTE_BASE : ExchangeType.BASE_QUOTE);
    pricingGlobals = PricingGlobals({
      optionPriceFeeCoefficient: optionPriceFeeCoefficient[_contractAddress],
      spotPriceFeeCoefficient: spotPriceFeeCoefficient[_contractAddress],
      vegaFeeCoefficient: vegaFeeCoefficient[_contractAddress],
      vegaNormFactor: vegaNormFactor[_contractAddress],
      standardSize: standardSize[_contractAddress],
      skewAdjustmentFactor: skewAdjustmentFactor[_contractAddress],
      rateAndCarry: rateAndCarry[_contractAddress],
      minDelta: minDelta[_contractAddress],
      volatilityCutoff: volatilityCutoff[_contractAddress],
      spotPrice: exchangeGlobals.spotPrice
    });
    tradeCutoff = tradingCutoff[_contractAddress];
  }

  modifier notPaused {
    require(!isPaused, "contracts are paused");
    _;
  }

  /** Emitted when globals are set.
   */
  event GlobalsSet(
    ISynthetix _synthetix,
    IExchanger _exchanger,
    IExchangeRates _exchangeRates,
    ICollateralShort _collateralShort
  );
  /**
   * @dev Emitted when paused.
   */
  event Paused(bool isPaused);
  /**
   * @dev Emitted when trading cut-off is set.
   */
  event TradingCutoffSet(address indexed _contractAddress, uint _tradingCutoff);
  /**
   * @dev Emitted when option price fee coefficient is set.
   */
  event OptionPriceFeeCoefficientSet(address indexed _contractAddress, uint _optionPriceFeeCoefficient);
  /**
   * @dev Emitted when spot price fee coefficient is set.
   */
  event SpotPriceFeeCoefficientSet(address indexed _contractAddress, uint _spotPriceFeeCoefficient);
  /**
   * @dev Emitted when vega fee coefficient is set.
   */
  event VegaFeeCoefficientSet(address indexed _contractAddress, uint _vegaFeeCoefficient);
  /**
   * @dev Emitted when standard size is set.
   */
  event StandardSizeSet(address indexed _contractAddress, uint _standardSize);
  /**
   * @dev Emitted when skew ddjustment factor is set.
   */
  event SkewAdjustmentFactorSet(address indexed _contractAddress, uint _skewAdjustmentFactor);
  /**
   * @dev Emitted when vegaNorm factor is set.
   */
  event VegaNormFactorSet(address indexed _contractAddress, uint _vegaNormFactor);
  /**
   * @dev Emitted when rate and carry is set.
   */
  event RateAndCarrySet(address indexed _contractAddress, int _rateAndCarry);
  /**
   * @dev Emitted when min delta is set.
   */
  event MinDeltaSet(address indexed _contractAddress, int _minDelta);
  /**
   * @dev Emitted when volatility cutoff is set.
   */
  event VolatilityCutoffSet(address indexed _contractAddress, uint _volatilityCutoff);
  /**
   * @dev Emitted when quote key is set.
   */
  event QuoteKeySet(address indexed _contractAddress, bytes32 _quoteKey);
  /**
   * @dev Emitted when base key is set.
   */
  event BaseKeySet(address indexed _contractAddress, bytes32 _baseKey);
}
