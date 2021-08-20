//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./ICollateralShort.sol";

interface IPoolHedger {
  function shortingInitialized() external view returns (bool);

  function shortId() external view returns (uint);

  function shortBuffer() external view returns (uint);

  function lastInteraction() external view returns (uint);

  function interactionDelay() external view returns (uint);

  function setShortBuffer(uint newShortBuffer) external;

  function setInteractionDelay(uint newInteractionDelay) external;

  function initShort() external;

  function reopenShort() external;

  function hedgeDelta() external;

  function getShortPosition(ICollateralShort short) external view returns (uint shortBalance, uint collateral);

  function getCurrentHedgedNetDelta() external view returns (int);

  function getValueQuote(ICollateralShort short, uint spotPrice) external view returns (uint value);
}
