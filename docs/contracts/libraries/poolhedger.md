# `PoolHedger`

Uses the delta hedging funds from the LiquidityPool to hedge option deltas, so LPs are minimally exposed to

movements in the underlying asset price.

## Modifiers:

- `onlyLiquidityPool()`

## Functions:

- `resetInteractionDelay() (external)`

- `getCurrentHedgedNetDelta() (external)`

- `getHedgingLiquidity(uint256 spotPrice) (external)`

- `getCappedExpectedHedge() (public)`

- `hedgeDelta() (external)`

- `updateCollateral() (external)`

- `getPoolHedgerParams() (external)`

- `_setPoolHedgerParams(struct PoolHedger.PoolHedgerParameters _poolHedgerParams) (internal)`

## Events:

- `PoolHedgerParametersSet(struct PoolHedger.PoolHedgerParameters poolHedgerParams)`

### Modifier `onlyLiquidityPool()`

### Function `resetInteractionDelay() external`

### Function `getCurrentHedgedNetDelta() → int256 external`

Returns the current hedged netDelta position.

### Function `getHedgingLiquidity(uint256 spotPrice) → uint256 pendingDeltaLiquidity, uint256 usedDeltaLiquidity external`

Returns pending delta hedge liquidity and used delta hedge liquidity

include funds that would need to be transferred to the contract to hedge optimally

### Function `getCappedExpectedHedge() → int256 cappedExpectedHedge public`

Calculates the expected delta hedge that hedger must perform and

adjusts the result down to the hedgeCap param if needed.

### Function `hedgeDelta() external`

Retrieves the netDelta for the system and hedges appropriately.

### Function `updateCollateral() external`

### Function `getPoolHedgerParams() → struct PoolHedger.PoolHedgerParameters external`

### Function `_setPoolHedgerParams(struct PoolHedger.PoolHedgerParameters _poolHedgerParams) internal`

### Event `PoolHedgerParametersSet(struct PoolHedger.PoolHedgerParameters poolHedgerParams)`

Emitted when pool hedger parameters are updated.
