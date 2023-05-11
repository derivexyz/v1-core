//SPDX-License-Identifier: ISC
pragma solidity >0.7.0;

interface IUniswapV3Oracle {
  /**
   * @dev return price of a uniswap pair. price is scaled by 1e18
   */
  function getTwap(address pool, address base, address quote, uint32 period) external view returns (uint);
}
