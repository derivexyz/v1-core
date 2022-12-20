//SPDX-License-Identifier: ISC
// test contract that mimics limited functionality of SNX Futures Market Settings

pragma solidity 0.8.16;

import "../../synthetix/Owned.sol";
import "../../libraries/SimpleInitializable.sol";

contract TestFuturesMarketSettings is Owned, SimpleInitializable {
  uint public leverage;

  constructor() Owned() {}

  function init(uint _leverage) external {
    leverage = _leverage;
  }

  // will just return the same leverage for all markets
  function maxLeverage(bytes32 /* marketKey */) external view returns (uint) {
    return leverage;
  }

  function setMaxLeverage(bytes32 /* marketKey */, uint lev) external returns (uint) {
    leverage = lev;
    return leverage;
  }
}
