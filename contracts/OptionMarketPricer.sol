//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SignedSafeDecimalMath.sol";
import "./synthetix/SafeDecimalMath.sol";

// Interfaces
import "./interfaces/ILyraGlobals.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IOptionMarket.sol";
import "./interfaces/IOptionGreekCache.sol";
import "./interfaces/IOptionMarket.sol";

/**
 * @title OptionMarketPricer
 * @author Lyra
 * @dev Logic for working out the price of an option. Includes the IV impact of the trade, the fee components and
 * premium.
 */
contract OptionMarketPricer is IOptionMarketPricer {
  using SafeMath for uint;
  using SafeDecimalMath for uint;
  using SignedSafeMath for int;

  address internal optionMarket;
  IOptionGreekCache internal greekCache;
  bool internal initialized = false;

  constructor() {}

  /**
   * @dev Initialize the contract.
   *
   * @param _optionMarket OptionMarket address
   * @param _greekCache OptionGreekCache address
   */
  function init(address _optionMarket, IOptionGreekCache _greekCache) external {
    require(!initialized, "contract already initialized");
    optionMarket = _optionMarket;
    greekCache = _greekCache;
    initialized = true;
  }

  /**
   * @dev Calculates the impact a trade has on the base IV of the OptionBoard and the skew of the OptionListing.
   *
   * @param listing The OptionListing.
   * @param trade The Trade.
   * @param pricingGlobals The PricingGlobals.
   * @param boardBaseIv The base IV of the OptionBoard.
   */
  function ivImpactForTrade(
    IOptionMarket.OptionListing memory listing,
    IOptionMarket.Trade memory trade,
    ILyraGlobals.PricingGlobals memory pricingGlobals,
    uint boardBaseIv
  ) public pure override returns (uint, uint) {
    uint orderSize = trade.amount.divideDecimal(pricingGlobals.standardSize);
    uint orderMoveBaseIv = orderSize / 100;
    uint orderMoveSkew = orderMoveBaseIv.multiplyDecimal(pricingGlobals.skewAdjustmentFactor);
    if (trade.isBuy) {
      return (boardBaseIv.add(orderMoveBaseIv), listing.skew.add(orderMoveSkew));
    } else {
      return (boardBaseIv.sub(orderMoveBaseIv), listing.skew.sub(orderMoveSkew));
    }
  }

  /**
   * @dev The entry point for the OptionMarket into the pricing logic when a trade is performed.
   *
   * @param listing The OptionListing.
   * @param trade The Trade.
   * @param pricingGlobals The PricingGlobals.
   * @param boardBaseIv The base IV of the OptionBoard.
   */
  function updateCacheAndGetTotalCost(
    IOptionMarket.OptionListing memory listing,
    IOptionMarket.Trade memory trade,
    ILyraGlobals.PricingGlobals memory pricingGlobals,
    uint boardBaseIv
  )
    external
    override
    onlyOptionMarket
    returns (
      uint totalCost,
      uint newBaseIv,
      uint newSkew
    )
  {
    (newBaseIv, newSkew) = ivImpactForTrade(listing, trade, pricingGlobals, boardBaseIv);
    trade.vol = newBaseIv.multiplyDecimal(newSkew);

    require(trade.vol >= pricingGlobals.volatilityCutoff, "vol out of trading range");

    Pricing memory pricing =
      greekCache.updateListingCacheAndGetPrice(
        ILyraGlobals.GreekCacheGlobals(pricingGlobals.rateAndCarry, pricingGlobals.spotPrice),
        listing.id,
        int(listing.longCall).sub(int(listing.shortCall)),
        int(listing.longPut).sub(int(listing.shortPut)),
        newBaseIv,
        newSkew
      );

    require(
      pricing.callDelta >= pricingGlobals.minDelta &&
        pricing.callDelta <= (int(SafeDecimalMath.UNIT).sub(pricingGlobals.minDelta)),
      "delta out of trading range"
    );

    totalCost = getPremium(trade, pricing, pricingGlobals);
  }

  /**
   * @dev Calculates the final premium for a trade.
   *
   * @param trade The Trade.
   * @param pricing The Pricing.
   * @param pricingGlobals The PricingGlobals.
   */
  function getPremium(
    IOptionMarket.Trade memory trade,
    Pricing memory pricing,
    ILyraGlobals.PricingGlobals memory pricingGlobals
  ) public pure override returns (uint premium) {
    uint vegaUtil = getVegaUtil(trade, pricing, pricingGlobals);

    uint fee = getFee(pricingGlobals, trade.amount, pricing.optionPrice, vegaUtil);
    premium = pricing.optionPrice.multiplyDecimal(trade.amount);
    if (trade.isBuy) {
      // If we are selling, increase the amount the user pays
      premium = premium.add(fee);
    } else {
      // If we are buying, reduce the amount we pay
      if (fee > premium) {
        premium = 0;
      } else {
        premium -= fee;
      }
    }
  }

  /**
   * @dev Calculates vega utilisation to be used as part of the trade fee. If the trade reduces net standard vega, this
   * component is omitted from the fee.
   *
   * @param trade The Trade.
   * @param pricing The Pricing.
   * @param pricingGlobals The PricingGlobals.
   */
  function getVegaUtil(
    IOptionMarket.Trade memory trade,
    Pricing memory pricing,
    ILyraGlobals.PricingGlobals memory pricingGlobals
  ) public pure override returns (uint vegaUtil) {
    if (abs(pricing.preTradeAmmNetStdVega) >= abs(pricing.postTradeAmmNetStdVega)) {
      return 0;
    }

    uint normVol =
      (100 * trade.vol).multiplyDecimal(abs(pricing.postTradeAmmNetStdVega)).multiplyDecimal(
        pricingGlobals.vegaNormFactor
      );
    // post trade vol liquidity excluding fee component
    uint totalCollatLiquidity = trade.liquidity.usedCollatLiquidity.add(trade.liquidity.freeCollatLiquidity);
    uint collatLiqPlusTotalCost =
      trade.isBuy
        ? (totalCollatLiquidity.add(trade.amount.multiplyDecimal(pricing.optionPrice)))
        : (totalCollatLiquidity.sub(trade.amount.multiplyDecimal(pricing.optionPrice)));
    vegaUtil = normVol.divideDecimal(collatLiqPlusTotalCost);
  }

  /**
   * @dev Calculate the fee for a trade.
   *
   * @param pricingGlobals The PricingGlobals.
   * @param amount The amount of options being traded.
   * @param optionPrice The fair price for one option.
   * @param vegaUtil The vega utilisation of the LiquidityPool.
   */
  function getFee(
    ILyraGlobals.PricingGlobals memory pricingGlobals,
    uint amount,
    uint optionPrice,
    uint vegaUtil
  ) public pure override returns (uint fee) {
    fee = (
      (pricingGlobals.optionPriceFeeCoefficient.multiplyDecimal(optionPrice))
        .add((pricingGlobals.spotPriceFeeCoefficient.multiplyDecimal(pricingGlobals.spotPrice)))
        .add((pricingGlobals.vegaFeeCoefficient.multiplyDecimal(vegaUtil)))
    )
      .multiplyDecimal(amount);
  }

  /**
   * @dev Compute the absolute value of `val`.
   *
   * @param val The number to absolute value.
   */
  function abs(int val) internal pure returns (uint absVal) {
    return val > 0 ? uint(val) : uint(-val);
  }

  modifier onlyOptionMarket virtual {
    require(msg.sender == optionMarket, "only optionMarket");
    _;
  }
}
