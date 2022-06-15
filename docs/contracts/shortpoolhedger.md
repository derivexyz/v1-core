# `ShortPoolHedger`

Uses the delta hedging funds from the LiquidityPool to hedge option deltas, so LPs are minimally exposed to

movements in the underlying asset price.

## Functions:

- `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract OptionGreekCache _optionGreekCache, contract LiquidityPool _liquidityPool, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) (external)`

- `setPoolHedgerParams(struct PoolHedger.PoolHedgerParameters _poolHedgerParams) (external)`

- `setShortBuffer(uint256 _shortBuffer) (external)`

- `updateCollateralShortAddress() (external)`

- `updateDelegateApproval() (external)`

- `openShortAccount() (external)`

- `_openShortAccount(struct SynthetixAdapter.ExchangeParams exchangeParams) (internal)`

- `getShortPosition() (public)`

- `getCurrentHedgedNetDelta() (external)`

- `getHedgingLiquidity(uint256 spotPrice) (external)`

- `hedgeDelta() (external)`

- `updateCollateral() (external)`

- `_hedgeDelta(int256 expectedHedge) (internal)`

- `_updatePosition(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 longBalance, uint256 shortBalance, uint256 collateral, int256 expectedHedge) (internal)`

- `_increaseLong(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amount, uint256 currentBalance) (internal)`

- `_decreaseLong(uint256 amount, uint256 currentBalance) (internal)`

- `_setShortTo(uint256 spotPrice, uint256 desiredShort, uint256 startShort, uint256 startCollateral) (internal)`

- `_updateCollateral(uint256 spotPrice, uint256 shortBalance, uint256 startCollateral) (internal)`

- `getCappedExpectedHedge() (public)`

- `_sendAllQuoteToLP() (internal)`

- `getPoolHedgerSettings() (external)`

- `_abs(int256 val) (internal)`

## Events:

- `ShortCollateralSet(contract ICollateralShort collateralShort)`

- `ShortBufferSet(uint256 newShortBuffer)`

- `OpenedShortAccount(uint256 shortId)`

- `PositionUpdated(int256 oldNetDelta, int256 currentNetDelta, int256 expectedNetDelta)`

- `LongSetTo(uint256 oldAmount, uint256 newAmount)`

- `ShortSetTo(uint256 oldShort, uint256 newShort, uint256 oldCollateral, uint256 newCollateral)`

- `QuoteReturnedToLP(uint256 amountQuote)`

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

### Function `setShortBuffer(uint256 _shortBuffer) external`

update the shortBuffer of the contract. 1.0 (1e18) means collateral equal to debt, which would get the

 contract liquidated. 2.0 would be considered very safe.

### Function `updateCollateralShortAddress() external`

update the collateralShort address based on the synthetix addressResolver

### Function `updateDelegateApproval() external`

In case of an update to the synthetix contract that revokes the approval

### Function `openShortAccount() external`

Opens/reopens short account if the old one was closed or liquidated.

opens short account with min colalteral and 0 amount

### Function `_openShortAccount(struct SynthetixAdapter.ExchangeParams exchangeParams) internal`

Opens new short account with min collateral and 0 amount.

#### Parameters:

- `exchangeParams`: The ExchangeParams.

### Function `getShortPosition() → uint256 shortBalance, uint256 collateral public`

Returns short balance and collateral owned by this contract.

### Function `getCurrentHedgedNetDelta() → int256 external`

Returns the current hedged netDelta position.

### Function `getHedgingLiquidity(uint256 spotPrice) → uint256 pendingDeltaLiquidity, uint256 usedDeltaLiquidity external`

Returns pending delta hedge liquidity and used delta hedge liquidity

include funds potentially transferred to the contract

### Function `hedgeDelta() external`

Retrieves the netDelta from the OptionGreekCache and updates the hedge position based off base

     asset balance of the liquidityPool minus netDelta (from OptionGreekCache)

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

### Function `_setShortTo(uint256 spotPrice, uint256 desiredShort, uint256 startShort, uint256 startCollateral) → uint256 newShort internal`

Increases or decreases short to get to this amount of shorted baseAsset at the shortBuffer ratio. Note,

hedge() may have to be called a second time to re-balance collateral after calling `repayWithCollateral`. As that

disregards the desired ratio.

#### Parameters:

- `spotPrice`: The spot price of the base asset.

- `desiredShort`: The desired short balance.

- `startShort`: Trusted value for current short amount, in base.

- `startCollateral`: Trusted value for current amount of collateral, in quote.

### Function `_updateCollateral(uint256 spotPrice, uint256 shortBalance, uint256 startCollateral) → uint256 newCollateral internal`

### Function `getCappedExpectedHedge() → int256 cappedExpectedHedge public`

Calculates the expected delta hedge that hedger must perform and

adjusts the result down to the hedgeCap param if needed.

### Function `_sendAllQuoteToLP() internal`

Sends all quote asset deposited in this contract to the `LiquidityPool`.

### Function `getPoolHedgerSettings() → struct PoolHedger.PoolHedgerParameters, uint256 _shortBuffer external`

Returns PoolHedgerParameters struct

### Function `_abs(int256 val) → uint256 internal`

Compute the absolute value of `val`.

#### Parameters:

- `val`: The number to absolute value.

### Event `ShortCollateralSet(contract ICollateralShort collateralShort)`

Emitted when the collateralShort address is updated

### Event `ShortBufferSet(uint256 newShortBuffer)`

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
