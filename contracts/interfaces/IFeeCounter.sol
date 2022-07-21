//SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

interface IFeeCounter {
  function trackFee(
    address market,
    address trader,
    uint amount,
    uint totalCost,
    uint totalFee
  ) external;
}
