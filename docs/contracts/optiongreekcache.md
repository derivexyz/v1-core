# `OptionGreekCache`

Aggregates the netDelta and netStdVega of the OptionMarket by iterating over current strikes, using gwav vols.

Needs to be called by an external actor as it's not feasible to do all the computation during the trade flow and

because delta/vega change over time and with movements in asset price and volatility.

All stored values in this contract are the aggregate of the trader's perspective. So values need to be inverted

to get the LP's perspective

Also handles logic for figuring out minimal collateral requirements for shorts.

## Modifiers:

- `onlyOptionMarket()`

- `onlyOptionMarketPricer()`

## Functions:

- `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, address _optionMarketPricer) (external)`

- `setGreekCacheParameters(struct OptionGreekCache.GreekCacheParameters _greekCacheParams) (external)`

- `setForceCloseParameters(struct OptionGreekCache.ForceCloseParameters _forceCloseParams) (external)`

- `setMinCollateralParameters(struct OptionGreekCache.MinCollateralParameters _minCollatParams) (external)`

- `addBoard(struct OptionMarket.OptionBoard board, struct OptionMarket.Strike[] strikes) (external)`

- `removeBoard(uint256 boardId) (external)`

- `addStrikeToBoard(uint256 boardId, uint256 strikeId, uint256 strikePrice, uint256 skew) (external)`

- `setBoardIv(uint256 boardId, uint256 newBaseIv) (external)`

- `setStrikeSkew(uint256 strikeId, uint256 newSkew) (external)`

- `_addNewStrikeToStrikeCache(struct OptionGreekCache.OptionBoardCache boardCache, uint256 strikeId, uint256 strikePrice, uint256 skew) (internal)`

- `updateStrikeExposureAndGetPrice(struct OptionMarket.Strike strike, struct OptionMarket.TradeParameters trade, uint256 iv, uint256 skew, bool isPostCutoff) (external)`

- `_updateStrikeExposureAndGetPrice(struct OptionGreekCache.StrikeCache strikeCache, struct OptionGreekCache.OptionBoardCache boardCache, struct OptionMarket.TradeParameters trade, int256 newCallExposure, int256 newPutExposure) (internal)`

- `getPriceForForceClose(struct OptionMarket.TradeParameters trade, struct OptionMarket.Strike strike, uint256 expiry, uint256 newVol, bool isPostCutoff) (public)`

- `_getGWAVVolWithOverride(uint256 boardId, uint256 strikeId, uint256 overrideIvPeriod, uint256 overrideSkewPeriod) (internal)`

- `getMinCollateral(enum OptionMarket.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) (external)`

- `getShockVol(uint256 timeToMaturity) (public)`

- `updateBoardCachedGreeks(uint256 boardId) (public)`

- `_updateBoardCachedGreeks(uint256 spotPrice, uint256 boardId) (internal)`

- `_updateStrikeCachedGreeks(struct OptionGreekCache.StrikeCache strikeCache, struct OptionGreekCache.OptionBoardCache boardCache, uint256 spotPrice, uint256 navGWAVvol) (internal)`

- `_updateGlobalLastUpdatedAt() (internal)`

- `_updateBoardIv(struct OptionGreekCache.OptionBoardCache boardCache, uint256 newIv) (internal)`

- `_updateStrikeSkew(struct OptionGreekCache.OptionBoardCache boardCache, struct OptionGreekCache.StrikeCache strikeCache, uint256 newSkew) (internal)`

- `_updateMaxIvVariance() (internal)`

- `_updateStrikeSkewVariance(struct OptionGreekCache.StrikeCache strikeCache) (internal)`

- `_updateBoardIvVariance(struct OptionGreekCache.OptionBoardCache boardCache) (internal)`

- `_updateMaxSkewVariance(struct OptionGreekCache.OptionBoardCache boardCache) (internal)`

- `isGlobalCacheStale(uint256 spotPrice) (external)`

- `isBoardCacheStale(uint256 boardId) (external)`

- `_isPriceMoveAcceptable(uint256 pastPrice, uint256 currentPrice) (internal)`

- `_isUpdatedAtTimeStale(uint256 updatedAt) (internal)`

- `getGlobalNetDelta() (external)`

- `getGlobalOptionValue() (external)`

- `getBoardGreeksView(uint256 boardId) (external)`

- `getStrikeCache(uint256 strikeId) (external)`

- `getOptionBoardCache(uint256 boardId) (external)`

- `getGlobalCache() (external)`

- `getIvGWAV(uint256 boardId, uint256 secondsAgo) (external)`

- `getSkewGWAV(uint256 strikeId, uint256 secondsAgo) (external)`

- `getGreekCacheParams() (external)`

- `getForceCloseParams() (external)`

- `getMinCollatParams() (external)`

- `_getParity(uint256 strikePrice, uint256 spot, enum OptionMarket.OptionType optionType) (internal)`

- `_timeToMaturitySeconds(uint256 expiry) (internal)`

- `_getSecondsTo(uint256 fromTime, uint256 toTime) (internal)`

- `_min(uint256 x, uint256 y) (internal)`

- `_max(uint256 x, uint256 y) (internal)`

## Events:

- `GreekCacheParametersSet(struct OptionGreekCache.GreekCacheParameters params)`

- `ForceCloseParametersSet(struct OptionGreekCache.ForceCloseParameters params)`

- `MinCollateralParametersSet(struct OptionGreekCache.MinCollateralParameters params)`

- `StrikeCacheUpdated(struct OptionGreekCache.StrikeCache strikeCache)`

- `BoardCacheUpdated(struct OptionGreekCache.OptionBoardCache boardCache)`

- `GlobalCacheUpdated(struct OptionGreekCache.GlobalCache globalCache)`

- `BoardCacheRemoved(uint256 boardId)`

- `StrikeCacheRemoved(uint256 strikeId)`

- `BoardIvUpdated(uint256 boardId, uint256 newIv, uint256 globalMaxIvVariance)`

- `StrikeSkewUpdated(uint256 strikeId, uint256 newSkew, uint256 globalMaxSkewVariance)`

### Modifier `onlyOptionMarket()`

### Modifier `onlyOptionMarketPricer()`

### Function `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, address _optionMarketPricer) external`

Initialize the contract.

#### Parameters:

- `_synthetixAdapter`: SynthetixAdapter address

- `_optionMarket`: OptionMarket address

- `_optionMarketPricer`: OptionMarketPricer address

### Function `setGreekCacheParameters(struct OptionGreekCache.GreekCacheParameters _greekCacheParams) external`

### Function `setForceCloseParameters(struct OptionGreekCache.ForceCloseParameters _forceCloseParams) external`

### Function `setMinCollateralParameters(struct OptionGreekCache.MinCollateralParameters _minCollatParams) external`

### Function `addBoard(struct OptionMarket.OptionBoard board, struct OptionMarket.Strike[] strikes) external`

Adds a new OptionBoardCache

Called by the OptionMarket whenever a new OptionBoard is added

#### Parameters:

- `board`: The new OptionBoard

- `strikes`: The new Strikes for the given board

### Function `removeBoard(uint256 boardId) external`

After board settlement, remove an OptionBoardCache. Called by OptionMarket

### Function `addStrikeToBoard(uint256 boardId, uint256 strikeId, uint256 strikePrice, uint256 skew) external`

Add a new strike to a given boardCache. Only callable by OptionMarket.

### Function `setBoardIv(uint256 boardId, uint256 newBaseIv) external`

Updates an OptionBoard's baseIv. Only callable by OptionMarket.

### Function `setStrikeSkew(uint256 strikeId, uint256 newSkew) external`

Updates a Strike's skew. Only callable by OptionMarket.

#### Parameters:

- `strikeId`: The id of the Strike

- `newSkew`: The new skew of the given Strike

### Function `_addNewStrikeToStrikeCache(struct OptionGreekCache.OptionBoardCache boardCache, uint256 strikeId, uint256 strikePrice, uint256 skew) internal`

Adds a new strike to a given board, initialising the skew GWAV

### Function `updateStrikeExposureAndGetPrice(struct OptionMarket.Strike strike, struct OptionMarket.TradeParameters trade, uint256 iv, uint256 skew, bool isPostCutoff) → struct OptionGreekCache.TradePricing pricing external`

During a trade, updates the exposure of the given strike, board and global state. Computes the cost of the

trade and returns it to the OptionMarketPricer.

#### Return Values:

- pricing The final price of the option to be paid for by the user. This could use marketVol or shockVol,

depending on the trade executed.

### Function `_updateStrikeExposureAndGetPrice(struct OptionGreekCache.StrikeCache strikeCache, struct OptionGreekCache.OptionBoardCache boardCache, struct OptionMarket.TradeParameters trade, int256 newCallExposure, int256 newPutExposure) → struct OptionGreekCache.TradePricing pricing internal`

Updates the exposure of the strike and computes the market black scholes price

### Function `getPriceForForceClose(struct OptionMarket.TradeParameters trade, struct OptionMarket.Strike strike, uint256 expiry, uint256 newVol, bool isPostCutoff) → uint256 optionPrice, uint256 forceCloseVol public`

Calculate price paid by the user to forceClose an options position

#### Parameters:

- `trade`: TradeParameter as defined in OptionMarket

- `strike`: strikes details (including total exposure)

- `expiry`: expiry of option

- `newVol`: volatility post slippage as determined in `OptionTokOptionMarketPriceren.ivImpactForTrade()`

- `isPostCutoff`: flag for whether order is closer to expiry than postCutoff param.

#### Return Values:

- optionPrice premium to charge for close order (excluding fees added in OptionMarketPricer)

- forceCloseVol volatility used to calculate optionPrice

### Function `_getGWAVVolWithOverride(uint256 boardId, uint256 strikeId, uint256 overrideIvPeriod, uint256 overrideSkewPeriod) → uint256 gwavVol internal`

### Function `getMinCollateral(enum OptionMarket.OptionType optionType, uint256 strikePrice, uint256 expiry, uint256 spotPrice, uint256 amount) → uint256 minCollateral external`

Gets minimum collateral requirement for the specified option

#### Parameters:

- `optionType`: The option type

- `strikePrice`: The strike price of the option

- `expiry`: The expiry of the option

- `spotPrice`: The price of the underlying asset

- `amount`: The size of the option

### Function `getShockVol(uint256 timeToMaturity) → uint256 public`

Gets shock vol (Vol used to compute the minimum collateral requirements for short positions)

### Function `updateBoardCachedGreeks(uint256 boardId) public`

Updates the cached greeks for an OptionBoardCache used to calculate:

- trading fees

- aggregate AMM option value

- net delta exposure for proper hedging

#### Parameters:

- `boardId`: The id of the OptionBoardCache.

### Function `_updateBoardCachedGreeks(uint256 spotPrice, uint256 boardId) internal`

### Function `_updateStrikeCachedGreeks(struct OptionGreekCache.StrikeCache strikeCache, struct OptionGreekCache.OptionBoardCache boardCache, uint256 spotPrice, uint256 navGWAVvol) internal`

Updates an StrikeCache using TWAP.

Assumes board has been zeroed out before updating all strikes at once

#### Parameters:

- `strikeCache`: The StrikeCache.

- `boardCache`: The OptionBoardCache.

### Function `_updateGlobalLastUpdatedAt() internal`

Updates global `lastUpdatedAt`.

### Function `_updateBoardIv(struct OptionGreekCache.OptionBoardCache boardCache, uint256 newIv) internal`

updates baseIv for a given board, updating the baseIv gwav

### Function `_updateStrikeSkew(struct OptionGreekCache.OptionBoardCache boardCache, struct OptionGreekCache.StrikeCache strikeCache, uint256 newSkew) internal`

updates skew for a given strike, updating the skew gwav

### Function `_updateMaxIvVariance() internal`

updates maxIvVariance across all boards

### Function `_updateStrikeSkewVariance(struct OptionGreekCache.StrikeCache strikeCache) internal`

updates skewVariance for strike, used to trigger CBs and charge varianceFees

### Function `_updateBoardIvVariance(struct OptionGreekCache.OptionBoardCache boardCache) internal`

updates ivVariance for board, used to trigger CBs and charge varianceFees

### Function `_updateMaxSkewVariance(struct OptionGreekCache.OptionBoardCache boardCache) internal`

updates maxSkewVariance for the board and across all strikes

### Function `isGlobalCacheStale(uint256 spotPrice) → bool external`

returns `true` if even one board not updated within `staleUpdateDuration` or

        if spot price moves up/down beyond `acceptablePriceMovement`

### Function `isBoardCacheStale(uint256 boardId) → bool external`

returns `true` if board not updated within `staleUpdateDuration` or

        if spot price moves up/down beyond `acceptablePriceMovement`

### Function `_isPriceMoveAcceptable(uint256 pastPrice, uint256 currentPrice) → bool internal`

Check if the price move of base asset renders the cache stale.

#### Parameters:

- `pastPrice`: The previous price.

- `currentPrice`: The current price.

### Function `_isUpdatedAtTimeStale(uint256 updatedAt) → bool internal`

Checks if board updated within `staleUpdateDuration`.

#### Parameters:

- `updatedAt`: The time of the last update.

### Function `getGlobalNetDelta() → int256 external`

Get the current cached global netDelta exposure.

### Function `getGlobalOptionValue() → int256 external`

Get the current global net option value

### Function `getBoardGreeksView(uint256 boardId) → struct OptionGreekCache.BoardGreeksView external`

Returns the BoardGreeksView struct given a specific boardId

### Function `getStrikeCache(uint256 strikeId) → struct OptionGreekCache.StrikeCache external`

Get StrikeCache given a specific strikeId

### Function `getOptionBoardCache(uint256 boardId) → struct OptionGreekCache.OptionBoardCache external`

Get OptionBoardCache given a specific boardId

### Function `getGlobalCache() → struct OptionGreekCache.GlobalCache external`

Get the global cache

### Function `getIvGWAV(uint256 boardId, uint256 secondsAgo) → uint256 ivGWAV external`

Returns ivGWAV for a given boardId and GWAV time interval

### Function `getSkewGWAV(uint256 strikeId, uint256 secondsAgo) → uint256 skewGWAV external`

Returns skewGWAV for a given strikeId and GWAV time interval

### Function `getGreekCacheParams() → struct OptionGreekCache.GreekCacheParameters external`

Get the GreekCacheParameters

### Function `getForceCloseParams() → struct OptionGreekCache.ForceCloseParameters external`

Get the ForceCloseParamters

### Function `getMinCollatParams() → struct OptionGreekCache.MinCollateralParameters external`

Get the MinCollateralParamters

### Function `_getParity(uint256 strikePrice, uint256 spot, enum OptionMarket.OptionType optionType) → uint256 parity internal`

Calculate option payout on expiry given a strikePrice, spot on expiry and optionType.

### Function `_timeToMaturitySeconds(uint256 expiry) → uint256 internal`

Returns time to maturity for a given expiry.

### Function `_getSecondsTo(uint256 fromTime, uint256 toTime) → uint256 internal`

Returns the difference in seconds between two dates.

### Function `_min(uint256 x, uint256 y) → uint256 internal`

### Function `_max(uint256 x, uint256 y) → uint256 internal`

### Event `GreekCacheParametersSet(struct OptionGreekCache.GreekCacheParameters params)`

### Event `ForceCloseParametersSet(struct OptionGreekCache.ForceCloseParameters params)`

### Event `MinCollateralParametersSet(struct OptionGreekCache.MinCollateralParameters params)`

### Event `StrikeCacheUpdated(struct OptionGreekCache.StrikeCache strikeCache)`

### Event `BoardCacheUpdated(struct OptionGreekCache.OptionBoardCache boardCache)`

### Event `GlobalCacheUpdated(struct OptionGreekCache.GlobalCache globalCache)`

### Event `BoardCacheRemoved(uint256 boardId)`

### Event `StrikeCacheRemoved(uint256 strikeId)`

### Event `BoardIvUpdated(uint256 boardId, uint256 newIv, uint256 globalMaxIvVariance)`

### Event `StrikeSkewUpdated(uint256 strikeId, uint256 newSkew, uint256 globalMaxSkewVariance)`
