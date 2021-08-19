# `OptionMarketSafeSlippage`

Allows users to set the min/max price they want to purchase options for, to help prevent frontrunning or

sandwich attacks.

## Functions:

- `init(contract OptionMarket _optionMarket, contract OptionToken _optionToken, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `openPosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 maxCost, uint256 minCost) (external)`

- `closePosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 maxCost, uint256 minCost) (external)`

### Function `init(contract OptionMarket _optionMarket, contract OptionToken _optionToken, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialises the contract

#### Parameters:

- `_optionMarket`: The optionMarket contract address

- `_optionToken`: The optionToken contract address

- `_quoteAsset`: The quoteAsset contract address

- `_baseAsset`: The baseAsset contract address

### Function `openPosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 maxCost, uint256 minCost) external`

Attempts to open positions within bounds, reverts if the returned amount is outside of the accepted bounds.

#### Parameters:

- `_listingId`: The id of the relevant OptionListing

- `tradeType`: Is the trade a long/short & call/put?

- `amount`: The amount the user has requested to trade

- `maxCost`: Max cost user is willing to pay

- `minCost`: Min cost user is willing to pay

### Function `closePosition(uint256 _listingId, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 maxCost, uint256 minCost) external`

Attempts to close some amount of an open position within bounds, reverts if the returned amount is outside of

the accepted bounds.

#### Parameters:

- `_listingId`: The id of the relevant OptionListing

- `tradeType`: Is the trade a long/short & call/put?

- `amount`: The amount the user has requested to close

- `maxCost`: Max amount for the cost of the trade

- `minCost`: Min amount for the cost of the trade
