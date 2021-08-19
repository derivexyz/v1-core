# `ISwapRouter`

Functions for swapping tokens via Uniswap V3

## Functions:

- `exactInput(struct ISwapRouter.ExactInputParams params) (external)`

### Function `exactInput(struct ISwapRouter.ExactInputParams params) → uint256 amountOut external`

Swaps `amountIn` of one token for as much as possible of another along the specified path

#### Parameters:

- `params`: The parameters necessary for the multi-hop swap, encoded as `ExactInputParams` in calldata

#### Return Values:

- amountOut The amount of the received token
