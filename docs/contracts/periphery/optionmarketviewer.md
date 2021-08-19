# `OptionMarketViewer`

Provides helpful functions to allow the dapp to operate more smoothly; logic in getPremiumForTrade is vital to

ensuring accurate prices are provided to the user.

## Functions:

- `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionMarketPricer _optionMarketPricer, contract OptionGreekCache _greekCache, contract OptionToken _optionToken, contract LiquidityPool _liquidityPool, contract BlackScholes _blackScholes) (external)`

- `getBoard(uint256 boardId) (public)`

- `getListing(uint256 listingId) (public)`

- `getListingCache(uint256 listingId) (internal)`

- `getGlobalCache() (internal)`

- `getLiveBoards() (external)`

- `getListingsForBoard(uint256 boardId) (external)`

- `getListingViewAndBalance(uint256 listingId, address user) (external)`

- `getListingView(uint256 listingId) (public)`

- `getPremiumForOpen(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) (external)`

- `getPremiumForClose(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) (external)`

- `getPremiumForTrade(uint256 _listingId, enum OptionMarket.TradeType tradeType, bool isBuy, uint256 amount) (public)`

- `_getPremiumForTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals, bool isCall) (public)`

- `_getPricingForTrade(struct LyraGlobals.PricingGlobals pricingGlobals, struct OptionMarket.Trade trade, uint256 _listingId, int256 newCallExposure, int256 newPutExposure, bool isCall) (internal)`

- `timeToMaturitySeconds(uint256 expiry) (internal)`

### Function `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionMarketPricer _optionMarketPricer, contract OptionGreekCache _greekCache, contract OptionToken _optionToken, contract LiquidityPool _liquidityPool, contract BlackScholes _blackScholes) external`

Initializes the contract

#### Parameters:

- `_globals`: LyraGlobals contract address

- `_optionMarket`: OptionMarket contract address

- `_optionMarketPricer`: OptionMarketPricer contract address

- `_greekCache`: OptionGreekCache contract address

- `_optionToken`: OptionToken contract address

- `_liquidityPool`: LiquidityPool contract address

- `_blackScholes`: BlackScholes contract address

### Function `getBoard(uint256 boardId) → struct OptionMarket.OptionBoard public`

Gets the OptionBoard struct from the OptionMarket

### Function `getListing(uint256 listingId) → struct OptionMarket.OptionListing public`

Gets the OptionListing struct from the OptionMarket

### Function `getListingCache(uint256 listingId) → struct OptionGreekCache.OptionListingCache internal`

Gets the OptionListingCache struct from the OptionGreekCache

### Function `getGlobalCache() → struct OptionGreekCache.GlobalCache internal`

Gets the GlobalCache struct from the OptionGreekCache

### Function `getLiveBoards() → struct OptionMarketViewer.BoardView[] boards external`

Gets the array of liveBoards with details from the OptionMarket

### Function `getListingsForBoard(uint256 boardId) → struct OptionMarketViewer.ListingView[] boardListings external`

Gets detailed ListingViews for all listings on a board

### Function `getListingViewAndBalance(uint256 listingId, address user) → struct OptionMarketViewer.ListingView listingView, uint256 longCallAmt, uint256 longPutAmt, uint256 shortCallAmt, uint256 shortPutAmt external`

Gets detailed ListingView along with all of a user's balances for a given listing

### Function `getListingView(uint256 listingId) → struct OptionMarketViewer.ListingView listingView public`

Gets a detailed ListingView for a given listing

### Function `getPremiumForOpen(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) → uint256 premium, uint256 newIv external`

Gets the premium and new iv value after opening

### Function `getPremiumForClose(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) → uint256 premium, uint256 newIv external`

Gets the premium and new iv value after closing

### Function `getPremiumForTrade(uint256 _listingId, enum OptionMarket.TradeType tradeType, bool isBuy, uint256 amount) → uint256 premium, uint256 newIv public`

Gets the premium and new iv value for a given trade

### Function `_getPremiumForTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals, bool isCall) → uint256, uint256 public`

Gets the premium and new iv value for a given trade

### Function `_getPricingForTrade(struct LyraGlobals.PricingGlobals pricingGlobals, struct OptionMarket.Trade trade, uint256 _listingId, int256 newCallExposure, int256 newPutExposure, bool isCall) → struct OptionMarketPricer.Pricing pricing internal`

### Function `timeToMaturitySeconds(uint256 expiry) → uint256 timeToMaturity internal`

Gets seconds to expiry.
