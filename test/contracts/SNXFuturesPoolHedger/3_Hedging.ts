// import { beforeEach } from 'mocha';
// import { HOUR_SEC, OptionType, toBN, toBytes32, UNIT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
// import { TradeInputParametersStruct } from '../../../typechain-types/IOptionMarket';
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
// describe('Hedging against mock contract', async () => {
//   beforeEach(seedFixture);
//
//   it('checking delta is zero without trading', async () => {
//     expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).eq(toBN('0'));
//   });
//
//   it('checking futures contract will hedge long when pool gets long', async () => {
//     await poolLong();
//
//     const curValue = await hre.f.c.poolHedger.getCappedExpectedHedge();
//     console.log('curValue', curValue.div(UNIT));
//     expect(curValue).gt(0);
//
//     // see if the logic to hedge delta works
//     expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).eq(0);
//
//     await hre.f.c.poolHedger.hedgeDelta();
//
//     expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).eq(curValue);
//     expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).eq(0);
//   });
// });
