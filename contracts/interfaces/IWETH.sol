//SPDX-License-Identifier: ISC
import "./IERC20Decimals.sol";

pragma solidity 0.8.16;

interface IWETH is IERC20Decimals {
  receive() external payable;

  function deposit() external payable;

  function withdraw(uint wad) external;
}
