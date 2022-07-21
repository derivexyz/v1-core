// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

import "../interfaces/IDelegateApprovals.sol";

contract TestDelegateApprovals is IDelegateApprovals {
  mapping(address => mapping(address => bool)) public exchangingApproved;

  function approveExchangeOnBehalf(address approvee) external override {
    exchangingApproved[msg.sender][approvee] = true;
  }

  function canExchangeOnBehalf(address exchanger, address beneficiary) external view returns (bool) {
    if (exchanger == beneficiary) {
      return true;
    }
    return exchangingApproved[beneficiary][exchanger];
  }
}
