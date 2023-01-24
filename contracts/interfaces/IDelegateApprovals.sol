//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IDelegateApprovals {
  function approveExchangeOnBehalf(address delegate) external;

  function canExchangeOnBehalf(address exchanger, address beneficiary) external view returns (bool);
}
