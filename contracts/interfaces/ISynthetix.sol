//SPDX-License-Identifier: ISC
pragma solidity >=0.7.6;

interface ISynthetix {
  function exchange(
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) external returns (uint amountReceived);

  function exchangeOnBehalf(
    address exchangeForAddress,
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) external returns (uint amountReceived);
}
