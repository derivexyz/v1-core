//SPDX-License-Identifier: ISC
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../BlackScholes.sol";

contract TestBlackScholes is BlackScholes {
  using SafeDecimalMath for uint;
  using SignedSafeDecimalMath for int;

  function ln_pub(uint x) external pure returns (int) {
    return ln(x).preciseDecimalToDecimal();
  }

  function exp_pub(int x) external pure returns (uint) {
    return exp(x).preciseDecimalToDecimal();
  }

  function sqrt_pub(uint x) external pure returns (uint) {
    return sqrt(x * 1e18);
  }

  function abs_pub(int x) external pure returns (uint) {
    return abs(x);
  }

  function stdNormal_pub(int x) external pure returns (uint) {
    return stdNormal(x).preciseDecimalToDecimal();
  }

  function stdNormalCDF_pub(int x) external pure returns (uint) {
    return stdNormalCDF(x).preciseDecimalToDecimal();
  }

  function annualise_pub(uint secs) external pure returns (uint yearFraction) {
    return annualise(secs).preciseDecimalToDecimal();
  }

  function d1d2_pub(
    uint tAnnualised,
    uint volatility,
    uint spot,
    uint strike,
    int rate
  ) external pure returns (int d1, int d2) {
    (d1, d2) = d1d2(tAnnualised, volatility, spot, strike, rate);
    return (d1.preciseDecimalToDecimal(), d2.preciseDecimalToDecimal());
  }
}
