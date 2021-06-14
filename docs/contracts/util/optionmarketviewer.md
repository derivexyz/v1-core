# `OptionMarketViewer`

## Functions:

- `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionMarketPricer _optionMarketPricer, contract OptionGreekCache _greekCache, contract LiquidityPool _liquidityPool, contract BlackScholes _blackScholes) (external)`

- `getBoard(uint256 boardId) (public)`

- `getListing(uint256 listingId) (public)`

- `getListingCache(uint256 listingId) (internal)`

- `getGlobalCache() (internal)`

- `getLiveBoards() (external)`

- `getListingsForBoard(uint256 boardId) (external)`

- `getListingViewAndBalance(uint256 listingId, address user) (external)`

- `getListingView(uint256 listingId) (public)`

- `getOwnedOptions(address user) (external)`

- `getPremiumForTrade(uint256 _listingId, bool isCall, bool isBuy, bool isLong, uint256 amount) (public)`

- `_getPremiumForTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals) (public)`

- `_getPricingForTrade(struct LyraGlobals.PricingGlobals pricingGlobals, struct OptionMarket.Trade trade, uint256 _listingId, int256 newCallExposure, int256 newPutExposure) (internal)`

- `timeToMaturitySeconds(uint256 expiry) (internal)`

### Function `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionMarketPricer _optionMarketPricer, contract OptionGreekCache _greekCache, contract LiquidityPool _liquidityPool, contract BlackScholes _blackScholes) external`

### Function `getBoard(uint256 boardId) → struct OptionMarket.OptionBoard public`

### Function `getListing(uint256 listingId) → struct OptionMarket.OptionListing public`

### Function `getListingCache(uint256 listingId) → struct OptionGreekCache.OptionListingCache internal`

### Function `getGlobalCache() → struct OptionGreekCache.GlobalCache internal`

### Function `getLiveBoards() → struct OptionMarketViewer.BoardView[] boards external`

### Function `getListingsForBoard(uint256 boardId) → struct OptionMarketViewer.ListingView[] boardListings external`

### Function `getListingViewAndBalance(uint256 listingId, address user) → struct OptionMarketViewer.ListingView listingView, int256 callAmt, int256 putAmt external`

### Function `getListingView(uint256 listingId) → struct OptionMarketViewer.ListingView listingView public`

### Function `getOwnedOptions(address user) → struct OptionMarketViewer.OwnedOptionView[] ownedListings external`

### Function `getPremiumForTrade(uint256 _listingId, bool isCall, bool isBuy, bool isLong, uint256 amount) → uint256 premium, uint256 newIv public`

### Function `_getPremiumForTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals) → uint256, uint256 public`

### Function `_getPricingForTrade(struct LyraGlobals.PricingGlobals pricingGlobals, struct OptionMarket.Trade trade, uint256 _listingId, int256 newCallExposure, int256 newPutExposure) → struct OptionMarketPricer.Pricing internal`

### Function `timeToMaturitySeconds(uint256 expiry) → uint256 timeToMaturity internal`
