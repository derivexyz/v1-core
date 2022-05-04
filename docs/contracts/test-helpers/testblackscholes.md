# `TestBlackScholes`

## Functions:

- `expPub(int256 x) (external)`

- `lnPub(int256 x) (external)`

- `sqrt_pub(uint256 x) (external)`

- `abs_pub(int256 x) (external)`

- `stdNormal_pub(int256 x) (external)`

- `stdNormalCDF_pub(int256 x) (external)`

- `annualise_pub(uint256 secs) (external)`

- `d1d2_pub(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strikePrice, int256 rate) (external)`

- `optionPrices_pub(struct BlackScholes.BlackScholesInputs bsInput) (external)`

- `pricesDeltaStdVega_pub(struct BlackScholes.BlackScholesInputs bsInput) (external)`

- `delta_pub(struct BlackScholes.BlackScholesInputs bsInput) (external)`

- `vega_pub(struct BlackScholes.BlackScholesInputs bsInput) (external)`

### Function `expPub(int256 x) → uint256 external`

### Function `lnPub(int256 x) → int256 external`

### Function `sqrt_pub(uint256 x) → uint256 external`

### Function `abs_pub(int256 x) → uint256 external`

### Function `stdNormal_pub(int256 x) → uint256 external`

### Function `stdNormalCDF_pub(int256 x) → uint256 external`

### Function `annualise_pub(uint256 secs) → uint256 yearFraction external`

### Function `d1d2_pub(uint256 tAnnualised, uint256 volatility, uint256 spot, uint256 strikePrice, int256 rate) → int256 d1, int256 d2 external`

### Function `optionPrices_pub(struct BlackScholes.BlackScholesInputs bsInput) → uint256 call, uint256 put external`

### Function `pricesDeltaStdVega_pub(struct BlackScholes.BlackScholesInputs bsInput) → struct BlackScholes.PricesDeltaStdVega external`

### Function `delta_pub(struct BlackScholes.BlackScholesInputs bsInput) → int256, int256 external`

### Function `vega_pub(struct BlackScholes.BlackScholesInputs bsInput) → uint256 external`
