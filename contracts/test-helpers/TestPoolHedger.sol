//SPDX-License-Identifier: ISC
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../PoolHedger.sol";

contract TestPoolHedger is PoolHedger {
  function hedgeDeltaExt(int expectedHedge) external {
    _hedgeDelta(expectedHedge);
  }

  function increaseLongExt(ILyraGlobals.ExchangeGlobals memory exchangeGlobals, uint amount) external {
    // Last field is optional, only for event
    increaseLong(exchangeGlobals, amount, 0);
  }

  function decreaseLongExt(ILyraGlobals.ExchangeGlobals memory exchangeGlobals, uint amount) external {
    // Last field is optional, only for event
    decreaseLong(exchangeGlobals, amount, 0);
  }

  function callTransferQuoteToHedge(ILyraGlobals.ExchangeGlobals memory exchangeGlobals, uint amount) external {
    liquidityPool.transferQuoteToHedge(exchangeGlobals, amount);
  }

  function setShortToExt(
    ILyraGlobals.ExchangeGlobals memory exchangeGlobals,
    uint desiredShort,
    uint currentShort,
    uint currentCollateral
  ) external {
    setShortTo(exchangeGlobals, desiredShort, currentShort, currentCollateral);
  }

  function sendAllQuoteToLPExt() external {
    sendAllQuoteToLP();
  }
}
