import { BigNumber, BigNumberish } from 'ethers';
import { currentTime, MAX_UINT, MONTH_SEC, OptionType, toBN, UNIT, YEAR_SEC } from '../../../scripts/util/web3utils';
import { TestBlackScholes } from '../../../typechain-types';
import { assertCloseToPercentage } from '../../utils/assert';
import { getSpotPrice, resetMinCollateralParameters } from '../../utils/contractHelpers';
import { DEFAULT_GREEK_CACHE_PARAMS, DEFAULT_MIN_COLLATERAL_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { mockPrice } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { deployTestBS } from './3_ForceClosePricing';

describe('OptionGreekCache - Min Collat Pricing', () => {
  let testBlackScholes: TestBlackScholes;

  beforeEach(async () => {
    await seedFixture();
    testBlackScholes = await deployTestBS();
    await mockPrice(hre.f.c, toBN('1000'), 'sETH');
  });

  describe('staticCollat < volCollat < fullCollat', () => {
    it('getShockVol', async () => {
      await seedFixture();
      await resetMinCollateralParameters();

      expect(await getShockVol(0)).eq(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolA);
      expect(await getShockVol(YEAR_SEC)).eq(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolB);
      expect(await getShockVol(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolPointA)).eq(
        DEFAULT_MIN_COLLATERAL_PARAMS.shockVolA,
      );
      expect(await getShockVol(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolPointB)).eq(
        DEFAULT_MIN_COLLATERAL_PARAMS.shockVolB,
      );
      expect(
        await getShockVol(
          getMidpoint(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolPointA, DEFAULT_MIN_COLLATERAL_PARAMS.shockVolPointB),
        ),
      ).eq(getMidpoint(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolA, DEFAULT_MIN_COLLATERAL_PARAMS.shockVolB));
    });

    [OptionType.SHORT_CALL_QUOTE, OptionType.SHORT_PUT_QUOTE].forEach(async optionType => {
      it(`shock price @ various optionTypes: ${OptionType[optionType]}`, async () => {
        const realCollat = await hre.f.c.optionGreekCache.getMinCollateral(
          optionType,
          toBN('1000'),
          (await currentTime()) + MONTH_SEC,
          await getSpotPrice(),
          toBN('1'),
        );

        const expectedCollat = await getBSPremium(
          testBlackScholes,
          await getShockVol(MONTH_SEC),
          optionType,
          toBN('1000'),
          MONTH_SEC,
          await getShockPrice(optionType),
          toBN('1'),
        );

        expect(realCollat).to.gt(DEFAULT_MIN_COLLATERAL_PARAMS.minStaticQuoteCollateral);
        assertCloseToPercentage(realCollat, expectedCollat, toBN('0.001'));

        expect(
          await hre.f.c.optionGreekCache.getMinCollateral(
            optionType,
            toBN('1000'),
            (await currentTime()) + MONTH_SEC,
            await getSpotPrice(),
            0,
          ),
        ).eq(0);
      });
    });

    const prices = [
      {
        increasedCollat: toBN('1500'),
        decreasedCollat: toBN('500'),
      },
      {
        increasedCollat: toBN('1500'),
        decreasedCollat: toBN('500'),
      },
      {
        increasedCollat: toBN('500'),
        decreasedCollat: toBN('1500'),
      },
    ];

    [OptionType.SHORT_CALL_BASE, OptionType.SHORT_CALL_QUOTE, OptionType.SHORT_PUT_QUOTE].forEach(
      async (optionType, index) => {
        it(`correctly adjusts collateral with price moves: ${OptionType[optionType]}`, async () => {
          // price = $1000
          const nominalCollat = await hre.f.c.optionGreekCache.getMinCollateral(
            optionType,
            toBN('1000'),
            (await currentTime()) + MONTH_SEC,
            await getSpotPrice(),
            toBN('5'),
          );
          await expectVolCollat(testBlackScholes, optionType, nominalCollat, toBN('5'));

          // price = $1500
          await mockPrice(hre.f.c, prices[index].increasedCollat, 'sETH');
          const increasedCollat = await hre.f.c.optionGreekCache.getMinCollateral(
            optionType,
            toBN('1000'),
            (await currentTime()) + MONTH_SEC,
            await getSpotPrice(),
            toBN('5'),
          );
          await expectVolCollat(testBlackScholes, optionType, increasedCollat, toBN('5'));

          // price = $500
          await mockPrice(hre.f.c, prices[index].decreasedCollat, 'sETH');
          const decreasedCollat = await hre.f.c.optionGreekCache.getMinCollateral(
            optionType,
            toBN('1000'),
            (await currentTime()) + MONTH_SEC,
            await getSpotPrice(),
            toBN('5'),
          );
          await expectVolCollat(testBlackScholes, optionType, decreasedCollat, toBN('5'));

          expect(nominalCollat).to.lt(increasedCollat);
          expect(nominalCollat).to.gt(decreasedCollat);
        });
      },
    );

    it('more lenient volCollat for base', async () => {
      const baseCollat = await hre.f.c.optionGreekCache.getMinCollateral(
        OptionType.SHORT_CALL_BASE,
        toBN('1000'),
        (await currentTime()) + MONTH_SEC,
        await getSpotPrice(),
        toBN('1'),
      );

      const quoteCollat = await hre.f.c.optionGreekCache.getMinCollateral(
        OptionType.SHORT_CALL_QUOTE,
        toBN('1000'),
        (await currentTime()) + MONTH_SEC,
        await getSpotPrice(),
        toBN('1'),
      );

      expect(quoteCollat).to.gt(baseCollat.mul(await getSpotPrice()).div(UNIT));
      assertCloseToPercentage(
        quoteCollat,
        baseCollat.mul(await getShockPrice(OptionType.SHORT_CALL_BASE)).div(UNIT),
        toBN('0.01'),
      );
    });
  });

  const staticCollat = [
    DEFAULT_MIN_COLLATERAL_PARAMS.minStaticBaseCollateral,
    DEFAULT_MIN_COLLATERAL_PARAMS.minStaticQuoteCollateral,
    DEFAULT_MIN_COLLATERAL_PARAMS.minStaticQuoteCollateral,
  ];

  const fullCollat = [toBN('0.5'), MAX_UINT, toBN('500')];
  [OptionType.SHORT_CALL_BASE, OptionType.SHORT_CALL_QUOTE, OptionType.SHORT_PUT_QUOTE].forEach(
    async (optionType, index) => {
      it(`returns staticCollat when volCollat < staticCollat: ${OptionType[optionType]}`, async () => {
        const collat = await hre.f.c.optionGreekCache.getMinCollateral(
          optionType,
          toBN('1000'),
          (await currentTime()) + MONTH_SEC,
          await getSpotPrice(),
          toBN('0.5'),
        );

        expect(collat).to.lt(fullCollat[index]); // ensure we're not hitting full collat
        expect(collat).to.eq(staticCollat[index]);
      });
    },
  );

  const overrideFullCollat = [toBN('0.1'), MAX_UINT, toBN('100')];
  [OptionType.SHORT_CALL_BASE, OptionType.SHORT_CALL_QUOTE, OptionType.SHORT_PUT_QUOTE].forEach(
    async (optionType, index) => {
      it(`returns fullCollat when volCollat > fullCollat: ${OptionType[optionType]}`, async () => {
        const collat = await hre.f.c.optionGreekCache.getMinCollateral(
          optionType,
          toBN('1000'),
          (await currentTime()) + MONTH_SEC,
          await getSpotPrice(),
          toBN('0.1'),
        );

        // don't expect full collat if short_call_quote
        if (optionType != OptionType.SHORT_CALL_QUOTE) {
          expect(collat).to.eq(overrideFullCollat[index]);
          expect(collat).to.lt(staticCollat[index]);
        } else {
          expect(collat).to.eq(staticCollat[index]);
          expect(collat).to.lt(overrideFullCollat[index]);
        }
      });
    },
  );
});

async function expectVolCollat(
  testBlackScholes: TestBlackScholes,
  optionType: OptionType,
  collat: BigNumber,
  amount: BigNumber,
) {
  let premium = await getBSPremium(
    testBlackScholes,
    await getShockVol(MONTH_SEC),
    optionType,
    toBN('1000'),
    MONTH_SEC,
    await getShockPrice(optionType),
    amount,
  );

  if (optionType == OptionType.SHORT_CALL_BASE) {
    premium = premium.mul(UNIT).div(await getShockPrice(optionType));
  }

  assertCloseToPercentage(premium, collat, toBN('0.001'));
}

async function getBSPremium(
  testBlackScholes: TestBlackScholes,
  vol: BigNumber,
  optionType: OptionType,
  strikePrice: BigNumber,
  expiry: number,
  spotPrice: BigNumber,
  amount: BigNumber,
) {
  const premiums = await testBlackScholes.optionPrices_pub({
    rateDecimal: DEFAULT_GREEK_CACHE_PARAMS.rateAndCarry,
    spotDecimal: spotPrice,
    strikePriceDecimal: strikePrice,
    timeToExpirySec: expiry,
    volatilityDecimal: vol,
  });

  if (optionType != OptionType.SHORT_PUT_QUOTE) {
    return premiums[0].mul(amount).div(UNIT);
  } else {
    return premiums[1].mul(amount).div(UNIT);
  }
}

async function getShockPrice(optionType: OptionType) {
  if (optionType != OptionType.SHORT_PUT_QUOTE) {
    return (await getSpotPrice()).mul(DEFAULT_MIN_COLLATERAL_PARAMS.callSpotPriceShock).div(UNIT);
  } else {
    return (await getSpotPrice()).mul(DEFAULT_MIN_COLLATERAL_PARAMS.putSpotPriceShock).div(UNIT);
  }
}

async function getShockVol(timeToExp: BigNumberish) {
  return hre.f.c.optionGreekCache.getShockVol(timeToExp);
}

function getMidpoint(a: BigNumberish, b: BigNumberish) {
  return BigNumber.from(a).add(BigNumber.from(b).sub(BigNumber.from(b)).div(2));
}
