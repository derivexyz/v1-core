# `IOptionGreekCache`

## Functions:

- `MAX_LISTINGS_PER_BOARD() (external)`

- `staleUpdateDuration() (external)`

- `priceScalingPeriod() (external)`

- `maxAcceptablePercent() (external)`

- `minAcceptablePercent() (external)`

- `liveBoards(uint256) (external)`

- `listingCaches(uint256) (external)`

- `boardCaches(uint256) (external)`

- `globalCache() (external)`

- `setStaleCacheParameters(uint256 _staleUpdateDuration, uint256 _priceScalingPeriod, uint256 _maxAcceptablePercent, uint256 _minAcceptablePercent) (external)`

- `addBoard(uint256 boardId) (external)`

- `removeBoard(uint256 boardId) (external)`

- `setBoardIv(uint256 boardId, uint256 newIv) (external)`

- `setListingSkew(uint256 listingId, uint256 newSkew) (external)`

- `addListingToBoard(uint256 boardId, uint256 listingId) (external)`

- `updateAllStaleBoards() (external)`

- `updateBoardCachedGreeks(uint256 boardCacheId) (external)`

- `updateListingCacheAndGetPrice(struct ILyraGlobals.GreekCacheGlobals greekCacheGlobals, uint256 listingCacheId, int256 newCallExposure, int256 newPutExposure, uint256 iv, uint256 skew) (external)`

- `isGlobalCacheStale() (external)`

- `isBoardCacheStale(uint256 boardCacheId) (external)`

- `getGlobalNetDelta() (external)`

### Function `MAX_LISTINGS_PER_BOARD() → uint256 external`

### Function `staleUpdateDuration() → uint256 external`

### Function `priceScalingPeriod() → uint256 external`

### Function `maxAcceptablePercent() → uint256 external`

### Function `minAcceptablePercent() → uint256 external`

### Function `liveBoards(uint256) → uint256 external`

### Function `listingCaches(uint256) → uint256 id, uint256 strike, uint256 skew, uint256 boardId, int256 callDelta, int256 putDelta, uint256 stdVega, int256 callExposure, int256 putExposure, uint256 updatedAt, uint256 updatedAtPrice external`

### Function `boardCaches(uint256) → uint256 id, uint256 expiry, uint256 iv, uint256 minUpdatedAt, uint256 minUpdatedAtPrice, uint256 maxUpdatedAtPrice, int256 netDelta, int256 netStdVega external`

### Function `globalCache() → int256 netDelta, int256 netStdVega, uint256 minUpdatedAt, uint256 minUpdatedAtPrice, uint256 maxUpdatedAtPrice, uint256 minExpiryTimestamp external`

### Function `setStaleCacheParameters(uint256 _staleUpdateDuration, uint256 _priceScalingPeriod, uint256 _maxAcceptablePercent, uint256 _minAcceptablePercent) external`

### Function `addBoard(uint256 boardId) external`

### Function `removeBoard(uint256 boardId) external`

### Function `setBoardIv(uint256 boardId, uint256 newIv) external`

### Function `setListingSkew(uint256 listingId, uint256 newSkew) external`

### Function `addListingToBoard(uint256 boardId, uint256 listingId) external`

### Function `updateAllStaleBoards() → int256 external`

### Function `updateBoardCachedGreeks(uint256 boardCacheId) external`

### Function `updateListingCacheAndGetPrice(struct ILyraGlobals.GreekCacheGlobals greekCacheGlobals, uint256 listingCacheId, int256 newCallExposure, int256 newPutExposure, uint256 iv, uint256 skew) → struct IOptionMarketPricer.Pricing external`

### Function `isGlobalCacheStale() → bool external`

### Function `isBoardCacheStale(uint256 boardCacheId) → bool external`

### Function `getGlobalNetDelta() → int256 external`
