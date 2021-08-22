# `IOptionMarketPricer`

## Functions:

- `ivImpactForTrade(struct IOptionMarket.OptionListing listing, struct IOptionMarket.Trade trade, struct ILyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) (external)`

- `updateCacheAndGetTotalCost(struct IOptionMarket.OptionListing listing, struct IOptionMarket.Trade trade, struct ILyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) (external)`

- `getPremium(struct IOptionMarket.Trade trade, struct IOptionMarketPricer.Pricing pricing, struct ILyraGlobals.PricingGlobals pricingGlobals) (external)`

- `getVegaUtil(struct IOptionMarket.Trade trade, struct IOptionMarketPricer.Pricing pricing, struct ILyraGlobals.PricingGlobals pricingGlobals) (external)`

- `getFee(struct ILyraGlobals.PricingGlobals pricingGlobals, uint256 amount, uint256 optionPrice, uint256 vegaUtil) (external)`

### Function `ivImpactForTrade(struct IOptionMarket.OptionListing listing, struct IOptionMarket.Trade trade, struct ILyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) → uint256, uint256 external`

### Function `updateCacheAndGetTotalCost(struct IOptionMarket.OptionListing listing, struct IOptionMarket.Trade trade, struct ILyraGlobals.PricingGlobals pricingGlobals, uint256 boardBaseIv) → uint256 totalCost, uint256 newBaseIv, uint256 newSkew external`

### Function `getPremium(struct IOptionMarket.Trade trade, struct IOptionMarketPricer.Pricing pricing, struct ILyraGlobals.PricingGlobals pricingGlobals) → uint256 premium external`

### Function `getVegaUtil(struct IOptionMarket.Trade trade, struct IOptionMarketPricer.Pricing pricing, struct ILyraGlobals.PricingGlobals pricingGlobals) → uint256 vegaUtil external`

### Function `getFee(struct ILyraGlobals.PricingGlobals pricingGlobals, uint256 amount, uint256 optionPrice, uint256 vegaUtil) → uint256 fee external`
