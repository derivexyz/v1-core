# `IPoolHedger`

## Functions:

- `shortingInitialized() (external)`

- `shortId() (external)`

- `shortBuffer() (external)`

- `lastInteraction() (external)`

- `interactionDelay() (external)`

- `setShortBuffer(uint256 newShortBuffer) (external)`

- `setInteractionDelay(uint256 newInteractionDelay) (external)`

- `initShort() (external)`

- `reopenShort() (external)`

- `hedgeDelta() (external)`

- `getShortPosition(contract ICollateralShort short) (external)`

- `getCurrentHedgedNetDelta() (external)`

- `getValueQuote(contract ICollateralShort short, uint256 spotPrice) (external)`

### Function `shortingInitialized() → bool external`

### Function `shortId() → uint256 external`

### Function `shortBuffer() → uint256 external`

### Function `lastInteraction() → uint256 external`

### Function `interactionDelay() → uint256 external`

### Function `setShortBuffer(uint256 newShortBuffer) external`

### Function `setInteractionDelay(uint256 newInteractionDelay) external`

### Function `initShort() external`

### Function `reopenShort() external`

### Function `hedgeDelta() external`

### Function `getShortPosition(contract ICollateralShort short) → uint256 shortBalance, uint256 collateral external`

### Function `getCurrentHedgedNetDelta() → int256 external`

### Function `getValueQuote(contract ICollateralShort short, uint256 spotPrice) → uint256 value external`
