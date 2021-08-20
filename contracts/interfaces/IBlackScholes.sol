//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

interface IBlackScholes {
  struct PricesDeltaStdVega {
    uint callPrice;
    uint putPrice;
    int callDelta;
    int putDelta;
    uint stdVega;
  }

  function abs(int x) external pure returns (uint);

  function exp(uint x) external pure returns (uint);

  function exp(int x) external pure returns (uint);

  function sqrt(uint x) external pure returns (uint y);

  function optionPrices(
    uint timeToExpirySec,
    uint volatilityDecimal,
    uint spotDecimal,
    uint strikeDecimal,
    int rateDecimal
  ) external pure returns (uint call, uint put);

  function pricesDeltaStdVega(
    uint timeToExpirySec,
    uint volatilityDecimal,
    uint spotDecimal,
    uint strikeDecimal,
    int rateDecimal
  ) external pure returns (PricesDeltaStdVega memory);
}
