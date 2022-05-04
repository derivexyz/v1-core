//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasicFeeCounter
 */
contract BasicFeeCounter is Ownable {
  mapping(address => bool) public trustedCounter;
  mapping(address => mapping(address => uint)) public totalFeesPerMarket;

  constructor() Ownable() {}

  function setTrustedCounter(address counter, bool isTrusted) external onlyOwner {
    trustedCounter[counter] = isTrusted;
  }

  function addFees(
    address market,
    address trader,
    uint fees
  ) external onlyTrustedCounter {
    totalFeesPerMarket[market][trader] += fees;
  }

  modifier onlyTrustedCounter() {
    require(trustedCounter[msg.sender], "not trusted counter");
    _;
  }
}
