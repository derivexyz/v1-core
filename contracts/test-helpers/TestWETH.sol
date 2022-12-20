//SPDX-License-Identifier:ISC
pragma solidity 0.8.16;

import "./TestERC20SetDecimals.sol";

contract TestWETH is TestERC20SetDecimals {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) TestERC20SetDecimals(name_, symbol_, decimals_) {}

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
