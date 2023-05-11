import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';
import { ethers } from 'hardhat';
import { deployGovernanceWrappers, GovernanceWrappersTypeGMX } from '../GovernanceWrapper/utils';
import { ListingManager } from '../../../typechain-types';
import { DAY_SEC } from '../../../scripts/util/web3utils';
import { fastForward } from '../../utils/evm';
import { DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS } from '../../utils/defaultParams';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('ListingManager - Integration', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  let listingManager: ListingManager;

  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.gmxHedgerGov.setRiskCouncil(RC.address);

    listingManager = (await (await ethers.getContractFactory('ListingManager'))
      .connect(hre.f.deployer)
      .deploy(
        hre.f.gc.GMXAdapter.address,
        hre.f.gc.liquidityPool.address,
        hre.f.gc.optionGreekCache.address,
        hre.f.gc.optionMarket.address,
        govWrap.optionMarketGov.address,
      )) as any as ListingManager;

    await govWrap.optionMarketGov.setBoardManager(listingManager.address);
  });

  it.skip('can queue both boards and strikes', async () => {
    console.log('initial state');
    console.log(await listingManager.getAllBoardDetails());
    console.log('\n');

    let tx = await listingManager.findAndQueueStrikesForBoard(1);
    console.log('queueing strikes to board', (await tx.wait()).gasUsed);

    console.log((await listingManager.getQueuedStrikes(1)).strikesToAdd.length);

    await fastForward(DAY_SEC);
    tx = await listingManager.executeQueuedStrikes(1, 6);
    console.log('executing 6 strike', (await tx.wait()).gasUsed);

    tx = await listingManager.executeQueuedStrikes(1, 10);
    console.log('executing 10 more strikes', (await tx.wait()).gasUsed);

    tx = await listingManager.executeQueuedStrikes(1, 100);
    console.log('executing rest of strikes', (await tx.wait()).gasUsed);

    console.log('Getting all boards');
    console.log(await listingManager.getAllBoardDetails());

    console.log('\n');

    const validExpiries = await listingManager.getValidExpiries();
    tx = await listingManager.queueNewBoard(validExpiries[validExpiries.length - 1]);
    console.log('queueing new board', (await tx.wait()).gasUsed);
    await fastForward(DAY_SEC);
    tx = await listingManager.executeQueuedBoard(validExpiries[validExpiries.length - 1]);
    console.log('Executing queued board', (await tx.wait()).gasUsed);

    console.log('Getting all boards');
    // await listingManager.queueNewBoard(await currentTime() );
    // console.log(await listingManager.getListingManagerState());
  });
});
