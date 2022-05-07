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

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | inputAsset   | Asset the caller is sending to the contract

16  | bool   | isCall       | Whether the purchased option is a call or put

24  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

32  | uint32 | strikeId     | The strikeId to be traded

64  | uint32 | maxCost      | The maximum amount the user will pay for all the options purchased - there must have at least this much left over after a stable swap

96  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

128 | uint64 | size         | The amount of options the user is purchasing (compressed to 8 d.p.)

Total 192 bits

### Function `addLong(uint256 params) → uint256 totalCost external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | inputAsset   | Asset the caller is sending to the contract

16  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

24  | uint32 | positionId   | Increasing the size of this position id

56  | uint32 | maxCost      | The maximum amount the user will pay for all the options purchased - there must have at least this much left over after a stable swap

88  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

120 | uint64 | size         | The amount of options the user is adding to the position (compressed to 8 d.p.)

Total 184 bits

### Function `reduceLong(uint256 params) → uint256 totalReceived external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | token        | InputAsset id as set in `addCurveStable` to be used

16  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

24  | bool   | isForceClose | Whether the size closed uses `forceClosePosition`

32  | uint32 | positionId   | Decreasing the size of this position id

64  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

96  | uint64 | size         | The amount of options the user is removing from the position (compressed to 8 d.p.)

160 | uint32 | minReceived  | The minimum amount the user willing to receive for the options closed

Total 192 bits

### Function `closeLong(uint256 params) → uint256 totalReceived external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | token        | InputAsset id as set in `addCurveStable` to be used

16  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

24  | bool   | isForceClose | Whether the position closed uses `forceClosePosition`

32  | uint32 | positionId   | Closing this position id

64  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

96  | uint32 | minReceived  | The minimum amount the user willing to receive for the options closed

Total 128 bits

### Function `openShort(uint256 params) → uint256 totalReceived external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | token        | InputAsset id as set in `addCurveStable` to be used

16  | uint8  | optionType   | Type of short option to be traded defined in `OptionType` enum

24  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

32  | uint32 | strikeId     | The strikeId to be traded

64  | uint32 | minReceived  | The minimum amount the user willing to receive for the options

96  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

128 | uint64 | size         | The amount of options the user is purchasing (compressed to 8 d.p.)

192 | uint64 | collateral   | The amount of collateral used for the position

Total 256 bits

### Function `addShort(uint256 params) → uint256 totalReceived external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | token        | InputAsset id as set in `addCurveStable` to be used

16  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

24  | uint32 | positionId   | Increasing the size of this position id

56  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

88  | uint32 | minReceived  | The minimum amount the user willing to receive for the options

120 | uint64 | size         | The amount of options the user is purchasing (compressed to 8 d.p.)

184 | uint64 | collateral   | The amount of absolute collateral used for the total position

Total 248 bits

### Function `reduceShort(uint256 params) → uint256 totalCost external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | token        | InputAsset id as set in `addCurveStable` to be used

16  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

24  | bool   | isForceClose | Whether the size closed uses `forceClosePosition`

32  | uint32 | positionId   | Decreasing the size of this position id

64  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

96  | uint32 | maxCost      | The maximum amount the user will pay for all the options closed

128 | uint64 | size         | The amount of options the user is purchasing (compressed to 8 d.p.)

196 | uint64 | collateral   | The amount of absolute collateral used for the total position

Total 256 bits

### Function `closeShort(uint256 params) → uint256 totalCost external`

#### Parameters:

- `params`: Is a compressed uint which contains the following fields:

loc | type   | name         | description

------------------------------------------

0   | uint8  | market       | Market id as set in `addMarket`

8   | uint8  | token        | InputAsset id as set in `addCurveStable` to be used

16  | uint8  | iterations   | Number of iterations for the trade to make. Avoid 3 due to rounding.

24  | bool   | isForceClose | Whether the position closed uses `forceClosePosition`

32  | uint32 | positionId   | Closing this position id

64  | uint32 | inputAmount  | The amount the user is sending into the contract (compressed to 1 d.p.)

96  | uint32 | maxCost      | The maximum amount the user will pay for all the options closed

Total 128 bits

### Function `_parseUint8(uint256 inp) → uint256 internal`

### Function `_parseUint32Amount(uint256 inp) → uint256 internal`

### Function `_parseUint32(uint256 inp) → uint256 internal`

### Function `_parseUint64Amount(uint256 inp) → uint256 internal`

### Function `_convertDecimal(uint256 amount, contract ERC20 inputAsset) → uint256 newAmount internal`
