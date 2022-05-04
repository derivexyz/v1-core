# `KeeperHelper`

A wrapper function that reduces the number of calls required for the keeperBot to liquidate positions

## Functions:

- `init(contract OptionMarket _optionMarket, contract ShortCollateral _shortCollateral) (external)`

- `liquidateMany(uint256[] positionIds) (external)`

- `settleMany(uint256[] positionIds) (external)`

### Function `init(contract OptionMarket _optionMarket, contract ShortCollateral _shortCollateral) external`

### Function `liquidateMany(uint256[] positionIds) external`

Allows liquidations of multiple positions in a single call

### Function `settleMany(uint256[] positionIds) external`

Allows settlement of many positions in a single call.
