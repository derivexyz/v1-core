//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "./TestERC20.sol";

contract TestERC20Fail is TestERC20 {
  bool public forceFail = false;

  constructor(string memory name_, string memory symbol_) TestERC20(name_, symbol_) {}

  function setForceFail(bool _forceFail) external {
    forceFail = _forceFail;
  }

  // This isn't ideal, it hits the coverage cases, but should only return false if the transfer fails. Would
  //  require a new contract that doesn't revert on failures.
  function transfer(address receiver, uint amount) external override returns (bool) {
    if (forceFail) {
      return false;
    }
    return super.transfer(receiver, amount);
  }

  function transferFrom(
    address sender,
    address receiver,
    uint amount
  ) external override returns (bool) {
    if (forceFail) {
      return false;
    }
    return super.transferFrom(sender, receiver, amount);
  }

  function approve(address spender, uint amount) external override returns (bool) {
    if (forceFail) {
      return false;
    }
    return super.approve(spender, amount);
  }
}
