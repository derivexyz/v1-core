import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DAY_SEC, HOUR_SEC, MAX_UINT, toBN } from '../../../scripts/util/web3utils';
import {
  ForceCloseParametersStruct,
  GreekCacheParametersStruct,
  MinCollateralParametersStruct,
} from '../../../typechain-types/OptionGreekCache';
import { emptyStrikeObject, emptyTradeObject } from '../../utils/contractHelpers';
import {
  DEFAULT_FORCE_CLOSE_PARAMS,
  DEFAULT_GREEK_CACHE_PARAMS,
  DEFAULT_MIN_COLLATERAL_PARAMS,
} from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

const setGreekCacheParams = async (GreekCacheOverrides?: GreekCacheParametersStruct) => {
  return await hre.f.c.optionGreekCache.setGreekCacheParameters({
    ...DEFAULT_GREEK_CACHE_PARAMS,
    ...(GreekCacheOverrides || {}),
  });
};

const expectInvalidGreekParams = async (overrides?: any) => {
  await expect(setGreekCacheParams(overrides)).revertedWith('InvalidGreekCacheParameters');
};

const setForceCloseParams = async (forceCloseOverrides?: ForceCloseParametersStruct) => {
  return await hre.f.c.optionGreekCache.setForceCloseParameters({
    ...DEFAULT_FORCE_CLOSE_PARAMS,
    ...(forceCloseOverrides || {}),
  });
};

const expectInvalidForceCloseParams = async (overrides?: any) => {
  await expect(setForceCloseParams(overrides)).revertedWith('InvalidForceCloseParameters');
};

const setMinCollateralParams = async (minCollateralOverrides?: MinCollateralParametersStruct) => {
  return await hre.f.c.optionGreekCache.setMinCollateralParameters({
    ...DEFAULT_MIN_COLLATERAL_PARAMS,
    ...(minCollateralOverrides || {}),
  });
};

const expectInvalidMinCollateralParams = async (overrides?: any) => {
  await expect(setMinCollateralParams(overrides)).revertedWith('InvalidMinCollatParams');
};

describe('OptionGreekCache - Admin', async () => {
  beforeEach(seedFixture);
  describe('Initialization', async () => {
    it('cannot init twice', async () => {
      await expect(
        hre.f.c.optionGreekCache.init(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWith('AlreadyInitialised');
    });
  });

  describe('GreekCacheParameters', async () => {
    it('updates params', async () => {
      const modParams = {
        acceptableSpotPricePercentMove: toBN('1'),
        staleUpdateDuration: 29 * DAY_SEC,
        varianceIvGWAVPeriod: 500 * HOUR_SEC,
        varianceSkewGWAVPeriod: 500 * HOUR_SEC,
        optionValueIvGWAVPeriod: 500 * HOUR_SEC,
        optionValueSkewGWAVPeriod: 500 * HOUR_SEC,
        gwavSkewFloor: 1,
        gwavSkewCap: toBN('1'),
        rateAndCarry: toBN('25'),
      } as GreekCacheParametersStruct;

      const oldParams = await hre.f.c.optionGreekCache.getGreekCacheParams();
      await setGreekCacheParams(modParams);
      const newParams = await hre.f.c.optionGreekCache.getGreekCacheParams();

      // Verify all parameters updated as expected
      expect(oldParams.acceptableSpotPricePercentMove).not.eq(newParams.acceptableSpotPricePercentMove);
      expect(newParams.acceptableSpotPricePercentMove).eq(modParams.acceptableSpotPricePercentMove);

      expect(oldParams.staleUpdateDuration).not.eq(newParams.staleUpdateDuration);
      expect(newParams.staleUpdateDuration).eq(modParams.staleUpdateDuration);

      expect(oldParams.varianceIvGWAVPeriod).not.eq(newParams.varianceIvGWAVPeriod);
      expect(newParams.varianceIvGWAVPeriod).eq(modParams.varianceIvGWAVPeriod);

      expect(oldParams.varianceSkewGWAVPeriod).not.eq(newParams.varianceSkewGWAVPeriod);
      expect(newParams.varianceSkewGWAVPeriod).eq(modParams.varianceSkewGWAVPeriod);

      expect(oldParams.optionValueIvGWAVPeriod).not.eq(newParams.optionValueIvGWAVPeriod);
      expect(newParams.optionValueIvGWAVPeriod).eq(modParams.optionValueIvGWAVPeriod);

      expect(oldParams.optionValueSkewGWAVPeriod).not.eq(newParams.optionValueSkewGWAVPeriod);
      expect(newParams.optionValueSkewGWAVPeriod).eq(modParams.optionValueSkewGWAVPeriod);

      expect(oldParams.gwavSkewFloor).not.eq(newParams.gwavSkewFloor);
      expect(newParams.gwavSkewFloor).eq(modParams.gwavSkewFloor);

      expect(oldParams.gwavSkewCap).not.eq(newParams.gwavSkewCap);
      expect(newParams.gwavSkewCap).eq(modParams.gwavSkewCap);

      expect(oldParams.rateAndCarry).not.eq(newParams.rateAndCarry);
      expect(newParams.rateAndCarry).eq(modParams.rateAndCarry);
    });

    it('GreekCacheParameters Reverts', async () => {
      await expectInvalidGreekParams({ acceptableSpotPricePercentMove: toBN('10').add(1) });
      await expectInvalidGreekParams({ staleUpdateDuration: DAY_SEC * 31 });
      await expectInvalidGreekParams({ varianceIvGWAVPeriod: 60 * DAY_SEC + 1 });
      await expectInvalidGreekParams({ optionValueIvGWAVPeriod: 60 * DAY_SEC + 1 });
      await expectInvalidGreekParams({ optionValueSkewGWAVPeriod: 60 * DAY_SEC + 1 });
      await expectInvalidGreekParams({ optionValueSkewGWAVPeriod: 0 });
      await expectInvalidGreekParams({ gwavSkewFloor: toBN('1').add(1) });
      await expectInvalidGreekParams({ gwavSkewFloor: 0 });
      await expectInvalidGreekParams({ rateAndCarry: toBN('50').add(1) });
      await expectInvalidGreekParams({ rateAndCarry: toBN('-50').sub(1) });
    });
  });

  describe('ForceCloseParameters', async () => {
    it('initializers and updates params', async () => {
      const newParams = {
        ...DEFAULT_FORCE_CLOSE_PARAMS,
        ivGWAVPeriod: 42 * DAY_SEC,
        skewGWAVPeriod: 42 * DAY_SEC,
        shortVolShock: toBN('2'),
        shortPostCutoffVolShock: toBN('2'),
        longVolShock: toBN('0.7'),
        longPostCutoffVolShock: toBN('0.8'),
        liquidateVolShock: toBN('2'),
        shortSpotMin: toBN('0.8'),
        longSpotMin: toBN('0.8'),
        liquidatePostCutoffVolShock: toBN('2'),
        liquidateSpotMin: toBN('0.8'),
      } as ForceCloseParametersStruct;

      await setForceCloseParams(newParams);

      const modParams = await hre.f.c.optionGreekCache.getForceCloseParams();

      expect(DEFAULT_FORCE_CLOSE_PARAMS.ivGWAVPeriod).not.eq(newParams.ivGWAVPeriod);
      expect(newParams.ivGWAVPeriod).eq(modParams.ivGWAVPeriod);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.skewGWAVPeriod).not.eq(newParams.skewGWAVPeriod);
      expect(newParams.skewGWAVPeriod).eq(modParams.skewGWAVPeriod);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.shortVolShock).not.eq(newParams.shortVolShock);
      expect(newParams.shortVolShock).eq(modParams.shortVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.shortPostCutoffVolShock).not.eq(newParams.shortPostCutoffVolShock);
      expect(newParams.shortPostCutoffVolShock).eq(modParams.shortPostCutoffVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.longVolShock).not.eq(newParams.longVolShock);
      expect(newParams.longVolShock).eq(modParams.longVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.longPostCutoffVolShock).not.eq(newParams.longPostCutoffVolShock);
      expect(newParams.longPostCutoffVolShock).eq(modParams.longPostCutoffVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.liquidatePostCutoffVolShock).not.eq(newParams.liquidatePostCutoffVolShock);
      expect(newParams.liquidatePostCutoffVolShock).eq(modParams.liquidatePostCutoffVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.liquidateVolShock).not.eq(newParams.liquidateVolShock);
      expect(newParams.liquidateVolShock).eq(modParams.liquidateVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.liquidatePostCutoffVolShock).not.eq(newParams.liquidatePostCutoffVolShock);
      expect(newParams.liquidatePostCutoffVolShock).eq(modParams.liquidatePostCutoffVolShock);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.shortSpotMin).not.eq(newParams.shortSpotMin);
      expect(newParams.shortSpotMin).eq(modParams.shortSpotMin);

      expect(DEFAULT_FORCE_CLOSE_PARAMS.liquidateSpotMin).not.eq(newParams.liquidateSpotMin);
      expect(newParams.liquidateSpotMin).eq(modParams.liquidateSpotMin);
    });

    it('revert testing for forceClose parameters', async () => {
      await expectInvalidForceCloseParams({ ivGWAVPeriod: 0 });
      await expectInvalidForceCloseParams({ ivGWAVPeriod: 60 * DAY_SEC + 1 });
      await expectInvalidForceCloseParams({ skewGWAVPeriod: 0 });
      await expectInvalidForceCloseParams({ skewGWAVPeriod: 60 * DAY_SEC + 1 });
      await expectInvalidForceCloseParams({ shortVolShock: toBN('1').sub(1) });
      await expectInvalidForceCloseParams({ shortPostCutoffVolShock: 0 });
      await expectInvalidForceCloseParams({ longVolShock: 0 });
      await expectInvalidForceCloseParams({ longVolShock: toBN('1').add(1) });
      await expectInvalidForceCloseParams({ longPostCutoffVolShock: 0 });
      await expectInvalidForceCloseParams({ longPostCutoffVolShock: toBN('1').add(1) });
      await expectInvalidForceCloseParams({ liquidateVolShock: 0 });
      await expectInvalidForceCloseParams({ liquidatePostCutoffVolShock: 0 });
      await expectInvalidForceCloseParams({ shortSpotMin: toBN('1').add(1) });
      await expectInvalidForceCloseParams({ liquidateSpotMin: toBN('1').add(1) });
    });
  });

  describe('MinCollateralParameters', async () => {
    it('updates params', async () => {
      const newParams = {
        ...DEFAULT_MIN_COLLATERAL_PARAMS,
        callSpotPriceShock: toBN('2'),
        minStaticQuoteCollateral: toBN('0.8'),
        putSpotPriceShock: toBN('1'),
        minStaticBaseCollateral: toBN('0.8'),
        shockVolA: toBN('0.06'),
        shockVolPointA: 0,
        shockVolB: toBN('0.01'),
        shockVolPointB: MAX_UINT,
      } as MinCollateralParametersStruct;

      await setMinCollateralParams(newParams);

      const modParams = await hre.f.c.optionGreekCache.getMinCollatParams();

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.minStaticQuoteCollateral).not.eq(newParams.minStaticQuoteCollateral);
      expect(newParams.minStaticQuoteCollateral).eq(modParams.minStaticQuoteCollateral);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.minStaticBaseCollateral).not.eq(newParams.minStaticBaseCollateral);
      expect(newParams.minStaticBaseCollateral).eq(modParams.minStaticBaseCollateral);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolA).not.eq(newParams.shockVolA);
      expect(newParams.shockVolA).eq(modParams.shockVolA);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolPointA).not.eq(newParams.shockVolPointA);
      expect(newParams.shockVolPointA).eq(modParams.shockVolPointA);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolB).not.eq(newParams.shockVolB);
      expect(newParams.shockVolB).eq(modParams.shockVolB);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.shockVolPointB).not.eq(newParams.shockVolPointB);
      expect(newParams.shockVolPointB).eq(modParams.shockVolPointB);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.callSpotPriceShock).not.eq(newParams.callSpotPriceShock);
      expect(newParams.callSpotPriceShock).eq(modParams.callSpotPriceShock);

      expect(DEFAULT_MIN_COLLATERAL_PARAMS.putSpotPriceShock).not.eq(newParams.putSpotPriceShock);
      expect(newParams.putSpotPriceShock).eq(modParams.putSpotPriceShock);
    });

    it('min collateral reverts if passed incorrect parameters', async () => {
      await expectInvalidMinCollateralParams({ minStaticQuoteCollateral: 0 });
      await expectInvalidMinCollateralParams({ minStaticBaseCollateral: 0 });
      await expectInvalidMinCollateralParams({ shockVolA: 0 });
      await expectInvalidMinCollateralParams({ shockVolA: 1, shockVolB: 2 });
      await expectInvalidMinCollateralParams({ shockVolPointA: 1, shockVolPointB: 0 });
      await expectInvalidMinCollateralParams({ callSpotPriceShock: toBN('0.1') });
      await expectInvalidMinCollateralParams({ putSpotPriceShock: toBN('1').add(1) });
    });
  });

  it('Misc', async () => {
    await expect(
      hre.f.c.optionGreekCache.updateStrikeExposureAndGetPrice(emptyStrikeObject, emptyTradeObject, 0, 0, true),
    ).revertedWith('OnlyOptionMarketPricer');
  });
});
