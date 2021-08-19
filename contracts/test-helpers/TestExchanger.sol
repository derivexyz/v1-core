//SPDX-License-Identifier:MIT
pragma solidity >=0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IExchanger.sol";

contract TestExchanger is IExchanger, Ownable {
  mapping(bytes32 => mapping(bytes32 => uint)) fee;

  constructor() Ownable() {}

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
