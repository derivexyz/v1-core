import { currentTime, DAY_SEC, HOUR_SEC, MONTH_SEC, toBN, WEEK_SEC, YEAR_SEC } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('getTimeWeightedFee', async () => {
  const pointA: number = WEEK_SEC;
  const pointB: number = MONTH_SEC;

  beforeEach(seedFixture);

  it('long dated option fee higher than short dated option fee', async () => {
    // get timestamp
    const expiry1x = (await currentTime()) + WEEK_SEC;
    const expiry1_5x = (await currentTime()) + WEEK_SEC + 1.5 * WEEK_SEC;
    const expiry2x = (await currentTime()) + MONTH_SEC;
    const expiry3x = (await currentTime()) + MONTH_SEC + 3 * WEEK_SEC;

    const res1x = await hre.f.c.optionMarketPricer.getTimeWeightedFee(expiry1x, pointA, pointB, toBN('1'));
    const res1_5x = await hre.f.c.optionMarketPricer.getTimeWeightedFee(expiry1_5x, pointA, pointB, toBN('1'));
    const res2x = await hre.f.c.optionMarketPricer.getTimeWeightedFee(expiry2x, pointA, pointB, toBN('1'));
    const res3x = await hre.f.c.optionMarketPricer.getTimeWeightedFee(expiry3x, pointA, pointB, toBN('1'));

    expect(res1x).eq(toBN('1'));
    expect(res1_5x).eq(toBN('1.5'));
    expect(res2x).eq(toBN('2'));
    expect(res3x).eq(toBN('3'));
  });

  it('time weighted option factor floors at 1', async () => {
    // floor in this case would be immediate expiry
    const expiry = (await currentTime()) + DAY_SEC;

    const factor = await hre.f.c.optionMarketPricer.getTimeWeightedFee(expiry, pointA, pointB, toBN('2'));
    expect(factor).eq(toBN('2')); // as curTime < pointA
  });

  it('reverts if strike expired', async () => {
    // get timestamp
    const pointA = (await currentTime()) + WEEK_SEC;
    const pointB = (await currentTime()) + MONTH_SEC * 6;
    const expiry = (await currentTime()) - DAY_SEC;

    await expect(hre.f.c.optionMarketPricer.getTimeWeightedFee(expiry, pointA, pointB, toBN('1'))).to.be.reverted;
  });

  it('returns 0 fee if coefficient is 0', async () => {
    // get timestamp
    const longExpiry = (await currentTime()) + YEAR_SEC;
    expect(await hre.f.c.optionMarketPricer.getTimeWeightedFee(await currentTime(), pointA, pointB, 0)).to.be.eq('0');
    expect(await hre.f.c.optionMarketPricer.getTimeWeightedFee(longExpiry, pointA, pointB, 0)).to.be.eq('0');
  });

  it('range of dates from 1sec to 2years', async () => {
    const coefficient = toBN('10');
    const pointA = DAY_SEC;
    const pointB = MONTH_SEC;
    const slope = toBN('10').div(MONTH_SEC - DAY_SEC);

    const dates = [1, HOUR_SEC, DAY_SEC, WEEK_SEC, MONTH_SEC, YEAR_SEC];
    const expectedFactors = [
      coefficient,
      coefficient,
      coefficient,
      coefficient.add(slope.mul(WEEK_SEC - DAY_SEC)),
      coefficient.mul(2),
      coefficient.add(slope.mul(YEAR_SEC - DAY_SEC)),
    ];

    for (let i = 0; i < dates.length; i++) {
      const time = (await currentTime()) + dates[i];
      const factor = await hre.f.c.optionMarketPricer.getTimeWeightedFee(time, pointA, pointB, coefficient);
      assertCloseToPercentage(expectedFactors[i], factor, toBN('0.00001'));
    }
  });
});
