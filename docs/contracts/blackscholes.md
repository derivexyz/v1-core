# `BlackScholes`

Contract to compute the black scholes price of options. Where the unit is unspecified, it should be treated as a

PRECISE_DECIMAL, which has 1e27 units of precision. The default decimal matches the ethereum standard of 1e18 units

of precision.

## Functions:

- `abs(int256 x) (public)`

- `floor(uint256 x) (internal)`

- `ln(uint256 x) (internal)`

- `exp(uint256 x) (public)`

- `exp(int256 x) (public)`

- `sqrt(uint256 x) (public)`

- `sqrtPrecise(uint256 x) (internal)`

- `stdNormal(int256 x) (internal)`

- `stdNormalCDF(int256 x) (internal)`

- `annualise(uint256 secs) (internal)`

- `d1d2(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strike, int256 rate) (internal)`

- `_optionPrices(uint256 tAnnualised, uint256 spot, uint256 strike, int256 rate, int256 d1, int256 d2) (internal)`

- `optionPrices(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) (external)`

- `_delta(int256 d1) (internal)`

- `_vega(uint256 tAnnualised, uint256 spot, int256 d1) (internal)`

- `_standardVega(int256 d1, uint256 spot, uint256 timeToExpirySec) (internal)`

- `pricesDeltaStdVega(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) (external)`

### Function `abs(int256 x) → uint256 public`

Returns absolute value of an int as a uint.

### Function `floor(uint256 x) → uint256 internal`

Returns the floor of a PRECISE_UNIT (x - (x % 1e27))

### Function `ln(uint256 x) → int256 internal`

Returns the natural log of the value using Halley's method.

### Function `exp(uint256 x) → uint256 public`

Returns the exponent of the value using taylor expansion with range reduction.

### Function `exp(int256 x) → uint256 public`

Returns the exponent of the value using taylor expansion with range reduction, with support for negative

numbers.

### Function `sqrt(uint256 x) → uint256 y public`

Returns the square root of the value using Newton's method. This ignores the unit, so numbers should be

multiplied by their unit before being passed in.

### Function `sqrtPrecise(uint256 x) → uint256 internal`

Returns the square root of the value using Newton's method.

### Function `stdNormal(int256 x) → uint256 internal`

The standard normal distribution of the value.

### Function `stdNormalCDF(int256 x) → uint256 internal`

### Function `annualise(uint256 secs) → uint256 yearFraction internal`

Converts an integer number of seconds to a fractional number of years.

### Function `d1d2(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strike, int256 rate) → int256 d1, int256 d2 internal`

Returns internal coefficients of the Black-Scholes call price formula, d1 and d2.

#### Parameters:

- `tAnnualised`: Number of years to expiry

- `volatility`: Implied volatility over the period til expiry as a percentage

- `spot`: The current price of the base asset

- `strike`: The strike price of the option

- `rate`: The percentage risk free rate + carry cost

### Function `_optionPrices(uint256 tAnnualised, uint256 spot, uint256 strike, int256 rate, int256 d1, int256 d2) → uint256 call, uint256 put internal`

Internal coefficients of the Black-Scholes call price formula.

#### Parameters:

- `tAnnualised`: Number of years to expiry

- `spot`: The current price of the base asset

- `strike`: The strike price of the option

- `rate`: The percentage risk free rate + carry cost

- `d1`: Internal coefficient of Black-Scholes

- `d2`: Internal coefficient of Black-Scholes

### Function `optionPrices(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) → uint256 call, uint256 put external`

Returns call and put prices for options with given parameters.

#### Parameters:

- `timeToExpirySec`: Number of seconds to the expiry of the option

- `volatilityDecimal`: Implied volatility over the period til expiry as a percentage

- `spotDecimal`: The current price of the base asset

- `strikeDecimal`: The strike price of the option

- `rateDecimal`: The percentage risk free rate + carry cost

### Function `_delta(int256 d1) → int256 callDelta, int256 putDelta internal`

Returns the option's delta value

#### Parameters:

- `d1`: Internal coefficient of Black-Scholes

### Function `_vega(uint256 tAnnualised, uint256 spot, int256 d1) → uint256 vega internal`

Returns the option's vega value based on d1

#### Parameters:

- `d1`: Internal coefficient of Black-Scholes

- `tAnnualised`: Number of years to expiry

- `spot`: The current price of the base asset

### Function `_standardVega(int256 d1, uint256 spot, uint256 timeToExpirySec) → uint256 internal`

Returns the option's vega value with expiry modified to be at least VEGA_STANDARDISATION_MIN_DAYS

#### Parameters:

- `d1`: Internal coefficient of Black-Scholes

- `spot`: The current price of the base asset

- `timeToExpirySec`: Number of seconds to expiry

### Function `pricesDeltaStdVega(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) → struct BlackScholes.PricesDeltaStdVega external`

Returns call/put prices and delta/stdVega for options with given parameters.

#### Parameters:

- `timeToExpirySec`: Number of seconds to the expiry of the option

- `volatilityDecimal`: Implied volatility over the period til expiry as a percentage

- `spotDecimal`: The current price of the base asset

- `strikeDecimal`: The strike price of the option

- `rateDecimal`: The percentage risk free rate + carry cost
