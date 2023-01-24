//SPDX-License-Identifier:ISC
pragma solidity 0.8.16;

import "./TestERC20SetDecimalsFail.sol";

contract TestWETH is TestERC20SetDecimalsFail {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) TestERC20SetDecimalsFail(name_, symbol_, decimals_) {}

  // Allow minting for wETH
  function deposit() public payable {
    _mint(msg.sender, msg.value);
  }

  function withdraw(uint amount) public {
    require(balanceOf(msg.sender) >= amount, "Token: insufficient balance");
    _burn(msg.sender, amount);
    payable(msg.sender).transfer(amount);
  }
}
