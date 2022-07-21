//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "../ShortPoolHedger.sol";

contract TestShortPoolHedger is ShortPoolHedger {
  function hedgeDeltaExt(int expectedHedge) external {
    _hedgeDelta(expectedHedge);
  }

  function increaseLongExt(SynthetixAdapter.ExchangeParams memory exchangeParams, uint amount) external {
    // Last field is optional, only for event
    _increaseLong(exchangeParams, amount, 0);
  }

  function decreaseLongExt(uint amount) external {
    // Last field is optional, only for event
    _decreaseLong(amount, 0);
  }

  function callTransferQuoteToHedge(uint spotPrice, uint amount) external {
    liquidityPool.transferQuoteToHedge(spotPrice, amount);
  }

  function setShortToExt(
    uint spotPrice,
    uint desiredShort,
    uint currentShort,
    uint currentCollateral
  ) external {
    _setShortTo(spotPrice, desiredShort, currentShort, currentCollateral);
  }

  function _sendAllQuoteToLPExt() external {
    _sendAllQuoteToLP();
  }
}
