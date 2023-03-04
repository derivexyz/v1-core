import { DEFAULT_GOV_OPTION_TOKEN_BOUNDS } from '../../utils/defaultParams';
import { MAX_UINT, toBN } from '../../../scripts/util/web3utils';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('OptionTokenGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.optionTokenGov.setRiskCouncil(RC.address);
    await govWrap.optionTokenGov.setOptionTokenBounds(DEFAULT_GOV_OPTION_TOKEN_BOUNDS);
  });

  ///////////
  // Admin //
  ///////////

  it('should be able to set risk council', async () => {
    expect(await govWrap.optionTokenGov.riskCouncil()).eq(hre.f.alice.address);
  });

  it('should NOT be able to set option option again', async () => {
    await expect(govWrap.optionTokenGov.setOptionToken(hre.f.gc.optionToken.address)).revertedWith(
      'OTGW_OptionTokenAlreadySet',
    );
  });

  it('should be able to forceChangeOwner', async () => {
    expect(await hre.f.gc.optionToken.owner()).eq(govWrap.optionTokenGov.address);
    await govWrap.optionTokenGov.forceChangeOwner(await govWrap.optionTokenGov.optionToken(), RC.address);
    expect(await hre.f.gc.optionToken.owner()).eq(govWrap.optionTokenGov.address);
    expect(await hre.f.gc.optionToken.nominatedOwner()).eq(RC.address);
    await hre.f.gc.optionToken.connect(RC).acceptOwnership();
    expect(await hre.f.gc.optionToken.owner()).eq(RC.address);
  });

  ////////////
  // Params //
  ////////////

  it('can set partial collateral parameters', async () => {
    await govWrap.optionTokenGov.setPartialCollateralParams(DEFAULT_GOV_OPTION_TOKEN_BOUNDS.maxPartialCollatParams);
    // can set to min and max
    await govWrap.optionTokenGov
      .connect(RC)
      .setPartialCollateralParams(DEFAULT_GOV_OPTION_TOKEN_BOUNDS.minPartialCollatParams);
    await govWrap.optionTokenGov
      .connect(RC)
      .setPartialCollateralParams(DEFAULT_GOV_OPTION_TOKEN_BOUNDS.maxPartialCollatParams);
    await expect(
      govWrap.optionTokenGov
        .connect(hre.f.signers[3])
        .setPartialCollateralParams(DEFAULT_GOV_OPTION_TOKEN_BOUNDS.maxPartialCollatParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.optionMarketPricer.getPricingParams(),
      DEFAULT_GOV_OPTION_TOKEN_BOUNDS.maxPartialCollatParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.optionTokenGov.connect(RC).setPartialCollateralParams({
        ...DEFAULT_GOV_OPTION_TOKEN_BOUNDS.minPartialCollatParams,
        minLiquidationFee: toBN('0.000001'),
      }),
    ).revertedWith('OTGW_partialCollateralParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.optionTokenGov.connect(RC).setPartialCollateralParams({
        ...DEFAULT_GOV_OPTION_TOKEN_BOUNDS.maxPartialCollatParams,
        minLiquidationFee: MAX_UINT,
      }),
    ).revertedWith('OTGW_partialCollateralParamsOutOfBounds');

    // owner can bypass
    await govWrap.optionTokenGov.setPartialCollateralParams({
      ...DEFAULT_GOV_OPTION_TOKEN_BOUNDS.maxPartialCollatParams,
      minLiquidationFee: MAX_UINT,
    });
  });

  it('can set option token uri', async () => {
    await govWrap.optionTokenGov.setOptionTokenURI('https://test.com/{id}');
    expect(await hre.f.gc.optionToken.baseURI()).eq('https://test.com/{id}');
    await expect(
      govWrap.optionTokenGov.connect(hre.f.signers[3]).setOptionTokenURI('https://test.com/{id}'),
    ).revertedWith('OnlyOwner');
  });

  it('should be able to get option token bounds', async () => {
    compareStruct(await govWrap.optionTokenGov.getOptionTokenBounds(), DEFAULT_GOV_OPTION_TOKEN_BOUNDS);
  });
});
