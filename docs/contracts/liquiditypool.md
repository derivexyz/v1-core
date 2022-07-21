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

- `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract LiquidityToken _liquidityToken, contract OptionGreekCache _greekCache, contract PoolHedger _poolHedger, contract ShortCollateral _shortCollateral, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) (external)`

- `setLiquidityPoolParameters(struct LiquidityPool.LiquidityPoolParameters _lpParams) (external)`

- `setPoolHedger(contract PoolHedger newPoolHedger) (external)`

- `updateDelegateApproval() (external)`

- `initiateDeposit(address beneficiary, uint256 amountQuote) (external)`

- `initiateWithdraw(address beneficiary, uint256 amountLiquidityToken) (external)`

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

- `reclaimInsolventQuote(uint256 spotPrice, uint256 amountQuote) (external)`

- `reclaimInsolventBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountBase) (external)`

- `getTotalTokenSupply() (public)`

- `getTokenPriceWithCheck() (external)`

- `getTokenPrice() (public)`

- `_getTokenPrice(uint256 totalPoolValue, uint256 totalTokenSupply) (internal)`

- `getCurrentLiquidity() (external)`

- `getLiquidity(uint256 spotPrice) (public)`

- `getTotalPoolValueQuote() (public)`

- `_getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity, int256 optionValueDebt) (internal)`

- `_getLiquidity(uint256 basePrice, uint256 totalPoolValue, uint256 reservedTokenValue, uint256 usedDelta, uint256 pendingDelta) (internal)`

- `exchangeBase() (public)`

- `_maybeExchangeBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity, bool revertBuyOnInsufficientFunds) (internal)`

- `getLpParams() (external)`

- `updateLiquidationInsolvency(uint256 insolvencyAmountInQuote) (external)`

- `_getPoolHedgerLiquidity(uint256 basePrice) (internal)`

- `transferQuoteToHedge(uint256 spotPrice, uint256 amount) (external)`

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

### Function `init(contract SynthetixAdapter _synthetixAdapter, contract OptionMarket _optionMarket, contract LiquidityToken _liquidityToken, contract OptionGreekCache _greekCache, contract PoolHedger _poolHedger, contract ShortCollateral _shortCollateral, contract ERC20 _quoteAsset, contract ERC20 _baseAsset) external`

Initialise important addresses for the contract

### Function `setLiquidityPoolParameters(struct LiquidityPool.LiquidityPoolParameters _lpParams) external`

set `LiquidityPoolParameteres`

### Function `setPoolHedger(contract PoolHedger newPoolHedger) external`

Swap out current PoolHedger with a new contract

### Function `updateDelegateApproval() external`

In case of an update to the synthetix contract that revokes the approval

### Function `initiateDeposit(address beneficiary, uint256 amountQuote) external`

LP will send sUSD into the contract in return for LiquidityToken (representative of their share of the entire pool)

        to be given either instantly (if no live boards) or after the delay period passes (including CBs).

        This action is not reversible.

#### Parameters:

- `beneficiary`: will receive the LiquidityToken after the deposit is processed

- `amountQuote`: is the amount of sUSD the LP is depositing

### Function `initiateWithdraw(address beneficiary, uint256 amountLiquidityToken) external`

LP instantly burns LiquidityToken, signalling they wish to withdraw

        their share of the pool in exchange for quote, to be processed instantly (if no live boards)

        or after the delay period passes (including CBs).

        This action is not reversible.

#### Parameters:

- `beneficiary`: will receive sUSD after the withdrawal is processed

- `is`: the amount of LiquidityToken the LP is withdrawing

### Function `processDepositQueue(uint256 limit) external`

#### Parameters:

- `limit`: number of deposit tickets to process in a single transaction to avoid gas limit soft-locks

### Function `processWithdrawalQueue(uint256 limit) external`

#### Parameters:

- `limit`: number of withdrawal tickets to process in a single transaction to avoid gas limit soft-locks

### Function `_canProcess(uint256 initiatedTime, uint256 minimumDelay, bool isStale, uint256 entryId) → bool internal`

Checks if deposit/withdrawal ticket can be processed

### Function `_getTotalBurnableTokens() → uint256 tokensBurnable, uint256 tokenPriceWithFee, bool stale internal`

### Function `_getTokenPriceAndStale() → uint256 tokenPrice, bool, uint256 burnableLiquidity internal`

### Function `updateCBs() external`

Checks the ivVariance, skewVariance, and liquidity circuit breakers and triggers if necessary

### Function `_updateCBs(struct LiquidityPool.Liquidity liquidity, uint256 maxIvVariance, uint256 maxSkewVariance, int256 optionValueDebt) internal`

### Function `lockQuote(uint256 amount, uint256 freeLiquidity) external`

Locks quote as collateral when the AMM sells a put option.

#### Parameters:

- `amount`: The amount of quote to lock.

- `freeLiquidity`: The amount of free collateral that can be locked.

### Function `lockBase(uint256 amount, struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity) external`

Purchases and locks base as collateral when the AMM sells a call option.

#### Parameters:

- `amount`: The amount of baseAsset to purchase and lock.

- `exchangeParams`: The exchangeParams.

- `freeLiquidity`: The amount of free collateral that can be locked.

### Function `freeQuoteCollateralAndSendPremium(uint256 amountQuoteFreed, address recipient, uint256 totalCost, uint256 reservedFee) external`

Frees quote collateral when user closes a long put

        and sends them the option premium

#### Parameters:

- `amountQuoteFreed`: The amount of quote to free.

### Function `liquidateBaseAndSendPremium(uint256 amountBase, address recipient, uint256 totalCost, uint256 reservedFee) external`

Frees/exchange base collateral when user closes a long call

        and sends the option premium to the user

#### Parameters:

- `amountBase`: The amount of base to free and exchange.

### Function `sendShortPremium(address recipient, uint256 premium, uint256 freeLiquidity, uint256 reservedFee) external`

Sends premium user selling an option to the pool.

The caller must be the OptionMarket.

#### Parameters:

- `recipient`: The address of the recipient.

- `premium`: The amount to transfer to the user.

- `freeLiquidity`: The amount of free collateral liquidity.

- `reservedFee`: The amount collected by the OptionMarket.

### Function `boardSettlement(uint256 insolventSettlements, uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) external`

Manages collateral at the time of board liquidation, also converting base received from shortCollateral.

#### Parameters:

- `insolventSettlements`: amount of AMM profits not paid by shortCollateral due to user insolvencies.

- `amountQuoteFreed`: amount of AMM long put quote collateral that can be freed, including ITM profits.

- `amountQuoteReserved`: amount of AMM quote reserved for long call/put ITM profits.

- `amountBaseFreed`: amount of AMM long call base collateral that can be freed, including ITM profits.

### Function `_freeQuoteCollateral(uint256 amountQuote) internal`

Frees quote when the AMM buys back/settles a put from the user.

#### Parameters:

- `amountQuote`: The amount of quote to free.

### Function `_freeBase(uint256 amountBase) internal`

Frees base when the AMM buys back/settles a call from the user.

#### Parameters:

- `amountBase`: The amount of base to free.

### Function `_sendPremium(address recipient, uint256 recipientAmount, uint256 optionMarketPortion) internal`

Sends the premium to a user who is closing a long or opening a short.

The caller must be the OptionMarket.

#### Parameters:

- `recipient`: The address of the recipient.

- `recipientAmount`: The amount to transfer to the recipient.

- `optionMarketPortion`: The fee to transfer to the optionMarket.

### Function `sendSettlementValue(address user, uint256 amount) external`

Transfers long option settlement profits to `user`.

The caller must be the ShortCollateral.

#### Parameters:

- `user`: The address of the user to send the quote.

- `amount`: The amount of quote to send.

### Function `reclaimInsolventQuote(uint256 spotPrice, uint256 amountQuote) external`

Claims AMM profits that were not paid during boardSettlement() due to

total quote insolvencies > total solvent quote collateral.

The caller must be ShortCollateral.

#### Parameters:

- `spotPrice`: The current spot price of the base asset.

- `amountQuote`: The amount of quote to send to the LiquidityPool.

### Function `reclaimInsolventBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 amountBase) external`

Claims AMM profits that were not paid during boardSettlement() due to

total base insolvencies > total solvent base collateral.

The caller must be ShortCollateral.

#### Parameters:

- `exchangeParams`: synthetix exchange parameters.

- `amountBase`: The amount of base to send to the LiquidityPool.

### Function `getTotalTokenSupply() → uint256 public`

Get total number of oustanding LiquidityToken

### Function `getTokenPriceWithCheck() → uint256 tokenPrice, bool isStale, uint256 circuitBreakerExpiry external`

Get current pool token price and check if market conditions warrant an accurate token price

#### Return Values:

- tokenPrice price of token

- isStale has global cache not been updated in a long time (if stale, greeks may be inaccurate)

- circuitBreakerExpiry expiry timestamp of the CircuitBreaker (if not expired, greeks may be inaccurate)

### Function `getTokenPrice() → uint256 public`

Get current pool token price without market condition check

### Function `_getTokenPrice(uint256 totalPoolValue, uint256 totalTokenSupply) → uint256 internal`

### Function `getCurrentLiquidity() → struct LiquidityPool.Liquidity external`

Returns the breakdown of current liquidity usage

### Function `getLiquidity(uint256 spotPrice) → struct LiquidityPool.Liquidity public`

Same return as `getCurrentLiquidity()` but with manual spot price

### Function `getTotalPoolValueQuote() → uint256 public`

Gets the current NAV

### Function `_getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity, int256 optionValueDebt) → uint256 internal`

### Function `_getLiquidity(uint256 basePrice, uint256 totalPoolValue, uint256 reservedTokenValue, uint256 usedDelta, uint256 pendingDelta) → struct LiquidityPool.Liquidity internal`

Calculates breakdown of LP liquidity usage.

     Accounts for quote needed to buy/lock base in cases where pool is not fully collateralized.

     PendingLiquidity never exceeds freeLiquidity (before pendingLiquidity is considered).

### Function `exchangeBase() public`

Will buy/sell and lock/free base if pool is under or over collateralized

### Function `_maybeExchangeBase(struct SynthetixAdapter.ExchangeParams exchangeParams, uint256 freeLiquidity, bool revertBuyOnInsufficientFunds) internal`

Will skip base purchase/locking if snx spot fees exceed `lpParams.maxFeePaid`.

### Function `getLpParams() → struct LiquidityPool.LiquidityPoolParameters external`

returns the LiquidityPoolParameters struct

### Function `updateLiquidationInsolvency(uint256 insolvencyAmountInQuote) external`

updates `liquidationInsolventAmount` if liquidated position is insolveny

### Function `_getPoolHedgerLiquidity(uint256 basePrice) → uint256 pendingDeltaLiquidity, uint256 usedDeltaLiquidity internal`

get the total amount of quote used and pending for delta hedging

#### Return Values:

- pendingDeltaLiquidity The amount of liquidity reserved for delta hedging that hasn't occured yet

- usedDeltaLiquidity The value of the current hedge position (long value OR collateral - short debt)

### Function `transferQuoteToHedge(uint256 spotPrice, uint256 amount) → uint256 external`

Sends quote to the PoolHedger.

Transfer amount up to `pendingLiquidity + freeLiquidity`.

The hedger must determine what to do with the amount received.

#### Parameters:

- `spotPrice`: The spot price of the base asset.

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
