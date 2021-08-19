//SPDX-License-Identifier: ISC
pragma solidity >=0.7.6;
pragma experimental ABIEncoderV2;

import "./TestSynthetix.sol";

contract TestSynthetixReturnZero is TestSynthetix {
  bool returnZero = false;

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
}
