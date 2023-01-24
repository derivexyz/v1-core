//SPDX-License-Identifier:ISC
pragma solidity 0.8.16;

// Inherited
import "../synthetix/Owned.sol";
import "../interfaces/IFeeCounter.sol";

/**
 * @title BasicFeeCounter
 */
contract BasicFeeCounter is IFeeCounter, Owned {
  mapping(address => bool) public trustedCounter;
  mapping(address => mapping(address => uint)) public totalFeesPerMarket;

  constructor() Owned() {}

  function setTrustedCounter(address counter, bool isTrusted) external onlyOwner {
    trustedCounter[counter] = isTrusted;
  }

  function trackFee(address market, address trader, uint, uint, uint totalFee) external onlyTrustedCounter {
    totalFeesPerMarket[market][trader] += totalFee;
  }

  modifier onlyTrustedCounter() {
    require(trustedCounter[msg.sender], "not trusted counter");
    _;
  }
}
