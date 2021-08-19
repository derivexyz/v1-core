# `ShortCollateral`

Holds collateral from users who are selling (shorting) options to the OptionMarket.

## Modifiers:

- `onlyOptionMarket()`

## Functions:

- `init(contract OptionMarket _optionMarket, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `sendQuoteCollateral(address recipient, uint256 amount) (external)`

- `sendBaseCollateral(address recipient, uint256 amount) (external)`

- `sendToLP(uint256 amountBase, uint256 amountQuote) (external)`

- `processSettle(uint256 listingId, address receiver, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 strike, uint256 priceAtExpiry, uint256 listingToShortCallEthReturned) (external)`

## Events:

- `OptionsSettled(uint256 listingId, address optionOwner, uint256 strike, uint256 priceAtExpiry, enum OptionMarket.TradeType tradeType, uint256 amount)`

- `QuoteSent(address receiver, uint256 amount)`

- `BaseSent(address receiver, uint256 amount)`

### Modifier `onlyOptionMarket()`

### Function `init(contract OptionMarket _optionMarket, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialize the contract.

#### Parameters:

- `_optionMarket`: OptionMarket address

- `_liquidityPool`: LiquidityPool address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

### Function `sendQuoteCollateral(address recipient, uint256 amount) external`

Transfers quoteAsset to the recipient.

#### Parameters:

- `recipient`: The recipient of the transfer.

- `amount`: The amount to send.

### Function `sendBaseCollateral(address recipient, uint256 amount) external`

Transfers baseAsset to the recipient.

#### Parameters:

- `recipient`: The recipient of the transfer.

- `amount`: The amount to send.

### Function `sendToLP(uint256 amountBase, uint256 amountQuote) external`

Transfers quoteAsset and baseAsset to the LiquidityPool.

#### Parameters:

- `amountBase`: The amount of baseAsset to transfer.

- `amountQuote`: The amount of quoteAsset to transfer.

### Function `processSettle(uint256 listingId, address receiver, enum OptionMarket.TradeType tradeType, uint256 amount, uint256 strike, uint256 priceAtExpiry, uint256 listingToShortCallEthReturned) external`

Called by the OptionMarket when the owner of an option settles.

#### Parameters:

- `listingId`: The OptionListing.

- `receiver`: The address of the receiver.

- `tradeType`: The TradeType.

- `amount`: The amount to settle.

- `strike`: The strike price of the OptionListing.

- `priceAtExpiry`: The price of baseAsset at expiry.

- `listingToShortCallEthReturned`: The amount of ETH to be returned.

### Event `OptionsSettled(uint256 listingId, address optionOwner, uint256 strike, uint256 priceAtExpiry, enum OptionMarket.TradeType tradeType, uint256 amount)`

Emitted when an Option is settled.

### Event `QuoteSent(address receiver, uint256 amount)`

Emitted when quote is sent to either a user or the LiquidityPool

### Event `BaseSent(address receiver, uint256 amount)`

Emitted when base is sent to either a user or the LiquidityPool
