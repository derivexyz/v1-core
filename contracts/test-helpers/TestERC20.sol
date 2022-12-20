//SPDX-License-Identifier:ISC
pragma solidity 0.8.16;

import "openzeppelin-contracts-4.4.1/token/ERC20/ERC20.sol";

import "./ITestERC20.sol";

contract TestERC20 is ITestERC20, ERC20 {
  mapping(address => bool) public permitted;

  constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
    permitted[msg.sender] = true;
  }

  function decimals() public pure override returns (uint8) {
    return 18;
  }

  function permitMint(address user, bool permit) external {
    require(permitted[msg.sender], "only permitted");
    permitted[user] = permit;
  }

  function mint(address account, uint amount) external override {
    require(permitted[msg.sender], "only permitted");
    ERC20._mint(account, amount);
  }

  function burn(address account, uint amount) external override {
    require(permitted[msg.sender], "only permitted");
    ERC20._burn(account, amount);
  }
}
