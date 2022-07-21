# `LyraRegistry`

Provides helpful functions to allow the dapp to operate more smoothly; logic in getPremiumForTrade is vital to

ensuring accurate prices are provided to the user.

## Functions:

- `getMarketAddresses(contract OptionMarket optionMarket) (external)`

- `getGlobalAddress(bytes32 contractName) (external)`

- `updateGlobalAddresses(bytes32[] names, address[] addresses) (external)`

- `addMarket(struct LyraRegistry.OptionMarketAddresses newMarketAddresses) (external)`

- `removeMarket(contract OptionMarket market) (external)`

- `_removeMarket(contract OptionMarket market) (internal)`

## Events:

- `GlobalAddressUpdated(bytes32 name, address addr)`

- `MarketUpdated(contract OptionMarket optionMarket, struct LyraRegistry.OptionMarketAddresses market)`

- `MarketRemoved(contract OptionMarket market)`

### Function `getMarketAddresses(contract OptionMarket optionMarket) → struct LyraRegistry.OptionMarketAddresses external`

### Function `getGlobalAddress(bytes32 contractName) → address globalContract external`

### Function `updateGlobalAddresses(bytes32[] names, address[] addresses) external`

### Function `addMarket(struct LyraRegistry.OptionMarketAddresses newMarketAddresses) external`

### Function `removeMarket(contract OptionMarket market) external`

### Function `_removeMarket(contract OptionMarket market) internal`

### Event `GlobalAddressUpdated(bytes32 name, address addr)`

Emitted when a global contract is added

### Event `MarketUpdated(contract OptionMarket optionMarket, struct LyraRegistry.OptionMarketAddresses market)`

Emitted when an optionMarket is updated

### Event `MarketRemoved(contract OptionMarket market)`

Emitted when an optionMarket is removed
