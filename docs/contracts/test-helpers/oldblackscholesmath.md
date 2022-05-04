# `OldBlackScholesMath`

## Functions:

- `floor(uint256 x) (internal)`

- `ln(uint256 x) (internal)`

- `exp(uint256 x) (internal)`

- `exp(int256 x) (internal)`

### Function `floor(uint256 x) → uint256 internal`

Returns the floor relative to UINT

### Function `ln(uint256 x) → int256 internal`

Returns the natural log of the value using Halley's method.

0.000001 -> 1000000+ work fine

this contract will deal with values between 0.3-10, so very safe for this method

### Function `exp(uint256 x) → uint256 internal`

Returns the exponent of the value using taylor expansion with range reduction.

### Function `exp(int256 x) → uint256 internal`

Returns the exponent of the value using taylor expansion with range reduction,

with support for negative numbers.
