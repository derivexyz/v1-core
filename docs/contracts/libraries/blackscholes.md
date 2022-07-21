# `BlackScholes`

Contract to compute the black scholes price of options. Where the unit is unspecified, it should be treated as a

PRECISE_DECIMAL, which has 1e27 units of precision. The default decimal matches the ethereum standard of 1e18 units

of precision.

## Functions:

- `optionPrices(struct BlackScholes.BlackScholesInputs bsInput) (public)`

- `pricesDeltaStdVega(struct BlackScholes.BlackScholesInputs bsInput) (public)`

- `delta(struct BlackScholes.BlackScholesInputs bsInput) (public)`

- `vega(struct BlackScholes.BlackScholesInputs bsInput) (public)`

- `_d1d2(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strikePrice, int256 rate) (internal)`

- `_optionPrices(uint256 tAnnualised, uint256 spot, uint256 strikePrice, int256 rate, int256 d1, int256 d2) (internal)`

- `_delta(int256 d1) (internal)`

- `_vega(uint256 tAnnualised, uint256 spot, int256 d1) (internal)`

- `_standardVega(int256 d1, uint256 spot, uint256 timeToExpirySec) (internal)`

- `_getVegaNormalisationFactorPrecise(uint256 timeToExpirySec) (internal)`

- `_abs(int256 val) (internal)`

- `_sqrt(uint256 x) (internal)`

- `_sqrtPrecise(uint256 x) (internal)`

- `_stdNormal(int256 x) (internal)`

- `_stdNormalCDF(int256 x) (public)`

- `_stdNormalCDFNumerator(uint256 z) (internal)`

- `_stdNormalCDFDenom(uint256 z) (internal)`

- `_annualise(uint256 secs) (internal)`

### Function `optionPrices(struct BlackScholes.BlackScholesInputs bsInput) → uint256 call, uint256 put public`

Returns call and put prices for options with given parameters.

### Function `pricesDeltaStdVega(struct BlackScholes.BlackScholesInputs bsInput) → struct BlackScholes.PricesDeltaStdVega public`

Returns call/put prices and delta/stdVega for options with given parameters.

### Function `delta(struct BlackScholes.BlackScholesInputs bsInput) → int256 callDeltaDecimal, int256 putDeltaDecimal public`

Returns call delta given parameters.

### Function `vega(struct BlackScholes.BlackScholesInputs bsInput) → uint256 vegaDecimal public`

Returns non-normalized vega given parameters. Quoted in cents.

### Function `_d1d2(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strikePrice, int256 rate) → int256 d1, int256 d2 internal`

Returns internal coefficients of the Black-Scholes call price formula, d1 and d2.

#### Parameters:

- `tAnnualised`: Number of years to expiry

- `volatility`: Implied volatility over the period til expiry as a percentage

- `spot`: The current price of the base asset

- `strikePrice`: The strikePrice price of the option

- `rate`: The percentage risk free rate + carry cost

### Function `_optionPrices(uint256 tAnnualised, uint256 spot, uint256 strikePrice, int256 rate, int256 d1, int256 d2) → uint256 call, uint256 put internal`

Internal coefficients of the Black-Scholes call price formula.

#### Parameters:

- `tAnnualised`: Number of years to expiry

- `spot`: The current price of the base asset

- `strikePrice`: The strikePrice price of the option

- `rate`: The percentage risk free rate + carry cost

- `d1`: Internal coefficient of Black-Scholes

- `d2`: Internal coefficient of Black-Scholes

### Function `_delta(int256 d1) → int256 callDelta, int256 putDelta internal`

Returns the option's delta value

#### Parameters:

- `d1`: Internal coefficient of Black-Scholes

### Function `_vega(uint256 tAnnualised, uint256 spot, int256 d1) → uint256 internal`

Returns the option's vega value based on d1. Quoted in cents.

#### Parameters:

- `d1`: Internal coefficient of Black-Scholes

- `tAnnualised`: Number of years to expiry

- `spot`: The current price of the base asset

### Function `_standardVega(int256 d1, uint256 spot, uint256 timeToExpirySec) → uint256, uint256 internal`

Returns the option's vega value with expiry modified to be at least VEGA_STANDARDISATION_MIN_DAYS

#### Parameters:

- `d1`: Internal coefficient of Black-Scholes

- `spot`: The current price of the base asset

- `timeToExpirySec`: Number of seconds to expiry

### Function `_getVegaNormalisationFactorPrecise(uint256 timeToExpirySec) → uint256 internal`

### Function `_abs(int256 val) → uint256 internal`

Compute the absolute value of `val`.

#### Parameters:

- `val`: The number to absolute value.

### Function `_sqrt(uint256 x) → uint256 result internal`

Calculates the square root of x, rounding down (borrowed from https://github.com/paulrberg/prb-math)

Uses the Babylonian method https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method.

#### Parameters:

- `x`: The uint256 number for which to calculate the square root.

#### Return Values:

- result The result as an uint256.

### Function `_sqrtPrecise(uint256 x) → uint256 internal`

Returns the square root of the value using Newton's method.

### Function `_stdNormal(int256 x) → uint256 internal`

The standard normal distribution of the value.

### Function `_stdNormalCDF(int256 x) → uint256 public`

The standard normal cumulative distribution of the value.

borrowed from a C++ implementation https://stackoverflow.com/a/23119456

### Function `_stdNormalCDFNumerator(uint256 z) → uint256 internal`

Helper for _stdNormalCDF

### Function `_stdNormalCDFDenom(uint256 z) → uint256 internal`

Helper for _stdNormalCDF

### Function `_annualise(uint256 secs) → uint256 yearFraction internal`

Converts an integer number of seconds to a fractional number of years.
