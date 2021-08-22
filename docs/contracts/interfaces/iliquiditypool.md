# `ILiquidityPool`

## Functions:

- `lockedCollateral() (external)`

- `queuedQuoteFunds() (external)`

- `expiryToTokenValue(uint256) (external)`

- `deposit(address beneficiary, uint256 amount) (external)`

- `signalWithdrawal(uint256 certificateId) (external)`

- `unSignalWithdrawal(uint256 certificateId) (external)`

- `withdraw(address beneficiary, uint256 certificateId) (external)`

- `tokenPriceQuote() (external)`

- `endRound() (external)`

- `startRound(uint256 lastMaxExpiryTimestamp, uint256 newMaxExpiryTimestamp) (external)`

- `exchangeBase() (external)`

- `lockQuote(uint256 amount, uint256 freeCollatLiq) (external)`

- `lockBase(uint256 amount, struct ILyraGlobals.ExchangeGlobals exchangeGlobals, struct ILiquidityPool.Liquidity liquidity) (external)`

- `freeQuoteCollateral(uint256 amount) (external)`

- `freeBase(uint256 amountBase) (external)`

- `sendPremium(address recipient, uint256 amount, uint256 freeCollatLiq) (external)`

- `boardLiquidation(uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) (external)`

- `sendReservedQuote(address user, uint256 amount) (external)`

- `getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity) (external)`

- `getLiquidity(uint256 basePrice, contract ICollateralShort short) (external)`

- `transferQuoteToHedge(struct ILyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) (external)`

### Function `lockedCollateral() → uint256, uint256 external`

### Function `queuedQuoteFunds() → uint256 external`

### Function `expiryToTokenValue(uint256) → uint256 external`

### Function `deposit(address beneficiary, uint256 amount) → uint256 external`

### Function `signalWithdrawal(uint256 certificateId) external`

### Function `unSignalWithdrawal(uint256 certificateId) external`

### Function `withdraw(address beneficiary, uint256 certificateId) → uint256 value external`

### Function `tokenPriceQuote() → uint256 external`

### Function `endRound() external`

### Function `startRound(uint256 lastMaxExpiryTimestamp, uint256 newMaxExpiryTimestamp) external`

### Function `exchangeBase() external`

### Function `lockQuote(uint256 amount, uint256 freeCollatLiq) external`

### Function `lockBase(uint256 amount, struct ILyraGlobals.ExchangeGlobals exchangeGlobals, struct ILiquidityPool.Liquidity liquidity) external`

### Function `freeQuoteCollateral(uint256 amount) external`

### Function `freeBase(uint256 amountBase) external`

### Function `sendPremium(address recipient, uint256 amount, uint256 freeCollatLiq) external`

### Function `boardLiquidation(uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) external`

### Function `sendReservedQuote(address user, uint256 amount) external`

### Function `getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity) → uint256 external`

### Function `getLiquidity(uint256 basePrice, contract ICollateralShort short) → struct ILiquidityPool.Liquidity external`

### Function `transferQuoteToHedge(struct ILyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) → uint256 external`
