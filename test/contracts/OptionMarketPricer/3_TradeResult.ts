import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { expect } from 'chai';
import { DAY_SEC, getEventArgs, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { TradePricingStruct } from '../../../typechain-types/OptionGreekCache';
import { TradeResultStructOutput } from '../../../typechain-types/OptionMarket';
import { TradeParametersStruct, TradeResultStruct } from '../../../typechain-types/OptionMarketPricer';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  forceClosePositionWithOverrides,
  openDefaultLongCall,
  openPositionWithOverrides,
} from '../../utils/contractHelpers';
import { DEFAULT_PRICING_PARAMS, DEFAULT_VARIANCE_FEE_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { mockPrice } from '../../utils/seedTestSystem';
import { hre } from '../../utils/testSetup';
import { defaultTradePricingStruct } from './4_VegaUtil';

describe('getTradeResult', async () => {
  beforeEach(async () => {
    await seedFixture();

    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      standardSize: toBN('1'),
      skewAdjustmentFactor: toBN('0.5'),
    });
  });

  it('if amount == 0, return 0', async () => {
    const result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('0'),
      },
      { ...defaultTradePricingStruct },
      toBN('1'),
      toBN('1'),
    );

    expect(result.premium).to.eq(0);
    expect(result.totalCost).to.eq(0);
    expect(result.totalFee).to.eq(0);
  });

  it('adds fee to premium if isBuy == true', async () => {
    const result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: true,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );

    expect(result.totalCost).to.eq(toBN('100').add(result.totalFee));
  });

  it('subtracts fee from premium if isBuy == false', async () => {
    const result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: false,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );

    expect(result.totalCost).to.eq(toBN('100').sub(result.totalFee));
  });

  it('if isBuy == false and fee > premium, totalCost = 0', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      spotPriceFeeCoefficient: toBN('0.15'),
    });

    const result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: false,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('1') },
      toBN('1'),
      toBN('1'),
    );

    expect(result.totalFee).to.eq(result.premium);
    expect(result.totalCost).to.eq(0);
  });

  it('returns twap vol for volTraded when force closed with twap', async () => {
    // open some trades
    await openDefaultLongCall();
    await fastForward(DAY_SEC);
    await openDefaultLongCall();
    await fastForward(DAY_SEC);

    // console.log("opening call on: ", await hre.f.c.optionMarket.getStrike(1))
    await openPositionWithOverrides(hre.f.c, { strikeId: 1, optionType: OptionType.LONG_CALL, amount: toBN('10') });

    await mockPrice(hre.f.c, toBN('2250'), 'sETH');

    const tx = await forceClosePositionWithOverrides(hre.f.c, {
      strikeId: 1,
      positionId: 3,
      optionType: OptionType.LONG_CALL,
      amount: toBN('10'),
    });

    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

    // twap vol
    const forceCloseParams = await hre.f.c.optionGreekCache.getForceCloseParams();
    const twapIv = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, forceCloseParams.ivGWAVPeriod);
    // console.log("twapIv", twapIv.toString());
    const twapSkew = await hre.f.c.optionGreekCache.getSkewGWAV(1, forceCloseParams.skewGWAVPeriod);
    // console.log("twapSkew", twapSkew.toString());
    const twapVol = twapIv.mul(twapSkew).mul(forceCloseParams.longVolShock).div(UNIT).div(UNIT);

    const eventResult = await getEventArgs(await tx.wait(), 'Trade');

    assertCloseToPercentage(eventResult.tradeResults[0].volTraded, twapVol, toBN('0.001'));
  });

  it('adds a spot price fee if vegautil and optionPrice are both 0', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0'),
      vegaFeeCoefficient: toBN('0'),
    });
    await hre.f.c.optionMarketPricer.setVarianceFeeParams({
      ...DEFAULT_VARIANCE_FEE_PARAMS,
      defaultVarianceFeeCoefficient: toBN('0'),
    });

    let result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: true,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );
    expect(result.totalFee).to.eq(result.spotPriceFee);

    result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: false,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );
    expect(result.totalFee).to.eq(result.spotPriceFee);
  });

  it('adds a vega util fee if spotPrice and optionPrice are both 0', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0'),
      spotPriceFeeCoefficient: toBN('0'),
    });
    await hre.f.c.optionMarketPricer.setVarianceFeeParams({
      ...DEFAULT_VARIANCE_FEE_PARAMS,
      defaultVarianceFeeCoefficient: toBN('0'),
    });

    let result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: true,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );
    expect(result.totalFee).to.eq(result.vegaUtilFee.vegaUtilFee);

    result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: false,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );
    expect(result.totalFee).to.eq(result.vegaUtilFee.vegaUtilFee);
  });
  it('adds a optionPrice fee if spotPrice and vega util are both 0', async () => {
    await hre.f.c.optionMarketPricer.setPricingParams({
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0'),
      spotPriceFeeCoefficient: toBN('0'),
      vegaFeeCoefficient: toBN('0'),
    });

    let result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: true,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );
    expect(result.totalFee).to.eq(result.varianceFee.varianceFee);

    result = await getTradeResult(
      {
        ...hre.f.defaultTradeParametersStruct,
        amount: toBN('1'),
        isBuy: false,
      },
      { ...defaultTradePricingStruct, optionPrice: toBN('100') },
      toBN('1'),
      toBN('1'),
    );
    expect(result.totalFee).to.eq(result.varianceFee.varianceFee);
  });
});

export async function getTradeResult(
  tradeParams: TradeParametersStruct,
  tradePricingStruct: TradePricingStruct,
  newBaseIv: BigNumber,
  newSkew: BigNumber,
): Promise<TradeResultStruct> {
  return (await hre.f.c.optionMarketPricer.getTradeResult(
    tradeParams,
    tradePricingStruct,
    newBaseIv,
    newSkew,
  )) as TradeResultStructOutput;
}
