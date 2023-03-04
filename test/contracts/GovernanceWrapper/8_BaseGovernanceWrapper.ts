import { DEFAULT_GOV_GMX_ADAPTER_BOUNDS } from '../../utils/defaultParams';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '../../../scripts/util/web3utils';

describe('GMXHedgedGovernanceWrapper - GMX adapter', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;

  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.gmxAdapterGov.setRiskCouncil(RC.address);
    await govWrap.gmxAdapterGov.setGMXAdapterBounds(hre.f.gc.optionMarket.address, DEFAULT_GOV_GMX_ADAPTER_BOUNDS);
  });

  /////////////
  // Reverts //
  /////////////

  it('cannot set risk council if not owner', async () => {
    await expect(govWrap.gmxAdapterGov.connect(RC).setRiskCouncil(RC.address)).to.be.revertedWith('OnlyOwner');
  });

  it('cannot set risk council to zero address', async () => {
    await expect(govWrap.gmxAdapterGov.setRiskCouncil(ZERO_ADDRESS)).to.be.revertedWith('Zero address');
  });
});
