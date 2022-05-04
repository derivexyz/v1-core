# `MultistepSwapper`

Swap between tokens and synths using uniswap router and synthetix exchanger

## Functions:

- `init(contract ISwapRouter _swapRouter, contract ISynthetix _synthetix) (external)`

- `swap(contract IERC20 tokenIn, bytes32 tokenInCurrencyKey, uint256 amountIn, struct MultistepSwapper.Swap[] swaps, uint256 amountOutMinimum) (external)`

### Function `init(contract ISwapRouter _swapRouter, contract ISynthetix _synthetix) external`

Initialize the contract.

### Function `swap(contract IERC20 tokenIn, bytes32 tokenInCurrencyKey, uint256 amountIn, struct MultistepSwapper.Swap[] swaps, uint256 amountOutMinimum) → uint256 amountOut external`

Swaps `amountIn` of one token for as much as possible of another token

#### Parameters:

- `tokenIn`: The token address being swapped from

- `tokenInCurrencyKey`: The synth currency key for `tokenIn`, set to zero if `tokenIn` is not a synth

- `amountIn`: The amount of `tokenIn` to be swapped

- `swaps`: The swap route encoded into an array of `Swap` structs

- `amountOutMinimum`: The minimum amount of the last `Swap` struct `tokenOut` token that must be returned

#### Return Values:

- amountOut The amount of the received token
