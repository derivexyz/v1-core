# `OptionMarketWrapper`

Allows users to open/close positions in any market with multiple stablecoins

## Functions:

- `openLong(uint256 params) (external)`

- `addLong(uint256 params) (external)`

- `reduceLong(uint256 params) (external)`

- `closeLong(uint256 params) (external)`

- `openShort(uint256 params) (external)`

- `addShort(uint256 params) (external)`

- `reduceShort(uint256 params) (external)`

- `closeShort(uint256 params) (external)`

- `_parseUint8(uint256 inp) (internal)`

- `_parseUint32Amount(uint256 inp) (internal)`

- `_parseUint32(uint256 inp) (internal)`

- `_parseUint64Amount(uint256 inp) (internal)`

- `_convertDecimal(uint256 amount, contract ERC20 inputAsset) (internal)`

### Function `openLong(uint256 params) → uint256 totalCost external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | market id as set in `addMarket`

8   | uint8  | inputAsset   | asset the caller is sending to the contract

16  | bool   | isCall       | whether the purchased option is a cll or put

24  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

32  | uint32 | strikeId     | The strikeId to be traded

64  | uint32 | maxCost      | The maximum amount the user will pay for all the options purchased - there must have at least this much left over after a stable swap

96  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

128 | uint64 | amount       | The amount of options the user is purchasing (compressed to 8 d.p.)

Total 192 bits

### Function `addLong(uint256 params) → uint256 totalCost external`

### Function `reduceLong(uint256 params) → uint256 totalReceived external`

### Function `closeLong(uint256 params) → uint256 totalReceived external`

### Function `openShort(uint256 params) → uint256 totalReceived external`

### Function `addShort(uint256 params) → uint256 totalReceived external`

### Function `reduceShort(uint256 params) → uint256 totalCost external`

### Function `closeShort(uint256 params) → uint256 totalCost external`

### Function `_parseUint8(uint256 inp) → uint256 internal`

### Function `_parseUint32Amount(uint256 inp) → uint256 internal`

### Function `_parseUint32(uint256 inp) → uint256 internal`

### Function `_parseUint64Amount(uint256 inp) → uint256 internal`

### Function `_convertDecimal(uint256 amount, contract ERC20 inputAsset) → uint256 newAmount internal`
