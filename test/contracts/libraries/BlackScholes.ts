import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { fromBN, toBN, WEEK_SEC, YEAR_SEC } from '../../../scripts/util/web3utils';
import { BlackScholes, TestBlackScholes } from '../../../typechain-types';
import { BlackScholesInputsStruct } from '../../../typechain-types/BlackScholes';
import { combineArrays } from '../../utils/arrayCombiner';
import { assertCloseToPercentage, getPercentageDiff } from '../../utils/assert';
import {
  callDelta,
  callPrice,
  d1,
  d2,
  putDelta,
  putPrice,
  stdNormal,
  stdNormalCDF,
  stdVega,
  vega,
} from '../../utils/blackScholes';
import { expect } from '../../utils/testSetup';

const defaultParams = {
  timeToExp: WEEK_SEC * 2,
  vol: 0.7,
  spot: 2998.7,
  strike: 3100,
  rate: 0.05,
};

const testData = {
  thorough: {
    timeToExp: [0.00001, 0.0001, 0.001, 1],
    volatility: [0.0002, 0.02, 2, 20, 200, 2000],
    low_spot: [0.000003, 0.0003, 3],
    high_spot: [3e12, 3e16, 3e20],
    low_strikePrice: [0.000007, 0.0007, 7],
    high_strikePrice: [7e12, 7e16, 7e20],
    rate: [-50, -5, -0.05, 0, 0.05, 5, 50],
  },
  quick: {
    timeToExp: [0.00001, 0.0001, 0.001],
    volatility: [0.02, 2],
    low_spot: [0.000003, 0.0003],
    high_spot: [3e12, 3e16],
    low_strikePrice: [0.000007, 0.0007],
    high_strikePrice: [7e12, 7e16],
    rate: [-0.05, 0, 0.05],
  },
};

// NOTE: change this to `thorough` for more test cases, `quick` for less
const dataToTestWith = testData.quick;

const combinedTestDataArrays = [
  ...combineArrays([
    dataToTestWith.timeToExp,
    dataToTestWith.volatility,
    dataToTestWith.low_spot,
    dataToTestWith.low_strikePrice,
    dataToTestWith.rate,
  ]),
  ...combineArrays([
    dataToTestWith.timeToExp,
    dataToTestWith.volatility,
    dataToTestWith.high_spot,
    dataToTestWith.high_strikePrice,
    dataToTestWith.rate,
  ]),
];

function compareResults(
  val1: BigNumber,
  val2: BigNumber,
  results: { good: number; bad: number; unacceptable: number },
  logData: any,
) {
  const diff = getPercentageDiff(val1, val2);
  if (diff.lt(toBN('0.005'))) {
    results.good += 1;
  } else if (diff.lt(toBN('0.05'))) {
    results.bad += 1;
  } else {
    results.unacceptable += 1;
    console.log({
      val1: fromBN(val1),
      val2: fromBN(val2),
      logData,
    });
  }
  return results;
}

describe('BlackScholes - values', () => {
  let account: Signer;
  let blackScholes: BlackScholes;
  let testBlackScholes: TestBlackScholes;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];

    blackScholes = await (await ethers.getContractFactory('BlackScholes')).connect(account).deploy();
    testBlackScholes = (await (
      await ethers.getContractFactory('TestBlackScholes', {
        libraries: {
          BlackScholes: blackScholes.address,
        },
      })
    )
      .connect(account)
      .deploy()) as TestBlackScholes;
  });

  // helper functions basic testing
  describe('ln', async () => {
    const lnTests = [0.000001, 0.001, 0.5, 1, 2, 100, 100000, 250000, 500000, 1000000];

    it('should provide a correct value for a number of cases', async () => {
      for (const val of lnTests) {
        const result = await testBlackScholes.lnPub(toBN(val.toString()));
        const expected = Math.log(val);
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  describe('exp', async () => {
    const expTests = [-1000, -100, -10, -5, -2, 0, 2, 5, 10, 100];
    it('should provide a correct value for a number of cases', async () => {
      for (const val of expTests) {
        const expected = Math.exp(val);
        const result = await testBlackScholes.expPub(toBN(val.toString()));
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });

    it('should revert for values greater than 100', async () => {
      await expect(testBlackScholes.expPub('135305999368893231589')).revertedWith('Overflow');
    });

    it('should return 0 for values under -42.14', async () => {
      expect(await testBlackScholes.expPub('-42139678854452767551')).eq(0);
    });
  });

  //
  describe('sqrt', async () => {
    const sqrtTests = [
      0, 0.00005, 0.0005, 0.005, 0.05, 0.5, 1, 2, 100, 100000, 250000, 500000, 1000000, 9848575333047, 1e10, 1e12, 1e14,
      1e16, 1e18, 1e19,
    ];
    it('should provide a correct value for a number of cases', async () => {
      for (const val of sqrtTests) {
        const result = await testBlackScholes.sqrt_pub(toBN(val.toString()));
        const expected = Math.sqrt(val);
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  // helper functions basic testing
  describe('stdNormal', async () => {
    const stdNormalTests = [-100, -10, -3, -2, 0, 2, 5, 10, 99];
    // TODO: unskip
    it.skip('should provide a correct value for a number of cases', async () => {
      for (const val of stdNormalTests) {
        const expected = stdNormal(val);
        const result = await testBlackScholes.stdNormalCDF_pub(toBN(val.toString()).mul(1e9));
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  // helper functions basic testing
  describe('stdNormalCDF', async () => {
    const stdNormalCDFTests = [-100, -10, -3, -2, 0, 2, 5, 10, 99];

    it('should provide a correct value for a number of cases', async () => {
      for (const val of stdNormalCDFTests) {
        const expected = stdNormalCDF(val);
        const result = await testBlackScholes.stdNormalCDF_pub(toBN(val.toString()).mul(1e9));
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  describe('d1d2', async () => {
    it('calculates d1 with respect to changes in parameters', async () => {
      if (!(global as any).HEAVY_TESTS) {
        return;
      }
      let results = { good: 0, bad: 0, unacceptable: 0 };
      for (const val of combinedTestDataArrays) {
        const [timeToExpiry, volatility, spot, strikePrice, rate] = val;
        const d1d2result = await testBlackScholes.d1d2_pub(
          toBN(timeToExpiry.toString()).mul(1e9),
          toBN(volatility.toString()).mul(1e9),
          toBN(spot.toString()).mul(1e9),
          toBN(strikePrice.toString()).mul(1e9),
          toBN(rate.toString()).mul(1e9),
        );
        const expectedD1 = d1(timeToExpiry, volatility, spot, strikePrice, rate);
        const expectedD2 = d2(timeToExpiry, volatility, spot, strikePrice, rate);

        results = compareResults(d1d2result.d1, toBN(expectedD1.toString()), results, val);
        results = compareResults(d1d2result.d2, toBN(expectedD2.toString()), results, val);

        console.log(results);
      }
    });
  });

  describe('delta - vega - stdVega - optionPrices', async () => {
    it('calculates d1 with respect to changes in parameters', async () => {
      if (!(global as any).HEAVY_TESTS) {
        return;
      }
      let results = { good: 0, bad: 0, unacceptable: 0 };
      for (const val of combinedTestDataArrays) {
        const [timeToExpiry, volatility, spot, strikePrice, rate] = val;
        let greeksResult;
        try {
          greeksResult = await testBlackScholes.pricesDeltaStdVega_pub({
            rateDecimal: toBN(rate.toString()),
            spotDecimal: toBN(spot.toString()),
            strikePriceDecimal: toBN(strikePrice.toString()),
            timeToExpirySec: toBN(timeToExpiry.toString()),
            volatilityDecimal: toBN(volatility.toString()),
          });
        } catch (e) {
          console.log('expectedStdVega', stdVega(timeToExpiry, volatility, spot, strikePrice, rate));

          console.log((e as Error).message);
          console.log(val);
          results.unacceptable += 6;
          console.log(results);
          continue;
        }

        const expectedCallDelta = callDelta(timeToExpiry, volatility, spot, strikePrice, rate);
        const expectedPutDelta = putDelta(timeToExpiry, volatility, spot, strikePrice, rate);
        const expectedCallPrice = callPrice(timeToExpiry, volatility, spot, strikePrice, rate);
        const expectedPutPrice = putPrice(timeToExpiry, volatility, spot, strikePrice, rate);
        const expectedVega = vega(timeToExpiry, volatility, spot, strikePrice, rate);
        const expectedStdVega = stdVega(timeToExpiry, volatility, spot, strikePrice, rate);

        results = compareResults(greeksResult.callDelta, toBN(expectedCallDelta.toString()), results, {
          type: 'callDelta',
          val,
        });
        results = compareResults(greeksResult.putDelta, toBN(expectedPutDelta.toString()), results, {
          type: 'putDelta',
          val,
        });
        results = compareResults(greeksResult.callPrice, toBN(expectedCallPrice.toString()), results, {
          type: 'callPrice',
          val,
        });
        results = compareResults(greeksResult.putPrice, toBN(expectedPutPrice.toString()), results, {
          type: 'putPrice',
          val,
        });
        results = compareResults(greeksResult.vega, toBN(expectedVega.toString()), results, {
          type: 'vega',
          val,
        });
        results = compareResults(greeksResult.stdVega, toBN(expectedStdVega.toString()), results, {
          type: 'stdVega',
          val,
        });

        console.log(results);
      }
    });
  });

  it('can call all the functions', async () => {
    const bsInput: BlackScholesInputsStruct = {
      rateDecimal: toBN(defaultParams.rate.toString()),
      spotDecimal: toBN(defaultParams.spot.toString()),
      strikePriceDecimal: toBN(defaultParams.strike.toString()),
      timeToExpirySec: defaultParams.timeToExp,
      volatilityDecimal: toBN(defaultParams.vol.toString()),
    };
    const timeToExpiry = defaultParams.timeToExp / YEAR_SEC;
    const volatility = defaultParams.vol;
    const spot = defaultParams.spot;
    const strikePrice = defaultParams.strike;
    const rate = defaultParams.rate;

    const expectedCallDelta = toBN(callDelta(timeToExpiry, volatility, spot, strikePrice, rate).toString());
    const expectedPutDelta = toBN(putDelta(timeToExpiry, volatility, spot, strikePrice, rate).toString());
    const expectedCallPrice = toBN(callPrice(timeToExpiry, volatility, spot, strikePrice, rate).toString());
    const expectedPutPrice = toBN(putPrice(timeToExpiry, volatility, spot, strikePrice, rate).toString());
    const expectedStdVega = toBN(stdVega(timeToExpiry, volatility, spot, strikePrice, rate).toString());
    const expectedVega = toBN(vega(timeToExpiry, volatility, spot, strikePrice, rate).toString());

    const pricesDeltaStdVega = await testBlackScholes.pricesDeltaStdVega_pub(bsInput);
    assertCloseToPercentage(pricesDeltaStdVega.callPrice, expectedCallPrice);
    assertCloseToPercentage(pricesDeltaStdVega.putPrice, expectedPutPrice);
    assertCloseToPercentage(pricesDeltaStdVega.callDelta, expectedCallDelta);
    assertCloseToPercentage(pricesDeltaStdVega.putDelta, expectedPutDelta);
    assertCloseToPercentage(pricesDeltaStdVega.stdVega, expectedStdVega);
    assertCloseToPercentage(pricesDeltaStdVega.vega, expectedVega);

    console.log(fromBN(pricesDeltaStdVega.vega));
    console.log(fromBN(pricesDeltaStdVega.stdVega));

    const optionPrices = await testBlackScholes.optionPrices_pub(bsInput);
    expect(optionPrices[0]).eq(pricesDeltaStdVega.callPrice);
    expect(optionPrices[1]).eq(pricesDeltaStdVega.putPrice);

    const deltaRes = await testBlackScholes.delta_pub(bsInput);
    expect(deltaRes[0]).eq(pricesDeltaStdVega.callDelta);
    expect(deltaRes[1]).eq(pricesDeltaStdVega.putDelta);

    const vegaRes = await testBlackScholes.vega_pub(bsInput);
    expect(vegaRes).eq(pricesDeltaStdVega.vega);
  });
});
