# `PoolHedger`

Uses the delta hedging funds from the LiquidityPool to hedge option deltas,

so LPs are minimally exposed to movements in the underlying asset price.

## Modifiers:

- `reentrancyGuard()`

## Functions:

- `setShortBuffer(uint256 newShortBuffer) (external)`

- `setInteractionDelay(uint256 newInteractionDelay) (external)`

- `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `initShort() (external)`

- `reopenShort() (external)`

- `openShort(struct LyraGlobals.ExchangeGlobals exchangeGlobals) (internal)`

- `hedgeDelta() (external)`

- `_hedgeDelta(int256 expectedHedge) (internal)`

- `updatePosition(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 longBalance, uint256 shortBalance, uint256 collateral, int256 expectedHedge) (internal)`

- `getShortPosition(contract ICollateralShort short) (public)`

- `getCurrentHedgedNetDelta() (external)`

- `getValueQuote(contract ICollateralShort short, uint256 spotPrice) (public)`

- `increaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount, uint256 currentBalance) (internal)`

- `decreaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount, uint256 currentBalance) (internal)`

- `setShortTo(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 desiredShort, uint256 currentShort, uint256 currentCollateral) (internal)`

- `sendAllQuoteToLP() (internal)`

## Events:

- `ShortBufferSet(uint256 newShortBuffer)`

- `InteractionDelaySet(uint256 newInteractionDelay)`

- `ShortInitialized(uint256 shortId)`

- `PositionUpdated(int256 oldNetDelta, int256 currentNetDelta, int256 expectedNetDelta)`

- `BaseExchanged(uint256 baseAmount, uint256 quoteReceived)`

- `QuoteExchanged(uint256 quoteAmount, uint256 baseReceived)`

- `LongSetTo(uint256 oldAmount, uint256 newAmount)`

- `ShortSetTo(uint256 oldShort, uint256 newShort, uint256 oldCollateral, uint256 newCollateral)`

- `QuoteReturnedToLP(uint256 amountQuote)`

### Modifier `reentrancyGuard()`

### Function `setShortBuffer(uint256 newShortBuffer) external`

### Function `setInteractionDelay(uint256 newInteractionDelay) external`

### Function `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialize the contract.

#### Parameters:

- `_globals`: LyraGlobals address

- `_optionMarket`: OptionMarket address

- `_liquidityPool`: LiquidityPool address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

### Function `initShort() external`

Initialises the short.

### Function `reopenShort() external`

Reopens the short if the old one was closed or liquidated.

### Function `openShort(struct LyraGlobals.ExchangeGlobals exchangeGlobals) internal`

Opens the short position with 0 amount and 0 collateral.

#### Parameters:

- `exchangeGlobals`: The ExchangeGlobals.

### Function `hedgeDelta() external`

Retreives the netDelta from the OptionGreekCache and updates the hedge position.

### Function `_hedgeDelta(int256 expectedHedge) internal`

### Function `updatePosition(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 longBalance, uint256 shortBalance, uint256 collateral, int256 expectedHedge) → int256 internal`

Updates the hedge contract based off a new netDelta.

#### Parameters:

- `exchangeGlobals`: TODO

- `longBalance`: TODO

- `shortBalance`: TODO

- `collateral`: TODO

- `expectedHedge`: The amount of baseAsset exposure needed to hedge delta risk.

### Function `getShortPosition(contract ICollateralShort short) → uint256 shortBalance, uint256 collateral public`

Returns short balance and collateral.

#### Parameters:

- `short`: The short contract.

### Function `getCurrentHedgedNetDelta() → int256 external`

Returns the current hedged netDelta position

### Function `getValueQuote(contract ICollateralShort short, uint256 spotPrice) → uint256 value public`

Returns the value of the long/short position held by the PoolHedger.

#### Parameters:

- `short`: The short contract.

- `spotPrice`: The price of the baseAsset.

### Function `increaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount, uint256 currentBalance) → uint256 newBalance internal`

Increases the long exposure of the hedge contract.

#### Parameters:

- `exchangeGlobals`: The ExchangeGlobals.

- `amount`: The amount of baseAsset to purchase.

### Function `decreaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount, uint256 currentBalance) → uint256 newBalance internal`

Decreases the long exposure of the hedge contract.

#### Parameters:

- `exchangeGlobals`: The ExchangeGlobals.

- `amount`: The amount of baseAsset to sell.

### Function `setShortTo(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 desiredShort, uint256 currentShort, uint256 currentCollateral) → uint256 newShortAmount internal`

Increases or decreases short to get to this amount of shorted eth at the shortBuffer ratio. Note, hedge() may

have to be called a second time to re-balance collateral after calling `repayWithCollateral`. As that disregards

the desired ratio.

#### Parameters:

- `exchangeGlobals`: The ExchangeGlobals.

- `desiredShort`: The desired short balance.

- `currentShort`: Trusted value for current short amount, in base.

- `currentCollateral`: Trusted value for current amount of collateral, in quote.

### Function `sendAllQuoteToLP() internal`

Sends all quote asset deposited in this contract to the `LiquidityPool`.

### Event `ShortBufferSet(uint256 newShortBuffer)`

Emitted when the short buffer ratio is set.

### Event `InteractionDelaySet(uint256 newInteractionDelay)`

Emitted when the interaction delay is set.

### Event `ShortInitialized(uint256 shortId)`

Emitted when the short is initialized.

### Event `PositionUpdated(int256 oldNetDelta, int256 currentNetDelta, int256 expectedNetDelta)`

Emitted when the hedge position is updated.

### Event `BaseExchanged(uint256 baseAmount, uint256 quoteReceived)`

Emitted when base is sold

### Event `QuoteExchanged(uint256 quoteAmount, uint256 baseReceived)`

Emitted when base is sold

### Event `LongSetTo(uint256 oldAmount, uint256 newAmount)`

Emitted when the long exposure of the hedge contract is adjusted.

### Event `ShortSetTo(uint256 oldShort, uint256 newShort, uint256 oldCollateral, uint256 newCollateral)`

Emitted when short or short collateral is adjusted.

### Event `QuoteReturnedToLP(uint256 amountQuote)`

Emitted when proceeds of the short are sent back to the LP.
