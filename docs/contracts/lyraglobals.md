# `LyraGlobals`

Contract holds onto all modifiable variables for the system. Also retrieves current spot price and fee rates

for a given currency pair.

Although this mixes two different systems, it was required to minimise gas costs from calling between contracts. In a

similar vein, a number of globals are bunched and retrieved together to minimise the number of calls made between

contracts.

In general the governance contract should be the owner of this.

TODO: verify all paths are actually paused when isPaused is set

## Functions:

- `setGlobals(contract ISynthetix _synthetix, contract IExchanger _exchanger, contract IExchangeRates _exchangeRates, contract ICollateralShort _collateralShort) (external)`

- `setGlobalsForContract(address _contractAddress, uint256 _tradingCutoff, struct LyraGlobals.PricingGlobals pricingGlobals, bytes32 _quoteKey, bytes32 _baseKey) (external)`

- `setPaused(bool _isPaused) (external)`

- `setTradingCutoff(address _contractAddress, uint256 _tradingCutoff) (public)`

- `setOptionPriceFeeCoefficient(address _contractAddress, uint256 _optionPriceFeeCoefficient) (public)`

- `setSpotPriceFeeCoefficient(address _contractAddress, uint256 _spotPriceFeeCoefficient) (public)`

- `setVegaFeeCoefficient(address _contractAddress, uint256 _vegaFeeCoefficient) (public)`

- `setVegaNormFactor(address _contractAddress, uint256 _vegaNormFactor) (public)`

- `setStandardSize(address _contractAddress, uint256 _standardSize) (public)`

- `setSkewAdjustmentFactor(address _contractAddress, uint256 _skewAdjustmentFactor) (public)`

- `setRateAndCarry(address _contractAddress, int256 _rateAndCarry) (public)`

- `setMinDelta(address _contractAddress, int256 _minDelta) (public)`

- `setQuoteKey(address _contractAddress, bytes32 _quoteKey) (public)`

- `setBaseKey(address _contractAddress, bytes32 _baseKey) (public)`

- `getSpotPriceForMarket(address _contractAddress) (external)`

- `getSpotPrice(bytes32 to) (public)`

- `getPricingGlobals(address _contractAddress) (external)`

- `getGreekCacheGlobals(address _contractAddress) (external)`

- `getExchangeGlobals(address _contractAddress, enum LyraGlobals.ExchangeType exchangeType) (public)`

- `getGlobalsForOptionTrade(address _contractAddress, bool isBuy) (external)`

## Events:

- `GlobalsSet(contract ISynthetix _synthetix, contract IExchanger _exchanger, contract IExchangeRates _exchangeRates, contract ICollateralShort _collateralShort)`

- `Paused(bool isPaused)`

- `TradingCutoffSet(address _contractAddress, uint256 _tradingCutoff)`

- `OptionPriceFeeCoefficientSet(address _contractAddress, uint256 _optionPriceFeeCoefficient)`

- `SpotPriceFeeCoefficientSet(address _contractAddress, uint256 _spotPriceFeeCoefficient)`

- `VegaFeeCoefficientSet(address _contractAddress, uint256 _vegaFeeCoefficient)`

- `StandardSizeSet(address _contractAddress, uint256 _standardSize)`

- `SkewAdjustmentFactorSet(address _contractAddress, uint256 _skewAdjustmentFactor)`

- `VegaNormFactorSet(address _contractAddress, uint256 _vegaNormFactor)`

- `RateAndCarrySet(address _contractAddress, int256 _rateAndCarry)`

- `MinDeltaSet(address _contractAddress, int256 _minDelta)`

- `QuoteKeySet(address _contractAddress, bytes32 _quoteKey)`

- `BaseKeySet(address _contractAddress, bytes32 _baseKey)`

### Function `setGlobals(contract ISynthetix _synthetix, contract IExchanger _exchanger, contract IExchangeRates _exchangeRates, contract ICollateralShort _collateralShort) external`

Set the globals that apply to all OptionMarkets.

#### Parameters:

- `_synthetix`: The address of Synthetix.

- `_exchanger`: The address of Synthetix's Exchanger.

- `_exchangeRates`: The address of Synthetix's ExchangeRates.

- `_collateralShort`: The address of Synthetix's CollateralShort.

### Function `setGlobalsForContract(address _contractAddress, uint256 _tradingCutoff, struct LyraGlobals.PricingGlobals pricingGlobals, bytes32 _quoteKey, bytes32 _baseKey) external`

Set the globals for a specific OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_tradingCutoff`: The time to stop trading.

- `pricingGlobals`: The PricingGlobals.

- `_quoteKey`: The key of the quoteAsset.

- `_baseKey`: The key of the baseAsset.

### Function `setPaused(bool _isPaused) external`

Pauses the contract.

#### Parameters:

- `_isPaused`: Should the contract be paused or not?

### Function `setTradingCutoff(address _contractAddress, uint256 _tradingCutoff) public`

Set the time at which the OptionMarket will cease trading before expiry.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_tradingCutoff`: The time to stop trading.

### Function `setOptionPriceFeeCoefficient(address _contractAddress, uint256 _optionPriceFeeCoefficient) public`

Set the option price fee coefficient for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_optionPriceFeeCoefficient`: The option price fee coefficient.

### Function `setSpotPriceFeeCoefficient(address _contractAddress, uint256 _spotPriceFeeCoefficient) public`

Set the spot price fee coefficient for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_spotPriceFeeCoefficient`: The spot price fee coefficient.

### Function `setVegaFeeCoefficient(address _contractAddress, uint256 _vegaFeeCoefficient) public`

Set the vega fee coefficient for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_vegaFeeCoefficient`: The vega fee coefficient.

### Function `setVegaNormFactor(address _contractAddress, uint256 _vegaNormFactor) public`

Set the vega normalisation factor for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_vegaNormFactor`: The vega normalisation factor.

### Function `setStandardSize(address _contractAddress, uint256 _standardSize) public`

Set the standard size for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_standardSize`: The size of an average trade.

### Function `setSkewAdjustmentFactor(address _contractAddress, uint256 _skewAdjustmentFactor) public`

Set the skew adjustment factor for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_skewAdjustmentFactor`: The skew adjustment factor.

### Function `setRateAndCarry(address _contractAddress, int256 _rateAndCarry) public`

Set the rate for the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_rateAndCarry`: The rate.

### Function `setMinDelta(address _contractAddress, int256 _minDelta) public`

Set the minimum Delta option that the OptionMarket will trade.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_minDelta`: THe minimum delta value.

### Function `setQuoteKey(address _contractAddress, bytes32 _quoteKey) public`

Set the quoteKey of the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_quoteKey`: The key of the quoteAsset.

### Function `setBaseKey(address _contractAddress, bytes32 _baseKey) public`

Set the baseKey of the OptionMarket.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `_baseKey`: The key of the baseAsset.

### Function `getSpotPriceForMarket(address _contractAddress) → uint256 external`

Returns the price of the baseAsset.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

### Function `getSpotPrice(bytes32 to) → uint256 public`

Gets spot price of an asset.

All rates are denominated in terms of sUSD,

so the price of sUSD is always $1.00, and is never stale.

#### Parameters:

- `to`: The key of the synthetic asset.

### Function `getPricingGlobals(address _contractAddress) → struct LyraGlobals.PricingGlobals external`

Returns the PricingGlobals.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

### Function `getGreekCacheGlobals(address _contractAddress) → struct LyraGlobals.GreekCacheGlobals external`

Returns the GreekCacheGlobals.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

### Function `getExchangeGlobals(address _contractAddress, enum LyraGlobals.ExchangeType exchangeType) → struct LyraGlobals.ExchangeGlobals exchangeGlobals public`

Returns the ExchangeGlobals.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `exchangeType`: The ExchangeType.

### Function `getGlobalsForOptionTrade(address _contractAddress, bool isBuy) → struct LyraGlobals.PricingGlobals pricingGlobals, struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 tradeCutoff external`

Returns the globals needed to perform a trade.

The purpose of this function is to provide all the necessary

variables in 1 call. Note GreekCacheGlobals are a subset of PricingGlobals,

so we generate that struct when needed.

#### Parameters:

- `_contractAddress`: The address of the OptionMarket.

- `isBuy`:  Is the trade buying or selling options to the OptionMarket.

### Event `GlobalsSet(contract ISynthetix _synthetix, contract IExchanger _exchanger, contract IExchangeRates _exchangeRates, contract ICollateralShort _collateralShort)`

Emitted when globals are set.

### Event `Paused(bool isPaused)`

Emitted when paused.

### Event `TradingCutoffSet(address _contractAddress, uint256 _tradingCutoff)`

Emitted when trading cut-off is set.

### Event `OptionPriceFeeCoefficientSet(address _contractAddress, uint256 _optionPriceFeeCoefficient)`

Emitted when option price fee coefficient is set.

### Event `SpotPriceFeeCoefficientSet(address _contractAddress, uint256 _spotPriceFeeCoefficient)`

Emitted when spot price fee coefficient is set.

### Event `VegaFeeCoefficientSet(address _contractAddress, uint256 _vegaFeeCoefficient)`

Emitted when vega fee coefficient is set.

### Event `StandardSizeSet(address _contractAddress, uint256 _standardSize)`

Emitted when standard size is set.

### Event `SkewAdjustmentFactorSet(address _contractAddress, uint256 _skewAdjustmentFactor)`

Emitted when skew ddjustment factor is set.

### Event `VegaNormFactorSet(address _contractAddress, uint256 _vegaNormFactor)`

Emitted when vegaNorm factor is set.

### Event `RateAndCarrySet(address _contractAddress, int256 _rateAndCarry)`

Emitted when rate and carry is set.

### Event `MinDeltaSet(address _contractAddress, int256 _minDelta)`

Emitted when min delta is set.

### Event `QuoteKeySet(address _contractAddress, bytes32 _quoteKey)`

Emitted when quote key is set.

### Event `BaseKeySet(address _contractAddress, bytes32 _baseKey)`

Emitted when base key is set.
