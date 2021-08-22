# `LiquidityPool`

Holds funds from LPs, which are used for the following purposes:

1. Collateralising options sold by the OptionMarket.

2. Buying options from users.

3. Delta hedging the LPs.

4. Storing funds for expired in the money options.

## Modifiers:

- `onlyPoolHedger()`

- `onlyOptionMarket()`

- `onlyShortCollateral()`

- `reentrancyGuard()`

## Functions:

- `init(contract ILyraGlobals _globals, contract IOptionMarket _optionMarket, contract ILiquidityCertificate _liquidityCertificate, contract IPoolHedger _poolHedger, contract IShortCollateral _shortCollateral, contract IERC20 _quoteAsset, contract IERC20 _baseAsset, string[] _errorMessages) (external)`

- `deposit(address beneficiary, uint256 amount) (external)`

- `signalWithdrawal(uint256 certificateId) (external)`

- `unSignalWithdrawal(uint256 certificateId) (external)`

- `withdraw(address beneficiary, uint256 certificateId) (external)`

- `tokenPriceQuote() (public)`

- `endRound() (external)`

- `startRound(uint256 lastMaxExpiryTimestamp, uint256 newMaxExpiryTimestamp) (external)`

- `exchangeBase() (external)`

- `lockQuote(uint256 amount, uint256 freeCollatLiq) (external)`

- `lockBase(uint256 amount, struct ILyraGlobals.ExchangeGlobals exchangeGlobals, struct ILiquidityPool.Liquidity liquidity) (external)`

- `freeQuoteCollateral(uint256 amount) (external)`

- `_freeQuoteCollateral(uint256 amount) (internal)`

- `freeBase(uint256 amountBase) (external)`

- `sendPremium(address recipient, uint256 amount, uint256 freeCollatLiq) (external)`

- `boardLiquidation(uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) (external)`

- `sendReservedQuote(address user, uint256 amount) (external)`

- `getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity) (public)`

- `getLiquidity(uint256 basePrice, contract ICollateralShort short) (public)`

- `transferQuoteToHedge(struct ILyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) (external)`

- `_require(bool pass, enum ILiquidityPool.Error error) (internal)`

## Events:

- `Deposit(address beneficiary, uint256 certificateId, uint256 amount)`

- `WithdrawSignaled(uint256 certificateId, uint256 tokensBurnableForRound)`

- `WithdrawUnSignaled(uint256 certificateId, uint256 tokensBurnableForRound)`

- `Withdraw(address beneficiary, uint256 certificateId, uint256 value, uint256 totalQuoteAmountReserved)`

- `RoundEnded(uint256 maxExpiryTimestamp, uint256 pricePerToken, uint256 totalQuoteAmountReserved, uint256 totalTokenSupply)`

- `RoundStarted(uint256 lastMaxExpiryTimestmp, uint256 newMaxExpiryTimestmp, uint256 totalTokenSupply, uint256 totalPoolValueQuote)`

- `QuoteLocked(uint256 quoteLocked, uint256 lockedCollateralQuote)`

- `BaseLocked(uint256 baseLocked, uint256 lockedCollateralBase)`

- `QuoteFreed(uint256 quoteFreed, uint256 lockedCollateralQuote)`

- `BaseFreed(uint256 baseFreed, uint256 lockedCollateralBase)`

- `BasePurchased(address caller, uint256 quoteSpent, uint256 amountPurchased)`

- `BaseSold(address caller, uint256 amountSold, uint256 quoteReceived)`

- `CollateralLiquidated(uint256 totalAmountToLiquidate, uint256 baseFreed, uint256 quoteReceived, uint256 lockedCollateralBase)`

- `QuoteReserved(uint256 amountQuoteReserved, uint256 totalQuoteAmountReserved)`

- `ReservedQuoteSent(address user, uint256 amount, uint256 totalQuoteAmountReserved)`

- `CollateralQuoteTransferred(address recipient, uint256 amount)`

- `DeltaQuoteTransferredToPoolHedger(uint256 amount)`

### Modifier `onlyPoolHedger()`

### Modifier `onlyOptionMarket()`

### Modifier `onlyShortCollateral()`

### Modifier `reentrancyGuard()`

### Function `init(contract ILyraGlobals _globals, contract IOptionMarket _optionMarket, contract ILiquidityCertificate _liquidityCertificate, contract IPoolHedger _poolHedger, contract IShortCollateral _shortCollateral, contract IERC20 _quoteAsset, contract IERC20 _baseAsset, string[] _errorMessages) external`

Initialize the contract.

#### Parameters:

- `_optionMarket`: OptionMarket address

- `_liquidityCertificate`: LiquidityCertificate address

- `_quoteAsset`: Quote Asset address

- `_poolHedger`: PoolHedger address

### Function `deposit(address beneficiary, uint256 amount) → uint256 external`

Deposits liquidity to the pool. This assumes users have authorised access to the quote ERC20 token. Will add

any deposited amount to the queuedQuoteFunds until the next round begins.

#### Parameters:

- `beneficiary`: The account that will receive the liquidity certificate.

- `amount`: The amount of quoteAsset to deposit.

### Function `signalWithdrawal(uint256 certificateId) external`

Signals withdraw of liquidity from the pool.

It is not possible to withdraw during a round, thus a user can signal to withdraw at the time the round ends.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `unSignalWithdrawal(uint256 certificateId) external`

Undo a previously signalled withdraw. Certificate owner must have signalled withdraw to call this function,

and cannot unsignal if the token is already burnable or burnt.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `withdraw(address beneficiary, uint256 certificateId) → uint256 value external`

Withdraws liquidity from the pool.

This requires tokens to have been locked until the round ending at the burnableAt timestamp has been ended.

This will burn the liquidityCertificates and have the quote asset equivalent at the time be reserved for the users.

#### Parameters:

- `beneficiary`: The account that will receive the withdrawn funds.

- `certificateId`: The id of the LiquidityCertificate.

### Function `tokenPriceQuote() → uint256 public`

Return Token value.

This token price is only accurate within the period between rounds.

### Function `endRound() external`

Ends a round.

Should only be called after all boards have been liquidated.

### Function `startRound(uint256 lastMaxExpiryTimestamp, uint256 newMaxExpiryTimestamp) external`

Starts a round. Can only be called by optionMarket contract when adding a board.

#### Parameters:

- `lastMaxExpiryTimestamp`: The time at which the previous round ended.

- `newMaxExpiryTimestamp`: The time which funds will be locked until.

### Function `exchangeBase() external`

external override function that will bring the base balance of this contract to match locked.base. This cannot be done

in the same transaction as locking the base, as exchanging on synthetix is too costly gas-wise.

### Function `lockQuote(uint256 amount, uint256 freeCollatLiq) external`

Locks quote when the system sells a put option.

#### Parameters:

- `amount`: The amount of quote to lock.

- `freeCollatLiq`: The amount of free collateral that can be locked.

### Function `lockBase(uint256 amount, struct ILyraGlobals.ExchangeGlobals exchangeGlobals, struct ILiquidityPool.Liquidity liquidity) external`

Purchases and locks base when the system sells a call option.

#### Parameters:

- `amount`: The amount of baseAsset to purchase and lock.

- `exchangeGlobals`: The exchangeGlobals.

- `liquidity`: Free and used liquidity amounts.

### Function `freeQuoteCollateral(uint256 amount) external`

Frees quote when the system buys back a put from the user.

#### Parameters:

- `amount`: The amount of quote to free.

### Function `_freeQuoteCollateral(uint256 amount) internal`

Frees quote when the system buys back a put from the user.

#### Parameters:

- `amount`: The amount of quote to free.

### Function `freeBase(uint256 amountBase) external`

Sells base and frees the proceeds of the sale.

#### Parameters:

- `amountBase`: The amount of base to sell.

### Function `sendPremium(address recipient, uint256 amount, uint256 freeCollatLiq) external`

Sends the premium to a user who is selling an option to the pool.

The caller must be the OptionMarket.

#### Parameters:

- `recipient`: The address of the recipient.

- `amount`: The amount to transfer.

- `freeCollatLiq`: The amount of free collateral liquidity.

### Function `boardLiquidation(uint256 amountQuoteFreed, uint256 amountQuoteReserved, uint256 amountBaseFreed) external`

Manages collateral at the time of board liquidation, also converting base sent here from the OptionMarket.

#### Parameters:

- `amountQuoteFreed`: Total amount of base to convert to quote, including profits from short calls.

- `amountQuoteReserved`: Total amount of base to convert to quote, including profits from short calls.

- `amountBaseFreed`: Total amount of collateral to liquidate.

### Function `sendReservedQuote(address user, uint256 amount) external`

Transfers reserved quote. Sends `amount` of reserved quoteAsset to `user`.

Requirements:

- the caller must be `OptionMarket`.

#### Parameters:

- `user`: The address of the user to send the quote.

- `amount`: The amount of quote to send.

### Function `getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity) → uint256 public`

Returns the total pool value in quoteAsset.

#### Parameters:

- `basePrice`: The price of the baseAsset.

- `usedDeltaLiquidity`: The amout of delta liquidity that has been used for hedging.

### Function `getLiquidity(uint256 basePrice, contract ICollateralShort short) → struct ILiquidityPool.Liquidity public`

Returns the used and free amounts for collateral and delta liquidity.

#### Parameters:

- `basePrice`: The price of the base asset.

- `short`: The address of the short contract.

### Function `transferQuoteToHedge(struct ILyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) → uint256 external`

Sends quoteAsset to the PoolHedger.

This function will transfer whatever free delta liquidity is available.

The hedger must determine what to do with the amount received.

#### Parameters:

- `exchangeGlobals`: The exchangeGlobals.

- `amount`: The amount requested by the PoolHedger.

### Function `_require(bool pass, enum ILiquidityPool.Error error) internal`

### Event `Deposit(address beneficiary, uint256 certificateId, uint256 amount)`

Emitted when liquidity is deposited.

### Event `WithdrawSignaled(uint256 certificateId, uint256 tokensBurnableForRound)`

Emitted when withdrawal is signaled.

### Event `WithdrawUnSignaled(uint256 certificateId, uint256 tokensBurnableForRound)`

Emitted when a withdrawal is unsignaled.

### Event `Withdraw(address beneficiary, uint256 certificateId, uint256 value, uint256 totalQuoteAmountReserved)`

Emitted when liquidity is withdrawn.

### Event `RoundEnded(uint256 maxExpiryTimestamp, uint256 pricePerToken, uint256 totalQuoteAmountReserved, uint256 totalTokenSupply)`

Emitted when a round ends.

### Event `RoundStarted(uint256 lastMaxExpiryTimestmp, uint256 newMaxExpiryTimestmp, uint256 totalTokenSupply, uint256 totalPoolValueQuote)`

Emitted when a round starts.

### Event `QuoteLocked(uint256 quoteLocked, uint256 lockedCollateralQuote)`

Emitted when quote is locked.

### Event `BaseLocked(uint256 baseLocked, uint256 lockedCollateralBase)`

Emitted when base is locked.

### Event `QuoteFreed(uint256 quoteFreed, uint256 lockedCollateralQuote)`

Emitted when quote is freed.

### Event `BaseFreed(uint256 baseFreed, uint256 lockedCollateralBase)`

Emitted when base is freed.

### Event `BasePurchased(address caller, uint256 quoteSpent, uint256 amountPurchased)`

Emitted when base is purchased.

### Event `BaseSold(address caller, uint256 amountSold, uint256 quoteReceived)`

Emitted when base is sold.

### Event `CollateralLiquidated(uint256 totalAmountToLiquidate, uint256 baseFreed, uint256 quoteReceived, uint256 lockedCollateralBase)`

Emitted when collateral is liquidated. This combines LP profit from short calls and freeing base collateral

### Event `QuoteReserved(uint256 amountQuoteReserved, uint256 totalQuoteAmountReserved)`

Emitted when quote is reserved.

### Event `ReservedQuoteSent(address user, uint256 amount, uint256 totalQuoteAmountReserved)`

Emitted when reserved quote is sent.

### Event `CollateralQuoteTransferred(address recipient, uint256 amount)`

Emitted when collatQuote is transferred.

### Event `DeltaQuoteTransferredToPoolHedger(uint256 amount)`

Emitted when quote is transferred to hedge.
