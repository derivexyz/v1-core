//SPDX-License-Identifier: ISC
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../LiquidityPool.sol";

contract TestLiquidityPool is LiquidityPool {
  function pub_totalQuoteAmountReserved() public view returns (uint) {
    return totalQuoteAmountReserved;
  }

  function pub_tokensBurnableForRound() public view returns (uint) {
    return tokensBurnableForRound;
  }

  function pub_totalTokenSupply() public view returns (uint) {
    return totalTokenSupply;
  }

  modifier onlyPoolHedger override {
    _;
  }

  modifier onlyOptionMarket override {
    _;
  }

  modifier onlyShortCollateral override {
    _;
  }
}
