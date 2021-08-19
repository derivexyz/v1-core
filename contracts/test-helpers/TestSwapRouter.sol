// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/ISwapRouter.sol";
import "./Path.sol";
import "./TestERC20.sol";
import "../synthetix/SafeDecimalMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V3
contract TestSwapRouter is ISwapRouter, Ownable {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  bool initialized = false;

  mapping(address => uint) public rates;

  constructor(address _factory, address _WETH9) {}

  function addToken(address token, uint rate) external onlyOwner {
    rates[token] = rate;
  }

  function uniswapV3SwapCallback(
    int amount0Delta,
    int amount1Delta,
    bytes calldata _data
  ) external override {}

  function exactInput(ExactInputParams calldata params) external payable override returns (uint amountOut) {
    TestERC20 tokenIn;
    TestERC20 tokenOut;

    if (!Path.hasMultiplePools(params.path)) {
      (address _tokenIn, address _tokenOut, ) = Path.decodeFirstPool(params.path);
      tokenIn = TestERC20(_tokenIn);
      tokenOut = TestERC20(_tokenOut);
    } else {
      bytes memory path = params.path;
      (address _tokenIn, , ) = Path.decodeFirstPool(path);
      tokenIn = TestERC20(_tokenIn);
      while (Path.hasMultiplePools(path)) {
        path = Path.skipToken(path);
      }
      (address _token, address _tokenOut, ) = Path.decodeFirstPool(path);
      tokenOut = TestERC20(_tokenOut);
    }

    require(tokenIn != TestERC20(0) && tokenOut != TestERC20(0), "token in or token out is zero address");

    uint bal = tokenIn.balanceOf(params.recipient);
    require(bal >= params.amountIn, "not enough to exchange");

    tokenIn.burn(params.recipient, params.amountIn);

    uint tokenInRate = rates[address(tokenIn)];
    uint tokenOutRate = rates[address(tokenOut)];

    uint8 tokenInDecimals = tokenIn.decimals();
    uint8 tokenOutDecimals = tokenOut.decimals();

    amountOut = (params.amountIn * tokenInRate) / tokenOutRate;

    if (tokenInDecimals > tokenOutDecimals) {
      amountOut *= (10**uint(tokenInDecimals - tokenOutDecimals));
    } else if (tokenInDecimals < tokenOutDecimals) {
      amountOut /= (10**uint(tokenOutDecimals - tokenInDecimals));
    }

    tokenOut.mint(params.recipient, amountOut);
    return amountOut;
  }
}
