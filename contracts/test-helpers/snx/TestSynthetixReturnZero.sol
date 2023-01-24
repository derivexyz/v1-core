//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

import "./TestSynthetix.sol";

contract TestSynthetixReturnZero is TestSynthetix {
  bool public returnZero = false;

  constructor() {}

  function setReturnZero(bool _returnZero) external {
    returnZero = _returnZero;
  }

  function exchange(
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey
  ) public override returns (uint amountReceived) {
    if (returnZero) {
      return 0;
    } else {
      return super.exchange(sourceCurrencyKey, sourceAmount, destinationCurrencyKey);
    }
  }

  function exchangeOnBehalfWithTracking(
    address exchangeForAddress,
    bytes32 sourceCurrencyKey,
    uint sourceAmount,
    bytes32 destinationCurrencyKey,
    address,
    bytes32
  ) public override returns (uint amountReceived) {
    if (returnZero) {
      return 0;
    } else {
      emit Exchange(msg.sender, sourceCurrencyKey, sourceAmount, destinationCurrencyKey);
      return super.exchangeOnBehalf(exchangeForAddress, sourceCurrencyKey, sourceAmount, destinationCurrencyKey);
    }
  }
}
