# `OptionMarket`

An AMM which allows users to trade options. Supports both buying and selling options. Also handles liquidating

short positions.

## Modifiers:

- `notGlobalPaused()`

## Functions:

- `init(contract SynthetixAdapter _synthetixAdapter, contract LiquidityPool _liquidityPool, contract OptionMarketPricer _optionPricer, contract OptionGreekCache _greekCache, contract ShortCollateral _shortCollateral, contract OptionToken _optionToken, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikePrices, uint256[] skews, bool frozen) (external)`

- `setBoardFrozen(uint256 boardId, bool frozen) (external)`

- `setBoardBaseIv(uint256 boardId, uint256 baseIv) (external)`

- `setStrikeSkew(uint256 strikeId, uint256 skew) (external)`

- `addStrikeToBoard(uint256 boardId, uint256 strikePrice, uint256 skew) (external)`

- `_addStrikeToBoard(struct OptionMarket.OptionBoard board, uint256 strikePrice, uint256 skew) (internal)`

- `forceSettleBoard(uint256 boardId) (external)`

- `setOptionMarketParams(struct OptionMarket.OptionMarketParameters _optionMarketParams) (external)`

- `smClaim() (external)`

- `getLiveBoards() (external)`

- `getNumLiveBoards() (external)`

- `getStrikeAndExpiry(uint256 strikeId) (external)`

- `getBoardStrikes(uint256 boardId) (external)`

- `getStrike(uint256 strikeId) (external)`

- `getOptionBoard(uint256 boardId) (external)`

- `getStrikeAndBoard(uint256 strikeId) (external)`

- `getBoardAndStrikeDetails(uint256 boardId) (external)`

- `openPosition(struct OptionMarket.TradeInputParameters params) (external)`

- `closePosition(struct OptionMarket.TradeInputParameters params) (external)`

- `forceClosePosition(struct OptionMarket.TradeInputParameters params) (external)`

- `addCollateral(uint256 positionId, uint256 amountCollateral) (external)`

- `_checkCostInBounds(uint256 totalCost, uint256 minCost, uint256 maxCost) (internal)`

- `_openPosition(struct OptionMarket.TradeInputParameters params) (internal)`

- `_closePosition(struct OptionMarket.TradeInputParameters params, bool forceClose) (internal)`

- `_composeTrade(uint256 strikeId, enum OptionMarket.OptionType optionType, uint256 amount, enum OptionMarket.TradeDirection _tradeDirection, uint256 iterations, bool isForceClose) (internal)`

- `_isLong(enum OptionMarket.OptionType optionType) (internal)`

- `_doTrade(struct OptionMarket.Strike strike, struct OptionMarket.OptionBoard board, struct OptionMarket.TradeParameters trade, uint256 iterations, uint256 expectedAmount) (internal)`

- `liquidatePosition(uint256 positionId, address rewardBeneficiary) (external)`

- `_routeLPFundsOnOpen(struct OptionMarket.TradeParameters trade, uint256 totalCost, uint256 feePortion) (internal)`

- `_routeLPFundsOnClose(struct OptionMarket.TradeParameters trade, uint256 totalCost, uint256 reservedFee) (internal)`

- `_routeUserCollateral(enum OptionMarket.OptionType optionType, int256 pendingCollateral) (internal)`

- `_updateExposure(uint256 amount, enum OptionMarket.OptionType optionType, struct OptionMarket.Strike strike, bool isOpen) (internal)`

- `settleExpiredBoard(uint256 boardId) (external)`

- `_clearAndSettleBoard(struct OptionMarket.OptionBoard board) (internal)`

- `_settleExpiredBoard(struct OptionMarket.OptionBoard board) (internal)`

- `getSettlementParameters(uint256 strikeId) (external)`

- `_transferFromQuote(address from, address to, uint256 amount) (internal)`

## Events:

- `BoardCreated(uint256 boardId, uint256 expiry, uint256 baseIv, bool frozen)`

- `BoardFrozen(uint256 boardId, bool frozen)`

- `BoardBaseIvSet(uint256 boardId, uint256 baseIv)`

- `StrikeSkewSet(uint256 strikeId, uint256 skew)`

- `StrikeAdded(uint256 boardId, uint256 strikeId, uint256 strikePrice, uint256 skew)`

- `OptionMarketParamsSet(struct OptionMarket.OptionMarketParameters optionMarketParams)`

- `SMClaimed(address securityModule, uint256 quoteAmount, uint256 baseAmount)`

- `Trade(address trader, uint256 strikeId, uint256 positionId, struct OptionMarket.TradeEventData trade, struct OptionMarketPricer.TradeResult[] tradeResults, struct OptionMarket.LiquidationEventData liquidation, uint256 timestamp)`

- `BoardSettled(uint256 boardId, uint256 spotPriceAtExpiry, uint256 totalUserLongProfitQuote, uint256 totalBoardLongCallCollateral, uint256 totalBoardLongPutCollateral, uint256 totalAMMShortCallProfitBase, uint256 totalAMMShortCallProfitQuote, uint256 totalAMMShortPutProfitQuote)`

### Modifier `notGlobalPaused()`

### Function `init(contract SynthetixAdapter _synthetixAdapter, contract LiquidityPool _liquidityPool, contract OptionMarketPricer _optionPricer, contract OptionGreekCache _greekCache, contract ShortCollateral _shortCollateral, contract OptionToken _optionToken, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialize the contract.

### Function `createOptionBoard(uint256 expiry, uint256 baseIV, uint256[] strikePrices, uint256[] skews, bool frozen) → uint256 external`

Creates a new OptionBoard which contains Strikes.

#### Parameters:

- `expiry`: The timestamp when the board expires.

- `baseIV`: The initial value for implied volatility.

- `strikePrices`: The array of strikePrices offered for this expiry.

- `skews`: The array of skews for each strikePrice.

- `frozen`: Whether the board is frozen or not at creation.

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

### Function `setStrikeSkew(uint256 strikeId, uint256 skew) external`

Sets the skew of an Strike of a frozen OptionBoard.

#### Parameters:

- `strikeId`: The id of the strike being modified.

- `skew`: The new skew value.

### Function `addStrikeToBoard(uint256 boardId, uint256 strikePrice, uint256 skew) external`

Add a strike to an existing board in the OptionMarket.

#### Parameters:

- `boardId`: The id of the board which the strike will be added

- `strikePrice`: Strike of the Strike

- `skew`: Skew of the Strike

### Function `_addStrikeToBoard(struct OptionMarket.OptionBoard board, uint256 strikePrice, uint256 skew) → struct OptionMarket.Strike internal`

Add a strike to an existing board.

### Function `forceSettleBoard(uint256 boardId) external`

### Function `setOptionMarketParams(struct OptionMarket.OptionMarketParameters _optionMarketParams) external`

### Function `smClaim() external`

### Function `getLiveBoards() → uint256[] _liveBoards external`

Returns the list of live board ids.

### Function `getNumLiveBoards() → uint256 numLiveBoards external`

Returns the number of current live boards

### Function `getStrikeAndExpiry(uint256 strikeId) → uint256 strikePrice, uint256 expiry external`

Returns the strike and expiry for a given strikeId

### Function `getBoardStrikes(uint256 boardId) → uint256[] external`

Returns the strike ids for a given `boardId`.

#### Parameters:

- `boardId`: The id of the relevant OptionBoard.

### Function `getStrike(uint256 strikeId) → struct OptionMarket.Strike external`

Returns the Strike struct for a given strikeId

### Function `getOptionBoard(uint256 boardId) → struct OptionMarket.OptionBoard external`

Returns the OptionBoard struct for a given boardId

### Function `getStrikeAndBoard(uint256 strikeId) → struct OptionMarket.Strike, struct OptionMarket.OptionBoard external`

Returns the Strike and OptionBoard structs for a given strikeId

### Function `getBoardAndStrikeDetails(uint256 boardId) → struct OptionMarket.OptionBoard, struct OptionMarket.Strike[], uint256[], uint256 external`

Returns board and strike details given a boardId

#### Return Values:

- OptionBoard the OptionBoard struct

- the list of board strikes

- the list of strike to base returned ratios

- uint the board to price at expiry

### Function `openPosition(struct OptionMarket.TradeInputParameters params) → struct OptionMarket.Result result external`

Attempts to open positions within cost bounds.

If a positionId is specified that position is adjusted accordingly

#### Parameters:

- `params`: The parameters for the requested trade

### Function `closePosition(struct OptionMarket.TradeInputParameters params) → struct OptionMarket.Result result external`

Attempts to reduce or fully close position within cost bounds.

#### Parameters:

- `params`: The parameters for the requested trade

### Function `forceClosePosition(struct OptionMarket.TradeInputParameters params) → struct OptionMarket.Result result external`

Attempts to reduce or fully close position within cost bounds while ignoring delta trading cutoffs.

#### Parameters:

- `params`: The parameters for the requested trade

### Function `addCollateral(uint256 positionId, uint256 amountCollateral) external`

Add collateral of size amountCollateral onto a short position (long or call) specified by positionId;

        this transfers tokens (which may be denominated in the quote or the base asset). This allows you to

        further collateralise a short position in order to, say, prevent imminent liquidation.

#### Parameters:

- `positionId`: addCollateral to this positionId

- `amountCollateral`: the amount of collateral to be added

### Function `_checkCostInBounds(uint256 totalCost, uint256 minCost, uint256 maxCost) internal`

### Function `_openPosition(struct OptionMarket.TradeInputParameters params) → struct OptionMarket.Result result internal`

Opens a position, which may be long call, long put, short call or short put.

### Function `_closePosition(struct OptionMarket.TradeInputParameters params, bool forceClose) → struct OptionMarket.Result result internal`

Closes some amount of an open position. The user does not have to close the whole position.

### Function `_composeTrade(uint256 strikeId, enum OptionMarket.OptionType optionType, uint256 amount, enum OptionMarket.TradeDirection _tradeDirection, uint256 iterations, bool isForceClose) → struct OptionMarket.TradeParameters trade, struct OptionMarket.Strike strike, struct OptionMarket.OptionBoard board internal`

Compile all trade related details

### Function `_isLong(enum OptionMarket.OptionType optionType) → bool internal`

### Function `_doTrade(struct OptionMarket.Strike strike, struct OptionMarket.OptionBoard board, struct OptionMarket.TradeParameters trade, uint256 iterations, uint256 expectedAmount) → uint256 totalAmount, uint256 totalCost, uint256 totalFee, struct OptionMarketPricer.TradeResult[] tradeResults internal`

Determine the cost of the trade and update the system's iv/skew/exposure parameters.

#### Parameters:

- `strike`: The relevant Strike.

- `board`: The relevant OptionBoard.

- `trade`: The trade parameters.

### Function `liquidatePosition(uint256 positionId, address rewardBeneficiary) external`

Allows you to liquidate an underwater position

#### Parameters:

- `positionId`: the position to be liquidated

- `rewardBeneficiary`: the address to receive quote/base

### Function `_routeLPFundsOnOpen(struct OptionMarket.TradeParameters trade, uint256 totalCost, uint256 feePortion) internal`

### Function `_routeLPFundsOnClose(struct OptionMarket.TradeParameters trade, uint256 totalCost, uint256 reservedFee) internal`

### Function `_routeUserCollateral(enum OptionMarket.OptionType optionType, int256 pendingCollateral) internal`

cannot be called with any optionType other than a short with > 0 pendingCollateral

### Function `_updateExposure(uint256 amount, enum OptionMarket.OptionType optionType, struct OptionMarket.Strike strike, bool isOpen) internal`

### Function `settleExpiredBoard(uint256 boardId) external`

Settle a board that has passed expiry. This function will not preserve the ordering of liveBoards.

#### Parameters:

- `boardId`: The id of the relevant OptionBoard.

### Function `_clearAndSettleBoard(struct OptionMarket.OptionBoard board) internal`

### Function `_settleExpiredBoard(struct OptionMarket.OptionBoard board) internal`

Liquidates an expired board.

It will transfer all short collateral for ITM options that the market owns.

It will reserve collateral for users to settle their ITM long options.

#### Parameters:

- `board`: The relevant OptionBoard.

### Function `getSettlementParameters(uint256 strikeId) → uint256 strikePrice, uint256 priceAtExpiry, uint256 strikeToBaseReturned external`

Returns the strike price, price at expiry, strike to base returned for a given strikeId

### Function `_transferFromQuote(address from, address to, uint256 amount) internal`

### Event `BoardCreated(uint256 boardId, uint256 expiry, uint256 baseIv, bool frozen)`

Emitted when a Board is created.

### Event `BoardFrozen(uint256 boardId, bool frozen)`

Emitted when a Board frozen is updated.

### Event `BoardBaseIvSet(uint256 boardId, uint256 baseIv)`

Emitted when a Board new baseIv is set.

### Event `StrikeSkewSet(uint256 strikeId, uint256 skew)`

Emitted when a Strike new skew is set.

### Event `StrikeAdded(uint256 boardId, uint256 strikeId, uint256 strikePrice, uint256 skew)`

Emitted when a Strike is added to a board

### Event `OptionMarketParamsSet(struct OptionMarket.OptionMarketParameters optionMarketParams)`

Emitted when parameters for the option market are adjusted

### Event `SMClaimed(address securityModule, uint256 quoteAmount, uint256 baseAmount)`

Emitted whenever the security module claims their portion of fees

### Event `Trade(address trader, uint256 strikeId, uint256 positionId, struct OptionMarket.TradeEventData trade, struct OptionMarketPricer.TradeResult[] tradeResults, struct OptionMarket.LiquidationEventData liquidation, uint256 timestamp)`

Emitted when a Position is opened, closed or liquidated.

### Event `BoardSettled(uint256 boardId, uint256 spotPriceAtExpiry, uint256 totalUserLongProfitQuote, uint256 totalBoardLongCallCollateral, uint256 totalBoardLongPutCollateral, uint256 totalAMMShortCallProfitBase, uint256 totalAMMShortCallProfitQuote, uint256 totalAMMShortPutProfitQuote)`

Emitted when a Board is liquidated.
