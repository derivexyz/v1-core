//SPDX-License-Identifier:ISC
pragma solidity 0.8.9;

import "../synthetix/Owned.sol";

/**
 * @title BasicFeeCounter
 */
contract BasicFeeCounter is Owned {
  mapping(address => bool) public trustedCounter;
  mapping(address => mapping(address => uint)) public totalFeesPerMarket;

  constructor() Owned() {}

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
