# `SignedDecimalMath`

Modified synthetix SafeSignedDecimalMath to include internal arithmetic underflow/overflow.

https://docs.synthetix.io/contracts/source/libraries/safedecimalmath

## Functions:

- `unit() (external)`

- `preciseUnit() (external)`

- `multiplyDecimal(int256 x, int256 y) (internal)`

- `multiplyDecimalRoundPrecise(int256 x, int256 y) (internal)`

- `multiplyDecimalRound(int256 x, int256 y) (internal)`

- `divideDecimal(int256 x, int256 y) (internal)`

- `divideDecimalRound(int256 x, int256 y) (internal)`

- `divideDecimalRoundPrecise(int256 x, int256 y) (internal)`

- `decimalToPreciseDecimal(int256 i) (internal)`

- `preciseDecimalToDecimal(int256 i) (internal)`

### Function `unit() → int256 external`

#### Return Values:

- Provides an interface to UNIT.

### Function `preciseUnit() → int256 external`

#### Return Values:

- Provides an interface to PRECISE_UNIT.

### Function `multiplyDecimal(int256 x, int256 y) → int256 internal`

A unit factor is divided out after the product of x and y is evaluated,

so that product must be less than 2**256. As this is an integer division,

the internal division always rounds down. This helps save on gas. Rounding

is more expensive on gas.

#### Return Values:

- The result of multiplying x and y, interpreting the operands as fixed-point

decimals.

### Function `multiplyDecimalRoundPrecise(int256 x, int256 y) → int256 internal`

The operands should be in the precise unit factor which will be

divided out after the product of x and y is evaluated, so that product must be

less than 2**256.

Unlike multiplyDecimal, this function rounds the result to the nearest increment.

Rounding is useful when you need to retain fidelity for small decimal numbers

(eg. small fractions or percentages).

#### Return Values:

- The result of safely multiplying x and y, interpreting the operands

as fixed-point decimals of a precise unit.

### Function `multiplyDecimalRound(int256 x, int256 y) → int256 internal`

The operands should be in the standard unit factor which will be

divided out after the product of x and y is evaluated, so that product must be

less than 2**256.

Unlike multiplyDecimal, this function rounds the result to the nearest increment.

Rounding is useful when you need to retain fidelity for small decimal numbers

(eg. small fractions or percentages).

#### Return Values:

- The result of safely multiplying x and y, interpreting the operands

as fixed-point decimals of a standard unit.

### Function `divideDecimal(int256 x, int256 y) → int256 internal`

y is divided after the product of x and the standard precision unit

is evaluated, so the product of x and UNIT must be less than 2**256. As

this is an integer division, the result is always rounded down.

This helps save on gas. Rounding is more expensive on gas.

#### Return Values:

- The result of safely dividing x and y. The return value is a high

precision decimal.

### Function `divideDecimalRound(int256 x, int256 y) → int256 internal`

y is divided after the product of x and the standard precision unit

is evaluated, so the product of x and the standard precision unit must

be less than 2**256. The result is rounded to the nearest increment.

#### Return Values:

- The result of safely dividing x and y. The return value is as a rounded

standard precision decimal.

### Function `divideDecimalRoundPrecise(int256 x, int256 y) → int256 internal`

y is divided after the product of x and the high precision unit

is evaluated, so the product of x and the high precision unit must

be less than 2**256. The result is rounded to the nearest increment.

#### Return Values:

- The result of safely dividing x and y. The return value is as a rounded

high precision decimal.

### Function `decimalToPreciseDecimal(int256 i) → int256 internal`

Convert a standard decimal representation to a high precision one.

### Function `preciseDecimalToDecimal(int256 i) → int256 internal`

Convert a high precision decimal to a standard decimal representation.
