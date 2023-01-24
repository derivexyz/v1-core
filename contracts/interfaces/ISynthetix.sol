//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface ISynthetix {
  function exchange(
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) external returns (uint amountReceived);

  function exchangeOnBehalfWithTracking(
    address exchangeForAddress,
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey,
    address rewardAddress,
    bytes32 trackingCode
  ) external returns (uint amountReceived);
}
