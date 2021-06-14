# `LiquidityPool`

Allows users to deposit the quote asset and get issued a Liquidity Certificate.

This NFT represents a share of the LP.

Funds are used both as collateral/premium for the options in `OptionMarket.sol` and for hedging risk in

`PoolHedger.sol`. This is done in a 2:1 ratio.

### Rounds

Funding is done in rounds. Liquidity cannot enter, nor can it be removed, until the round is over.

A round is defined by the maxExpiryTimestamp in OptionMarket. No new boards can be added with expiries greater than

the maxExpiryTimestamp until it has been passed. This does not prevent new boards being added that have a shorter

expiry, however as no liquidity is added/removed to the pool until the round is over, this doesn't affect any

calculations.

### Tokens

For accounting reasons, we use a concept of a "TokenPrice" which is the value of liquidity in relation to the rest

of the pool. A Token is a share of the entire pool, as such the price of a "token" is:

 tokenPrice = poolValueQuote / tokenTotalSupply

As this definition requires pool value/tokens to exist, we set a base price of a token to be 1 unit of quote asset.

### LiquidityCertificates

When liquidity is added, we store the amount of liquidity that will be added, along with at what timestamp the

liquidity can enter the pool. When the round ends, we store the token value at the time, and by having the entry and

exit value of the tokens, we can compute the amount owed the the LPs.

 amount owed = liquidity / (entryTokenPrice) * (exitTokenPrice)

As we need to track these variables per bundle of liquidity, we issue an NFT to lender which is their claim to the

value. These can be transferred to other users, potentially sold on secondary markets to gain access to the value

immediately. Otherwise, the tokens will need to signal they want to leave the market, and will continue to be locked

until the round is over.

In the period between rounds, tokens should be instantly burnable for their value as well.

### Glossary

- **base asset:** refers to the asset that is the quantity of a symbol. For the pair ETH USD, ETH would be the base

asset.

- **quote asset:** refers to the asset that is the price of a symbol. For the pair ETH USD, USD would be the quote

asset.

## Modifiers:

- `onlyPoolHedger()`

- `onlyOptionMarket()`

- `onlyShortCollateral()`

## Functions:

- `init(contract OptionMarket _optionMarket, contract LiquidityCertificate _liquidityCertificate, contract PoolHedger _hedge, contract ShortCollateral _shortCollateral, contract IERC20 _quoteAsset) (external)`

- `tokenPriceQuote(contract ICollateralShort short, uint256 spotPrice) (public)`

- `deposit(address beneficiary, uint256 amount) (external)`

- `signalWithdrawal(uint256 certificateId) (external)`

- `unSignalWithdrawal(uint256 certificateId) (external)`

- `withdraw(address beneficiary, uint256 certificateId) (external)`

- `endRound(contract ICollateralShort short, uint256 basePrice, uint256 maxExpiryTimestamp) (external)`

- `startRound(uint256 lastMaxExpiryTimestamp, uint256 newMaxExpiryTimestamp) (external)`

- `lockQuote(uint256 amount, uint256 freeCollatLiq) (external)`

- `lockBase(uint256 amount, struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 freeCollatLiq) (external)`

- `freeQuoteCollateral(uint256 amount) (external)`

- `freeBase(uint256 amountBase, struct LyraGlobals.ExchangeGlobals exchangeGlobals) (external)`

- `liquidateCollateral(uint256 amountToLiquidate, uint256 amountCollateral, struct LyraGlobals.ExchangeGlobals exchangeGlobals) (external)`

- `reserveQuote(uint256 amount) (external)`

- `sendReservedQuote(address user, uint256 amount) (external)`

- `sendPremium(address recipient, uint256 amount, uint256 freeCollatLiq) (external)`

- `transferQuoteToHedge(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) (external)`

- `getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity) (public)`

- `getUsedCollatLiquidityQuote(uint256 basePrice) (public)`

- `getLiquidity(uint256 basePrice, contract ICollateralShort short) (public)`

## Events:

- `Deposit(address beneficiary, uint256 certificateId, uint256 amount)`

- `WithdrawSignaled(uint256 certificateId, uint256 tokensBurnableForRound)`

- `WithdrawUnSignaled(uint256 certificateId, uint256 tokensBurnableForRound)`

- `Withdraw(address beneficiary, uint256 certificateId, uint256 value, uint256 totalQuoteAmountReserved)`

- `RoundEnded(uint256 maxExpiryTimestamp, uint256 pricePerToken, uint256 totalQuoteAmountReserved, uint256 totalTokenSupply)`

- `RoundStarted(uint256 lastMaxExpiryTimestmp, uint256 newMaxExpiryTimestmp, uint256 totalTokenSupply, uint256 totalPoolValueQuote)`

- `QuoteLocked(uint256 amount, uint256 lockedCollateralQuote)`

- `BaseLocked(uint256 quoteSpent, uint256 baseReceivedAndLocked, uint256 lockedCollateralBase)`

- `QuoteFreed(uint256 amount, uint256 lockedCollateralQuote)`

- `BaseFreed(uint256 amountSoldBase, uint256 receivedQuote, uint256 lockedCollateralBase)`

- `CollateralLiquidated(uint256 totalAmountToLiquidate, uint256 baseFreed, uint256 quoteReceived, uint256 lockedCollateralBase)`

- `QuoteReserved(uint256 amount, uint256 totalQuoteAmountReserved)`

- `ReservedQuoteSent(address user, uint256 amount, uint256 totalQuoteAmountReserved)`

- `CollateralQuoteTransferred(address recipient, uint256 amount)`

- `DeltaQuoteTransferredToPoolHedger(uint256 amount)`

### Modifier `onlyPoolHedger()`

### Modifier `onlyOptionMarket()`

### Modifier `onlyShortCollateral()`

### Function `init(contract OptionMarket _optionMarket, contract LiquidityCertificate _liquidityCertificate, contract PoolHedger _hedge, contract ShortCollateral _shortCollateral, contract IERC20 _quoteAsset) external`

Initalize the contract.

#### Parameters:

- `_optionMarket`: OptionMarket address

- `_liquidityCertificate`: LiquidityCertificate address

- `_quoteAsset`: Quote Asset address

- `_hedge`: PoolHedger address

### Function `tokenPriceQuote(contract ICollateralShort short, uint256 spotPrice) → uint256 public`

Return Token value.

This token price is only accurate within the period between rounds

Otherwise it would have to factor in the value of all outstanding contracts

### Function `deposit(address beneficiary, uint256 amount) → uint256 external`

Deposits liquidity to the pool.

This assumes users have authorised access to the quote ERC20 token.

Note this does not need to rebalance the books, hedge() should be called often enough to handle that.

#### Parameters:

- `beneficiary`: The account that will receive the deposit.

- `amount`: The amount of quoteAsset to deposit.

### Function `signalWithdrawal(uint256 certificateId) external`

Signals withdraw of liquidity from the pool.

It is not possible to withdraw during a round.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `unSignalWithdrawal(uint256 certificateId) external`

Undo a previously signalled withdraw.

Certificate owner must have signalled withdraw to call this function.

#### Parameters:

- `certificateId`: The id of the LiquidityCertificate.

### Function `withdraw(address beneficiary, uint256 certificateId) → uint256 external`

Withdraws liquidity from the pool.

This requires tokens to have been locked until burnableAt timestamp has passed.

This will burn the liquidityCertificates and have the quote asset equivalent at the time be returned to the users

#### Parameters:

- `beneficiary`: The account that will receive the withdrawn funds.

- `certificateId`: The id of the LiquidityCertificate.

### Function `endRound(contract ICollateralShort short, uint256 basePrice, uint256 maxExpiryTimestamp) external`

Ends a round.

Should only be called after `maxExpiryTimestamp` andall boards have been liquidated.

#### Parameters:

- `short`: The address of Synthetix's short contract.

- `basePrice`: The price of the baseAsset.

- `maxExpiryTimestamp`: The time at which the round ended.

### Function `startRound(uint256 lastMaxExpiryTimestamp, uint256 newMaxExpiryTimestamp) external`

Starts a round.

#### Parameters:

- `lastMaxExpiryTimestamp`: The time at which the previous rounnd ended.

- `newMaxExpiryTimestamp`: The time which funds will be locked until.

### Function `lockQuote(uint256 amount, uint256 freeCollatLiq) external`

Locks quote when the system sells a put option.

#### Parameters:

- `amount`: The amount of quote to lock.

- `freeCollatLiq`: The amount of free collateral that can be locked.

### Function `lockBase(uint256 amount, struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 freeCollatLiq) external`

Purchases and locks base when the system sells a call option.

#### Parameters:

- `amount`: The amount of baseAsset to purchase and lock.

- `exchangeGlobals`: The exchangeGlobals.

- `freeCollatLiq`: The amount of free collateral that can be locked.

### Function `freeQuoteCollateral(uint256 amount) external`

Frees quote when the system buys back a put from the user.

#### Parameters:

- `amount`: The amount of quote to free.

### Function `freeBase(uint256 amountBase, struct LyraGlobals.ExchangeGlobals exchangeGlobals) → uint256 external`

Sells base and frees the proceeds of the sale.

#### Parameters:

- `amountBase`: The amount of base to sell.

- `exchangeGlobals`: The exchangeGlobals.

### Function `liquidateCollateral(uint256 amountToLiquidate, uint256 amountCollateral, struct LyraGlobals.ExchangeGlobals exchangeGlobals) → uint256 external`

Frees base, and liquidates extra eth sent here from the OptionMarket when liquidating the boards

merged to only call exchange once.

#### Parameters:

- `amountToLiquidate`: Total amount of eth to convert to quote, including profits from short calls.

- `amountCollateral`: Total amount of collateral to liquidate.

- `exchangeGlobals`: The exchangeGlobals.

### Function `reserveQuote(uint256 amount) external`

Reserves Base. This function is specifically for locking quote for paying out long call/put options that

finished in the money. `totalQuoteAmountReserved` keeps track of both that, and funds that are to be withdrawn by

LPs who have signalled to exit.

Requirements:

- the caller must be `OptionMarket`.

#### Parameters:

- `amount`: TODO - add description

### Function `sendReservedQuote(address user, uint256 amount) external`

Transfers reserved qu

Sends some `amount` of reserved quote to a given `user`.

Requirements:

- the caller must be `OptionMarket`.

#### Parameters:

- `user`: The address of the user to send the quote.

- `amount`: The amount of quote to send.

### Function `sendPremium(address recipient, uint256 amount, uint256 freeCollatLiq) external`

Sends the premium to a user who is selling an option to the pool.

The caller must be the OptionMarket.

#### Parameters:

- `recipient`: The address of the recipient.

- `amount`: The amount to transfer.

- `freeCollatLiq`: The amount of free collateral liquidity.

### Function `transferQuoteToHedge(struct LyraGlobals.ExchangeGlobals exchangeGlobals, uint256 amount) → uint256 external`

Sends quoteAsset to the PoolHedger.

This function will transfer whatever free delta liquidity is available.

The hedger must determine what to do with the amount received.

#### Parameters:

- `exchangeGlobals`: The exchangeGlobals.

- `amount`: The amount requested by the PoolHedger.

### Function `getTotalPoolValueQuote(uint256 basePrice, uint256 usedDeltaLiquidity) → uint256 public`

Returns the total pool value in quoteAsset.

#### Parameters:

- `basePrice`: The price of the baseAsset.

- `usedDeltaLiquidity`: The amout of delta liquidity that has been used for hedging.

### Function `getUsedCollatLiquidityQuote(uint256 basePrice) → uint256 public`

Returns used collateral liquidity in quoteAsset.

#### Parameters:

- `basePrice`: The price of the baseAsset.

### Function `getLiquidity(uint256 basePrice, contract ICollateralShort short) → struct LiquidityPool.Liquidity public`

Returns the used and free amounts for collateral and delta liquidity.

#### Parameters:

- `basePrice`: The price of the base asset.

- `short`: The address of the short contract.

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

### Event `QuoteLocked(uint256 amount, uint256 lockedCollateralQuote)`

Emitted when quote is locked.

### Event `BaseLocked(uint256 quoteSpent, uint256 baseReceivedAndLocked, uint256 lockedCollateralBase)`

Emitted when base is locked.

### Event `QuoteFreed(uint256 amount, uint256 lockedCollateralQuote)`

Emitted when quote is freed.

### Event `BaseFreed(uint256 amountSoldBase, uint256 receivedQuote, uint256 lockedCollateralBase)`

Emitted when base is freed.

### Event `CollateralLiquidated(uint256 totalAmountToLiquidate, uint256 baseFreed, uint256 quoteReceived, uint256 lockedCollateralBase)`

Emitted when collateral is liquidated. This combines LP profit from short calls and freeing base collateral

### Event `QuoteReserved(uint256 amount, uint256 totalQuoteAmountReserved)`

Emitted when quote is reserved.

### Event `ReservedQuoteSent(address user, uint256 amount, uint256 totalQuoteAmountReserved)`

Emitted when reserved quote is sent.

### Event `CollateralQuoteTransferred(address recipient, uint256 amount)`

Emitted when collatQuote is transferred.

### Event `DeltaQuoteTransferredToPoolHedger(uint256 amount)`

Emitted when quote is transferred to hedge.
