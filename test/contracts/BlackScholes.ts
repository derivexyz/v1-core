import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { DAY_SEC, fromBN, toBN, YEAR_SEC } from '../../scripts/util/web3utils';
import { TestBlackScholes } from '../../typechain';
import { assertCloseTo, assertCloseToPercentage } from '../utils';
import { callPrice, d1, d2, optionPrices, putPrice, stdNormalCDF } from '../utils/blackScholes';
import { expect } from '../utils/testSetup';

type BigNumberFive = [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

describe('BlackScholes - values', () => {
  let account: Signer;
  let testBlackScholes: TestBlackScholes;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    testBlackScholes = (await (await ethers.getContractFactory('TestBlackScholes'))
      .connect(account)
      .deploy()) as TestBlackScholes;
  });

  // helper functions basic testing
  describe('ln', async () => {
    const lnTests = [0.5, 1, 2, 100, 100000, 250000, 500000, 1000000];

    it('should provide a correct value for a number of cases', async () => {
      for (const val of lnTests) {
        const result = await testBlackScholes.ln_pub(toBN(val.toString()).mul(1e9));
        const expected = Math.log(val);
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  // helper functions basic testing
  describe('n', async () => {
    const nTests = [-100, -10, -3, -2, 0, 2, 5, 10, 99];

    it('should provide a correct value for a number of cases', async () => {
      for (const val of nTests) {
        const expected = stdNormalCDF(val);
        const result = await testBlackScholes.stdNormalCDF_pub(toBN(val.toString()).mul(1e9));
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  describe('exp', async () => {
    const expTests = [-1000, -100, -10, -5, -2, 0, 2, 5, 10, 100];
    it('should provide a correct value for a number of cases', async () => {
      for (const val of expTests) {
        const expected = Math.exp(val);
        const result = await testBlackScholes.exp_pub(toBN(val.toString()).mul(1e9));
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });

    it('should revert for values greater than 100', async () => {
      await expect(testBlackScholes.exp_pub(toBN('100').mul(1e9).add(1))).revertedWith(
        'cannot handle exponents greater than 100',
      );
    });
  });

  //
  describe('sqrt', async () => {
    const sqrtTests = [
      0,
      0.00005,
      0.0005,
      0.005,
      0.05,
      0.5,
      1,
      2,
      100,
      100000,
      250000,
      500000,
      1000000,
      9848575333047,
      1e10,
      1e12,
      1e14,
      1e16,
      1e18,
      1e19,
    ];
    it('should provide a correct value for a number of cases', async () => {
      for (const val of sqrtTests) {
        const result = await testBlackScholes.sqrt_pub(toBN(val.toString()));
        const expected = Math.sqrt(val);
        assertCloseToPercentage(result, toBN(expected.toString()));
      }
    });
  });

  describe('d1d2', async () => {
    const timeToExp = [
      // 0,
      0.00005,
      0.0005,
      0.005,
      0.05,
      0.5,
      1,
      2,
      100,
      100000,
      250000,
      500000,
      1000000,
      9848575333047,
      1e10,
      1e12,
      1e14,
      1e16,
      1e18,
      1e19,
    ];
    it('calculates d1 with respect to changes in time to expiry', async () => {
      for (const val of timeToExp) {
        const volatility = toBN('1');
        const spot = toBN('2000');
        const strike = toBN('2000');
        const rate = toBN('0.1');
        const result = await testBlackScholes.d1d2_pub(
          toBN(val.toString()).mul(1e9),
          volatility.mul(1e9),
          spot.mul(1e9),
          strike.mul(1e9),
          rate.mul(1e9),
        );
        const expectedD1 = d1(
          val,
          parseFloat(fromBN(volatility)),
          parseFloat(fromBN(spot)),
          parseFloat(fromBN(strike)),
          parseFloat(fromBN(rate)),
        );
        const expectedD2 = d2(
          val,
          parseFloat(fromBN(volatility)),
          parseFloat(fromBN(spot)),
          parseFloat(fromBN(strike)),
          parseFloat(fromBN(rate)),
        );

        assertCloseToPercentage(result.d1, toBN(expectedD1.toString()));
        assertCloseToPercentage(result.d2, toBN(expectedD2.toString()));
      }
    });
  });

  describe('optionPrices - spot == strike', async () => {
    const timeToExp = [
      // 0,
      1,
      2,
      100,
      100000,
      250000,
      500000,
      1000000,
      9848575333047,
    ];
    it('calculates optionPrices with respect to changes in time to expiry', async () => {
      for (const val of timeToExp) {
        const volatility = toBN('1');
        const spot = toBN('2000');
        const strike = toBN('2000');
        const rate = toBN('0.1');
        const result = await testBlackScholes.optionPrices(val, volatility, spot, strike, rate);

        const tAnnualised = val / YEAR_SEC;
        const expectedCall = callPrice(tAnnualised, 1, 2000, 2000, 0.1);
        const expectedPut = putPrice(tAnnualised, 1, 2000, 2000, 0.1);

        assertCloseToPercentage(toBN(expectedCall.toString()), result.call, toBN('0.008'));
        assertCloseToPercentage(toBN(expectedPut.toString()), result.put, toBN('0.008'));
      }
    });

    it('calculates somewhat correctly for 0', async () => {
      const volatility = toBN('1');
      const spot = toBN('2000');
      const strike = toBN('2000');
      const rate = toBN('0.1');
      const result = await testBlackScholes.optionPrices(0, volatility, spot, strike, rate);

      expect(result.call).to.eq(toBN('0.142811097320000000'));
      expect(result.put).to.eq(toBN('0.142811097320000000'));
    });
  });
});

describe('BlackScholes', () => {
  let blackScholes: TestBlackScholes;
  let account1: Signer;
  // let optionMarketPricer: OptionMarketPricer;

  before(async () => {
    [account1] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const bsFactory = await ethers.getContractFactory('TestBlackScholes');
    blackScholes = (await bsFactory.connect(account1).deploy()) as TestBlackScholes;

    // const opFactory = await ethers.getContractFactory('OptionMarketPricer');
    // optionMarketPricer = (await opFactory.connect(account1).deploy()) as OptionMarketPricer;
  });
  describe('Option Pricing and Greeks', async () => {
    describe('d1d2', async () => {
      it('Produces the correct result on example data', async () => {
        const t = DAY_SEC * 30,
          vol = 0.5,
          spot = 1000,
          strike = 1100,
          rate = -0.03;
        const args = bsInputs(t, vol, spot, strike, rate, true);

        const d1d2 = await blackScholes.d1d2_pub(...args);
        const trueD1 = d1d2.d1;
        const trueD2 = d1d2.d2;

        const expectedD1 = d1(t / YEAR_SEC, vol, spot, strike, rate);
        const expectedD2 = d2(t / YEAR_SEC, vol, spot, strike, rate);

        assertCloseTo(trueD1, toBN(expectedD1.toString()));
        assertCloseTo(trueD2, toBN(expectedD2.toString()));
      });

      it('Alternative data', async () => {
        const t = DAY_SEC * 12,
          vol = 2.0,
          spot = 20,
          strike = 10,
          rate = -2.0;
        const args = bsInputs(t, vol, spot, strike, rate, true);

        const d1d2 = await blackScholes.d1d2_pub(...args);
        const trueD1 = d1d2.d1;
        const trueD2 = d1d2.d2;

        const expectedD1 = 1.911398648;
        const expectedD2 = 1.548759917;

        assertCloseTo(trueD1, toBN(expectedD1.toString()));
        assertCloseTo(trueD2, toBN(expectedD2.toString()));
      });

      it('d2 < d1 < 0 if spot << strike', async () => {
        const args = bsInputs(DAY_SEC * 30, 0.5, 1000, 1100, 0.03, true);
        const d1d2 = await blackScholes.d1d2_pub(...args);

        const expectedD1 = d1((DAY_SEC * 30) / YEAR_SEC, 0.5, 1000, 1100, 0.03);
        const expectedD2 = d2((DAY_SEC * 30) / YEAR_SEC, 0.5, 1000, 1100, 0.03);

        expect(d1d2.d1.lt(0)).to.be.true;
        expect(d1d2.d2.lt(0)).to.be.true;
        expect(d1d2.d2.lt(d1d2.d1)).to.be.true;
        assertCloseTo(d1d2.d1, toBN(expectedD1.toString()));
        assertCloseTo(d1d2.d2, toBN(expectedD2.toString()));
      });

      it('0 < d2 < d1 if strike << spot', async () => {
        const args = bsInputs(DAY_SEC * 30, 0.5, 1100, 500, 0.03, true);
        const d1d2 = await blackScholes.d1d2_pub(...args);
        expect(d1d2.d1.gt(0)).to.be.true;
        expect(d1d2.d2.gt(0)).to.be.true;
        expect(d1d2.d2.lt(d1d2.d1)).to.be.true;
      });

      it('when 0 < d1 < vol * sqrt(t), d2 < 0 < d1', async () => {
        const args = bsInputs(DAY_SEC * 30, 0.5, 1001, 1000, 0.03, true);
        const d1d2 = await blackScholes.d1d2_pub(...args);
        expect(d1d2.d1.gt(0)).to.be.true;
        expect(d1d2.d2.lt(0)).to.be.true;
        expect(d1d2.d2.lt(d1d2.d1)).to.be.true;

        // The symmetric case, with d1 < 0 < d2 cannot occur, as d2 is strictly
        // less than d1 at all times.
      });

      it('swapping spot and strike with zero rate yields swapped and negated results', async () => {
        const t = DAY_SEC * 30,
          vol = 0.5,
          spot = 1000,
          strike = 1100,
          rate = 0;
        let args = bsInputs(t, vol, spot, strike, rate, true);
        const d1d2_1 = await blackScholes.d1d2_pub(...args);

        args = bsInputs(t, vol, strike, spot, rate, true);
        const d1d2_2 = await blackScholes.d1d2_pub(...args);

        assertCloseTo(d1d2_1.d1, d1d2_2.d2.mul(-1));
        assertCloseTo(d1d2_1.d2, d1d2_2.d1.mul(-1));
      });
    });

    describe('Prices', async () => {
      const defaultTime = 30 * DAY_SEC,
        defaultVolatility = 1,
        defaultSpot = 1000,
        defaultStrike = 1100,
        defaultRate = 0.03;

      it('Basic values give the proper result', async () => {
        const args = bsInputs(defaultTime, defaultVolatility, defaultSpot, defaultStrike, defaultRate, false);

        const prices = await blackScholes.optionPrices(...args);
        const call = prices[0];
        const put = prices[1];

        const expectedPrices = optionPrices(
          annualise(defaultTime),
          defaultVolatility,
          defaultSpot,
          defaultStrike,
          defaultRate,
        );

        assertCloseToPercentage(call, toBN(expectedPrices[0].toString()));
        assertCloseToPercentage(put, toBN(expectedPrices[1].toString()));
      });

      it('Basic values give the proper result', async () => {
        const args = bsInputs(2 * DAY_SEC, 2, 10000, 9052, -15, false);

        const prices = await blackScholes.optionPrices(...args);
        const call = prices[0];
        const put = prices[1];

        assertCloseToPercentage(call, toBN('675.3066775'));
        assertCloseToPercentage(put, toBN('502.7372001'));
      });

      it('Inverting spot and strike with no risk free rate swaps the prices', async () => {
        let args = bsInputs(defaultTime, defaultVolatility, defaultSpot, defaultStrike, 0, false);
        const pricesA = await blackScholes.optionPrices(...args);

        args = bsInputs(defaultTime, defaultVolatility, defaultStrike, defaultSpot, 0, false);
        const pricesB = await blackScholes.optionPrices(...args);

        assertCloseToPercentage(pricesA.call, pricesB.put);
        assertCloseToPercentage(pricesA.put, pricesB.call);
      });

      it('range of prices', async () => {
        for (let magnitude = 0; magnitude <= 9; magnitude++) {
          const price = 10 ** magnitude;

          const args = bsInputs(defaultTime, defaultVolatility, price, price * 1.1, defaultRate, false);

          const prices = await blackScholes.optionPrices(...args);
          const expectedPrices = optionPrices(
            annualise(defaultTime),
            defaultVolatility,
            price,
            price * 1.1,
            defaultRate,
          );

          assertCloseToPercentage(prices[0], toBN(expectedPrices[0].toString()));
          assertCloseToPercentage(prices[1], toBN(expectedPrices[1].toString()));
        }
      });
    });
  });
});

/*
 * Test-specific utility functions
 */

function annualise(seconds: number): number {
  return seconds / YEAR_SEC;
}

// Converts black scholes inputs from floats
// to a BigNumber form appropriate to feed into the smart contracts,
// optionally annualising the time input, which is otherwise an
// integer quantity of seconds.
function bsInputs(
  tSeconds: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number,
  precise: boolean = false,
): BigNumberFive {
  const c = precise ? (x: number) => toBN(x.toString()).mul(1e9) : (x: number) => toBN(x.toString());
  return [precise ? c(annualise(tSeconds)) : BigNumber.from(tSeconds), c(vol), c(spot), c(strike), c(rate)];
}
