# `BasicOptionMarketWrapper`

## Functions:

- `updateMarket(contract OptionMarket optionMarket, struct BasicOptionMarketWrapper.OptionMarketContracts _marketContracts) (external)`

- `openPosition(contract OptionMarket optionMarket, struct OptionMarket.TradeInputParameters params, uint256 extraCollateral) (external)`

- `closePosition(contract OptionMarket optionMarket, struct OptionMarket.TradeInputParameters params, uint256 extraCollateral) (external)`

- `forceClosePosition(contract OptionMarket optionMarket, struct OptionMarket.TradeInputParameters params, uint256 extraCollateral) (external)`

- `_takeExtraCollateral(struct BasicOptionMarketWrapper.OptionMarketContracts c, enum OptionMarket.OptionType optionType, uint256 extraCollateral) (internal)`

- `_returnExcessFunds(struct BasicOptionMarketWrapper.OptionMarketContracts c) (internal)`

- `_isLong(enum OptionMarket.OptionType optionType) (internal)`

- `_isCall(enum OptionMarket.OptionType optionType) (internal)`

- `_isBaseCollateral(enum OptionMarket.OptionType optionType) (internal)`

### Function `updateMarket(contract OptionMarket optionMarket, struct BasicOptionMarketWrapper.OptionMarketContracts _marketContracts) external`

### Function `openPosition(contract OptionMarket optionMarket, struct OptionMarket.TradeInputParameters params, uint256 extraCollateral) → struct OptionMarket.Result result external`

### Function `closePosition(contract OptionMarket optionMarket, struct OptionMarket.TradeInputParameters params, uint256 extraCollateral) → struct OptionMarket.Result result external`

### Function `forceClosePosition(contract OptionMarket optionMarket, struct OptionMarket.TradeInputParameters params, uint256 extraCollateral) → struct OptionMarket.Result result external`

### Function `_takeExtraCollateral(struct BasicOptionMarketWrapper.OptionMarketContracts c, enum OptionMarket.OptionType optionType, uint256 extraCollateral) internal`

### Function `_returnExcessFunds(struct BasicOptionMarketWrapper.OptionMarketContracts c) internal`

### Function `_isLong(enum OptionMarket.OptionType optionType) → bool internal`

### Function `_isCall(enum OptionMarket.OptionType optionType) → bool internal`

### Function `_isBaseCollateral(enum OptionMarket.OptionType optionType) → bool internal`
