import {
  DEFAULT_FORCE_CLOSE_PARAMS,
  DEFAULT_GOV_GREEK_CACHE_BOUNDS,
  DEFAULT_GREEK_CACHE_PARAMS,
  DEFAULT_MIN_COLLATERAL_PARAMS,
} from '../../utils/defaultParams';
import { MAX_UINT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('GreekCacheGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.greekCacheGov.setRiskCouncil(RC.address);
    await govWrap.greekCacheGov.setGreekCacheBounds(DEFAULT_GOV_GREEK_CACHE_BOUNDS);
  });

  ///////////
  // Admin //
  ///////////

  it('should be able to set risk council', async () => {
    expect(await govWrap.greekCacheGov.riskCouncil()).eq(hre.f.alice.address);
  });

  it('should NOT be able to set option greek cache again', async () => {
    await expect(govWrap.greekCacheGov.setOptionGreekCache(ZERO_ADDRESS)).revertedWith(
      'OGCGW_OptionGreekCacheAlreadySet',
    );
  });

  it('should be able to forceChangeOwner', async () => {
    expect(await hre.f.gc.optionGreekCache.owner()).eq(govWrap.greekCacheGov.address);
    await govWrap.greekCacheGov.forceChangeOwner(await govWrap.greekCacheGov.optionGreekCache(), RC.address);
    expect(await hre.f.gc.optionGreekCache.owner()).eq(govWrap.greekCacheGov.address);
    expect(await hre.f.gc.optionGreekCache.nominatedOwner()).eq(RC.address);
    await hre.f.gc.optionGreekCache.connect(RC).acceptOwnership();
    expect(await hre.f.gc.optionGreekCache.owner()).eq(RC.address);
  });

  ////////////
  // Params //
  ////////////

  it('can set greek cache parameters', async () => {
    await govWrap.greekCacheGov.setGreekCacheParameters(DEFAULT_GREEK_CACHE_PARAMS);
    // can set to min and max
    await govWrap.greekCacheGov.connect(RC).setGreekCacheParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.minGreekCacheParams);
    await govWrap.greekCacheGov.connect(RC).setGreekCacheParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxGreekCacheParams);
    await expect(
      govWrap.greekCacheGov.connect(hre.f.signers[3]).setGreekCacheParameters(DEFAULT_GREEK_CACHE_PARAMS),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.optionGreekCache.getGreekCacheParams(),
      DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxGreekCacheParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.greekCacheGov.connect(RC).setGreekCacheParameters({
        ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.minGreekCacheParams,
        maxStrikesPerBoard: 0,
      }),
    ).revertedWith('OGCGW_GreekCacheParametersOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.greekCacheGov.connect(RC).setGreekCacheParameters({
        ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxGreekCacheParams,
        maxStrikesPerBoard: MAX_UINT,
      }),
    ).revertedWith('OGCGW_GreekCacheParametersOutOfBounds');

    // owner can bypass
    await govWrap.greekCacheGov.setGreekCacheParameters({
      ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxGreekCacheParams,
      maxStrikesPerBoard: MAX_UINT,
    });
  });

  it('can set force close parameters', async () => {
    await govWrap.greekCacheGov.setForceCloseParameters(DEFAULT_FORCE_CLOSE_PARAMS);
    await govWrap.greekCacheGov.connect(RC).setForceCloseParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.minForceCloseParams);
    await govWrap.greekCacheGov.connect(RC).setForceCloseParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxForceCloseParams);

    await expect(
      govWrap.greekCacheGov
        .connect(hre.f.signers[3])
        .setForceCloseParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.minForceCloseParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.optionGreekCache.getForceCloseParams(),
      DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxForceCloseParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.greekCacheGov.connect(RC).setForceCloseParameters({
        ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.minForceCloseParams,
        shortSpotMin: 0,
      }),
    ).revertedWith('OGCGW_ForceCloseParametersOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.greekCacheGov.connect(RC).setForceCloseParameters({
        ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxForceCloseParams,
        shortSpotMin: MAX_UINT,
      }),
    ).revertedWith('OGCGW_ForceCloseParametersOutOfBounds');

    // owner can bypass bounds
    await govWrap.greekCacheGov.setForceCloseParameters({
      ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.minForceCloseParams,
      shortSpotMin: 0,
    });
  });

  it('can set min collateral params', async () => {
    await govWrap.greekCacheGov.setMinCollateralParameters(DEFAULT_MIN_COLLATERAL_PARAMS);
    await govWrap.greekCacheGov
      .connect(RC)
      .setMinCollateralParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.minMinCollateralParams);
    await govWrap.greekCacheGov
      .connect(RC)
      .setMinCollateralParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxMinCollateralParams);

    await expect(
      govWrap.greekCacheGov
        .connect(hre.f.signers[3])
        .setMinCollateralParameters(DEFAULT_GOV_GREEK_CACHE_BOUNDS.minMinCollateralParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.optionGreekCache.getMinCollatParams(),
      DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxMinCollateralParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.greekCacheGov.connect(RC).setMinCollateralParameters({
        ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.minMinCollateralParams,
        minStaticBaseCollateral: 0,
      }),
    ).revertedWith('OGCGW_MinCollateralParametersOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.greekCacheGov.connect(RC).setMinCollateralParameters({
        ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.maxMinCollateralParams,
        minStaticBaseCollateral: MAX_UINT,
      }),
    ).revertedWith('OGCGW_MinCollateralParametersOutOfBounds');

    // owner can bypass bounds
    await govWrap.greekCacheGov.setMinCollateralParameters({
      ...DEFAULT_GOV_GREEK_CACHE_BOUNDS.minMinCollateralParams,
      minStaticBaseCollateral: 1,
    });
  });

  it('should be able to get greekCache bounds', async () => {
    compareStruct(await govWrap.greekCacheGov.getGreekCacheBounds(), DEFAULT_GOV_GREEK_CACHE_BOUNDS);
  });
});
