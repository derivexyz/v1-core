//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./ILyraGlobals.sol";
import "./IOptionMarket.sol";

interface IOptionMarketPricer {
  struct Pricing {
    uint optionPrice;
    int preTradeAmmNetStdVega;
    int postTradeAmmNetStdVega;
    int callDelta;
  }

  function ivImpactForTrade(
    IOptionMarket.OptionListing memory listing,
    IOptionMarket.Trade memory trade,
    ILyraGlobals.PricingGlobals memory pricingGlobals,
    uint boardBaseIv
  ) external pure returns (uint, uint);

  function updateCacheAndGetTotalCost(
    IOptionMarket.OptionListing memory listing,
    IOptionMarket.Trade memory trade,
    ILyraGlobals.PricingGlobals memory pricingGlobals,
    uint boardBaseIv
  )
    external
    returns (
      uint totalCost,
      uint newBaseIv,
      uint newSkew
    );

  function getPremium(
    IOptionMarket.Trade memory trade,
    Pricing memory pricing,
    ILyraGlobals.PricingGlobals memory pricingGlobals
  ) external pure returns (uint premium);

  function getVegaUtil(
    IOptionMarket.Trade memory trade,
    Pricing memory pricing,
    ILyraGlobals.PricingGlobals memory pricingGlobals
  ) external pure returns (uint vegaUtil);

  function getFee(
    ILyraGlobals.PricingGlobals memory pricingGlobals,
    uint amount,
    uint optionPrice,
    uint vegaUtil
  ) external pure returns (uint fee);
}
