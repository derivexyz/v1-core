//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

import "../../synthetix/Owned.sol";

import "../../interfaces/IExchangeRates.sol";

contract TestExchangeRates is IExchangeRates, Owned {
  mapping(bytes32 => uint) public rates;
  mapping(bytes32 => bool) public isInvalid;

  constructor() Owned() {}

  function rateAndInvalid(bytes32 currencyKey) external view override returns (uint rate, bool invalid) {
    rate = rates[currencyKey];
    invalid = isInvalid[currencyKey];
  }

  function setRateAndInvalid(bytes32 currencyKey, uint rate, bool invalid) external onlyOwner {
    rates[currencyKey] = rate;
    isInvalid[currencyKey] = invalid;
  }
}
