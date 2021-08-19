# `Path`

## Functions:

- `hasMultiplePools(bytes path) (internal)`

- `numPools(bytes path) (internal)`

- `decodeFirstPool(bytes path) (internal)`

- `getFirstPool(bytes path) (internal)`

- `skipToken(bytes path) (internal)`

### Function `hasMultiplePools(bytes path) → bool internal`

Returns true iff the path contains two or more pools

#### Parameters:

- `path`: The encoded swap path

#### Return Values:

- True if path contains two or more pools, otherwise false

### Function `numPools(bytes path) → uint256 internal`

Returns the number of pools in the path

#### Parameters:

- `path`: The encoded swap path

#### Return Values:

- The number of pools in the path

### Function `decodeFirstPool(bytes path) → address tokenA, address tokenB, uint24 fee internal`

Decodes the first pool in path

#### Parameters:

- `path`: The bytes encoded swap path

#### Return Values:

- tokenA The first token of the given pool

- tokenB The second token of the given pool

- fee The fee level of the pool

### Function `getFirstPool(bytes path) → bytes internal`

Gets the segment corresponding to the first pool in the path

#### Parameters:

- `path`: The bytes encoded swap path

#### Return Values:

- The segment containing all data necessary to target the first pool in the path

### Function `skipToken(bytes path) → bytes internal`

Skips a token + fee element from the buffer and returns the remainder

#### Parameters:

- `path`: The swap path

#### Return Values:

- The remaining token + fee elements in the path
