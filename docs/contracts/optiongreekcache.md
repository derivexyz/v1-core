# `OptionGreekCache`

A system for caching greeks for listings and boards that exist in OptionMarket. This is required to help reduce

gas costs dramatically for trades occurring at a high frequency. This will also permit partial updates of the system

in the case of a large number of boards/listings being present on the system, allowing an external party to update

all the greeks separately, before permitting trades to occur.

As greeks are fairly stable the further from expiry an option is, and given the price hasn't moved much, we consider

the cache to be out of date using the following formula:

safeTimePeriod = 30 days; // Arbitrary number of days

acceptablePriceMovement = 5%; // This is completely arbitrary, lower is safer

if (timeToExpiry < safeTimePeriod) {

 acceptablePriceMovement = acceptablePriceMovement * timeToExpiry / safeTimePeriod

}

This can also work as an indirect mechanism to limit trading in cases of large price swings, as the cache will be out

of date more often.

The optionMarket is the source of truth for which boards make up the netDelta/netStdVega positions, OptionMarket

will call addBoard and removeBoard when boards are added or removed.

Note: these positions are from the perspective of the user's net positions, hence when returned to the pricing module

they are inverted.

## Modifiers:

- `onlyOptionMarket()`

- `onlyOptionMarketPricer()`

## Functions:

- `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionMarketPricer _optionPricer, contract BlackScholes _blackScholes) (external)`

- `addBoard(uint256 boardId) (external)`

- `removeBoard(uint256 boardCacheId) (external)`

- `getOptionMarketListing(uint256 listingId) (internal)`

- `updateAllStaleBoards() (external)`

- `_updateAllStaleBoards(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals) (internal)`

- `updateBoardCachedGreeks(uint256 boardCacheId) (external)`

- `_updateBoardCachedGreeks(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals, uint256 boardCacheId) (internal)`

- `updateListingCacheAndGetPrice(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals, uint256 listingCacheId, int256 newCallExposure, int256 newPutExposure, uint256 iv, uint256 skew) (external)`

- `_updateListingCachedGreeks(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals, struct OptionGreekCache.OptionListingCache listingCache, struct OptionGreekCache.OptionBoardCache boardCache, bool returnCallPrice, int256 newCallExposure, int256 newPutExposure) (internal)`

- `isGlobalCacheStale() (external)`

- `_isGlobalCacheStale(uint256 spotPrice) (internal)`

- `isBoardCacheStale(uint256 boardCacheId) (external)`

- `_isBoardCacheStale(uint256 boardCacheId, uint256 spotPrice) (internal)`

- `isUpdatedAtTimeStale(uint256 updatedAt) (internal)`

- `isPriceMoveAcceptable(uint256 pastPrice, uint256 currentPrice, uint256 timeToExpirySec) (internal)`

- `_updateBoardLastUpdatedAt(struct OptionGreekCache.OptionBoardCache boardCache) (internal)`

- `_updateGlobalLastUpdatedAt() (internal)`

- `timeToMaturitySeconds(uint256 expiry) (internal)`

- `getSecondsTo(uint256 fromTime, uint256 toTime) (internal)`

- `getCurrentPrice() (internal)`

## Events:

- `ListingGreeksUpdated(uint256 listingId, int256 callDelta, int256 putDelta, uint256 vega, uint256 price, uint256 baseIv, uint256 skew)`

- `ListingExposureUpdated(uint256 listingId, int256 newCallExposure, int256 newPutExposure)`

- `GlobalCacheUpdated(int256 netDelta, int256 netStdVega)`

### Modifier `onlyOptionMarket()`

### Modifier `onlyOptionMarketPricer()`

### Function `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionMarketPricer _optionPricer, contract BlackScholes _blackScholes) external`

Initialize the contract.

#### Parameters:

- `_globals`: LyraGlobals address

- `_optionMarket`: OptionMarket address

- `_optionPricer`: OptionMarketPricer address

### Function `addBoard(uint256 boardId) external`

Adds a new OptionBoardCache.

Called by the OptionMarket when an OptionBoard is added.

#### Parameters:

- `boardId`: The id of the OptionBoard.

### Function `removeBoard(uint256 boardCacheId) external`

Removes an OptionBoardCache.

Called by the OptionMarket when an OptionBoard is liquidated.

#### Parameters:

- `boardCacheId`: The id of the OptionBoard.

### Function `getOptionMarketListing(uint256 listingId) → struct OptionMarket.OptionListing internal`

Retrieves an OptionListing from the OptionMarket.

#### Parameters:

- `listingId`: The id of the OptionListing.

### Function `updateAllStaleBoards() → int256 external`

Updates all stale boards.

### Function `_updateAllStaleBoards(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals) internal`

Updates all stale boards.

#### Parameters:

- `greekCacheGlobals`: The GreekCacheGlobals.

### Function `updateBoardCachedGreeks(uint256 boardCacheId) external`

Updates the cached greeks for an OptionBoardCache.

#### Parameters:

- `boardCacheId`: The id of the OptionBoardCache.

### Function `_updateBoardCachedGreeks(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals, uint256 boardCacheId) internal`

Updates the cached greeks for an OptionBoardCache.

#### Parameters:

- `greekCacheGlobals`: The GreekCacheGlobals.

- `boardCacheId`: The id of the OptionBoardCache.

### Function `updateListingCacheAndGetPrice(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals, uint256 listingCacheId, int256 newCallExposure, int256 newPutExposure, uint256 iv, uint256 skew) → struct OptionMarketPricer.Pricing external`

Updates the OptionListingCache to reflect the new exposure.

#### Parameters:

- `greekCacheGlobals`: The GreekCacheGlobals.

- `listingCacheId`: The id of the OptionListingCache.

- `newCallExposure`: The new call exposure of the OptionListing.

- `newPutExposure`: The new put exposure of the OptionListing.

- `iv`: The new iv of the OptionBoardCache.

- `skew`: The new skew of the OptionListingCache.

### Function `_updateListingCachedGreeks(struct LyraGlobals.GreekCacheGlobals greekCacheGlobals, struct OptionGreekCache.OptionListingCache listingCache, struct OptionGreekCache.OptionBoardCache boardCache, bool returnCallPrice, int256 newCallExposure, int256 newPutExposure) → struct OptionMarketPricer.Pricing pricing internal`

Updates an OptionListingCache.

#### Parameters:

- `greekCacheGlobals`: The GreekCacheGlobals.

- `listingCache`: The OptionListingCache.

- `boardCache`: The OptionBoardCache.

- `returnCallPrice`: If true, return the call price, otherwise return the put price.

### Function `isGlobalCacheStale() → bool external`

Checks if the GlobalCache is stale.

### Function `_isGlobalCacheStale(uint256 spotPrice) → bool internal`

Checks if the GlobalCache is stale.

#### Parameters:

- `spotPrice`: The price of the baseAsset.

### Function `isBoardCacheStale(uint256 boardCacheId) → bool external`

Checks if the OptionBoardCache is stale.

#### Parameters:

- `boardCacheId`: The OptionBoardCache id.

### Function `_isBoardCacheStale(uint256 boardCacheId, uint256 spotPrice) → bool internal`

Checks if the OptionBoardCache is stale.

#### Parameters:

- `boardCacheId`: The OptionBoardCache id.

- `spotPrice`: The price of the baseAsset.

### Function `isUpdatedAtTimeStale(uint256 updatedAt) → bool internal`

Checks if `updatedAt` is stale.

#### Parameters:

- `updatedAt`: The time of the last update.

### Function `isPriceMoveAcceptable(uint256 pastPrice, uint256 currentPrice, uint256 timeToExpirySec) → bool internal`

Check if the price move of an asset is acceptable given the time to expiry.

#### Parameters:

- `pastPrice`: The previous price.

- `currentPrice`: The current price.

- `timeToExpirySec`: The time to expiry in seconds.

### Function `_updateBoardLastUpdatedAt(struct OptionGreekCache.OptionBoardCache boardCache) internal`

Updates `lastUpdatedAt` for an OptionBoardCache.

#### Parameters:

- `boardCache`: The OptionBoardCache.

### Function `_updateGlobalLastUpdatedAt() internal`

Updates global `lastUpdatedAt`.

### Function `timeToMaturitySeconds(uint256 expiry) → uint256 internal`

Returns time to maturity for a given expiry.

### Function `getSecondsTo(uint256 fromTime, uint256 toTime) → uint256 internal`

Returns the difference in seconds between two dates.

### Function `getCurrentPrice() → uint256 internal`

Get the price of the baseAsset for the OptionMarket.

### Event `ListingGreeksUpdated(uint256 listingId, int256 callDelta, int256 putDelta, uint256 vega, uint256 price, uint256 baseIv, uint256 skew)`

Emitted when the cache of an OptionListing is updated.

### Event `ListingExposureUpdated(uint256 listingId, int256 newCallExposure, int256 newPutExposure)`

Emitted when the exposure of an OptionListing is updated.

### Event `GlobalCacheUpdated(int256 netDelta, int256 netStdVega)`

Emitted when the GlobalCache is updated.
