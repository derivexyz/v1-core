# `LiquidityPool`

Holds funds from LPs, which are used for the following purposes:

1. Collateralizing options sold by the OptionMarket.

2. Buying options from users.

3. Delta hedging the LPs.

4. Storing funds for expired in the money options.

## Modifiers:

- `onlyPoolHedger()`

- `onlyOptionMarket()`

- `onlyShortCollateral()`

## Functions:

- `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract LiquidityTokens _liquidityTokens, contract OptionGreekCache _greekCache, contract PoolHedger _poolHedger, contract ShortCollateral _shortCollateral, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) (external)`

- `setLiquidityPoolParameters(struct LiquidityPool.LiquidityPoolParameters _lpParams) (external)`

- `setPoolHedger(contract PoolHedger newPoolHedger) (external)`

- `initiateDeposit(address beneficiary, uint256 amountQuote) (external)`

- `initiateWithdraw(address beneficiary, uint256 amountLiquidityTokens) (external)`

- `processDepositQueue(uint256 limit) (external)`

- `processWithdrawalQueue(uint256 limit) (external)`

- `_canProcess(uint256 initiatedTime, uint256 minimumDelay, bool isStale, uint256 entryId) (internal)`

- `_getTotalBurnableTokens() (internal)`

- `_getTokenPriceAndStale() (internal)`

- `updateCBs() (external)`

- `_updateCBs(struct LiquidityPool.Liquidity liquidity, uint256 maxIvVariance, uint256 maxSkewVariance, int256 optionValueDebt) (internal)`

- `lockQuote(uint256 amount, uint256 freeLiquidity) (external)`

- `lockBase(uint256 amount, struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity) (external)`

- `freeQuoteCollateralAndSendPremium(uint256 amountQuoteFreed, address recipient, uint256 totalCost, uint256 reservedFee) (external)`

- `liquidateBaseAndSendPremium(uint256 amountBase, address recipient, uint256 totalCost, uint256 reservedFee) (external)`

- `sendShortPremium(address recipient, uint256 premium, uint256 freeLiquidity, uint256 reservedFee) (external)`

- `boardSettlement(uint256 insolventSettlements, uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) (external)`

- `_freeQuoteCollateral(uint256 amountQuote) (internal)`

- `_freeBase(uint256 amountBase) (internal)`

- `_sendPremium(address recipient, uint256 recipientAmount, uint256 optionMarketPortion) (internal)`

- `sendSettlementValue(address user, uint256 amount) (external)`

- `reclaimInsolventQuote(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountQuote) (external)`

- `reclaimInsolventBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountBase) (external)`

- `getTotalTokenSupply() (public)`

- `getTokenPrice() (public)`

- `_getTokenPrice(uint256 totalPoolValue, uint256 totalTokenSupply) (internal)`

- `getLiquidityParams() (external)`

- `getLiquidity(uint256 basePrice, contract ICollateralShort short) (public)`

- `getTotalPoolValueQuote() (public)`

- `_getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity, int256 optionValueDebt) (internal)`

- `_getLiquidity(uint256 basePrice, uint256 totalPoolValue, uint256 reservedTokenValue, uint256 usedDelta, uint256 pendingDelta) (internal)`

- `exchangeBase() (public)`

- `_maybeExchangeBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity, bool revertBuyOnInsufficientFunds) (internal)`

- `getLpParams() (external)`

- `updateLiquidationInsolvency(uint256 insolvencyAmountInQuote) (external)`

- `_getPoolHedgerLiquidity(contract ICollateralShort short, uint256 basePrice) (internal)`

- `transferQuoteToHedge(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amount) (external)`

- `_transferQuote(address to, uint256 amount) (internal)`

## Events:

- `LiquidityPoolParametersUpdated(struct LiquidityPool.LiquidityPoolParameters lpParams)`

- `PoolHedgerUpdated(contract PoolHedger poolHedger)`

- `QuoteLocked(uint256 quoteLocked, uint256 lockedCollateralQuote)`

- `QuoteFreed(uint256 quoteFreed, uint256 lockedCollateralQuote)`

- `BaseLocked(uint256 baseLocked, uint256 lockedCollateralBase)`

- `BaseFreed(uint256 baseFreed, uint256 lockedCollateralBase)`

- `BoardSettlement(uint256 insolventSettlementAmount, uint256 amountQuoteReserved, uint256 totalOutstandingSettlements)`

- `OutstandingSettlementSent(address user, uint256 amount, uint256 totalOutstandingSettlements)`

- `BasePurchased(uint256 quoteSpent, uint256 baseReceived)`

- `BaseSold(uint256 amountBase, uint256 quoteReceived)`

- `PremiumTransferred(address recipient, uint256 recipientPortion, uint256 optionMarketPortion)`

- `QuoteTransferredToPoolHedger(uint256 amountQuote)`

- `InsolventSettlementAmountUpdated(uint256 amountQuoteAdded, uint256 totalInsolventSettlementAmount)`

- `DepositQueued(address depositor, address beneficiary, uint256 depositQueueId, uint256 amountDeposited, uint256 totalQueuedDeposits, uint256 timestamp)`

- `DepositProcessed(address caller, address beneficiary, uint256 depositQueueId, uint256 amountDeposited, uint256 tokenPrice, uint256 tokensReceived, uint256 timestamp)`

- `WithdrawProcessed(address caller, address beneficiary, uint256 withdrawalQueueId, uint256 amountWithdrawn, uint256 tokenPrice, uint256 quoteReceived, uint256 totalQueuedWithdrawals, uint256 timestamp)`

- `WithdrawPartiallyProcessed(address caller, address beneficiary, uint256 withdrawalQueueId, uint256 amountWithdrawn, uint256 tokenPrice, uint256 quoteReceived, uint256 totalQueuedWithdrawals, uint256 timestamp)`

- `WithdrawQueued(address withdrawer, address beneficiary, uint256 withdrawalQueueId, uint256 amountWithdrawn, uint256 totalQueuedWithdrawals, uint256 timestamp)`

- `CircuitBreakerUpdated(uint256 newTimestamp, bool ivVarianceThresholdCrossed, bool skewVarianceThresholdCrossed, bool liquidityThresholdCrossed)`

- `BoardSettlementCircuitBreakerUpdated(uint256 newTimestamp)`

- `CheckingCanProcess(uint256 entryId, bool boardNotStale, bool validEntry, bool guardianBypass, bool delaysExpired)`

### Modifier `onlyPoolHedger()`

### Modifier `onlyOptionMarket()`

### Modifier `onlyShortCollateral()`

### Function `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract LiquidityTokens _liquidityTokens, contract OptionGreekCache _greekCache, contract PoolHedger _poolHedger, contract ShortCollateral _shortCollateral, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) external`

Initialise important addresses for the contract

### Function `setLiquidityPoolParameters(struct LiquidityPool.LiquidityPoolParameters _lpParams) external`

### Function `setPoolHedger(contract PoolHedger newPoolHedger) external`

Update the pool hedger, can only be done if the value in the pool hedger is 0

### Function `initiateDeposit(address beneficiary, uint256 amountQuote) external`

LP will send sUSD into the contract in return for LiquidityTokens (representative of their share of the entire pool)

        to be given either instantly (if no live boards) or after the delay period passes (including CBs).

        This action is not reversible.

#### Parameters:

- `beneficiary`: will receive the LiquidityTokens after the deposit is processed

- `amountQuote`: is the amount of sUSD the LP is depositing

### Function `initiateWithdraw(address beneficiary, uint256 amountLiquidityTokens) external`

LP will send LiquidityTokens into the contract to be burnt instantly, signalling they wish to remove

        their share of the pool represented by the tokens being burnt.

#### Parameters:

- `beneficiary`: will receive the LiquidityTokens after the deposit is processed

- `is`: the amount of sUSD the LP is depositing

### Function `processDepositQueue(uint256 limit) external`

#### Parameters:

- `limit`: how many to process in a single transaction to avoid gas limit soft-locks

### Function `processWithdrawalQueue(uint256 limit) external`

#### Parameters:

- `limit`: how many to process in a single transaction to avoid gas limit soft-locks

### Function `_canProcess(uint256 initiatedTime, uint256 minimumDelay, bool isStale, uint256 entryId) → bool internal`

### Function `_getTotalBurnableTokens() → uint256 tokensBurnable, uint256 tokenPriceWithFee, bool stale internal`

### Function `_getTokenPriceAndStale() → uint256 tokenPrice, bool, uint256 burnableLiquidity internal`

### Function `updateCBs() external`

Updates the circuit breaker parameters

### Function `_updateCBs(struct LiquidityPool.Liquidity liquidity, uint256 maxIvVariance, uint256 maxSkewVariance, int256 optionValueDebt) internal`

### Function `lockQuote(uint256 amount, uint256 freeLiquidity) external`

Locks quote when the system sells a put option.

#### Parameters:

- `amount`: The amount of quote to lock.

- `freeLiquidity`: The amount of free collateral that can be locked.

### Function `lockBase(uint256 amount, struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity) external`

Purchases and locks base when the system sells a call option.

#### Parameters:

- `amount`: The amount of baseAsset to purchase and lock.

- `exchangeParams`: The exchangeParams.

- `freeLiquidity`: The amount of free collateral that can be locked.

### Function `freeQuoteCollateralAndSendPremium(uint256 amountQuoteFreed, address recipient, uint256 totalCost, uint256 reservedFee) external`

Frees quote when the system buys back a put from the user and sends them the option premium

#### Parameters:

- `amountQuoteFreed`: The amount of quote to free.

### Function `liquidateBaseAndSendPremium(uint256 amountBase, address recipient, uint256 totalCost, uint256 reservedFee) external`

Sells and frees base collateral. Sends the option premium to the user

#### Parameters:

- `amountBase`: The amount of base to sell.

### Function `sendShortPremium(address recipient, uint256 premium, uint256 freeLiquidity, uint256 reservedFee) external`

Sends the premium to a user who is selling an option to the pool.

The caller must be the OptionMarket.

#### Parameters:

- `recipient`: The address of the recipient.

- `premium`: The amount to transfer to the user.

- `freeLiquidity`: The amount of free collateral liquidity.

- `reservedFee`: The amount collected by the OptionMarket.

### Function `boardSettlement(uint256 insolventSettlements, uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) external`

Manages collateral at the time of board liquidation, also converting base sent here from the OptionMarket.

#### Parameters:

- `amountQuoteFreed`: Total amount of base to convert to quote, including profits from short calls.

- `amountQuoteReserved`: Total amount of base to convert to quote, including profits from short calls.

- `amountBaseFreed`: Total amount of collateral to free.

### Function `_freeQuoteCollateral(uint256 amountQuote) internal`

Frees quote when the system buys back a put from the user.

#### Parameters:

- `amountQuote`: The amount of quote to free.

### Function `_freeBase(uint256 amountBase) internal`

### Function `_sendPremium(address recipient, uint256 recipientAmount, uint256 optionMarketPortion) internal`

Sends the premium to a user who is closing an existing option position.

The caller must be the OptionMarket.

#### Parameters:

- `recipient`: The address of the recipient.

- `recipientAmount`: The amount to transfer to the recipient.

- `optionMarketPortion`: The amount to transfer to the optionMarket.

### Function `sendSettlementValue(address user, uint256 amount) external`

Transfers reserved quote. Sends `amount` of reserved quoteAsset to `user`.

Requirements:

- the caller must be `ShortCollateral`.

#### Parameters:

- `user`: The address of the user to send the quote.

- `amount`: The amount of quote to send.

### Function `reclaimInsolventQuote(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountQuote) external`

### Function `reclaimInsolventBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountBase) external`

### Function `getTotalTokenSupply() → uint256 public`

Get current total liquidity tokens supply

### Function `getTokenPrice() → uint256 public`

Get current pool token price

### Function `_getTokenPrice(uint256 totalPoolValue, uint256 totalTokenSupply) → uint256 internal`

### Function `getLiquidityParams() → struct LiquidityPool.Liquidity external`

Gets current liquidity parameters using current market spot prices

### Function `getLiquidity(uint256 basePrice, contract ICollateralShort short) → struct LiquidityPool.Liquidity public`

### Function `getTotalPoolValueQuote() → uint256 public`

### Function `_getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity, int256 optionValueDebt) → uint256 internal`

Returns the total pool value in quoteAsset.

#### Parameters:

- `basePrice`: The price of the baseAsset.

- `usedDeltaLiquidity`: The amount of delta liquidity that has been used for hedging.

- `optionValueDebt`: the "debt" the AMM owes to traders in terms of option exposure

### Function `_getLiquidity(uint256 basePrice, uint256 totalPoolValue, uint256 reservedTokenValue, uint256 usedDelta, uint256 pendingDelta) → struct LiquidityPool.Liquidity internal`

Returns the used and free amounts for collateral and delta liquidity.

#### Parameters:

- `basePrice`: The price of the base asset.

### Function `exchangeBase() public`

In-case of a mismatch of base balance and lockedCollateral.base; will rebalance the baseAsset balance of the LiquidityPool

### Function `_maybeExchangeBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity, bool revertBuyOnInsufficientFunds) internal`

### Function `getLpParams() → struct LiquidityPool.LiquidityPoolParameters external`

returns LiquidityPoolParameters struct

### Function `updateLiquidationInsolvency(uint256 insolvencyAmountInQuote) external`

updates the liquidation insolvency by quote amount specified

### Function `_getPoolHedgerLiquidity(contract ICollateralShort short, uint256 basePrice) → uint256 pendingDeltaLiquidity, uint256 usedDeltaLiquidity internal`

get the current level of delta hedging as well as outstanding

#### Return Values:

- pendingDeltaLiquidity The amount of liquidity reserved for delta hedging that hasn't occured yet

- usedDeltaLiquidity The value of the current hedge position (long value OR collateral - short debt)

### Function `transferQuoteToHedge(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amount) → uint256 external`

Sends quoteAsset to the PoolHedger.

This function will transfer whatever free delta liquidity is available.

The hedger must determine what to do with the amount received.

#### Parameters:

- `exchangeParams`: The exchangeParams.

- `amount`: The amount requested by the PoolHedger.

### Function `_transferQuote(address to, uint256 amount) internal`

### Event `LiquidityPoolParametersUpdated(struct LiquidityPool.LiquidityPoolParameters lpParams)`

Emitted whenever the pool paramters are updated

### Event `PoolHedgerUpdated(contract PoolHedger poolHedger)`

Emitted whenever the poolHedger address is modified

### Event `QuoteLocked(uint256 quoteLocked, uint256 lockedCollateralQuote)`

Emitted when quote is locked.

### Event `QuoteFreed(uint256 quoteFreed, uint256 lockedCollateralQuote)`

Emitted when quote is freed.

### Event `BaseLocked(uint256 baseLocked, uint256 lockedCollateralBase)`

Emitted when base is locked.

### Event `BaseFreed(uint256 baseFreed, uint256 lockedCollateralBase)`

Emitted when base is freed.

### Event `BoardSettlement(uint256 insolventSettlementAmount, uint256 amountQuoteReserved, uint256 totalOutstandingSettlements)`

Emitted when a board is settled.

### Event `OutstandingSettlementSent(address user, uint256 amount, uint256 totalOutstandingSettlements)`

Emitted when reserved quote is sent.

### Event `BasePurchased(uint256 quoteSpent, uint256 baseReceived)`

Emitted whenever quote is exchanged for base

### Event `BaseSold(uint256 amountBase, uint256 quoteReceived)`

Emitted whenever base is exchanged for quote

### Event `PremiumTransferred(address recipient, uint256 recipientPortion, uint256 optionMarketPortion)`

Emitted whenever premium is sent to a trader closing their position

### Event `QuoteTransferredToPoolHedger(uint256 amountQuote)`

Emitted whenever quote is sent to the PoolHedger

### Event `InsolventSettlementAmountUpdated(uint256 amountQuoteAdded, uint256 totalInsolventSettlementAmount)`

Emitted whenever the insolvent settlement amount is updated (settlement and excess)

### Event `DepositQueued(address depositor, address beneficiary, uint256 depositQueueId, uint256 amountDeposited, uint256 totalQueuedDeposits, uint256 timestamp)`

Emitted whenever a user deposits and enters the queue.

### Event `DepositProcessed(address caller, address beneficiary, uint256 depositQueueId, uint256 amountDeposited, uint256 tokenPrice, uint256 tokensReceived, uint256 timestamp)`

Emitted whenever a deposit gets processed. Note, can be processed without being queued.

 QueueId of 0 indicates it was not queued.

### Event `WithdrawProcessed(address caller, address beneficiary, uint256 withdrawalQueueId, uint256 amountWithdrawn, uint256 tokenPrice, uint256 quoteReceived, uint256 totalQueuedWithdrawals, uint256 timestamp)`

Emitted whenever a deposit gets processed. Note, can be processed without being queued.

 QueueId of 0 indicates it was not queued.

### Event `WithdrawPartiallyProcessed(address caller, address beneficiary, uint256 withdrawalQueueId, uint256 amountWithdrawn, uint256 tokenPrice, uint256 quoteReceived, uint256 totalQueuedWithdrawals, uint256 timestamp)`

### Event `WithdrawQueued(address withdrawer, address beneficiary, uint256 withdrawalQueueId, uint256 amountWithdrawn, uint256 totalQueuedWithdrawals, uint256 timestamp)`

### Event `CircuitBreakerUpdated(uint256 newTimestamp, bool ivVarianceThresholdCrossed, bool skewVarianceThresholdCrossed, bool liquidityThresholdCrossed)`

Emitted whenever the CB timestamp is updated

### Event `BoardSettlementCircuitBreakerUpdated(uint256 newTimestamp)`

Emitted whenever the CB timestamp is updated from a board settlement

### Event `CheckingCanProcess(uint256 entryId, bool boardNotStale, bool validEntry, bool guardianBypass, bool delaysExpired)`

Emitted whenever a queue item is checked for the ability to be processed
