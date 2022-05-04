# `TestCurve`

Functions for swapping tokens via Curve

## Functions:

- `setRate(address token, uint256 rate) (external)`

- `get_best_rate(address _from, address _to, uint256 _amount) (external)`

- `exchange_with_best_rate(address _from, address _to, uint256 _amount, uint256 _expected, address _receiver) (external)`

- `exchange_underlying(int128 _from, int128 _to, uint256 _amount, uint256 _expected) (external)`

### Function `setRate(address token, uint256 rate) external`

### Function `get_best_rate(address _from, address _to, uint256 _amount) → address pool, uint256 amountOut external`

### Function `exchange_with_best_rate(address _from, address _to, uint256 _amount, uint256 _expected, address _receiver) → uint256 amountOut external`

### Function `exchange_underlying(int128 _from, int128 _to, uint256 _amount, uint256 _expected) → uint256 amountOut external`
