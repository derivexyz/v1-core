# `ShortCollateral`

## Modifiers:

- `onlyOptionMarket()`

## Functions:

- `init(contract OptionMarket _optionMarket, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) (external)`

- `sendQuoteCollateral(address recipient, uint256 amount) (external)`

- `sendBaseCollateral(address recipient, uint256 amount) (external)`

- `sendQuoteToLP(uint256 amount) (external)`

- `sendBaseToLP(uint256 amount) (external)`

- `processExercise(uint256 listingId, address receiver, int256 callAmt, int256 putAmt, uint256 strike, uint256 priceAtExpiry, uint256 listingToShortCallEthReturned) (external)`

## Events:

- `OptionsExercised(uint256 listingId, address optionOwner, uint256 strike, uint256 priceAtExpiry, int256 callAmt, int256 putAmt)`

- `quoteSent(address receiver, uint256 amount)`

- `baseSent(address receiver, uint256 amount)`

### Modifier `onlyOptionMarket()`

### Function `init(contract OptionMarket _optionMarket, contract LiquidityPool _liquidityPool, contract IERC20 _quoteAsset, contract IERC20 _baseAsset) external`

Initialize the contract.

#### Parameters:

- `_optionMarket`: OptionMarket address

- `_liquidityPool`: LiquidityPool address

- `_quoteAsset`: Quote asset address

- `_baseAsset`: Base asset address

### Function `sendQuoteCollateral(address recipient, uint256 amount) external`

### Function `sendBaseCollateral(address recipient, uint256 amount) external`

### Function `sendQuoteToLP(uint256 amount) external`

### Function `sendBaseToLP(uint256 amount) → uint256 external`

### Function `processExercise(uint256 listingId, address receiver, int256 callAmt, int256 putAmt, uint256 strike, uint256 priceAtExpiry, uint256 listingToShortCallEthReturned) external`

### Event `OptionsExercised(uint256 listingId, address optionOwner, uint256 strike, uint256 priceAtExpiry, int256 callAmt, int256 putAmt)`

Emitted when a Option is exercised.

### Event `quoteSent(address receiver, uint256 amount)`

Emitted when quote is sent to either a user or the LiquidityPool

### Event `baseSent(address receiver, uint256 amount)`

Emitted when base is sent to either a user or the LiquidityPool
