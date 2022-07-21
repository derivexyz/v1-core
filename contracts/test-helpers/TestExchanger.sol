//SPDX-License-Identifier:MIT
pragma solidity 0.8.9;

import "../synthetix/Owned.sol";

import "../interfaces/IExchanger.sol";

contract TestExchanger is IExchanger, Owned {
  mapping(bytes32 => mapping(bytes32 => uint)) fee;

  constructor() Owned() {}

  function feeRateForExchange(bytes32 sourceCurrencyKey, bytes32 destinationCurrencyKey)
    external
    view
    override
    returns (uint exchangeFeeRate)
  {
    return fee[sourceCurrencyKey][destinationCurrencyKey];
  }

  function setFeeRateForExchange(
    bytes32 sourceCurrencyKey,
    bytes32 destinationCurrencyKey,
    uint newFee
  ) external onlyOwner {
    fee[sourceCurrencyKey][destinationCurrencyKey] = newFee;
  }
}
