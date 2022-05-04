//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasicFeeCounter
 */
contract BasicLiquidityCounter is Ownable {
  address public liquidityToken;
  mapping(address => uint) public userLiquidity;

  constructor() Ownable() {}

  /**
   * @dev
   * param lpToken liquidity token address
   */
  function setLiquidityToken(address lpToken) external onlyOwner {
    liquidityToken = lpToken;
  }

  /**
   * @dev
   * param trader the address of the trader that is exchaning liquidity
   * param amount the amount of liquidity tokens that are being exchanged
   */
  function addTokens(address trader, uint amount) external onlyLiquidityToken {
    userLiquidity[trader] += amount;
  }

  /**
   * @dev
   * param trader the address of the trader that is exchaning liquidity
   * param amount the amount of liquidity tokens that are being exchanged
   */
  function removeTokens(address trader, uint amount) external onlyLiquidityToken {
    userLiquidity[trader] -= amount;
  }

  modifier onlyLiquidityToken() {
    require(liquidityToken == msg.sender, "can only be called by LiquidityToken");
    _;
  }
}
