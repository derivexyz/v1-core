//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

import "../libraries/FixedPointMathLib.sol";
import "./OldBlackScholesMath.sol";

contract MathTest {
  function lnV1(int x) external pure returns (int r) {
    return FixedPointMathLib.ln(x);
  }

  function expV1(int x) external pure returns (uint r) {
    return FixedPointMathLib.exp(x);
  }

  function lnV2(uint x) external pure returns (int r) {
    return OldBlackScholesMath.ln(x);
  }

  function expV2(int x) external pure returns (uint r) {
    return OldBlackScholesMath.exp(x);
  }
}
