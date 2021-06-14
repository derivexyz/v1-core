# `BlackScholes`

Where the unit is unspecified, it should be treated as a PRECISE_DECIMAL, which has 1e27 units of precision.

The default decimal matches the ethereum standard of 1e18 units of precision.

## Functions:

- `abs(int256 x) (public)`

- `floor(uint256 x) (internal)`

- `ln(uint256 x) (internal)`

- `exp(uint256 x) (public)`

- `exp(int256 x) (public)`

- `sqrt(uint256 x) (public)`

- `sqrtDecimal(uint256 x) (internal)`

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

### Function `floor(uint256 x) → uint256 internal`

### Function `ln(uint256 x) → int256 internal`

### Function `exp(uint256 x) → uint256 public`

### Function `exp(int256 x) → uint256 public`

### Function `sqrt(uint256 x) → uint256 y public`

### Function `sqrtDecimal(uint256 x) → uint256 internal`

### Function `stdNormal(int256 x) → uint256 internal`

### Function `stdNormalCDF(int256 x) → uint256 internal`

### Function `annualise(uint256 secs) → uint256 yearFraction internal`

### Function `d1d2(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strike, int256 rate) → int256 d1, int256 d2 internal`

### Function `_optionPrices(uint256 tAnnualised, uint256 spot, uint256 strike, int256 rate, int256 d1, int256 d2) → uint256 call, uint256 put internal`

### Function `optionPrices(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) → uint256 call, uint256 put external`

### Function `_delta(int256 d1) → int256 callDelta, int256 putDelta internal`

### Function `_vega(uint256 tAnnualised, uint256 spot, int256 d1) → uint256 vega internal`

### Function `_standardVega(int256 d1, uint256 spot, uint256 timeToExpirySec) → uint256 internal`

### Function `pricesDeltaStdVega(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) → struct BlackScholes.PricesDeltaStdVega external`
