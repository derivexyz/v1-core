//SPDX-License-Identifier: ISC

pragma solidity 0.8.16;

interface IPositionRouterCallbackReceiver {
  function gmxPositionCallback(bytes32 positionKey, bool isExecuted, bool isIncrease) external;
}
