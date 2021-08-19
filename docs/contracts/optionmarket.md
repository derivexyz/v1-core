# `OptionMarket`

An AMM which allows users to trade options. Supports both buying and selling options, which determine the value

for the listing's IV. Also allows for auto cash settling options as at expiry.

## Modifiers:

- `onlyOwner()`

## Functions:

- `init(contract LyraGlobals _globals, contract LiquidityPool _liquidityPool, contract OptionMarketPricer _optionPricer, contract OptionGreekCache _greekCache, contract ShortCollateral _shortCollateral, contract OptionToken _optionToken, contract IERC20 _quoteAsset, contract IERC20 _baseAsset, string[] _errorMessages) (external)`

- `transferOwnership(address newOwner) (external)`

- `setBoardFrozen(uint256 boardId, bool frozen) (external)`

- `setBoardBaseIv(uint256 boardId, uint256 baseIv) (external)`

- `setListingSkew(uint256 listingId, uint256 skew) (external)`

- `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikes, uint256[] skews) (external)`

- `addListingToBoard(uint256 boardId, uint256 strike, uint256 skew) (external)`

- `_addListingToBoard(uint256 boardId, uint256 strike, uint256 skew) (internal)`

- `getLiveBoards() (external)`

- `getBoardListings(uint256 boardId) (external)`

- `openPosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) (external)`

- `closePosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) (external)`

- `_doTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals) (internal)`

- `liquidateExpiredBoard(uint256 boardId) (external)`

- `_liquidateExpiredBoard(struct OptionMarket.OptionBoard board) (internal)`

- `settleOptions(uint256 listingId, enum OptionMarket.TradeType tradeType) (external)`

- `_require(bool pass, enum OptionMarket.Error error) (internal)`

## Events:

- `BoardCreated(uint256 boardId, uint256 expiry, uint256 baseIv)`

- `BoardFrozen(uint256 boardId, bool frozen)`

- `BoardBaseIvSet(uint256 boardId, uint256 baseIv)`

- `ListingSkewSet(uint256 listingId, uint256 skew)`

- `ListingAdded(uint256 boardId, uint256 listingId, uint256 strike, uint256 skew)`

- `PositionOpened(address trader, uint256 listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 totalCost)`

- `PositionClosed(address trader, uint256 listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 totalCost)`

- `BoardLiquidated(uint256 boardId, uint256 totalUserLongProfitQuote, uint256 totalBoardLongCallCollateral, uint256 totalBoardLongPutCollateral, uint256 totalAMMShortCallProfitBase, uint256 totalAMMShortPutProfitQuote)`

- `OwnershipTransferred(address previousOwner, address newOwner)`

### Modifier `onlyOwner()`

Throws if called by any account other than the owner.

### Function `init(contract LyraGlobals _globals, contract LiquidityPool _liquidityPool, contract OptionMarketPricer _optionPricer, contract OptionGreekCache _greekCache, contract ShortCollateral _shortCollateral, contract OptionToken _optionToken, contract IERC20 _quoteAsset, contract IERC20 _baseAsset, string[] _errorMessages) external`

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

#### Parameters:

- `newOwner`: The address of the new contract owner.

### Function `setBoardFrozen(uint256 boardId, bool frozen) external`

Sets the frozen state of an OptionBoard.

#### Parameters:

- `boardId`: The id of the OptionBoard.

- `frozen`: Whether the board will be frozen or not.

### Function `setBoardBaseIv(uint256 boardId, uint256 baseIv) external`

Sets the baseIv of a frozen OptionBoard.

#### Parameters:

- `boardId`: The id of the OptionBoard.

- `baseIv`: The new baseIv value.

### Function `setListingSkew(uint256 listingId, uint256 skew) external`

Sets the skew of an OptionListing of a frozen OptionBoard.

#### Parameters:

- `listingId`: The id of the listing being modified.

- `skew`: The new skew value.

### Function `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikes, uint256[] skews) → uint256 external`

Creates a new OptionBoard which contains OptionListings.

This only allows a new maxExpiryTimestamp to be added if the previous one has been passed. This is done to create a

system of "rounds" where PnL for LPs can be computed easily across all boards.

#### Parameters:

- `expiry`: The timestamp when the board expires.

- `baseIV`: The initial value for implied volatility.

- `strikes`: The array of strikes offered for this expiry.

- `skews`: The array of skews for each strike.

### Function `addListingToBoard(uint256 boardId, uint256 strike, uint256 skew) external`

Add a listing to an existing board in the OptionMarket.

#### Parameters:

- `boardId`: The id of the board which the listing will be added

- `strike`: Strike of the Listing

- `skew`: Skew of the Listing

### Function `_addListingToBoard(uint256 boardId, uint256 strike, uint256 skew) → uint256 listingId internal`

Add a listing to an existing board.

### Function `getLiveBoards() → uint256[] _liveBoards external`

Returns the list of live board ids.

### Function `getBoardListings(uint256 boardId) → uint256[] external`

Returns the listing ids for a given `boardId`.

#### Parameters:

- `boardId`: The id of the relevant OptionBoard.

### Function `openPosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) → uint256 totalCost external`

Opens a position, which may be long call, long put, short call or short put.

#### Parameters:

- `_listingId`: The id of the relevant OptionListing.

- `tradeType`: Is the trade long or short?

- `amount`: The amount the user has requested to trade.

### Function `closePosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount) → uint256 totalCost external`

Closes some amount of an open position. The user does not have to close the whole position.

#### Parameters:

- `_listingId`: The id of the relevant OptionListing.

- `tradeType`: Is the trade long or short?

- `amount`: The amount the user has requested to trade.

### Function `_doTrade(struct OptionMarket.OptionListing listing, struct OptionMarket.OptionBoard board, struct OptionMarket.Trade trade, struct LyraGlobals.PricingGlobals pricingGlobals) → uint256 internal`

Determine the cost of the trade and update the system's iv/skew parameters.

#### Parameters:

- `listing`: The relevant OptionListing.

- `board`: The relevant OptionBoard.

- `trade`: The trade parameters.

- `pricingGlobals`: The pricing globals.

### Function `liquidateExpiredBoard(uint256 boardId) external`

Liquidates a board that has passed expiry. This function will not preserve the ordering of liveBoards.

#### Parameters:

- `boardId`: The id of the relevant OptionBoard.

### Function `_liquidateExpiredBoard(struct OptionMarket.OptionBoard board) internal`

Liquidates an expired board.

It will transfer all short collateral for ITM options that the market owns.

It will reserve collateral for users to settle their ITM long options.

#### Parameters:

- `board`: The relevant OptionBoard.

### Function `settleOptions(uint256 listingId, enum OptionMarket.TradeType tradeType) external`

Settles options for expired and liquidated listings. Also functions as the way to reclaim capital for options

sold to the market.

#### Parameters:

- `listingId`: The id of the relevant OptionListing.

### Function `_require(bool pass, enum OptionMarket.Error error) internal`

### Event `BoardCreated(uint256 boardId, uint256 expiry, uint256 baseIv)`

Emitted when a Board is created.

### Event `BoardFrozen(uint256 boardId, bool frozen)`

Emitted when a Board frozen is updated.

### Event `BoardBaseIvSet(uint256 boardId, uint256 baseIv)`

Emitted when a Board new baseIv is set.

### Event `ListingSkewSet(uint256 listingId, uint256 skew)`

Emitted when a Listing new skew is set.

### Event `ListingAdded(uint256 boardId, uint256 listingId, uint256 strike, uint256 skew)`

Emitted when a Listing is added to a board

### Event `PositionOpened(address trader, uint256 listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 totalCost)`

Emitted when a Position is opened.

### Event `PositionClosed(address trader, uint256 listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 totalCost)`

Emitted when a Position is closed.

### Event `BoardLiquidated(uint256 boardId, uint256 totalUserLongProfitQuote, uint256 totalBoardLongCallCollateral, uint256 totalBoardLongPutCollateral, uint256 totalAMMShortCallProfitBase, uint256 totalAMMShortPutProfitQuote)`

Emitted when a Board is liquidated.

### Event `OwnershipTransferred(address previousOwner, address newOwner)`
