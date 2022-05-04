import { BigNumber } from 'ethers';
import { toBN, UNIT } from '../../../scripts/util/web3utils';
import { TradeParametersStruct, TradePricingStruct } from '../../../typechain-types/OptionGreekCache';
import { VarianceFeeComponentsStruct, VarianceFeeParametersStruct } from '../../../typechain-types/OptionMarketPricer';
import { DEFAULT_VARIANCE_FEE_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

const defaultTradePricingStruct: TradePricingStruct = {
  optionPrice: toBN('1'),
  preTradeAmmNetStdVega: toBN('0.1'),
  postTradeAmmNetStdVega: toBN('80'),
  callDelta: toBN('1'),
  volTraded: toBN('1'),
  vega: toBN('14'),
  ivVariance: toBN('0'),
};
//
// export const DEFAULT_VARIANCE_FEE_PARAMS: VarianceFeeParametersStruct = {
//   defaultVarianceFeeCoefficient: toBN('5'),
//   forceCloseVarianceFeeCoefficient: toBN('2'),
//   skewAdjustmentCoefficient: toBN('3'),
//   referenceSkew: toBN('1'),
//   minimumStaticSkewAdjustment: toBN('1'),
//   vegaCoefficient: toBN('0.02'),
//   minimumStaticVega: toBN('2'),
//   ivVarianceCoefficient: toBN('1.5'),
//   minimumStaticIvVariance: toBN('1')
// }

async function setVarianceFeeParams(varianceFeeParamOverrides?: Partial<VarianceFeeParametersStruct>) {
  const varianceFeeParams = {
    ...DEFAULT_VARIANCE_FEE_PARAMS,
    ...(varianceFeeParamOverrides || {}),
  };

  await hre.f.c.optionMarketPricer.setVarianceFeeParams(varianceFeeParams);
}

async function getVarianceFee(
  skew: BigNumber = toBN('1'),
  pricingStructOverrides: Partial<TradePricingStruct> = {},
  tradeStructOverrides: Partial<TradeParametersStruct> = {},
) {
  return await hre.f.c.optionMarketPricer.getVarianceFee(
    {
      ...hre.f.defaultTradeParametersStruct,
      amount: toBN('1'),
      ...tradeStructOverrides,
    },
    {
      ...defaultTradePricingStruct,
      ...pricingStructOverrides,
    },
    skew,
  );
}

function assertVarianceParameters(res: VarianceFeeComponentsStruct, expected: Partial<VarianceFeeComponentsStruct>) {
  if (expected.varianceFee) {
    expect(res.varianceFee, 'varianceFee differs').eq(expected.varianceFee);
  }
  if (expected.varianceFeeCoefficient) {
    expect(res.varianceFeeCoefficient, 'varianceFeeCoefficient differs').eq(expected.varianceFeeCoefficient);
  }
  if (expected.ivVariance) {
    expect(res.ivVariance, 'ivVariance differs').eq(expected.ivVariance);
  }
  if (expected.ivVarianceCoefficient) {
    expect(res.ivVarianceCoefficient, 'ivVarianceCoefficient differs').eq(expected.ivVarianceCoefficient);
  }
  if (expected.skew) {
    expect(res.skew, 'skew differs').eq(expected.skew);
  }
  if (expected.skewCoefficient) {
    expect(res.skewCoefficient, 'skewCoefficient differs').eq(expected.skewCoefficient);
  }
  if (expected.vega) {
    expect(res.vega, 'vega differs').eq(expected.vega);
  }
  if (expected.vegaCoefficient) {
    expect(res.vegaCoefficient, 'vegaCoefficient differs').eq(expected.vegaCoefficient);
  }
}

describe('getVarianceFee', async () => {
  // As this is a view function, we don't need to reset the state between each test
  beforeEach(seedFixture);

  it('Computes the fee correctly given different parameters', async () => {
    const initial = await getVarianceFee();
    assertVarianceParameters(initial, {
      varianceFee: toBN('11.4'),
    });

    // amount doubled - coefficients the same, just result doubled
    let res = await getVarianceFee(toBN('1'), {}, { amount: toBN('2') });
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee.mul(2),
      ivVarianceCoefficient: initial.ivVarianceCoefficient,
      skewCoefficient: initial.skewCoefficient,
      vegaCoefficient: initial.vegaCoefficient,
    });

    // With just skew changed
    res = await getVarianceFee(toBN('1.5'));
    // can just add 0.5 as initial skew matches reverence skew
    let newSkewCoefficient = toBN('1.5')
      .sub(DEFAULT_VARIANCE_FEE_PARAMS.referenceSkew)
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.skewAdjustmentCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticSkewAdjustment);
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee.mul(newSkewCoefficient).div(initial.skewCoefficient),
      ivVarianceCoefficient: initial.ivVarianceCoefficient,
      skewCoefficient: newSkewCoefficient,
      vegaCoefficient: initial.vegaCoefficient,
    });

    // With just vega changed
    res = await getVarianceFee(toBN('1'), { vega: toBN('30') });
    let newVegaCoefficient = toBN('30')
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.vegaCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticVega);
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee.mul(newVegaCoefficient).div(initial.vegaCoefficient),
      ivVarianceCoefficient: initial.ivVarianceCoefficient,
      skewCoefficient: initial.skewCoefficient,
      vegaCoefficient: newVegaCoefficient,
    });

    // With just ivVariance
    res = await getVarianceFee(toBN('1'), { ivVariance: toBN('0.1') });
    let newIvVarianceCoefficient = toBN('0.1')
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.ivVarianceCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticIvVariance);
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee.mul(newIvVarianceCoefficient).div(initial.ivVarianceCoefficient),
      ivVarianceCoefficient: newIvVarianceCoefficient,
      skewCoefficient: initial.skewCoefficient,
      vegaCoefficient: initial.vegaCoefficient,
    });

    res = await getVarianceFee(toBN('1.2'), { vega: toBN('30') });
    newSkewCoefficient = toBN('1.2')
      .sub(DEFAULT_VARIANCE_FEE_PARAMS.referenceSkew)
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.skewAdjustmentCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticSkewAdjustment);
    newVegaCoefficient = toBN('30')
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.vegaCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticVega);
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee
        .mul(newVegaCoefficient)
        .mul(newSkewCoefficient)
        .div(initial.vegaCoefficient)
        .div(initial.skewCoefficient),
      ivVarianceCoefficient: initial.ivVarianceCoefficient,
      skewCoefficient: newSkewCoefficient,
      vegaCoefficient: newVegaCoefficient,
    });

    res = await getVarianceFee(toBN('1.3'), { ivVariance: toBN('0.12') });
    newSkewCoefficient = toBN('1.3')
      .sub(DEFAULT_VARIANCE_FEE_PARAMS.referenceSkew)
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.skewAdjustmentCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticSkewAdjustment);
    newIvVarianceCoefficient = toBN('0.12')
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.ivVarianceCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticIvVariance);
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee
        .mul(newSkewCoefficient)
        .mul(newIvVarianceCoefficient)
        .div(initial.skewCoefficient)
        .div(initial.ivVarianceCoefficient),
      ivVarianceCoefficient: newIvVarianceCoefficient,
      skewCoefficient: newSkewCoefficient,
      vegaCoefficient: initial.vegaCoefficient,
    });

    res = await getVarianceFee(toBN('1.3'), { vega: toBN('10'), ivVariance: toBN('0.2') });
    newSkewCoefficient = toBN('1.3')
      .sub(DEFAULT_VARIANCE_FEE_PARAMS.referenceSkew)
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.skewAdjustmentCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticSkewAdjustment);
    newIvVarianceCoefficient = toBN('0.2')
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.ivVarianceCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticIvVariance);
    newVegaCoefficient = toBN('10')
      .mul(DEFAULT_VARIANCE_FEE_PARAMS.vegaCoefficient)
      .div(UNIT)
      .add(DEFAULT_VARIANCE_FEE_PARAMS.minimumStaticVega);
    assertVarianceParameters(res, {
      varianceFee: initial.varianceFee
        .mul(newSkewCoefficient)
        .mul(newIvVarianceCoefficient)
        .mul(newVegaCoefficient)
        .div(initial.skewCoefficient)
        .div(initial.ivVarianceCoefficient)
        .div(initial.vegaCoefficient),
      ivVarianceCoefficient: newIvVarianceCoefficient,
      skewCoefficient: newSkewCoefficient,
      vegaCoefficient: newVegaCoefficient,
    });

    await setVarianceFeeParams({ defaultVarianceFeeCoefficient: 0 });
    res = await getVarianceFee(toBN('1'), {}, { isForceClose: true });
    assertVarianceParameters(res, {
      varianceFee: 0,
      varianceFeeCoefficient: toBN('2'),
    });
  });

  it('can turn off the various components', async () => {
    await setVarianceFeeParams({ skewAdjustmentCoefficient: 0, minimumStaticSkewAdjustment: toBN('1') });
    let res = await getVarianceFee(toBN('300'));
    expect(res.skewCoefficient).eq(toBN('1'));

    await setVarianceFeeParams({ ivVarianceCoefficient: 0, minimumStaticIvVariance: toBN('1') });
    res = await getVarianceFee(toBN('1'), { ivVariance: toBN('100') });
    expect(res.ivVarianceCoefficient).eq(toBN('1'));

    await setVarianceFeeParams({ vegaCoefficient: 0, minimumStaticVega: toBN('1') });
    res = await getVarianceFee(toBN('1'), { vega: toBN('100') });
    expect(res.vegaCoefficient).eq(toBN('1'));
  });

  it('changes based on changes in skew', async () => {
    let res = await getVarianceFee();
    assertVarianceParameters(res, {
      varianceFee: toBN('11.4'),
      skewCoefficient: toBN('1'),
    });

    res = await getVarianceFee(toBN('1.1'));
    assertVarianceParameters(res, {
      varianceFee: toBN('14.82'),
      skewCoefficient: toBN('1.3'),
    });

    res = await getVarianceFee(toBN('0.9'));
    assertVarianceParameters(res, {
      varianceFee: toBN('14.82'),
      skewCoefficient: toBN('1.3'),
    });

    res = await getVarianceFee(toBN('1.5'));
    assertVarianceParameters(res, {
      varianceFee: toBN('28.5'),
      skewCoefficient: toBN('2.5'),
    });

    res = await getVarianceFee(toBN('0.5'));
    assertVarianceParameters(res, {
      varianceFee: toBN('28.5'),
      skewCoefficient: toBN('2.5'),
    });
  });

  it('changes based on changes in variance', async () => {
    let res = await getVarianceFee();
    assertVarianceParameters(res, {
      varianceFee: toBN('11.4'),
      ivVarianceCoefficient: toBN('1'),
    });

    res = await getVarianceFee(toBN('1'), { ivVariance: toBN('0.1') });
    assertVarianceParameters(res, {
      varianceFee: toBN('13.11'),
      ivVarianceCoefficient: toBN('1.15'),
    });

    res = await getVarianceFee(toBN('1'), { ivVariance: toBN('0.3') });
    assertVarianceParameters(res, {
      varianceFee: toBN('16.53'),
      ivVarianceCoefficient: toBN('1.45'),
    });

    res = await getVarianceFee(toBN('1'), { ivVariance: toBN('0.6') });
    assertVarianceParameters(res, {
      varianceFee: toBN('21.66'),
      ivVarianceCoefficient: toBN('1.9'),
    });
  });
  it('changes based on changes in vega', async () => {
    let res = await getVarianceFee(toBN('1'), { vega: 0 });
    assertVarianceParameters(res, {
      varianceFee: toBN('10'),
      vegaCoefficient: toBN('2'),
    });

    res = await getVarianceFee(toBN('1'), { vega: toBN('20') });
    assertVarianceParameters(res, {
      varianceFee: toBN('12'),
      vegaCoefficient: toBN('2.4'),
    });

    res = await getVarianceFee(toBN('1'), { vega: toBN('50') });
    assertVarianceParameters(res, {
      varianceFee: toBN('15'),
      vegaCoefficient: toBN('3'),
    });

    res = await getVarianceFee(toBN('1'), { vega: toBN('200') });
    assertVarianceParameters(res, {
      varianceFee: toBN('30'),
      vegaCoefficient: toBN('6'),
    });
  });
  it('disables the fee if any coefficient == 0', async () => {
    await setVarianceFeeParams({ skewAdjustmentCoefficient: 0, minimumStaticSkewAdjustment: 0 });
    let res = await getVarianceFee(toBN('300'));
    assertVarianceParameters(res, {
      varianceFee: 0,
      skewCoefficient: 0,
    });

    await setVarianceFeeParams({ ivVarianceCoefficient: 0, minimumStaticIvVariance: 0 });
    res = await getVarianceFee(toBN('1'), { ivVariance: toBN('100') });
    assertVarianceParameters(res, {
      varianceFee: 0,
      ivVarianceCoefficient: 0,
    });

    await setVarianceFeeParams({ vegaCoefficient: 0, minimumStaticVega: toBN('1') });
    res = await getVarianceFee(toBN('1'), { vega: toBN('100') });
    assertVarianceParameters(res, {
      varianceFee: 0,
      vegaCoefficient: 0,
    });

    await setVarianceFeeParams({ defaultVarianceFeeCoefficient: 0 });
    res = await getVarianceFee();
    assertVarianceParameters(res, {
      varianceFee: 0,
      varianceFeeCoefficient: 0,
    });

    await setVarianceFeeParams({ forceCloseVarianceFeeCoefficient: 0 });
    res = await getVarianceFee(toBN('1'), {}, { isForceClose: true });
    assertVarianceParameters(res, {
      varianceFee: 0,
      varianceFeeCoefficient: 0,
    });
  });
});
