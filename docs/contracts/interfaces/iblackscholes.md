# `IBlackScholes`

## Functions:

- `abs(int256 x) (external)`

- `exp(uint256 x) (external)`

- `exp(int256 x) (external)`

- `sqrt(uint256 x) (external)`

- `optionPrices(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) (external)`

- `pricesDeltaStdVega(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) (external)`

### Function `abs(int256 x) → uint256 external`

### Function `exp(uint256 x) → uint256 external`

### Function `exp(int256 x) → uint256 external`

### Function `sqrt(uint256 x) → uint256 y external`

### Function `optionPrices(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) → uint256 call, uint256 put external`

### Function `pricesDeltaStdVega(uint256 timeToExpirySec, uint256 volatilityDecimal, uint256 spotDecimal, uint256 strikeDecimal, int256 rateDecimal) → struct IBlackScholes.PricesDeltaStdVega external`
