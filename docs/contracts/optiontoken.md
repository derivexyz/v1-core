# `OptionToken`

Provides a tokenised representation of each OptionListing offered

by the OptionMarket.

## Modifiers:

- `onlyOptionMarket()`

## Functions:

- `constructor(string uri_) (public)`

- `init(address _optionMarket) (external)`

- `setURI(string newURI) (external)`

- `mint(address account, uint256 id, uint256 amount) (external)`

- `burn(address account, uint256 id, uint256 amount) (external)`

### Modifier `onlyOptionMarket()`

### Function `constructor(string uri_) public`

### Function `init(address _optionMarket) external`

Initialise the contract.

#### Parameters:

- `_optionMarket`: The OptionMarket contract address.

### Function `setURI(string newURI) external`

Initialise the contract.

#### Parameters:

- `newURI`: The new uri definition for the contract.

### Function `mint(address account, uint256 id, uint256 amount) external`

Initialise the contract.

#### Parameters:

- `account`: The owner of the tokens.

- `id`: The listingId + tradeType of the option.

- `amount`: The amount of options.

### Function `burn(address account, uint256 id, uint256 amount) external`

Burn the specified amount of token for the account.

#### Parameters:

- `account`: The owner of the tokens.

- `id`: The listingId + tradeType of the option.

- `amount`: The amount of options.
