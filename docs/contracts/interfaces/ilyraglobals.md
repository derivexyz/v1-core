# `ILyraGlobals`

## Functions:

- `synthetix() (external)`

- `exchanger() (external)`

- `exchangeRates() (external)`

- `collateralShort() (external)`

- `isPaused() (external)`

- `tradingCutoff(address) (external)`

- `optionPriceFeeCoefficient(address) (external)`

- `spotPriceFeeCoefficient(address) (external)`

- `vegaFeeCoefficient(address) (external)`

- `vegaNormFactor(address) (external)`

- `standardSize(address) (external)`

- `skewAdjustmentFactor(address) (external)`

- `rateAndCarry(address) (external)`

- `minDelta(address) (external)`

- `volatilityCutoff(address) (external)`

- `quoteKey(address) (external)`

- `baseKey(address) (external)`

- `setGlobals(contract ISynthetix _synthetix, contract IExchanger _exchanger, contract IExchangeRates _exchangeRates, contract ICollateralShort _collateralShort) (external)`

- `setGlobalsForContract(address _contractAddress, uint256 _tradingCutoff, struct ILyraGlobals.PricingGlobals pricingGlobals, bytes32 _quoteKey, bytes32 _baseKey) (external)`

- `setPaused(bool _isPaused) (external)`

- `setTradingCutoff(address _contractAddress, uint256 _tradingCutoff) (external)`

- `setOptionPriceFeeCoefficient(address _contractAddress, uint256 _optionPriceFeeCoefficient) (external)`

- `setSpotPriceFeeCoefficient(address _contractAddress, uint256 _spotPriceFeeCoefficient) (external)`

- `setVegaFeeCoefficient(address _contractAddress, uint256 _vegaFeeCoefficient) (external)`

- `setVegaNormFactor(address _contractAddress, uint256 _vegaNormFactor) (external)`

- `setStandardSize(address _contractAddress, uint256 _standardSize) (external)`

- `setSkewAdjustmentFactor(address _contractAddress, uint256 _skewAdjustmentFactor) (external)`

- `setRateAndCarry(address _contractAddress, int256 _rateAndCarry) (external)`

- `setMinDelta(address _contractAddress, int256 _minDelta) (external)`

- `setVolatilityCutoff(address _contractAddress, uint256 _volatilityCutoff) (external)`

- `setQuoteKey(address _contractAddress, bytes32 _quoteKey) (external)`

- `setBaseKey(address _contractAddress, bytes32 _baseKey) (external)`

- `getSpotPriceForMarket(address _contractAddress) (external)`

- `getSpotPrice(bytes32 to) (external)`

- `getPricingGlobals(address _contractAddress) (external)`

- `getGreekCacheGlobals(address _contractAddress) (external)`

- `getExchangeGlobals(address _contractAddress, enum ILyraGlobals.ExchangeType exchangeType) (external)`

- `getGlobalsForOptionTrade(address _contractAddress, bool isBuy) (external)`

### Function `synthetix() → contract ISynthetix external`

### Function `exchanger() → contract IExchanger external`

### Function `exchangeRates() → contract IExchangeRates external`

### Function `collateralShort() → contract ICollateralShort external`

### Function `isPaused() → bool external`

### Function `tradingCutoff(address) → uint256 external`

### Function `optionPriceFeeCoefficient(address) → uint256 external`

### Function `spotPriceFeeCoefficient(address) → uint256 external`

### Function `vegaFeeCoefficient(address) → uint256 external`

### Function `vegaNormFactor(address) → uint256 external`

### Function `standardSize(address) → uint256 external`

### Function `skewAdjustmentFactor(address) → uint256 external`

### Function `rateAndCarry(address) → int256 external`

### Function `minDelta(address) → int256 external`

### Function `volatilityCutoff(address) → uint256 external`

### Function `quoteKey(address) → bytes32 external`

### Function `baseKey(address) → bytes32 external`

### Function `setGlobals(contract ISynthetix _synthetix, contract IExchanger _exchanger, contract IExchangeRates _exchangeRates, contract ICollateralShort _collateralShort) external`

### Function `setGlobalsForContract(address _contractAddress, uint256 _tradingCutoff, struct ILyraGlobals.PricingGlobals pricingGlobals, bytes32 _quoteKey, bytes32 _baseKey) external`

### Function `setPaused(bool _isPaused) external`

### Function `setTradingCutoff(address _contractAddress, uint256 _tradingCutoff) external`

### Function `setOptionPriceFeeCoefficient(address _contractAddress, uint256 _optionPriceFeeCoefficient) external`

### Function `setSpotPriceFeeCoefficient(address _contractAddress, uint256 _spotPriceFeeCoefficient) external`

### Function `setVegaFeeCoefficient(address _contractAddress, uint256 _vegaFeeCoefficient) external`

### Function `setVegaNormFactor(address _contractAddress, uint256 _vegaNormFactor) external`

### Function `setStandardSize(address _contractAddress, uint256 _standardSize) external`

### Function `setSkewAdjustmentFactor(address _contractAddress, uint256 _skewAdjustmentFactor) external`

### Function `setRateAndCarry(address _contractAddress, int256 _rateAndCarry) external`

### Function `setMinDelta(address _contractAddress, int256 _minDelta) external`

### Function `setVolatilityCutoff(address _contractAddress, uint256 _volatilityCutoff) external`

### Function `setQuoteKey(address _contractAddress, bytes32 _quoteKey) external`

### Function `setBaseKey(address _contractAddress, bytes32 _baseKey) external`

### Function `getSpotPriceForMarket(address _contractAddress) → uint256 external`

### Function `getSpotPrice(bytes32 to) → uint256 external`

### Function `getPricingGlobals(address _contractAddress) → struct ILyraGlobals.PricingGlobals external`

### Function `getGreekCacheGlobals(address _contractAddress) → struct ILyraGlobals.GreekCacheGlobals external`

### Function `getExchangeGlobals(address _contractAddress, enum ILyraGlobals.ExchangeType exchangeType) → struct ILyraGlobals.ExchangeGlobals exchangeGlobals external`

### Function `getGlobalsForOptionTrade(address _contractAddress, bool isBuy) → struct ILyraGlobals.PricingGlobals pricingGlobals, struct ILyraGlobals.ExchangeGlobals exchangeGlobals, uint256 tradeCutoff external`
