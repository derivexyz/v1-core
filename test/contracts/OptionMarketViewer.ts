// import { getEventArgs, OptionType, toBN } from '../../scripts/util/web3utils';
// import { StrikeViewStruct } from '../../typechain-types/OptionMarketViewer';
// import { assertCloseTo, assertCloseToPercentage } from '../utils';
// import { closePositionWithOverrides, openPositionWithOverrides } from '../utils/contractHelpers';
// import { TestSystemContractsType } from '../utils/deployTestSystem';
// import { seedFixture } from '../utils/fixture';
// import { hre } from '../utils/testSetup';
//
// describe('OptionMarketViewer', () => {
//   let c: TestSystemContractsType;
//   let boardId: any;
//   let strikes: StrikeViewStruct[];
//
//   beforeEach(async () => {
//     await seedFixture();
//     c = hre.f.c;
//     boardId = hre.f.board.boardId;
//     strikes = hre.f.market.liveBoards[0].strikes;
//   });
//
//   //Assumptions 1500, 2000, 2500, stock 1742, vol 100, skews 0.9/1/1.1,
//   describe('get premium for trade', async () => {
//     it('should work out the premium correctly for opening long call', async () => {
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikeIds[0],
//         OptionType.LONG_CALL,
//         true,
//         toBN('100'),
//       );
//       const receipt = await (
//         await c.optionMarket.openPosition(strikeIds[0], OptionType.LONG_CALL, toBN('100'), 0, MAX_UINT)
//       ).wait();
//       const event = getEventArgs(receipt, 'Trade');
//       // Use closeTo as the block.timestamp affects the result
//       assertCloseTo(viewerResult.premium, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('39704.56928'));
//       assertCloseToPercentage(
//         viewerResult.basePrice
//           .add(viewerResult.vegaUtilFee)
//           .add(viewerResult.optionPriceFee)
//           .add(viewerResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for opening long put', async () => {
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikeIds[0],
//         OptionType.LONG_PUT,
//         true,
//         toBN('100'),
//       );
//       const receipt = await (
//         await c.optionMarket.openPosition(strikeIds[0], OptionType.LONG_PUT, toBN('100'), 0, MAX_UINT)
//       ).wait();
//       const event = getEventArgs(receipt, 'Trade');
//
//       assertCloseTo(viewerResult.premium, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('14129.55419'));
//       assertCloseToPercentage(
//         viewerResult.basePrice
//           .add(viewerResult.vegaUtilFee)
//           .add(viewerResult.optionPriceFee)
//           .add(viewerResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for opening short call', async () => {
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikeIds[0],
//         OptionType.SHORT_CALL,
//         false,
//         toBN('100'),
//       );
//       const receipt = await (
//         await c.optionMarket.openPosition(strikeIds[0], OptionType.SHORT_CALL, toBN('100'), 0, MAX_UINT)
//       ).wait();
//       const event = getEventArgs(receipt, 'Trade');
//
//       assertCloseTo(viewerResult.premium, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('25650.18097'));
//       assertCloseToPercentage(
//         viewerResult.basePrice
//           .sub(viewerResult.vegaUtilFee)
//           .sub(viewerResult.optionPriceFee)
//           .sub(viewerResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for opening short put', async () => {
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikeIds[0],
//         OptionType.SHORT_PUT,
//         false,
//         toBN('100'),
//       );
//       const receipt = await (
//         await c.optionMarket.openPosition(strikeIds[0], OptionType.SHORT_PUT, toBN('100'), 0, MAX_UINT)
//       ).wait();
//       const event = getEventArgs(receipt, 'Trade');
//
//       assertCloseTo(viewerResult.premium, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('567.8496522'));
//       assertCloseToPercentage(
//         viewerResult.basePrice
//           .sub(viewerResult.vegaUtilFee)
//           .sub(viewerResult.optionPriceFee)
//           .sub(viewerResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for closing long call', async () => {
//       await c.optionMarket.openPosition(strikeIds[0], OptionType.LONG_CALL, toBN('100'), 0, MAX_UINT);
//
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikeIds[0],
//         OptionType.LONG_CALL,
//         false,
//         toBN('100'),
//       );
//       const receipt = await (
//         await c.optionMarket.closePosition(strikeIds[0], OptionType.LONG_CALL, toBN('100'), 0, MAX_UINT)
//       ).wait();
//       const event = getEventArgs(receipt, 'Trade');
//
//       assertCloseTo(viewerResult.premium, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('29697.27118'));
//       assertCloseToPercentage(
//         viewerResult.basePrice
//           .sub(viewerResult.vegaUtilFee)
//           .sub(viewerResult.optionPriceFee)
//           .sub(viewerResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for closing long put', async () => {
//       await c.optionMarket.openPosition(strikeIds[0], OptionType.LONG_PUT, toBN('100'), 0, MAX_UINT);
//
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikeIds[0],
//         OptionType.LONG_PUT,
//         false,
//         toBN('100'),
//       );
//       const receipt = await (
//         await c.optionMarket.closePosition(strikeIds[0], OptionType.LONG_PUT, toBN('100'), 0, MAX_UINT)
//       ).wait();
//       const event = getEventArgs(receipt, 'Trade');
//
//       assertCloseTo(viewerResult.premium, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('4604.451396'));
//       assertCloseToPercentage(
//         viewerResult.basePrice
//           .sub(viewerResult.vegaUtilFee)
//           .sub(viewerResult.optionPriceFee)
//           .sub(viewerResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for closing short call', async () => {
//       const [, positionId] = await openPositionWithOverrides(c, {
//         strikeId: strikes[0].strikeId,
//         optionType: OptionType.SHORT_CALL_BASE,
//         amount: toBN('100'),
//         setCollateralTo: toBN('100'),
//       });
//
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikes[0].strikeId,
//         OptionType.SHORT_CALL_BASE,
//         true,
//         toBN('100'),
//       );
//
//       const tx = await closePositionWithOverrides(c, {
//         strikeId: strikes[0].strikeId,
//         positionId,
//         optionType: OptionType.SHORT_CALL_BASE,
//         amount: toBN('100'),
//       });
//
//       const event = getEventArgs(await tx.wait(), 'Trade');
//
//       assertCloseTo(viewerResult.tradeResult.totalCost, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('33816.43498'));
//       assertCloseToPercentage(
//         viewerResult.tradeResult.premium
//           .add(viewerResult.tradeResult.vegaUtilFee)
//           .add(viewerResult.tradeResult.optionPriceFee)
//           .add(viewerResult.tradeResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work out the premium correctly for closing short put', async () => {
//       const [, positionId] = await openPositionWithOverrides(c, {
//         strikeId: strikes[0].strikeId,
//         optionType: OptionType.SHORT_PUT_QUOTE,
//         amount: toBN('100'),
//         setCollateralTo: toBN('200000'),
//       });
//
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikes[0].strikeId,
//         OptionType.SHORT_PUT_QUOTE,
//         true,
//         toBN('100'),
//       );
//       const tx = await closePositionWithOverrides(c, {
//         strikeId: strikes[0].strikeId,
//         positionId,
//         optionType: OptionType.SHORT_PUT_QUOTE,
//         amount: toBN('100'),
//       });
//       const event = getEventArgs(await tx.wait(), 'Trade');
//       assertCloseTo(viewerResult.tradeResult.totalCost, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('8216.689546'));
//       assertCloseToPercentage(
//         viewerResult.tradeResult.premium
//           .add(viewerResult.tradeResult.vegaUtilFee)
//           .add(viewerResult.tradeResult.optionPriceFee)
//           .add(viewerResult.tradeResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//     it('it should work for OTM options', async () => {
//       const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
//         strikes[2].strikeId,
//         OptionType.LONG_CALL,
//         true,
//         toBN('100'),
//       );
//       const [tx] = await openPositionWithOverrides(c, {
//         strikeId: strikes[2].strikeId,
//         optionType: OptionType.LONG_CALL,
//         amount: toBN('100'),
//       });
//       const event = getEventArgs(await tx.wait(), 'Trade');
//       console.log(event)
//       // Use closeTo as the block.timestamp affects the result
//       assertCloseTo(viewerResult.tradeResult.totalCost, event.totalCost);
//       assertCloseToPercentage(event.totalCost, toBN('11617.84553'));
//       assertCloseToPercentage(
//         viewerResult.tradeResult.premium
//           .add(viewerResult.tradeResult.vegaUtilFee)
//           .add(viewerResult.tradeResult.optionPriceFee)
//           .add(viewerResult.tradeResult.spotPriceFee),
//         event.totalCost,
//       );
//     });
//
//     it('should work for two trades in the same direction', async () => {
//       await openPositionWithOverrides(c, {
//         strikeId: strikes[2].strikeId,
//         optionType: OptionType.LONG_CALL,
//         amount: toBN('50'),
//       });
//       const [tx] = await openPositionWithOverrides(c, {
//         strikeId: strikes[2].strikeId,
//         optionType: OptionType.LONG_CALL,
//         amount: toBN('50'),
//       });
//       const event = getEventArgs(await tx.wait(), 'Trade');
//       assertCloseToPercentage(event.totalCost, toBN('5810.29207'));
//     });
//
//     it('should work for three trades in the same direction', async () => {
//       await openPositionWithOverrides(c, {
//         strikeId: strikes[2].strikeId,
//         optionType: OptionType.LONG_CALL,
//         amount: toBN('50'),
//       });
//       await openPositionWithOverrides(c, {
//         strikeId: strikes[2].strikeId,
//         optionType: OptionType.LONG_CALL,
//         amount: toBN('50'),
//       });
//       const [tx] = await openPositionWithOverrides(c, {
//         strikeId: strikes[2].strikeId,
//         optionType: OptionType.LONG_CALL,
//         amount: toBN('50'),
//       });
//       const event = getEventArgs(await tx.wait(), 'Trade');
//       assertCloseToPercentage(event.totalCost, toBN('7826.34999'));
//     });
//
//     it('should work out the board premiums correctly for opening long positions', async () => {
//       const totalCosts = [toBN('338.6716'), toBN('125.5816'), toBN('57.0564')];
//       const viewerResults = await c.optionMarketViewer.getPremiumsForBoard(
//         boardId,
//         OptionType.LONG_CALL,
//         true,
//         toBN('1'),
//       );
//       const res = await Promise.all(
//         strikes.map(strike =>
//           openPositionWithOverrides(c, {
//             strikeId: strike.strikeId,
//             optionType: OptionType.LONG_CALL,
//             amount: toBN('1'),
//           }),
//         ),
//       );
//       const receipts = await Promise.all(res.map(x => x[0].wait()));
//       receipts.forEach((receipt, idx) => {
//         const viewerResult = viewerResults[idx];
//         const event = getEventArgs(receipt, 'Trade');
//         assertCloseToPercentage(event.totalCost, totalCosts[idx]);
//         // 5% tolerance to account for IV / price impact after each transaction
//         assertCloseToPercentage(viewerResult.tradeResult.totalCost, event.totalCost, toBN('0.05'));
//         assertCloseToPercentage(
//           viewerResult.tradeResult.premium
//             .add(viewerResult.tradeResult.vegaUtilFee)
//             .add(viewerResult.tradeResult.optionPriceFee)
//             .add(viewerResult.tradeResult.spotPriceFee),
//           event.totalCost,
//           toBN('0.05'),
//         );
//       });
//     });
//
//     it('should work out the board premiums correctly for opening short positions', async () => {
//       const viewerResults = await c.optionMarketViewer.getPremiumsForBoard(
//         boardId,
//         OptionType.SHORT_CALL_QUOTE,
//         false,
//         toBN('1'),
//       );
//       const totalCosts = [toBN('296.4769'), toBN('86.4964'), toBN('19.3948')];
//       const res = await Promise.all(
//         strikes.map(strike =>
//           openPositionWithOverrides(c, {
//             strikeId: strike.strikeId,
//             optionType: OptionType.SHORT_CALL_QUOTE,
//             amount: toBN('1'),
//             setCollateralTo: toBN('2000'),
//           }),
//         ),
//       );
//       const receipts = await Promise.all(res.map(x => x[0].wait()));
//       receipts.forEach((receipt, idx) => {
//         const viewerResult = viewerResults[idx];
//         const event = getEventArgs(receipt, 'Trade');
//         // 5% tolerance to account for IV / price impact after each transaction
//         assertCloseToPercentage(event.totalCost, totalCosts[idx]);
//         assertCloseToPercentage(viewerResult.tradeResult.totalCost, event.totalCost, toBN('0.05'));
//         assertCloseToPercentage(
//           viewerResult.tradeResult.premium
//             .sub(viewerResult.tradeResult.vegaUtilFee)
//             .sub(viewerResult.tradeResult.optionPriceFee)
//             .sub(viewerResult.tradeResult.spotPriceFee),
//           event.totalCost,
//           toBN('0.05'),
//         );
//       });
//     });
//   });
//
//   describe('getStrikeViewAndBalance', async () => {
//     it('Returns the user balance for longs', async () => {
//       await c.optionMarket.openPosition(strikeIds[0], OptionType.LONG_CALL, toBN('10'), 0, MAX_UINT);
//       await c.optionMarket.openPosition(strikeIds[0], OptionType.LONG_PUT, toBN('20'), 0, MAX_UINT);
//       await c.optionMarket.openPosition(strikeIds[0], OptionType.SHORT_CALL, toBN('30'), 0, MAX_UINT);
//       await c.optionMarket.openPosition(strikeIds[0], OptionType.SHORT_PUT, toBN('40'), 0, MAX_UINT);
//
//       const x = await c.optionMarketViewer.getStrikeViewAndBalance(strikeIds[0], await account.getAddress());
//       expect(x.longCallAmt).eq(toBN('10'));
//       expect(x.longPutAmt).eq(toBN('20'));
//       expect(x.shortCallAmt).eq(toBN('30'));
//       expect(x.shortPutAmt).eq(toBN('40'));
//     });
//   });
// });
