# `OptionMarketPricer`

A collection of pricing logic for the OptionMarket. Retrieves globals from LyraGlobals and uses them, along

with pricing returned from OptionGreekCache to determine the cost and fee of the options being purchased; also

provides the scale for adjusting iv/skew in the OptionMarket. It is also responsible for passing the new call/put

exposure for a listing through to the OptionGreekCache.

## Modifiers:

- `onlyOptionMarket()`

## Functions:

- `init(address _optionMarket, contract OptionGreekCache _greekCache) (external)`

- `ivImpactForTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) (public)`

- `updateCacheAndGetTotalCost(struct OptionMarket.OptionListing listing, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) (external)`

- `getPremium(struct OptionMarket.Trade trade, struct OptionMarketPricer.Pricing pricing, struct LyraGlobals.PricingGlobals pricingGlobals) (public)`

- `getVegaUtil(struct OptionMarket.Trade trade, struct OptionMarketPricer.Pricing pricing, struct LyraGlobals.PricingGlobals pricingGlobals) (public)`

- `getFee(struct LyraGlobals.PricingGlobals pricingGlobals, uint256 amount, uint256 optionPrice, uint256 vegaUtil) (public)`

- `abs(int256 val) (internal)`

### Modifier `onlyOptionMarket()`

### Function `init(address _optionMarket, contract OptionGreekCache _greekCache) external`

Initialize the contract.

#### Parameters:

- `_optionMarket`: OptionMarket address

- `_greekCache`: OptionGreekCache address

### Function `ivImpactForTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) → uint256, uint256 public`

Calculates the impact a trade has on the base IV of the

OptionBoard and the skew of the OptionListing.

#### Parameters:

- `listing`: The OptionListing.

- `trade`: The Trade.

- `pricingGlobals`: The PricingGlobals.

- `boardBaseIv`: The base IV of the OptionBoard.

### Function `updateCacheAndGetTotalCost(struct OptionMarket.OptionListing listing, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) → uint256 totalCost, uint256 newBaseIv, uint256 newSkew external`

Acts as the entry point for the OptionMarket into the

pricing logic when a trade is performed.

#### Parameters:

- `listing`: The OptionListing.

- `trade`: The Trade.

- `pricingGlobals`: The PricingGlobals.

- `boardBaseIv`: The base IV of the OptionBoard.

### Function `getPremium(struct OptionMarket.Trade trade, struct OptionMarketPricer.Pricing pricing, struct LyraGlobals.PricingGlobals pricingGlobals) → uint256 premium public`

Calculates the premium for a trade.

#### Parameters:

- `trade`: The Trade.

- `pricing`: The Pricing.

- `pricingGlobals`: The PricingGlobals.

### Function `getVegaUtil(struct OptionMarket.Trade trade, struct OptionMarketPricer.Pricing pricing, struct LyraGlobals.PricingGlobals pricingGlobals) → uint256 vegaUtil public`

Calculates vega utilisation to be used as part of the trade fee.

If the trade reduces net standard vega, it is omitted from the fee.

#### Parameters:

- `trade`: The Trade.

- `pricing`: The Pricing.

- `pricingGlobals`: The PricingGlobals.

### Function `getFee(struct LyraGlobals.PricingGlobals pricingGlobals, uint256 amount, uint256 optionPrice, uint256 vegaUtil) → uint256 fee public`

Calculate the fee for a trade.

#### Parameters:

- `pricingGlobals`: The PricingGlobals.

- `amount`: The amount of options being traded.

- `optionPrice`: The fair price for one option.

- `vegaUtil`: The vega utilisation of the LiquidityPool.

### Function `abs(int256 val) → uint256 absVal internal`

Compute the absolute value of `val`.

#### Parameters:

- `val`: The number to absolute value.
