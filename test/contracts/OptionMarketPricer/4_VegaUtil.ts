import { expect } from 'chai';
import { toBN } from '../../../scripts/util/web3utils';
import { TradeParametersStruct, TradePricingStruct } from '../../../typechain-types/OptionGreekCache';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

export const defaultTradePricingStruct: TradePricingStruct = {
  optionPrice: toBN('1'),
  preTradeAmmNetStdVega: toBN('0.1'),
  postTradeAmmNetStdVega: toBN('80'),
  callDelta: toBN('1'),
  volTraded: toBN('1'),
  vega: toBN('10'),
  ivVariance: toBN('0'),
};

async function getVegaUtilFee(
  tradeStructOverrides: Partial<TradeParametersStruct> = {},
  pricingStructOverrides: Partial<TradePricingStruct> = {},
) {
  return (
    await hre.f.c.optionMarketPricer.getVegaUtilFee(
      {
        ...hre.f.defaultTradeParametersStruct,
        ...tradeStructOverrides,
      },
      {
        ...defaultTradePricingStruct,
        ...pricingStructOverrides,
      },
    )
  ).vegaUtilFee;
}

describe('getVegaUtil', async () => {
  // As this is a view function, we don't need to reset the state between each test
  before(seedFixture);

  it('correctly computes the fee', async () => {
    // if this is wrong check pricing calcs were not changed.
    expect(await getVegaUtilFee()).eq(toBN('0.016'));
  });

  it('amount is equal to zero', async () => {
    expect(await getVegaUtilFee({ amount: 0 })).eq(0);
  });

  it('free liquidity 0 but optionPrice greater than 1', async () => {
    await expect(
      getVegaUtilFee({
        liquidity: {
          ...hre.f.defaultTradeParametersStruct.liquidity,
          NAV: 0,
        },
      }),
    ).to.be.revertedWith('reverted with panic code 18');
  });

  it('pricing.vol = 0', async () => {
    expect(await getVegaUtilFee({}, { volTraded: 0 })).eq(0);
  });

  it('returns 0 if preTrade netStdVega > postTrade', async () => {
    expect(
      await getVegaUtilFee(
        {},
        {
          preTradeAmmNetStdVega: 1000,
          postTradeAmmNetStdVega: 999,
        },
      ),
    ).eq(0);
  });
});
