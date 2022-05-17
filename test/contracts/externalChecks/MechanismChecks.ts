import { BigNumber, BigNumberish } from 'ethers';
import { getMarketTradeArgs } from '../../../scripts/util/transactions';
import {
  currentTime,
  DAY_SEC,
  fromBN,
  getEvent,
  getEventArgs,
  HOUR_SEC,
  OptionType,
  toBN,
  toBytes32,
  WEEK_SEC,
} from '../../../scripts/util/web3utils';
import {
  ForceCloseParametersStruct,
  GreekCacheParametersStruct,
  MinCollateralParametersStruct,
} from '../../../typechain-types/OptionGreekCache';
import { OptionMarketParametersStruct, TradeEvent } from '../../../typechain-types/OptionMarket';
import {
  PricingParametersStruct,
  TradeLimitParametersStruct,
  VarianceFeeParametersStruct,
} from '../../../typechain-types/OptionMarketPricer';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  mockPrice,
  openPosition,
  resetForceCloseParameters,
  resetGreekCacheParameters,
  resetMinCollateralParameters,
  resetOptionMarketParams,
  resetPricingParams,
  resetTradeLimitParams,
  resetVarianceFeeParams,
} from '../../utils/contractHelpers';
import { fastForwardTo, restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { deployFixture } from '../../utils/fixture';
import {
  createDefaultBoardWithOverrides,
  seedBalanceAndApprovalFor,
  seedLiquidityPool,
} from '../../utils/seedTestSystem';
import { hre } from '../../utils/testSetup';
import { test1 } from './mechanismTestResults';

//
const greekCacheParamOverrides: Partial<GreekCacheParametersStruct> = {
  //   gwavSkewFloor: toBN('0.5'),
  //   gwavSkewCap: toBN('2'),
  rateAndCarry: toBN('0.06'),
  varianceIvGWAVPeriod: HOUR_SEC * 12,
  varianceSkewGWAVPeriod: HOUR_SEC * 12,
  optionValueIvGWAVPeriod: HOUR_SEC * 12,
  optionValueSkewGWAVPeriod: HOUR_SEC * 12,
};

const minCollatParamOverrides: Partial<MinCollateralParametersStruct> = {
  minStaticBaseCollateral: 1, // can't be 0
  minStaticQuoteCollateral: 1,
  shockVolA: toBN('2.5'),
  shockVolPointA: WEEK_SEC * 2,
  shockVolB: toBN('1.8'),
  shockVolPointB: WEEK_SEC * 8,
  callSpotPriceShock: toBN('1.1'),
  putSpotPriceShock: toBN('0.9'),
};

const forceCloseParamOverrides: Partial<ForceCloseParametersStruct> = {
  ivGWAVPeriod: HOUR_SEC * 12,
  skewGWAVPeriod: HOUR_SEC * 12,
  longVolShock: toBN('0.8'),
  shortVolShock: toBN('1.2'),
  longPostCutoffVolShock: toBN('0.5'),
  shortPostCutoffVolShock: toBN('1.4'),
  liquidateVolShock: toBN('1.3'),
  liquidatePostCutoffVolShock: toBN('1.6'),
  shortSpotMin: toBN('0.01'),
  liquidateSpotMin: toBN('0.02'),
};

const pricingParamOverrides: Partial<PricingParametersStruct> = {
  optionPriceFeeCoefficient: toBN('0.01'),
  optionPriceFee1xPoint: WEEK_SEC * 6,
  optionPriceFee2xPoint: WEEK_SEC * 16,
  spotPriceFeeCoefficient: toBN('0.001'),
  spotPriceFee1xPoint: WEEK_SEC * 6,
  spotPriceFee2xPoint: WEEK_SEC * 12,
  vegaFeeCoefficient: toBN('0.2'),
  standardSize: toBN('150'),
  skewAdjustmentFactor: toBN('1'),
};

const varianceFeeParamOverrides: Partial<VarianceFeeParametersStruct> = {
  defaultVarianceFeeCoefficient: toBN('1'),
  forceCloseVarianceFeeCoefficient: toBN('1'),
  skewAdjustmentCoefficient: toBN('1'),
  referenceSkew: toBN('0'),
  minimumStaticSkewAdjustment: toBN('0'),
  vegaCoefficient: toBN('0.01'),
  minimumStaticVega: toBN('0'),
  ivVarianceCoefficient: toBN('100'),
  minimumStaticIvVariance: toBN('0'),
};

const tradeLimitParamOverrides: Partial<TradeLimitParametersStruct> = {
  minDelta: toBN('0.03'),
  minForceCloseDelta: toBN('1'),
};

const optionMarketParamOverrides: Partial<OptionMarketParametersStruct> = {
  feePortionReserved: toBN('0'),
};

const QuoteBaseFeeRateOverride = toBN('0');
const BaseQuoteFeeRateOverride = toBN('0');

describe('MechanismChecks', () => {
  let snap: number;
  before(async () => {
    await deployFixture();
    await resetGreekCacheParameters(greekCacheParamOverrides);
    await resetMinCollateralParameters(minCollatParamOverrides);
    await resetForceCloseParameters(forceCloseParamOverrides);
    await resetPricingParams(pricingParamOverrides);
    await resetVarianceFeeParams(varianceFeeParamOverrides);
    await resetOptionMarketParams(optionMarketParamOverrides);
    await resetTradeLimitParams(tradeLimitParamOverrides);
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), QuoteBaseFeeRateOverride);
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sETH'), toBytes32('sUSD'), BaseQuoteFeeRateOverride);
  });

  beforeEach(async () => {
    if (snap) {
      await restoreSnapshot(snap);
    }
    snap = await takeSnapshot();
  });

  it('test1', async () => {
    // Ctotal = 10000000;

    await seedLiquidityPool(hre.f.deployer, hre.f.c, toBN('50000000'));
    await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, toBN('10000000'), toBN('1000000'));

    const boardId = await createDefaultBoardWithOverrides(hre.f.c, {
      expiresIn: DAY_SEC * 14,
      baseIV: '1',
      strikePrices: ['3000'],
      skews: ['1'],
    });

    const board = await hre.f.c.optionMarket.getOptionBoard(boardId);
    const strikeId = board.strikeIds[0];

    const startTime = await currentTime();

    const expectedResults: any = test1;
    for (const key of Object.keys(expectedResults)) {
      expectedResults[key] = expectedResults[key].map((x: any) => toBN(x.toString()));
    }

    for (let i = 0; i < expectedResults['TradeSize'].length; i++) {
      const tradeSize = expectedResults['TradeSize'][i];
      console.log(`Opening position of size ${fromBN(tradeSize)}`);

      await fastForwardTo(startTime + parseFloat(fromBN(expectedResults['Trade Times'][i])) * 3600, true);
      await mockPrice('sETH', expectedResults['Spot'][i]);

      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId);

      let tx;
      if (tradeSize.gt(0)) {
        [tx] = await openPosition({
          strikeId,
          amount: tradeSize,
          optionType: OptionType.LONG_CALL,
        });
      } else if (tradeSize.lt(0)) {
        [tx] = await openPosition({
          strikeId,
          amount: tradeSize.abs(),
          optionType: OptionType.SHORT_CALL_BASE,
          setCollateralTo: tradeSize.abs(),
        });
      }

      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId);

      if (tx) {
        const tradeEvent = ({ args: getEventArgs(await tx.wait(), 'Trade') } as TradeEvent).args;

        const [forceCloseVolTraded, forceClosePremium] = await getForceClosePremiumForTrade(
          tradeEvent.positionId,
          tradeSize,
          strikeId,
        );
        assertCloseToPercentage(forceClosePremium, expectedResults['ForceClosePrem'][i]);
        assertCloseToPercentage(forceCloseVolTraded, expectedResults['ForceCloseVols'][i]);

        assertCloseToPercentage(tradeEvent.tradeResults[0].varianceFee.varianceFee, expectedResults['VarianceFees'][i]);
        assertCloseToPercentage(tradeEvent.tradeResults[0].spotPriceFee, expectedResults['SpotFees'][i]);
        assertCloseToPercentage(tradeEvent.tradeResults[0].optionPriceFee, expectedResults['OptionFees'][i]);
        assertCloseToPercentage(tradeEvent.tradeResults[0].premium, expectedResults['Premiums'][i]);
        assertCloseToPercentage(tradeEvent.tradeResults[0].newBaseIv, expectedResults['BaseIVs'][i]);
        assertCloseToPercentage(tradeEvent.tradeResults[0].newSkew, expectedResults['Skews'][i]);
        // assertCloseToPercentage(tradeEvent.tradeResults[0].varianceFee.vega.div(100), expectedResults["Vegas"][i]);
        // TODO: investigate vegaUtil

        assertCloseToPercentage(
          tradeEvent.tradeResults[0].vegaUtilFee.vegaUtilFee,
          expectedResults['VUFees'][i].div(100),
          toBN('0.005'),
        );
        const gwavs = await hre.f.c.optionGreekCache.getBoardGreeksView(boardId);
        assertCloseToPercentage(gwavs.strikeGreeks[0].stdVega, expectedResults['stdvega'][i]);
        assertCloseToPercentage(gwavs.ivGWAV, expectedResults['BaseIVsGWAV'][i]);
        assertCloseToPercentage(gwavs.skewGWAVs[0], expectedResults['SkewsGWAV'][i]);

        const liquidity = await hre.f.c.liquidityPool.getLiquidityParams();

        assertCloseToPercentage(liquidity.NAV.sub(toBN('50000000')), expectedResults['NAV'][i], toBN('0.005'));
        assertCloseToPercentage(liquidity.usedCollatLiquidity, expectedResults['TotalCollateralValue'][i]);
        assertCloseToPercentage(gwavs.strikeGreeks[0].stdVega, expectedResults['stdvega'][i]);

        const globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
        assertCloseToPercentage(globalCache.netGreeks.netOptionValue, expectedResults['OptionPos'][i].mul(-1));
      }
    }
  });
});

async function getForceClosePremiumForTrade(positionId: BigNumberish, tradeSize: BigNumber, strikeId: BigNumberish) {
  const snap = await takeSnapshot();
  let tx;
  if (tradeSize.gt(0)) {
    tx = await hre.f.c.optionMarket.forceClosePosition(
      getMarketTradeArgs({
        amount: tradeSize,
        strikeId,
        positionId,
        optionType: OptionType.LONG_CALL,
      }),
    );
  } else if (tradeSize.lt(0)) {
    tx = await hre.f.c.optionMarket.forceClosePosition(
      getMarketTradeArgs({
        amount: tradeSize.abs(),
        strikeId,
        positionId,
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: 0,
      }),
    );
  }

  if (!tx) {
    throw Error();
  }

  const tradeEvent = getEvent(await tx.wait(), 'Trade');

  await restoreSnapshot(snap);

  return [tradeEvent.args.tradeResults[0].volTraded, tradeEvent.args.tradeResults[0].premium];
}
