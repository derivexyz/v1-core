# `OptionMarketPricer`

Logic for working out the price of an option. Includes the IV impact of the trade, the fee components and

premium.

## Modifiers:

- `onlyOptionMarket()`

## Functions:

- `init(address _optionMarket, contract OptionGreekCache _greekCache) (external)`

- `setPricingParams(struct OptionMarketPricer.PricingParameters _pricingParams) (public)`

- `setTradeLimitParams(struct OptionMarketPricer.TradeLimitParameters _tradeLimitParams) (public)`

- `setVarianceFeeParams(struct OptionMarketPricer.VarianceFeeParameters _varianceFeeParams) (public)`

- `updateCacheAndGetTradeResult(struct OptionMarket.Strike strike, struct OptionMarket.TradeParameters trade, uint256 boardBaseIv, uint256 boardExpiry) (external)`

- `ivImpactForTrade(struct OptionMarket.TradeParameters trade, uint256 boardBaseIv, uint256 strikeSkew) (public)`

- `getTradeResult(struct OptionMarket.TradeParameters trade, struct OptionGreekCache.TradePricing pricing, uint256 newBaseIv, uint256 newSkew) (public)`

- `getTimeWeightedFee(uint256 expiry, uint256 pointA, uint256 pointB, uint256 coefficient) (public)`

- `getVegaUtilFee(struct OptionMarket.TradeParameters trade, struct OptionGreekCache.TradePricing pricing) (public)`

- `getVarianceFee(struct OptionMarket.TradeParameters trade, struct OptionGreekCache.TradePricing pricing, uint256 skew) (public)`

- `getPricingParams() (external)`

- `getTradeLimitParams() (external)`

- `getVarianceFeeParams() (external)`

- `_min(uint256 x, uint256 y) (internal)`

- `_max(uint256 x, uint256 y) (internal)`

- `_abs(int256 val) (internal)`

## Events:

- `PricingParametersSet(struct OptionMarketPricer.PricingParameters pricingParams)`

- `TradeLimitParametersSet(struct OptionMarketPricer.TradeLimitParameters tradeLimitParams)`

- `VarianceFeeParametersSet(struct OptionMarketPricer.VarianceFeeParameters varianceFeeParams)`

### Modifier `onlyOptionMarket()`

### Function `init(address _optionMarket, contract OptionGreekCache _greekCache) external`

Initialize the contract.

#### Parameters:

- `_optionMarket`: OptionMarket address

- `_greekCache`: OptionGreekCache address

### Function `setPricingParams(struct OptionMarketPricer.PricingParameters _pricingParams) public`

@dev

#### Parameters:

- `params`: new parameters

### Function `setTradeLimitParams(struct OptionMarketPricer.TradeLimitParameters _tradeLimitParams) public`

@dev

#### Parameters:

- `params`: new parameters

### Function `setVarianceFeeParams(struct OptionMarketPricer.VarianceFeeParameters _varianceFeeParams) public`

@dev

#### Parameters:

- `params`: new parameters

### Function `updateCacheAndGetTradeResult(struct OptionMarket.Strike strike, struct OptionMarket.TradeParameters trade, uint256 boardBaseIv, uint256 boardExpiry) → struct OptionMarketPricer.TradeResult tradeResult external`

The entry point for the OptionMarket into the pricing logic when a trade is performed.

#### Parameters:

- `strike`: The strike being traded.

- `trade`: The trade struct, containing fields related to the ongoing trade.

- `boardBaseIv`: The base IV of the OptionBoard.

### Function `ivImpactForTrade(struct OptionMarket.TradeParameters trade, uint256 boardBaseIv, uint256 strikeSkew) → uint256 newBaseIv, uint256 newSkew public`

Calculates the impact a trade has on the base IV of the OptionBoard and the skew of the Strike.

#### Parameters:

- `trade`: The trade struct, containing fields related to the ongoing trade.

- `boardBaseIv`: The base IV of the OptionBoard.

- `strikeSkew`: The skew of the option being traded.

### Function `getTradeResult(struct OptionMarket.TradeParameters trade, struct OptionGreekCache.TradePricing pricing, uint256 newBaseIv, uint256 newSkew) → struct OptionMarketPricer.TradeResult tradeResult public`

Calculates the final premium for a trade.

#### Parameters:

- `trade`: The trade struct, containing fields related to the ongoing trade.

- `pricing`: Fields related to option pricing and required for fees.

### Function `getTimeWeightedFee(uint256 expiry, uint256 pointA, uint256 pointB, uint256 coefficient) → uint256 timeWeightedFee public`

Calculates a time weighted fee depending on the time to expiry. The fee graph has value = 1 and slope = 0

until pointA is reached; at which it increasing linearly to 2x at pointB. This only assumes pointA < pointB, so

fees can only get larger for longer dated options.

   |

   |       /

   |      /

2x |     /|

   |    / |

1x |___/  |

   |__________

       A  B

#### Parameters:

- `expiry`: the timestamp at which the listing/board expires

- `pointA`: the point (time to expiry) at which the fees start to increase beyond 1x

- `pointB`: the point (time to expiry) at which the fee are 2x

- `coefficient`: the fee coefficent as a result of the time to expiry.

### Function `getVegaUtilFee(struct OptionMarket.TradeParameters trade, struct OptionGreekCache.TradePricing pricing) → struct OptionMarketPricer.VegaUtilFeeComponents vegaUtilFeeComponents public`

Calculates vega utilisation to be used as part of the trade fee. If the trade reduces net standard vega, this

component is omitted from the fee.

#### Parameters:

- `trade`: The trade struct, containing fields related to the ongoing trade.

- `pricing`: Fields related to option pricing and required for fees.

### Function `getVarianceFee(struct OptionMarket.TradeParameters trade, struct OptionGreekCache.TradePricing pricing, uint256 skew) → struct OptionMarketPricer.VarianceFeeComponents varianceFeeComponents public`

Calculates the variance fee to be used as part of the trade fee.

#### Parameters:

- `trade`: The trade struct, containing fields related to the ongoing trade.

- `pricing`: Fields related to option pricing and required for fees.

### Function `getPricingParams() → struct OptionMarketPricer.PricingParameters pricingParameters external`

returns current pricing paramters

### Function `getTradeLimitParams() → struct OptionMarketPricer.TradeLimitParameters tradeLimitParameters external`

returns current trade limit parameters

### Function `getVarianceFeeParams() → struct OptionMarketPricer.VarianceFeeParameters varianceFeeParameters external`

returns current variance fee parameters

### Function `_min(uint256 x, uint256 y) → uint256 internal`

### Function `_max(uint256 x, uint256 y) → uint256 internal`

### Function `_abs(int256 val) → uint256 internal`

Compute the absolute value of `val`.

#### Parameters:

- `val`: The number to absolute value.

### Event `PricingParametersSet(struct OptionMarketPricer.PricingParameters pricingParams)`

### Event `TradeLimitParametersSet(struct OptionMarketPricer.TradeLimitParameters tradeLimitParams)`

### Event `VarianceFeeParametersSet(struct OptionMarketPricer.VarianceFeeParameters varianceFeeParams)`
