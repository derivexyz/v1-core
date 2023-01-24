// import { beforeEach } from 'mocha';
// import { HOUR_SEC, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
// import { changeDelegateApprovalAddress, openDefaultShortPutQuote } from '../../utils/contractHelpers';
// import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
// import { seedFixture } from '../../utils/fixture';
// import { expect, hre } from '../../utils/testSetup';
//
// const modParams = {
//   shortBuffer: toBN('2.1'),
//   hedgeCap: toBN('1000000'),
//   interactionDelay: HOUR_SEC * 6,
// };
//
// async function setParams(overrides?: any) {
//   await hre.f.c.poolHedger.setPoolHedgerParams({
//     ...DEFAULT_POOL_HEDGER_PARAMS,
//     ...(overrides || {}),
//   });
//   // await hre.f.c.poolHedger.setShortBuffer(modParams.shortBuffer);
// }
//
// describe('Admin', async () => {
//   beforeEach(seedFixture);
//
//   it('cannot initialized contract twice', async () => {
//     await expect(
//       hre.f.c.poolHedger.init(
//         hre.f.c.synthetixAdapter.address,
//         hre.f.c.optionMarket.address,
//         hre.f.c.optionGreekCache.address,
//         hre.f.c.liquidityPool.address,
//         hre.f.c.snx.quoteAsset.address,
//         hre.f.c.snx.baseAsset.address,
//       ),
//     ).revertedWith('AlreadyInitialised');
//   });
//
//   it('updates successfully', async () => {
//     const oldParams = await hre.f.c.poolHedger.getPoolHedgerParams();
//     await setParams(modParams);
//     const newParams = await hre.f.c.poolHedger.getPoolHedgerParams();
//
//     expect(oldParams.interactionDelay).not.eq(newParams.interactionDelay);
//     expect(newParams.interactionDelay).eq(modParams.interactionDelay);
//
//     expect(oldParams.hedgeCap).not.eq(newParams.hedgeCap);
//     expect(newParams.hedgeCap).eq(modParams.hedgeCap);
//   });
//
//   it('only liquidity pool can reset interaction delay', async () => {
//     await expect(hre.f.c.poolHedger.resetInteractionDelay()).revertedWith('OnlyLiquidityPool');
//   });
//
//   it('reverts if max leverage is larger then permitted by snx settings contract', async () => {
//     await expect(hre.f.c.poolHedger.(maxLeverage)).revertedWith('InvalidMaxLeverage');
//   });
//
//   // TODO: come back to this
//   // it('updateDelegateApproval', async () => {
//   //   await changeDelegateApprovalAddress();
//   //   await hre.f.c.liquidityPool.updateDelegateApproval();
//   //   await openDefaultShortPutQuote(); // what is this??
//   //   expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.be.gt(toBN('0'));
//
//   //   await expect(hre.f.c.poolHedger.connect(hre.f.alice).hedgeDelta());
//   //   await hre.f.c.poolHedger.updateDelegateApproval();
//   //   await hre.f.c.poolHedger.hedgeDelta();
//   // });
// });
