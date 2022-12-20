//SPDX-License-Identifier:ISC
pragma solidity 0.8.16;

import "openzeppelin-contracts-4.4.1/token/ERC20/ERC20.sol";

import "./ITestERC20.sol";

contract TestERC20SetDecimals is ITestERC20, ERC20 {
  mapping(address => bool) public permitted;
  uint8 private _decimals;

  constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
    permitted[msg.sender] = true;
    _setupDecimals(decimals_);
  }

  // Default setup of decimals in OpenZepellin v4 is done via decimals() override
  // For testing purposes, manually implementing v3 style ERC20 storage and _setDecimals
  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function _setupDecimals(uint8 decimals_) internal {
    _decimals = decimals_;
  }

  function setDecimals(uint8 newDecimals) external {
    require(permitted[msg.sender], "TestERC20SetDecimals: only permitted");
    _decimals = newDecimals;
  }

  function permitMint(address user, bool permit) external {
    require(permitted[msg.sender], "TestERC20SetDecimals: only permitted");
    permitted[user] = permit;
  }

  function mint(address account, uint amount) external override {
    require(permitted[msg.sender], "TestERC20SetDecimals: only permitted");
    ERC20._mint(account, amount);
  }

  function burn(address account, uint amount) external override {
    require(permitted[msg.sender], "TestERC20SetDecimals: only permitted");
    ERC20._burn(account, amount);
  }
}
