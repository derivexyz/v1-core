import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { toBN } from '../../../scripts/util/web3utils';
import { DEFAULT_PRICING_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

describe('IvImpact', async () => {
  beforeEach(async () => {
    await seedFixture();

    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('0.5'),
    });
  });

  it('correctly computes slippage @ different order sizes and initial values', async () => {
    let result = await getIvImpactForTrade(true, toBN('1'), toBN('1'), toBN('1'));
    expect(result.newBase).to.eq(toBN('1.01'));
    expect(result.newSkew).to.eq(toBN('1.005'));

    result = await getIvImpactForTrade(true, toBN('10'), toBN('0.5'), toBN('1'));
    expect(result.newBase).to.eq(toBN('0.6'));
    expect(result.newSkew).to.eq(toBN('1.05'));

    result = await getIvImpactForTrade(true, toBN('0'), toBN('0.75'), toBN('0.5'));
    expect(result.newBase).to.eq(toBN('0.75'));
    expect(result.newSkew).to.eq(toBN('0.5'));
  });

  it('skewAdjustment of 0 stops skew moving', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('0'),
    });

    const result = await getIvImpactForTrade(true, toBN('10'), toBN('1'), toBN('1'));
    expect(result.newBase).to.eq(toBN('1.1'));
    expect(result.newSkew).to.eq(toBN('1'));
  });

  it('skewAdjustment > 1 moves skew more than iv', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('2'),
    });

    let result = await getIvImpactForTrade(true, toBN('10'), toBN('1'), toBN('1'));
    expect(result.newBase).to.eq(toBN('1.1'));
    expect(result.newSkew).to.eq(toBN('1.2'));

    result = await getIvImpactForTrade(true, toBN('5'), toBN('0.5'), toBN('0.75'));
    expect(result.newBase).to.eq(toBN('0.55'));
    expect(result.newSkew).to.eq(toBN('0.85'));
  });

  it('isBuy = false moves skew and iv down', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('2'),
    });

    let result = await getIvImpactForTrade(false, toBN('10'), toBN('1'), toBN('1'));
    expect(result.newBase).to.eq(toBN('0.9'));
    expect(result.newSkew).to.eq(toBN('0.8'));

    result = await getIvImpactForTrade(false, toBN('5'), toBN('0.5'), toBN('0.75'));
    expect(result.newBase).to.eq(toBN('0.45'));
    expect(result.newSkew).to.eq(toBN('0.65'));

    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('100'),
      skewAdjustmentFactor: toBN('0'),
    });

    result = await getIvImpactForTrade(false, toBN('10'), toBN('0.5'), toBN('0.75'));
    expect(result.newBase).to.eq(toBN('0.499'));
    expect(result.newSkew).to.eq(toBN('0.75'));
  });

  it('skew reverts if trying to go below 0', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('2'),
    });

    const result = await getIvImpactForTrade(false, toBN('10'), toBN('1'), toBN('0.2'));
    expect(result.newBase).to.eq(toBN('0.9'));
    expect(result.newSkew).to.eq(toBN('0'));

    await expect(getIvImpactForTrade(false, toBN('20'), toBN('1'), toBN('0.2'))).to.be.revertedWith(
      'reverted with panic code 17',
    );
  });

  it('iv reverts if trying to go below 0', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('0'),
    });

    const result = await getIvImpactForTrade(false, toBN('10'), toBN('0.1'), toBN('1'));
    expect(result.newBase).to.eq(toBN('0'));
    expect(result.newSkew).to.eq(toBN('1'));

    await expect(getIvImpactForTrade(false, toBN('20'), toBN('0.15'), toBN('1'))).to.be.revertedWith(
      'reverted with panic code 17',
    );
  });
});

async function getIvImpactForTrade(
  isBuy: boolean,
  amount: BigNumber,
  boardBaseIv: BigNumber,
  strikeSkew: BigNumber,
): Promise<{ newBase: BigNumber; newSkew: BigNumber }> {
  const result = await hre.f.c.optionMarketPricer.ivImpactForTrade(
    {
      ...hre.f.defaultTradeParametersStruct,
      isBuy,
      amount,
    },
    boardBaseIv,
    strikeSkew,
  );

  return { newBase: result[0], newSkew: result[1] };
}
