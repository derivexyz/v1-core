// import { beforeEach } from 'mocha';
// import { HOUR_SEC, OptionType, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
// import { OptionMarket } from '../../../typechain-types';
// import { TradeInputParametersStruct } from '../../../typechain-types/BasicOptionMarketWrapper';
// import {
//   changeDelegateApprovalAddress,
//   getSpotPrice,
//   mockPrice,
//   openDefaultShortPutQuote,
// } from '../../utils/contractHelpers';
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
// async function poolLong() {
//   //get strike
//   // iterations is 1
//   // option type is short put
//   // number of contracts, large amount, 20?
//   // setCollat to what ever the min collat is
//   // min total cost 0
//   // max total cost is a max unit
//
//   const spotPrice = await getSpotPrice();
//
//   const amount = toBN('100');
//   const boards = await hre.f.c.optionMarket.getLiveBoards();
//   const strikeId = (await hre.f.c.optionMarket.getBoardStrikes(boards[0]))[0];
//   const strike = await hre.f.c.optionMarket.getStrikeAndExpiry(strikeId);
//   const minCollat = await hre.f.c.optionGreekCache.getMinCollateral(
//     OptionType.SHORT_PUT_QUOTE,
//     strike[0],
//     strike[1],
//     spotPrice,
//     amount,
//   );
//
//   // short puts
//   await hre.f.c.optionMarket.openPosition({
//     strikeId: strikeId,
//     positionId: 0,
//     iterations: 1,
//     optionType: OptionType.SHORT_PUT_QUOTE,
//     amount: toBN('100'),
//     setCollateralTo: minCollat,
//     minTotalCost: toBN('1'),
//     maxTotalCost: toBN('1000000'), // TODO: should just set to max unit probs
//   } as TradeInputParametersStruct);
// }
//
// async function poolShort() {
//   //get strike
//   // iterations is 1
//   // option type is short put
//   // number of contracts, large amount, 20?
//   // setCollat to what ever the min collat is
//   // min total cost 0
//   // max total cost is a max unit
//   const spotPrice = await getSpotPrice();
//   const amount = toBN('100');
//   const boards = await hre.f.c.optionMarket.getLiveBoards();
//   const strikeId = (await hre.f.c.optionMarket.getBoardStrikes(boards[0]))[0];
//   const strike = await hre.f.c.optionMarket.getStrikeAndExpiry(strikeId);
//   const minCollat = await hre.f.c.optionGreekCache.getMinCollateral(
//     OptionType.SHORT_CALL_QUOTE,
//     strike[0],
//     strike[1],
//     spotPrice,
//     amount,
//   );
//
//   // short puts
//   await hre.f.c.optionMarket.openPosition({
//     strikeId: strikeId,
//     positionId: 0,
//     iterations: 1,
//     optionType: OptionType.SHORT_CALL_QUOTE,
//     amount: toBN('100'),
//     setCollateralTo: minCollat,
//     minTotalCost: toBN('1'),
//     maxTotalCost: toBN('1000000'), // TODO: should just set to max unit probs
//   } as TradeInputParametersStruct);
// }
//
// describe('Hedging Delta(views)', async () => {
//   beforeEach(seedFixture);
//
//   it('checking delta is zero without trading', async () => {
//     const curValue = await hre.f.c.poolHedger.getCappedExpectedHedge();
//     await expect(curValue).eq(0);
//   });
//
//   it('checking futures contract will hedge long when pool gets long', async () => {
//     await poolLong();
//     const curValue = await hre.f.c.poolHedger.getCappedExpectedHedge();
//     expect(curValue).gt(0); // TODO: should figure out the exact value of this.
//   });
//
//   it('checking futures contract will hedge short', async () => {
//     await poolShort();
//     const curValue = await hre.f.c.poolHedger.getCappedExpectedHedge();
//     expect(curValue).lt(toBN('1')); // TODO: should figure out the exact value of this.
//   });
//
//   // TODO:  finish this test
//   it('checking no delta has been hedged', async () => {
//     await poolShort();
//     const curValue = await hre.f.c.poolHedger.getCappedExpectedHedge();
//     expect(curValue).lt(toBN('0')); // TODO: should figure out the exact value of this.
//
//     // await expect(
//     //   hre.f.c.poolHedger.getCappedExpectedHedge()
//     // ).to.be.equal(toBN('0')); // TODO: should figure out the exact value of this.
//   });
// });
