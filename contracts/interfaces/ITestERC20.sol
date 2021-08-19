//SPDX-License-Identifier: ISC
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITestERC20 is IERC20 {
  function mint(address account, uint amount) external;

  function burn(address account, uint amount) external;
}
