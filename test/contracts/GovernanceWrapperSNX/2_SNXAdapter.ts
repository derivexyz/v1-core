import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DEFAULT_GOV_SNX_ADAPTER_BOUNDS, DEFAULT_GOV_SNX_FUTURES_HEDGER_PARAMS } from '../../utils/defaultParams';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { GovernanceWrappersTypeSNXPerps, deploySNXGovernanceWrapper } from '../GovernanceWrapper/utils';
import { toBN } from '../../../scripts/util/web3utils';

describe('SNXAdapter - Governance Wrapper', () => {
  let govWrappers: GovernanceWrappersTypeSNXPerps;
  let RC: SignerWithAddress;

  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    govWrappers = await deploySNXGovernanceWrapper(hre.f.c, hre.f.pc, hre.f.deployer);

    RC = hre.f.alice;
    await govWrappers.snxAdapterGov.setRiskCouncil(RC.address);
  });

  ////////////////
  // OnlyOwner ///
  ////////////////

  it('owner can enableRiskCouncilAdapterPausing', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).enableRiskCouncilAdapterPausing(true);
    expect(await govWrappers.snxAdapterGov.adapterPausingEnabled()).to.be.true;
  });

  it('risk council cannot set enableRiskCouncilAdapterPausing', async () => {
    await expect(govWrappers.snxAdapterGov.connect(RC).enableRiskCouncilAdapterPausing(true)).to.be.revertedWith(
      'OnlyOwner',
    );
  });

  it('risk council cannot set snxAdapter', async () => {
    await expect(
      govWrappers.snxAdapterGov.connect(RC).setSNXAdapter(hre.f.c.synthetixPerpV2Adapter.address),
    ).to.be.revertedWith('OnlyOwner');
  });

  it('owner can set uniswap router', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setUniSwapRouter(hre.f.alice.address);
    expect(await hre.f.c.synthetixPerpV2Adapter.swapRouter()).to.equal(hre.f.alice.address);
  });

  it('risk council cannot set uniswap router', async () => {
    await expect(govWrappers.snxAdapterGov.connect(RC).setUniSwapRouter(hre.f.alice.address)).to.be.revertedWith(
      'OnlyOwner',
    );
  });


  it('set Address resolver', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setAddressResolver(hre.f.c.snx.addressResolver.address);
    expect(await hre.f.c.synthetixPerpV2Adapter.addressResolver()).to.equal(hre.f.c.snx.addressResolver.address);
  });

  it('risk council cannot set Address resolver', async () => {
    await expect(govWrappers.snxAdapterGov.connect(RC).setAddressResolver(hre.f.alice.address)).to.be.revertedWith(
      'OnlyOwner',
    );
  });

  it('onlyOwner can set uniswap devitation', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setUniSwapDeviation(100);
    expect(await hre.f.c.synthetixPerpV2Adapter.uniDeviation()).to.equal(100);
  });

  it('set RiskFreeRate as owner', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setRiskFreeRate(hre.f.c.optionMarket.address, 100);
    expect(await hre.f.c.synthetixPerpV2Adapter.rateAndCarry(hre.f.c.optionMarket.address)).to.equal(100);

    // can set rate outside of the bounds
    const maxRiskFreeRate = (await govWrappers.snxAdapterGov.connect(hre.f.deployer).getAdapterBounds(hre.f.c.optionMarket.address)).maxRiskFreeRate;

    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setRiskFreeRate(hre.f.c.optionMarket.address, maxRiskFreeRate);
    expect(await hre.f.c.synthetixPerpV2Adapter.rateAndCarry(hre.f.c.optionMarket.address)).to.equal(maxRiskFreeRate);
  });

  it('risk council can only set riskFreeRate inside bounds', async () => {
    await expect(govWrappers.snxAdapterGov.connect(RC).setRiskFreeRate(hre.f.c.optionMarket.address, toBN('100000'))).to.be.revertedWith(
      'SNXAGW_RiskFreeRateBounds',
    );
  });

  it('only owner can set UniSwap deviation', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setUniSwapDeviation(100);
    expect(await hre.f.c.synthetixPerpV2Adapter.uniDeviation()).to.equal(100);

    // should revert on risk council
    await expect(govWrappers.snxAdapterGov.connect(RC).setUniSwapDeviation(100)).to.be.revertedWith('OnlyOwner');
  })

  it('owner can snx market adapter configuration', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setMarketAdapterConfiguration(
      hre.f.c.optionMarket.address,
      DEFAULT_GOV_SNX_ADAPTER_BOUNDS.minMarketPricingParams
    );
    const marketConfigurations = await hre.f.c.synthetixPerpV2Adapter.marketConfigurations(hre.f.c.optionMarket.address);
    expect(marketConfigurations.staticEstimationDiscount).to.equal(DEFAULT_GOV_SNX_ADAPTER_BOUNDS.minMarketPricingParams.staticEstimationDiscount);
    expect(marketConfigurations.snxPerpV2MarketAddress).to.equal(DEFAULT_GOV_SNX_ADAPTER_BOUNDS.minMarketPricingParams.snxPerpV2MarketAddress);
  });

  it ('risk council can set snx market adapter configuration', async () => {
    await govWrappers.snxAdapterGov.connect(RC).setMarketAdapterConfiguration(
      hre.f.c.optionMarket.address,
      DEFAULT_GOV_SNX_ADAPTER_BOUNDS.minMarketPricingParams
    )
    const res = await hre.f.c.synthetixPerpV2Adapter.marketConfigurations(hre.f.c.optionMarket.address);
    expect(res.staticEstimationDiscount).to.deep.equal(DEFAULT_GOV_SNX_ADAPTER_BOUNDS.minMarketPricingParams.staticEstimationDiscount);
    expect(res.snxPerpV2MarketAddress).to.deep.equal(DEFAULT_GOV_SNX_ADAPTER_BOUNDS.minMarketPricingParams.snxPerpV2MarketAddress);
  });

  it('Owner can set market paused', async () => {
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setMarketPaused(hre.f.c.optionMarket.address, true);
    expect(await hre.f.c.synthetixPerpV2Adapter.isMarketPaused(hre.f.c.optionMarket.address)).to.be.true;
  });

  it('risk council can set market paused if adapterPausing is enabled', async () => {
    expect(await govWrappers.snxAdapterGov.adapterPausingEnabled()).to.be.true;

    await govWrappers.snxAdapterGov.connect(hre.f.deployer).setMarketPaused(hre.f.c.optionMarket.address, true);
    expect(await hre.f.c.synthetixPerpV2Adapter.isMarketPaused(hre.f.c.optionMarket.address)).to.be.true;

    // disable adapter pausing
    await govWrappers.snxAdapterGov.connect(hre.f.deployer).enableRiskCouncilAdapterPausing(false);
    expect(await govWrappers.snxAdapterGov.adapterPausingEnabled()).to.be.false;
    // should revert when trying to set back to true
    await expect(govWrappers.snxAdapterGov.connect(RC).setMarketPaused(hre.f.c.optionMarket.address, true)).to.be.revertedWith('SNXAGW_RiskCouncilCannotPauseMarket');

  });

});
