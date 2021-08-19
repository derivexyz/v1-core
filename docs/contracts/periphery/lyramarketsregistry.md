# `LyraMarketsRegistry`

Registry that allow external services to keep track of the deployments Lyra Markets

## Functions:

- `addMarket(address optionMarket, address liquidityPool, address liquidityCertificate, address optionGreekCache, address optionMarketPricer, address poolHedger, address shortCollateral, address quoteAsset, address baseAsset, address optionToken) (external)`

- `removeMarket(address optionMarket) (external)`

- `getOptionMarkets() (external)`

- `getOptionMarketsAddresses(address[] optionMarketList) (external)`

## Events:

- `MarketAdded(address optionMarket, address liquidityPool, address liquidityCertificate, address optionGreekCache, address optionMarketPricer, address poolHedger, address shortCollateral, address quoteAsset, address baseAsset, address optionToken)`

- `MarketRemoved(address optionMarket)`

### Function `addMarket(address optionMarket, address liquidityPool, address liquidityCertificate, address optionGreekCache, address optionMarketPricer, address poolHedger, address shortCollateral, address quoteAsset, address baseAsset, address optionToken) external`

Method to register the addresses of a new deployments market

#### Parameters:

- `optionMarket`: Address of the optionMarket contract

- `liquidityPool`: Address of the liquidityPool contract

- `liquidityCertificate`: Address of the liquidityCertificate contract

- `optionGreekCache`: Address of the optionGreekCache contract

- `optionMarketPricer`: Address of the optionMarketPricer contract

- `poolHedger`: Address of the poolHedger contract

- `shortCollateral`: Address of the shortCollateral contract

- `quoteAsset`: Address of quote asset

- `baseAsset`: Address of base asset

- `optionToken`: Address of optionToken contract

### Function `removeMarket(address optionMarket) external`

Method to remove a market

#### Parameters:

- `optionMarket`: Address of the optionMarket contract

### Function `getOptionMarkets() → address[] external`

Gets the list of addresses of deployments OptionMarket contracts

#### Return Values:

- Array of OptionMarket addresses

### Function `getOptionMarketsAddresses(address[] optionMarketList) → struct LyraMarketsRegistry.MarketAddresses[] external`

Gets the addresses of the contracts associated to an OptionMarket contract

#### Parameters:

- `optionMarketList`: Array of optionMarket contract addresses

#### Return Values:

- Array of struct containing the associated contract addresses

### Event `MarketAdded(address optionMarket, address liquidityPool, address liquidityCertificate, address optionGreekCache, address optionMarketPricer, address poolHedger, address shortCollateral, address quoteAsset, address baseAsset, address optionToken)`

### Event `MarketRemoved(address optionMarket)`
