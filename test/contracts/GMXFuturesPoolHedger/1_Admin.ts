// import { beforeEach } from 'mocha';
// import { HOUR_SEC, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
// import { changeDelegateApprovalAddress, openDefaultShortPutQuote } from '../../utils/contractHelpers';
// import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
// import { seedFixture } from '../../utils/fixture';
// import { expect, hre } from '../../utils/testSetup';

// describe('GMXFuturesHedger - Admin', async () => {
//   beforeEach(seedFixture);

//   it.skip('cannot initialized contract twice', async () => {});

//   it.skip('updates successfully', async () => {});

//   it.skip('only liquidity pool can reset interaction delay', async () => {});

//   it.skip('reverts if max leverage is larger then permitted by snx settings contract', async () => {});

//   // TODO: come back to this
//   // it.skip('updateDelegateApproval', async () => {
//   //   await changeDelegateApprovalAddress();
//   //   await hre.f.c.liquidityPool.updateDelegateApproval();
//   //   await openDefaultShortPutQuote(); // what is this??
//   //   expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.be.gt(toBN('0'));

//   //   await expect(hre.f.c.poolHedger.connect(hre.f.alice).hedgeDelta());
//   //   await hre.f.c.poolHedger.updateDelegateApproval();
//   //   await hre.f.c.poolHedger.hedgeDelta();
//   // });
// });
