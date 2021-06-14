# `PoolHedger`

This contract assesses the netDelta position of the LiquidityPool/OptionMarket and hedges the risk by

purchasing or shorting eth, to try bring the market to a delta neutral hedged position. This only leaves the LP

exposed to changes in the asset volatility.

PoolHedger.hedgeDelta() is the only exposed mutative function for this contract. It gets the current global netDelta

position from the OptionGreekCache, and either purchases/sells eth, or shorts/closes an eth short; using the

Synthetix suite of contracts.

If the netDelta of the market is positive, it implies that when the price of the asset moves up $1, the value of the

options goes up by that amount. So given the netDelta from the perspective of the users is 500; if eth moves $1, the

value the LPs would have to pay out is $500 more, on the flip side, the LPs profit a similar amount if the price of

the asset goes down $1. As such, to hedge the risk of the price movement (to instead create market purely on the

volatility of the asset) - the LPs should purchase $500 eth.

The opposite is true for the cases where the netDelta is negative. The LPs would want to short the asset to not be

exposed to price movements.

One caveat with this approach is that the LP is funded by USD, so when a call option is purchased from the market,

enough collateral must be purchased to cover the options purchased. By doing so, the LPs expose themselves to price

movements of the asset. As such, these purchases must be hedged by shorting the asset.

i.e. One 50d eth call is purchased; 1 eth must be purchased. netDelta is 0.5, but the position of the LP is

      1 eth, so (0.5 - 1) -> -0.5 eth must be purchased to be delta neutral; so the PoolHedger would short 0.5 eth.

Note that this system was developed assuming the following from synthetix shorting:

- No interaction delay exists

- Shorts can be repaid using collateral

- Short contracts return the collateral after every action

## Modifiers:

- `onlyLiquidityPool()`

## Functions:

- `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `initShort() (external)`

- `reopenShort() (external)`

- `openShort(struct LyraGlobals.ExchangeGlobals exchangeGlobals) (internal)`

- `setShortBuffer(uint256 newShortBuffer) (external)`

- `hedgeDelta() (external)`

- `updatePosition(int256 netDelta) (internal)`

- `getShortPosition(contract ICollateralShort short) (public)`

- `getCurrentHedgedNetDelta() (external)`

- `getValueQuote(contract ICollateralShort short, uint256 spotPrice) (public)`

- `increaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) (internal)`

- `decreaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) (internal)`

- `setShortTo(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 desiredShort, uint256 currentShort, uint256 currentCollateral) (internal)`

- `endRound() (external)`

- `sendAllQuoteToLP() (internal)`

## Events:

- `ShortBufferSet(uint256 newShortBuffer)`

- `ShortInitialized(uint256 shortId)`

- `PositionUpdated(int256 netDelta)`

- `LongIncreased(uint256 purchaseAmount)`

- `LongDecreased(uint256 amount)`

- `CollateralSetTo(uint256 newCollateral)`

- `ShortSetTo(uint256 newShort)`

- `QuoteReturnedToLP(uint256 amountQuote)`

### Modifier `onlyLiquidityPool()`

### Function `init(contract LyraGlobals _globals, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialize the contract.

#### Parameters:

- `_globals`: LyraGlobals address

- `_optionMarket`: OptionMarket address

- `_liquidityPool`: LiquidityPool address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

### Function `initShort() external`

### Function `reopenShort() external`

### Function `openShort(struct LyraGlobals.ExchangeGlobals exchangeGlobals) internal`

### Function `setShortBuffer(uint256 newShortBuffer) external`

### Function `hedgeDelta() external`

### Function `updatePosition(int256 netDelta) internal`

Updates the hedge contract based off a new netDelta.

#### Parameters:

- `netDelta`: The amount of baseAsset exposure needed to hedge delta risk.

### Function `getShortPosition(contract ICollateralShort short) → uint256 shortBalance, uint256 collateral public`

Returns short balance and collateral.

The balance of the short is read from the short contract

### Function `getCurrentHedgedNetDelta() → int256 external`

Returns the current hedged netDelta position

### Function `getValueQuote(contract ICollateralShort short, uint256 spotPrice) → uint256 value public`

Returns the value of the long/short position held by the PoolHedger.

### Function `increaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) internal`

Increases the long exposure of the hedge contract.

#### Parameters:

- `amount`: The amount of baseAsset to purchase.

### Function `decreaseLong(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) internal`

Decreases the long exposure of the hedge contract

#### Parameters:

- `amount`: The amount of baseAsset to sell.

### Function `setShortTo(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 desiredShort, uint256 currentShort, uint256 currentCollateral) internal`

Increases or decreases short to get to this amount of shorted eth at the shortBuffer ratio. Note, hedge() may

have to be called a second time to re-balance collateral after calling `repayWithCollateral`. As that disregards

the desired ratio.

#### Parameters:

- `exchangeGlobals`: The ExchangeGlobals.

- `desiredShort`: The desired short balance.

- `currentShort`: Trusted value for current short amount, in base

- `currentCollateral`: Trusted value for current amount of collateral, in quote

### Function `endRound() external`

### Function `sendAllQuoteToLP() internal`

Sends all quote asset deposited in this contract to the `LiquidityPool`.

### Event `ShortBufferSet(uint256 newShortBuffer)`

Emitted when the target short ratio is set.

### Event `ShortInitialized(uint256 shortId)`

Emitted when the short is initialized.

### Event `PositionUpdated(int256 netDelta)`

Emitted when the hedge position is updated.

### Event `LongIncreased(uint256 purchaseAmount)`

Emitted when the long exposure of the hedge contract is increased.

### Event `LongDecreased(uint256 amount)`

Emitted when the long exposure of the hedge contract is decreased.

### Event `CollateralSetTo(uint256 newCollateral)`

Emitted when the amount of collateral is adjusted.

### Event `ShortSetTo(uint256 newShort)`

Emitted when short size is adjusted.

### Event `QuoteReturnedToLP(uint256 amountQuote)`

Emitted when proceeds of the short are sent back to the LP.
