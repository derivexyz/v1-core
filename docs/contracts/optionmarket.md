# `OptionMarket`

A collection of boards/listings which a user can trade against. Manages collateral locking/freeing for longs,

holds collateral for shorts, board expiry and liquidation, and cash settling/exercising options that finished in the

money.

---

Boards are a collection of listings at a specific expiry. Listings are a combination of strike and expiry. They are

created by the owner of the contract. At the time of creation, the baseIV of the board is specified, along with a

skew value per listing. These combine to define the volatility value for the option, which is required for the

BlackScholes pricing model.

## Trading

Traders have both the option to buy a call/put option from the market (a long) or to sell a call/put option to the

market (a short). Once the trader has an outstanding position (positive for long, negative for short), they must

close their position to take out a position on the opposite side (i.e. close their long to open a short). This

applies separately for both calls and puts.

When options are purchased from the market, collateral is locked in the LiquidityPool, and users send the cost to the

LiquidityPool. When options are sold to the market, users must lock collateral in the OptionMarket (this contract),

and receive the cost from the LiquidityPool. When an option is closed, this is reversed.

Each of the four scenarios behave differently; they are listed at the bottom of this comment.

When a trader is opening a long, or closing a short; that is considered a buy from the perspective of the user,

the contract notes this as isBuy = true. Similarly, when a trader opens a short, or closes a long, isBuy = false.

`isBuy` denotes which direction the market is moving, and scales the board's iv and the listing's vol in that

direction. It also denotes whether a fee is charged on top of the blackScholes option price, or removed from. i.e. if

the market is  paying for the option, the fee should be removed from the price; to pay less out to the trader, as LPs

are the ones making the market.

new IV/skew values and option prices are returned from the OptionMarketPricer contract.

## Board Liquidation and Option Exercising

Beyond trading, the OptionMarket is also responsible for the liquidation of assets held by a board, as well as

reserving the correct amount of assets required to pay out to all the traders. This functions similarly to what "auto

exercising" is. When the expiry time has passed, the spot price of baseAsset is reserved, and funds are reserved

appropriately for all listings. As options are cash settled, this involves holding onto the difference of spotPrice

and strike for long options; and liquidating and sending a portion of the collateral from options sold to the market.

## Opening/closing/liquidating different types options.

### Long Call (user is buying a call from the market)

#### To open:

- User must send the cost of the options to the LP in quoteAsset

- LP locks the amount of options purchased in baseAsset. This is converted from quoteAsset.

#### To close:

- User receives the cost of the options in quoteAsset

- LP frees the amount of options in baseAsset. This is converted to quoteAsset.

#### At liquidation:

- If spot > strike

 => (spot - strike) quoteAsset is reserved per option to pay out to the user

### Long Put (user is buying a put from the market)

#### To open:

- User must send the cost of the options to the LP in quoteAsset.

- LP locks the amount of options purchased * the strike in quoteAsset.

#### To close:

- User receives the cost of the options in quoteAsset

- LP frees the amount of options purchased * the strike in quoteAsset.

#### At liquidation:

- If strike > spot

 => (strike - spot) quoteAsset is reserved per option to pay out to the user

### Short Call (user is selling a call to the market)

#### To open:

- User sends the amount of options in baseAsset to the OptionMarket (this contract)

- User receives the cost of the options in quoteAsset from LP

#### To close:

- User sends the cost of the options in quoteAsset to LP

- User receives the amount of options in baseAsset from the OptionMarket (this contract)

#### At liquidation:

- If spot > strike

 => (spot - strike) quoteAsset is reserved per option is taken from the user's collateral (baseAsset is sold)

 => The remainder of baseAsset is reserved to pay back to the user

- Else

 => baseAsset is reserved to pay back to the user per option

### Short Put (user is selling a call to the market)

#### To open:

- User sends the amount of options * strike in quoteAsset to the OptionMarket (this contract)

- User receives the cost of the options in quoteAsset from LP

#### To close:

- User sends the cost of the options in quoteAsset to LP

- User receives the amount of options * strike in quoteAsset from the OptionMarket (this contract)

#### At liquidation:

- If strike > spot

 => (strike - spot) quoteAsset per option is taken from the user's collateral

 => (spot) is sent to the user per option

- Else

 => (strike) is sent to the user per option

## Modifiers:

- `onlyOwner()`

## Functions:

- `init(contract LyraGlobals _globals, contract LiquidityPool _liquidityPool, contract OptionMarketPricer _optionPricer, contract OptionGreekCache _greekCache, contract ShortCollateral _shortCollateral, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `transferOwnership(address newOwner) (external)`

- `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikes, uint256[] skews) (external)`

- `_canDoTrade(address account, uint256 listingId, bool isLong, bool isCall, bool isOpen, uint256 amount) (internal)`

- `openPosition(uint256 _listingId, bool isLong, bool isCall, uint256 amount) (external)`

- `closePosition(uint256 _listingId, bool isLong, bool isCall, uint256 amount) (external)`

- `_doTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals) (internal)`

- `getLiveBoards() (external)`

- `getBoardListings(uint256 boardId) (external)`

- `_liquidateExpiredBoard(struct LyraGlobals.ExchangeGlobals exchangeGlobals, struct OptionMarket.OptionBoard board) (internal)`

- `liquidateExpiredBoard(uint256 boardId) (external)`

- `exerciseOptions(uint256 listingId) (external)`

## Events:

- `BoardCreated(uint256 boardId)`

- `PositionOpened(address trader, uint256 listingId, bool isLong, bool isCall, uint256 amount, uint256 totalCost)`

- `PositionClosed(address trader, uint256 listingId, bool isLong, bool isCall, uint256 amount, uint256 totalCost)`

- `BoardLiquidated(uint256 boardId, uint256 totalUserLongProfitQuote, uint256 totalBoardLongCallCollateral, uint256 totalBoardLongPutCollateral, uint256 totalAMMShortCallProfitBase, uint256 totalAMMShortPutProfitQuote)`

- `OwnershipTransferred(address previousOwner, address newOwner)`

### Modifier `onlyOwner()`

### Function `init(contract LyraGlobals _globals, contract LiquidityPool _liquidityPool, contract OptionMarketPricer _optionPricer, contract OptionGreekCache _greekCache, contract ShortCollateral _shortCollateral, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialize the contract.

#### Parameters:

- `_globals`: LyraGlobals address

- `_liquidityPool`: LiquidityPool address

- `_optionPricer`: OptionMarketPricer address

- `_greekCache`: OptionGreekCache address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

### Function `transferOwnership(address newOwner) external`

Transfer this contract ownership to `newOwner`.

Implement simple version of ownership to avoid excess code size (due to optimism contract size constraints).

#### Parameters:

- `newOwner`: The address of the new contract owner.

### Function `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikes, uint256[] skews) → uint256 external`

Creates a new OptionBoard which contains OptionListings.

This only allows a new maxExpiryTimestamp to be added if the previous one has been passed.

This is done to create a system of "rounds" where PnL can be computed easily

across all boards for LPs to withdraw liquidity.

#### Parameters:

- `expiry`: The timestamp when the board expires.

- `baseIV`: The initial value for implied volatility.

- `strikes`: The array of strikes offered for this expiry.

- `skews`: The array of skews for each strike.

### Function `_canDoTrade(address account, uint256 listingId, bool isLong, bool isCall, bool isOpen, uint256 amount) → bool internal`

Checks if the user can make the proposed trade.

A user cannot have a long and short position on the same listing and option type.

For example, if a user is long calls, they cannot open a short call position.

However, they can open a short put position.

#### Parameters:

- `account`: The account requesting the trade.

- `listingId`: The id of the relevant OptionListing.

- `isLong`: Is the trade long or short?

- `isCall`: Is the trade a call or a put?

- `isOpen`: Is the user opening a position or closing an existing one?

- `amount`: The amount the user has requested to trade.

### Function `openPosition(uint256 _listingId, bool isLong, bool isCall, uint256 amount) external`

Opens a position, which may be long call, long put, short call or short put.

#### Parameters:

- `_listingId`: The id of the relevant OptionListing.

- `isLong`: Is the trade long or short?

- `isCall`: Is the trade a call or a put?

- `amount`: The amount the user has requested to trade.

### Function `closePosition(uint256 _listingId, bool isLong, bool isCall, uint256 amount) external`

Closes some amount of an open position. The user does not have to close the whole position.

#### Parameters:

- `_listingId`: The id of the relevant OptionListing.

- `isLong`: Is the trade long or short?

- `isCall`: Is the trade a call or a put?

- `amount`: The amount the user has requested to trade.

### Function `_doTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals) → uint256 internal`

Determine the cost of the trade and update the system's net exposure.

This function does not care whether the position is being opened or closed.

It only cares about which way the options are flowing (i.e. user --> system or system  --> user).

#### Parameters:

- `listing`: The relevant OptionListing.

- `board`: The relevant OptionBoard.

- `trade`: The trade parameters.

- `pricingGlobals`: The pricing globals.

### Function `getLiveBoards() → uint256[] external`

Returns the list of live board ids.

### Function `getBoardListings(uint256 boardId) → uint256[] external`

Returns the listing ids for a given `boardId`.

#### Parameters:

- `boardId`: The id of the relevant OptionBoard.

### Function `_liquidateExpiredBoard(struct LyraGlobals.ExchangeGlobals exchangeGlobals, struct OptionMarket.OptionBoard board) internal`

Liquidates an expired board.

This will sell all locked base collateral to quote.

It will exercise ITM options that the market owns.

It will reserve collateral for users to exercise their ITM options.

#### Parameters:

- `board`: The relevant OptionBoard.

### Function `liquidateExpiredBoard(uint256 boardId) external`

Liquidates a board that has passed expiry.

This function will not preserve the ordering of liveBoards.

#### Parameters:

- `boardId`: The id of the relevant OptionBoard.

### Function `exerciseOptions(uint256 listingId) external`

Exercises options for expired and liquidated listings.

Also functions as the way to reclaim capital for options sold to the market.

#### Parameters:

- `listingId`: The id of the relevant OptionListing.

### Event `BoardCreated(uint256 boardId)`

Emitted when a Board is created.

### Event `PositionOpened(address trader, uint256 listingId, bool isLong, bool isCall, uint256 amount, uint256 totalCost)`

Emitted when a Position is opened.

### Event `PositionClosed(address trader, uint256 listingId, bool isLong, bool isCall, uint256 amount, uint256 totalCost)`

Emitted when a Position is closed.

### Event `BoardLiquidated(uint256 boardId, uint256 totalUserLongProfitQuote, uint256 totalBoardLongCallCollateral, uint256 totalBoardLongPutCollateral, uint256 totalAMMShortCallProfitBase, uint256 totalAMMShortPutProfitQuote)`

Emitted when a Board is liquidated.

### Event `OwnershipTransferred(address previousOwner, address newOwner)`

Emitted when a ownership is transferred.
