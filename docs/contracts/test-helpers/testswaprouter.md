# `TestSwapRouter`

Functions for swapping tokens via Uniswap V3

## Functions:

- `constructor(address _factory, address _WETH9) (public)`

- `addToken(address token, uint256 rate) (external)`

- `uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes _data) (external)`

- `exactInput(struct ISwapRouter.ExactInputParams params) (external)`

### Function `constructor(address _factory, address _WETH9) public`

### Function `addToken(address token, uint256 rate) external`

### Function `uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes _data) external`

### Function `exactInput(struct ISwapRouter.ExactInputParams params) → uint256 amountOut external`
