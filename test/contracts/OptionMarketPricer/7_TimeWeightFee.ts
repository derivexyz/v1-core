import { currentTime, DAY_SEC, MONTH_SEC, toBN, WEEK_SEC, YEAR_SEC } from '../../../scripts/util/web3utils';
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

  // test a range of dates from 1 sec to 2 years
  it.skip('...', async () => {
    // const pointA = await currentTime();
    // const pointB = (await currentTime()) + 1;
    // const expiryTarget = (await currentTime()) + YEAR_SEC;
  }); // test range of timeToExpiry = [1 sec to 2 years]
});
