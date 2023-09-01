import { DEFAULT_GOV_GMX_ADAPTER_BOUNDS } from '../../utils/defaultParams';
import { toBN, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';

describe('GMXAdapterGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;

  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.gmxAdapterGov.setRiskCouncil(RC.address);
    await govWrap.gmxAdapterGov.setGMXAdapterBounds(hre.f.gc.optionMarket.address, DEFAULT_GOV_GMX_ADAPTER_BOUNDS);
  });

  ///////////
  // Param //
  ///////////

  it('set vault contract', async () => {
    await govWrap.gmxAdapterGov.setVaultContract(hre.f.gc.liquidityPool.address);
    expect(await hre.f.gc.GMXAdapter.vault()).eq(hre.f.gc.liquidityPool.address);
  });

  it('set market paused', async () => {
    await govWrap.gmxAdapterGov.setMarketPaused(hre.f.gc.optionMarket.address, true);
    await govWrap.gmxAdapterGov.enableRiskCouncilAdapterPausing(false);

    // revert when risk council tries to set market paused but its blocked
    await expect(
      govWrap.gmxAdapterGov.connect(RC).setMarketPaused(hre.f.gc.optionMarket.address, true),
    ).to.be.revertedWith('GMXAGW_RiskCouncilCannotPauseMarket');

    // set bounds to allow for pausing
    await govWrap.gmxAdapterGov.enableRiskCouncilAdapterPausing(true);
    await govWrap.gmxAdapterGov.connect(RC).setMarketPaused(hre.f.gc.optionMarket.address, true);
  });

  it('set global paused', async () => {
    await govWrap.gmxAdapterGov.setGlobalPaused(true);

    await govWrap.gmxAdapterGov.enableRiskCouncilAdapterPausing(false);
    // revert when risk council tries to set global paused but its blocked
    await expect(govWrap.gmxAdapterGov.connect(RC).setGlobalPaused(true)).to.be.revertedWith(
      'GMXAGW_RiskCouncilCannotPauseGlobal',
    );

    // await enable pausing
    await govWrap.gmxAdapterGov.enableRiskCouncilAdapterPausing(true);
    await govWrap.gmxAdapterGov.connect(RC).setGlobalPaused(true);
  });

  it('set risk free rate', async () => {
    await govWrap.gmxAdapterGov.setRiskFreeRate(hre.f.gc.optionMarket.address, toBN('25'));
    expect(govWrap.gmxAdapterGov.connect(RC).setRiskFreeRate(hre.f.gc.optionMarket.address, toBN('0.15')));

    await expect(
      govWrap.gmxAdapterGov.connect(RC).setRiskFreeRate(hre.f.gc.optionMarket.address, toBN('25')),
    ).to.be.revertedWith('GMXAGW_RiskFeeRateBoundsInvalid');
  });

  it('set chainlink feed', async () => {
    const newFeed = await (await ethers.getContractFactory('MockAggregatorV2V3')).deploy();
    await newFeed.setDecimals(18);
    await govWrap.gmxAdapterGov.setChainlinkFeed(hre.f.gc.gmx.eth.address, newFeed.address);
    expect(await hre.f.gc.GMXAdapter.chainlinkFeeds(hre.f.gc.gmx.eth.address)).eq(newFeed.address);
  });

  /////////////
  // Reverts //
  /////////////

  it('set market pricing params', async () => {
    await govWrap.gmxAdapterGov.setMarketPricingParams(
      hre.f.gc.optionMarket.address,
      DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams,
    );
    await govWrap.gmxAdapterGov
      .connect(RC)
      .setMarketPricingParams(hre.f.gc.optionMarket.address, DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams);

    // Should revert if risk council over bound
    await expect(
      govWrap.gmxAdapterGov.connect(RC).setMarketPricingParams(hre.f.gc.optionMarket.address, {
        ...DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams,
        staticSwapFeeEstimate: toBN('100'),
      }),
    ).to.be.revertedWith('GMXAGW_MarketPricingParams');

    // should revert if risk council under bounds
    await expect(
      govWrap.gmxAdapterGov.connect(RC).setMarketPricingParams(hre.f.gc.optionMarket.address, {
        ...DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams,
        staticSwapFeeEstimate: toBN('0.00001'),
      }),
    ).to.be.revertedWith('GMXAGW_MarketPricingParams');

    // Should revert if risk council over bound for chainlink staleness check
    await expect(
      govWrap.gmxAdapterGov.connect(RC).setMarketPricingParams(hre.f.gc.optionMarket.address, {
        ...DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams,
        chainlinkStalenessCheck: toBN('7201'),
      }),
    ).to.be.revertedWith('GMXAGW_MarketPricingParams');

    // should revert if risk council under bounds for chainlink staleness check
    await expect(
      govWrap.gmxAdapterGov.connect(RC).setMarketPricingParams(hre.f.gc.optionMarket.address, {
        ...DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams,
        chainlinkStalenessCheck: toBN('300'),
      }),
    ).to.be.revertedWith('GMXAGW_MarketPricingParams');
  });

  it('should NOT be able to set liquidity pool', async () => {
    await expect(govWrap.gmxAdapterGov.setGMXAdapter(ZERO_ADDRESS)).revertedWith('GMXAGW_GMXAdapterAlreadySet');
  });

  it('should revert if staticSwapFeeEstimate is over the upper bound', async () => {
    const upperBound = DEFAULT_GOV_GMX_ADAPTER_BOUNDS.maxMarketPricingParams;
    const invalidValue = ethers.utils.parseUnits('100', 18);
    await expect(
      govWrap.gmxAdapterGov
        .connect(RC)
        .setMarketPricingParams(hre.f.gc.optionMarket.address, { ...upperBound, staticSwapFeeEstimate: invalidValue }),
    ).to.be.revertedWith('GMXAGW_MarketPricingParams');
  });

  //////////
  // View //
  //////////

  it('should be able to get adapter bounds', async () => {
    compareStruct(
      await govWrap.gmxAdapterGov.getAdapterBounds(hre.f.gc.optionMarket.address),
      DEFAULT_GOV_GMX_ADAPTER_BOUNDS,
    );
  });
});
