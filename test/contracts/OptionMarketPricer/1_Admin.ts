import { expect } from 'chai';
import { DAY_SEC, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { PricingParametersStruct, TradeLimitParametersStruct } from '../../../typechain-types/OptionMarketPricer';
import { DEFAULT_PRICING_PARAMS, DEFAULT_TRADE_LIMIT_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

const modParams: PricingParametersStruct = {
  optionPriceFeeCoefficient: toBN('0.1'),
  optionPriceFee1xPoint: 2 * WEEK_SEC,
  optionPriceFee2xPoint: 4 * WEEK_SEC,
  spotPriceFeeCoefficient: toBN('0.1'),
  spotPriceFee1xPoint: 3 * WEEK_SEC,
  spotPriceFee2xPoint: 7 * WEEK_SEC,
  vegaFeeCoefficient: toBN('200000'),
  standardSize: toBN('0.0001'),
  skewAdjustmentFactor: toBN('10'),
};
const expectInvalidTradeLimitParams = async (overrides?: any) => {
  return await expect(setTradingParams(overrides)).revertedWith('InvalidTradeLimitParameters');
};

const setTradingParams = async (tradingParamsOverride?: TradeLimitParametersStruct) => {
  return await hre.f.c.optionMarketPricer.setTradeLimitParams({
    ...DEFAULT_TRADE_LIMIT_PARAMS,
    ...(tradingParamsOverride || {}),
  });
};

describe('Admin', () => {
  beforeEach(seedFixture);

  const setInvalidPricingParams = async (pricingParamsOverrides?: PricingParametersStruct) => {
    return await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      ...(pricingParamsOverrides || {}),
    });
  };

  const expectInvalidPricingParams = async (overrides?: any) => {
    await expect(setInvalidPricingParams(overrides)).revertedWith('InvalidPricingParameters');
  };

  it('cannot init twice', async () => {
    await expect(
      hre.f.c.optionMarketPricer.init(hre.f.c.optionMarket.address, hre.f.c.optionGreekCache.address),
    ).to.be.revertedWith('AlreadyInitialised');
  });

  it('updates pricing params', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams(modParams);
    const retParams = await hre.f.c.optionMarketPricer.pricingParams();
    expect(retParams.optionPriceFeeCoefficient).eq(modParams.optionPriceFeeCoefficient);
    expect(retParams.optionPriceFee1xPoint).eq(modParams.optionPriceFee1xPoint);
    expect(retParams.optionPriceFee2xPoint).eq(modParams.optionPriceFee2xPoint);
    expect(retParams.spotPriceFeeCoefficient).eq(modParams.spotPriceFeeCoefficient);
    expect(retParams.spotPriceFee1xPoint).eq(modParams.spotPriceFee1xPoint);
    expect(retParams.spotPriceFee2xPoint).eq(modParams.spotPriceFee2xPoint);
    expect(retParams.vegaFeeCoefficient).eq(modParams.vegaFeeCoefficient);
    expect(retParams.standardSize).eq(modParams.standardSize);
    expect(retParams.skewAdjustmentFactor).eq(modParams.skewAdjustmentFactor);
  });

  it('reverts if invalid pricing params are set', async () => {
    await expectInvalidPricingParams({
      optionPriceFeeCoefficient: toBN('201'),
    });

    // TODO: more tests when bounds finalized by mechanism
    await expectInvalidPricingParams({
      optionPriceFee1xPoint: toBN('10'),
    });

    await expectInvalidPricingParams({
      optionPriceFee2xPoint: DAY_SEC,
    });

    // set point1x valid for testing
    await expectInvalidPricingParams({
      optionPriceFee1xPoint: toBN('1'),
      optionPriceFee2xPoint: toBN('1'),
    });

    await expectInvalidPricingParams({
      standardSize: 0,
    });

    await expectInvalidPricingParams({
      skewAdjustmentFactor: toBN('10000'), // 10_000
    });
  });

  describe('Trade Limit Params', () => {
    it('Can successfully modify Trade Limit Params', async () => {
      const newParams = {
        maxBaseIV: toBN('3'),
        maxSkew: toBN('1.8'),
        minBaseIV: toBN('0.12'),
        minSkew: toBN('0.4'),
        minDelta: toBN('0.1'),
        minForceCloseDelta: toBN('0.12'),
        minVol: toBN('0.6'),
        maxVol: toBN('2.2'),
        tradingCutoff: DAY_SEC,
        absMaxSkew: toBN('2.3'),
        absMinSkew: toBN('0.1'),
      } as TradeLimitParametersStruct;

      await hre.f.c.optionMarketPricer.setTradeLimitParams(newParams);

      await setTradingParams(newParams);

      const modParams = await hre.f.c.optionMarketPricer.getTradeLimitParams();

      expect(DEFAULT_TRADE_LIMIT_PARAMS.maxBaseIV).not.eq(newParams.maxBaseIV);
      expect(newParams.maxBaseIV).eq(modParams.maxBaseIV);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.maxSkew).not.eq(newParams.maxSkew);
      expect(newParams.maxSkew).eq(modParams.maxSkew);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.minBaseIV).not.eq(newParams.minBaseIV);
      expect(newParams.minBaseIV).eq(modParams.minBaseIV);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.minSkew).not.eq(newParams.minSkew);
      expect(newParams.minSkew).eq(modParams.minSkew);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.minDelta).not.eq(newParams.minDelta);
      expect(newParams.minDelta).eq(modParams.minDelta);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.minForceCloseDelta).not.eq(newParams.minForceCloseDelta);
      expect(newParams.minForceCloseDelta).eq(modParams.minForceCloseDelta);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.minVol).not.eq(newParams.minVol);
      expect(newParams.minVol).eq(modParams.minVol);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.maxVol).not.eq(newParams.maxVol);
      expect(newParams.maxVol).eq(modParams.maxVol);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.tradingCutoff).not.eq(newParams.tradingCutoff);
      expect(newParams.tradingCutoff).eq(modParams.tradingCutoff);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.absMaxSkew).not.eq(newParams.absMaxSkew);
      expect(newParams.absMaxSkew).eq(modParams.absMaxSkew);

      expect(DEFAULT_TRADE_LIMIT_PARAMS.absMinSkew).not.eq(newParams.absMinSkew);
      expect(newParams.absMinSkew).eq(modParams.absMinSkew);
    });

    it('revert testing for TradeLimitParameters', async () => {
      await expectInvalidTradeLimitParams({
        minDelta: toBN('2'),
      });

      await expectInvalidTradeLimitParams({
        minForceCloseDelta: toBN('2'),
      });

      await expectInvalidTradeLimitParams({
        tradingCutoff: 11 * DAY_SEC,
      });

      await expectInvalidTradeLimitParams({
        tradingCutoff: 0,
      });

      await expectInvalidTradeLimitParams({
        minBaseIV: toBN('20'),
      });

      await expectInvalidTradeLimitParams({
        minSkew: toBN('20'),
      });

      await expectInvalidTradeLimitParams({
        maxSkew: toBN('20'),
      });

      await expectInvalidTradeLimitParams({
        maxSkew: 0,
      });

      await expectInvalidTradeLimitParams({
        maxVol: 0,
      });

      await expectInvalidTradeLimitParams({
        absMaxSkew: 0,
      });

      await expectInvalidTradeLimitParams({
        absMaxSkew: 1,
        maxSkew: 2,
      });

      await expectInvalidTradeLimitParams({
        absMinSkew: 2,
        minSkew: 1,
      });
    });
  });
});
