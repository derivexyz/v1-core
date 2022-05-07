# `PoolHedger`

Uses the delta hedging funds from the LiquidityPool to hedge option deltas, so LPs are minimally exposed to

movements in the underlying asset price.

## Modifiers:

- `onlyLiquidityPool()`

## Functions:

- `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) (external)`

- `setPoolHedgerParams(struct PoolHedger.PoolHedgerParameters _poolHedgerParams) (external)`

- `openShortAccount() (external)`

- `_openShortAccount(struct SynthetixAdapter.ExchangeParams exchangeParams) (internal)`

- `resetInteractionDelay() (external)`

- `getShortPosition(contract ICollateralShort short) (public)`

- `getCurrentHedgedNetDelta() (external)`

- `getHedgingLiquidity(contract ICollateralShort short, uint256 spotPrice) (external)`

- `hedgeDelta() (external)`

- `updateCollateral() (external)`

- `_hedgeDelta(int256 expectedHedge) (internal)`

- `_updatePosition(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 longBalance, uint256 shortBalance, uint256 collateral, int256 expectedHedge) (internal)`

- `_increaseLong(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amount, uint256 currentBalance) (internal)`

- `_decreaseLong(uint256 amount, uint256 currentBalance) (internal)`

- `_setShortTo(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 desiredShort, uint256 startShort, uint256 startCollateral) (internal)`

- `_updateCollateral(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 shortBalance, uint256 startCollateral) (internal)`

- `getCappedExpectedHedge() (public)`

- `_sendAllQuoteToLP() (internal)`

- `getPoolHedgerParams() (external)`

- `_abs(int256 val) (internal)`

## Events:

- `PoolHedgerParametersSet(struct PoolHedger.PoolHedgerParameters poolHedgerParams)`

- `OpenedShortAccount(uint256 shortId)`

- `PositionUpdated(int256 oldNetDelta, int256 currentNetDelta, int256 expectedNetDelta)`

- `LongSetTo(uint256 oldAmount, uint256 newAmount)`

- `ShortSetTo(uint256 oldShort, uint256 newShort, uint256 oldCollateral, uint256 newCollateral)`

- `QuoteReturnedToLP(uint256 amountQuote)`

### Modifier `onlyLiquidityPool()`

Modifiers

### Function `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) external`

Initialize the contract.

#### Parameters:

- `_synthetixAdapter`: SynthetixAdapter address

- `_optionMarket`: OptionMarket address

- `_liquidityPool`: LiquidityPool address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

### Function `setPoolHedgerParams(struct PoolHedger.PoolHedgerParameters _poolHedgerParams) external`

Update pool hedger parameters.

### Function `openShortAccount() external`

Opens/reopens short account if the old one was closed or liquidated.

### Function `_openShortAccount(struct SynthetixAdapter.ExchangeParams exchangeParams) internal`

Opens new short account with min collateral and 0 amount.

#### Parameters:

- `exchangeParams`: The ExchangeParams.

### Function `resetInteractionDelay() external`

### Function `getShortPosition(contract ICollateralShort short) → uint256 shortBalance, uint256 collateral public`

Returns short balance and collateral.

#### Parameters:

- `short`: The short contract.

### Function `getCurrentHedgedNetDelta() → int256 external`

Returns the current hedged netDelta position.

### Function `getHedgingLiquidity(contract ICollateralShort short, uint256 spotPrice) → uint256 pendingDeltaLiquidity, uint256 usedDeltaLiquidity external`

### Function `hedgeDelta() external`

Retrieves the netDelta from the OptionGreekCache and updates the hedge position.

### Function `updateCollateral() external`

Updates the collateral held in the short to prevent liquidations and

return excess collateral without checking/triggering the interaction delay.

### Function `_hedgeDelta(int256 expectedHedge) internal`

Updates the hedge position. This may need to be called several times as it will only do one step at a time

I.e. to go from a long position to asho

#### Parameters:

- `expectedHedge`: The expected final hedge value.

### Function `_updatePosition(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 longBalance, uint256 shortBalance, uint256 collateral, int256 expectedHedge) → int256 internal`

Updates the hedge contract based off a new netDelta.

#### Parameters:

- `exchangeParams`: Globals related to exchanging synths

- `longBalance`: The current long base balance of the PoolHedger

- `shortBalance`: The current short balance of the PoolHedger

- `collateral`: The current quote collateral for shorts of the PoolHedger

- `expectedHedge`: The amount of baseAsset exposure needed to hedge delta risk.

### Function `_increaseLong(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amount, uint256 currentBalance) → uint256 newBalance internal`

Increases the long exposure of the hedge contract.

#### Parameters:

- `exchangeParams`: The ExchangeParams.

- `amount`: The amount of baseAsset to purchase.

### Function `_decreaseLong(uint256 amount, uint256 currentBalance) → uint256 newBalance internal`

Decreases the long exposure of the hedge contract.

#### Parameters:

- `amount`: The amount of baseAsset to sell.

### Function `_setShortTo(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 desiredShort, uint256 startShort, uint256 startCollateral) → uint256 newShort internal`

Increases or decreases short to get to this amount of shorted baseAsset at the shortBuffer ratio. Note,

hedge() may have to be called a second time to re-balance collateral after calling `repayWithCollateral`. As that

disregards the desired ratio.

#### Parameters:

- `exchangeParams`: The ExchangeParams.

- `desiredShort`: The desired short balance.

- `startShort`: Trusted value for current short amount, in base.

- `startCollateral`: Trusted value for current amount of collateral, in quote.

### Function `_updateCollateral(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 shortBalance, uint256 startCollateral) → uint256 newCollateral internal`

### Function `getCappedExpectedHedge() → int256 cappedExpectedHedge public`

Calculates the expected delta hedge that hedger must perform and

adjusts the result down to the hedgeCap param if needed.

### Function `_sendAllQuoteToLP() internal`

Sends all quote asset deposited in this contract to the `LiquidityPool`.

### Function `getPoolHedgerParams() → struct PoolHedger.PoolHedgerParameters external`

### Function `_abs(int256 val) → uint256 internal`

### Event `PoolHedgerParametersSet(struct PoolHedger.PoolHedgerParameters poolHedgerParams)`

Emitted when pool hedger parameters are updated.

### Event `OpenedShortAccount(uint256 shortId)`

Emitted when the short is initialized.

### Event `PositionUpdated(int256 oldNetDelta, int256 currentNetDelta, int256 expectedNetDelta)`

Emitted when the hedge position is updated.

### Event `LongSetTo(uint256 oldAmount, uint256 newAmount)`

Emitted when the long exposure of the hedge contract is adjusted.

### Event `ShortSetTo(uint256 oldShort, uint256 newShort, uint256 oldCollateral, uint256 newCollateral)`

Emitted when short or short collateral is adjusted.

### Event `QuoteReturnedToLP(uint256 amountQuote)`

Emitted when proceeds of the short are sent back to the LP.
