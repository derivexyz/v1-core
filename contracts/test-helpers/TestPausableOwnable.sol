//SPDX-License-Identifier:ISC
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract TestPausableOwnable is Ownable, Pausable {
  uint public someValue;

  constructor() Ownable() Pausable() {}

  function setSomeValue(uint _value) external whenNotPaused {
    someValue = _value;
  }

  function setPaused() external onlyOwner {
    _pause();
  }
}
