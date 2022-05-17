# `KeeperHelper`

A wrapper function that reduces the number of calls required for the keeperBot to liquidate positions

## Functions:

- `init(contract OptionMarket _optionMarket, contract ShortCollateral _shortCollateral) (external)`

- `liquidate8(uint256 batch1) (external)`

- `_liquidateMany(uint256[] positionIds) (internal)`

- `liquidateMany(uint256[] positionIds) (external)`

- `settle8(uint256 batch1) (external)`

- `settle16(uint256 batch1, uint256 batch2) (external)`

- `settle24(uint256 batch1, uint256 batch2, uint256 batch3) (external)`

- `settle32(uint256 batch1, uint256 batch2, uint256 batch3, uint256 batch4) (external)`

- `settle40(uint256 batch1, uint256 batch2, uint256 batch3, uint256 batch4, uint256 batch5) (external)`

- `settle80(uint256 batch1, uint256 batch2, uint256 batch3, uint256 batch4, uint256 batch5, uint256 batch6, uint256 batch7, uint256 batch8, uint256 batch9, uint256 batch10) (external)`

- `_settleMany(uint256[] positionIds) (internal)`

- `settleMany(uint256[] positionIds) (external)`

- `_shiftUint32(uint256 batch, uint256 loc) (internal)`

### Function `init(contract OptionMarket _optionMarket, contract ShortCollateral _shortCollateral) external`

### Function `liquidate8(uint256 batch1) external`

Liquidates positions using a compressed uint

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `_liquidateMany(uint256[] positionIds) internal`

Allows liquidations of multiple positions in a single call

### Function `liquidateMany(uint256[] positionIds) external`

### Function `settle8(uint256 batch1) external`

Settles up to 8 positions

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `settle16(uint256 batch1, uint256 batch2) external`

Settles up to 16 positions

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `settle24(uint256 batch1, uint256 batch2, uint256 batch3) external`

Settles up to 24 positions

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `settle32(uint256 batch1, uint256 batch2, uint256 batch3, uint256 batch4) external`

Settles up to 32 positions

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `settle40(uint256 batch1, uint256 batch2, uint256 batch3, uint256 batch4, uint256 batch5) external`

Settles up to 40 positions

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `settle80(uint256 batch1, uint256 batch2, uint256 batch3, uint256 batch4, uint256 batch5, uint256 batch6, uint256 batch7, uint256 batch8, uint256 batch9, uint256 batch10) external`

Settles up to 80 positions

#### Parameters:

- `batch1`: Is a compressed uint which contains up to 8 positionIds (uint32)

### Function `_settleMany(uint256[] positionIds) internal`

Allows settlement of many positions in a single call.

### Function `settleMany(uint256[] positionIds) external`

Allows settlement of many positions in a single call.

### Function `_shiftUint32(uint256 batch, uint256 loc) → uint256 internal`

Extracts a specific positionId from a uint32 batch
