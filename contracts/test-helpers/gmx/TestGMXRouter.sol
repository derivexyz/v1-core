//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

import "../../synthetix/DecimalMath.sol";
import "../../interfaces/gmx/IVault.sol";
import "../../synthetix/Owned.sol";
import "../TestERC20.sol";

contract TestGMXRouter is Owned {
  using DecimalMath for uint;

  constructor() {}

  function approvePlugin(address toApprove) external {}
}
