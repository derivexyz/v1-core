//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

// https://docs.synthetix.io/contracts/source/interfaces/iaddressresolver
interface ILiquidityTracker {
  function addTokens(address trader, uint amount) external;

  function removeTokens(address trader, uint amount) external;
}
