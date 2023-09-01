// import { BigNumber, Contract, ethers, Wallet } from 'ethers';
// import {
//   closePosition,
//   expectFuturesHedgeEqualTo,
//   // expectHedgeEqualTo,
//   forceUpdateFuturesHedgePosition,
//   // forceUpdateHedgePosition,
//   openPosition,
// } from '../../scripts/util/integrationFunctions';
// import { fromBN, MAX_UINT, MAX_UINT128, OptionType, toBN, toBytes32, UNIT } from '../../scripts/util/web3utils';
// import { FuturesPoolHedgerParametersStruct, PoolHedgerParametersStruct } from '../../typechain-types/FuturesPoolHedger';
// import { assertCloseToPercentage } from '../utils/assert';
// import { DEFAULT_CB_PARAMS, DEFAULT_LIQUIDITY_POOL_PARAMS, DEFAULT_OPTION_MARKET_PARAMS } from '../utils/defaultParams';
// import { deployTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
// import { restoreSnapshot, takeSnapshot } from '../utils/evm';
// import { getLocalRealSynthetixContract } from '../utils/package/parseFiles';
// import { changeRate, setDebtLimit } from '../utils/package/realSynthetixUtils';
// import { seedTestSystem } from '../utils/seedTestSystem';
// import { expect } from '../utils/testSetup';

// describe('Integration tests', () => {
//   let testSystem: TestSystemContractsType;
//   let market: string;
//   let deployer: Wallet;
//   let snapId: number;
//   let marketView: any;
//   let preQuoteBal: number;
//   let preBaseBal: number;

//   before(async () => {
//     const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

//     const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
//     provider.getGasPrice = async () => {
//       return ethers.BigNumber.from('0');
//     };
//     provider.estimateGas = async () => {
//       return ethers.BigNumber.from(15000000);
//     };

//     deployer = new ethers.Wallet(privateKey, provider);
//     const exportAddresses = true;

//     testSystem = await deployTestSystem(deployer, false, exportAddresses, {
//       mockSNX: false,
//       compileSNX: false,
//       optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') },
//     });

//     await seedTestSystem(deployer, testSystem);
//     await testSystem.snx.delegateApprovals.approveAllDelegatePowers(testSystem.synthetixAdapter.address);
//     market = 'sETH';
//     marketView = await testSystem.optionMarketViewer.getMarket(testSystem.optionMarket.address);
//   });

//   beforeEach(async () => {
//     snapId = await takeSnapshot();
//     preQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//     preBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));
//   });

//   afterEach(async () => {
//     await restoreSnapshot(snapId);
//   });

//   describe('setAddressResolver', async () => {
//     it('can setAddressResolver', async () => {
//       const addressResolver = await (await getLocalRealSynthetixContract(deployer, 'local', `AddressResolver`)).address;
//       await testSystem.synthetixAdapter.setAddressResolver(addressResolver);
//       const currentAddress = await testSystem.synthetixAdapter.addressResolver();
//       expect(addressResolver).eq(currentAddress);
//     });
//   });

//   describe('delegateApprovals', async () => {
//     it('delegateApprovals set to snx contract', async () => {
//       const setContract = await testSystem.synthetixAdapter.delegateApprovals();
//       expect(setContract).eq(testSystem.snx.delegateApprovals.address);
//     });
//   });

//   describe('exchanging quote for base', async () => {
//     it('exchangeFromExactQuote', async () => {
//       await testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, toBN('1000'));
//       const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//       const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       expect(preQuoteBal - postQuoteBal).to.eq(1000);
//       expect(postBaseBal - preBaseBal).to.eq(0.5665857776966732);
//     });

//     it('revert when not enough quote', async () => {
//       const quoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       await expect(
//         testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, quoteBal.add(1)),
//       ).to.revertedWith('SafeMath: subtraction overflow');
//     });

//     it('exchangeToExactBase', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       await testSystem.synthetixAdapter.exchangeToExactBase(exchangeParams, testSystem.optionMarket.address, toBN('1'));
//       const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//       const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       expect(preQuoteBal - postQuoteBal).to.eq(1764.957820892334);
//       expect(postBaseBal - preBaseBal).to.eq(1);
//     });

//     it('revert when not enough quote', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//       const quoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       const max = quoteBal.div(spotPrice);

//       await expect(
//         testSystem.synthetixAdapter.exchangeToExactBase(
//           exchangeParams,
//           testSystem.optionMarket.address,
//           toBN(max.toString()),
//         ),
//       ).to.revertedWith('SafeMath: subtraction overflow');
//     });

//     it('exchangeForExactBaseWithLimit', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       await testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
//         exchangeParams,
//         testSystem.optionMarket.address,
//         toBN('1'),
//         toBN('1770'),
//       );
//       const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//       const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       expect(preQuoteBal - postQuoteBal).to.eq(1764.957820892334);
//       expect(postBaseBal - preBaseBal).to.eq(1);
//     });

//     it('revert when not enough quote', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       await expect(
//         testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
//           exchangeParams,
//           testSystem.optionMarket.address,
//           toBN('1'),
//           toBN('1750'),
//         ),
//       ).to.revertedWith("reverted with custom error 'QuoteBaseExchangeExceedsLimit");
//     });
//   });

//   describe('exchanging base for quote', async () => {
//     it('exchangeFromExactBase', async () => {
//       await testSystem.synthetixAdapter.exchangeFromExactBase(testSystem.optionMarket.address, toBN('10'));
//       const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));
//       const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//       expect(postBaseBal - preBaseBal).to.eq(-10);
//       expect(postQuoteBal - preQuoteBal).to.eq(17193.671962738037);
//     });

//     it('revert when not enough base', async () => {
//       await expect(
//         testSystem.synthetixAdapter.exchangeFromExactBase(testSystem.optionMarket.address, toBN('20000')),
//       ).to.revertedWith('SafeMath: subtraction overflow');
//     });

//     it('exchangeToExactQuote', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       await testSystem.synthetixAdapter.exchangeToExactQuote(
//         exchangeParams,
//         testSystem.optionMarket.address,
//         toBN('1000'),
//       );
//       const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//       const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       expect(postQuoteBal - preQuoteBal).to.eq(1000);
//       expect(preBaseBal - postBaseBal).to.eq(0.5816093282555812);
//     });

//     it('revert when not enough base', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);

//       await expect(
//         testSystem.synthetixAdapter.exchangeToExactQuote(
//           exchangeParams,
//           testSystem.optionMarket.address,
//           toBN('999999999'),
//         ),
//       ).to.revertedWith('SafeMath: subtraction overflow');
//     });

//     it('exchangeToExactQuoteWithLimit', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       await testSystem.synthetixAdapter.exchangeToExactQuoteWithLimit(
//         exchangeParams,
//         testSystem.optionMarket.address,
//         toBN('1000'),
//         toBN('0.6'),
//       );
//       const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
//       const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       expect(postQuoteBal - preQuoteBal).to.eq(1000);
//       expect(preBaseBal - postBaseBal).to.eq(0.5816093282555812);
//     });

//     it('revert when base limit too high', async () => {
//       const exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);

//       await expect(
//         testSystem.synthetixAdapter.exchangeToExactQuoteWithLimit(
//           exchangeParams,
//           testSystem.optionMarket.address,
//           toBN('1000'),
//           toBN('0.5'),
//         ),
//       ).to.revertedWith("reverted with custom error 'BaseQuoteExchangeExceedsLimit");
//     });
//   });

//   describe('variable fees', async () => {
//     it('min ~0% fee vs 10% fee (max) base', async () => {
//       // First set fees to ~0
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sETH')],
//         [BigNumber.from(1)],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sUSD')],
//         [BigNumber.from(1)],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

//       const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//       let preQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);

//       // Try swapping with 0 fees
//       let exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);
//       await testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
//         exchangeParams,
//         testSystem.optionMarket.address,
//         toBN('1'),
//         toBN('1760'),
//       );

//       let postQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       let postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       // Should cost the spot price of sETH
//       assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), spotPrice);
//       expect(postBaseBal - preBaseBal).to.eq(1);

//       preQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       preBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       // Set fee to 10% and get new exchange params
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sETH')],
//         [toBN('0.05')],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sUSD')],
//         [toBN('0.05')],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));
//       exchangeParams = await testSystem.synthetixAdapter.getExchangeParams(testSystem.optionMarket.address);

//       await expect(
//         testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
//           exchangeParams,
//           testSystem.optionMarket.address,
//           toBN('1'),
//           toBN('1760'),
//         ),
//       ).to.revertedWith("reverted with custom error 'QuoteBaseExchangeExceedsLimit");

//       // Now try to exchange for 10% less
//       await testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
//         exchangeParams,
//         testSystem.optionMarket.address,
//         toBN('0.9'),
//         toBN('1760'),
//       );

//       postQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

//       // 0.9 should cost spotPrice of eth (10% fee)
//       assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), spotPrice);
//       expect(postBaseBal - preBaseBal).to.eq(0.8999999999996362);
//     });

//     it('min ~0% fee vs 10% fee (max) quote', async () => {
//       // First set fees to ~0
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sETH')],
//         [BigNumber.from(1)],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sUSD')],
//         [BigNumber.from(1)],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

//       const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//       let preQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       let preBaseBal: BigNumber = await testSystem.snx.baseAsset.balanceOf(deployer.address);

//       // Try swapping with 0 fees
//       await testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, toBN('1000'));

//       let postQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       let postBaseBal: BigNumber = await testSystem.snx.baseAsset.balanceOf(deployer.address);

//       // Should receive (quote / spotPrice) sETH (no fees)
//       assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), toBN('1000'));
//       assertCloseToPercentage(postBaseBal.sub(preBaseBal), toBN('1000').mul(toBN('1')).div(spotPrice));

//       preQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       preBaseBal = await testSystem.snx.baseAsset.balanceOf(deployer.address);

//       // Set fee to 10% and get new exchange params
//       // await (await getLocalRealSynthetixContract(deployer, 'local', `SystemSettings`) as Contract)
//       //   .setExchangeFeeRateForSynths([toBytes32('sETH')], [toBN('0.1')]);
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sETH')],
//         [toBN('0.05')],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//         [toBytes32('sUSD')],
//         [toBN('0.05')],
//       );
//       await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

//       // Now try to exchange, expecting for 10% less sETH
//       await testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, toBN('1000'));

//       postQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
//       postBaseBal = await testSystem.snx.baseAsset.balanceOf(deployer.address);

//       // Should receive 0.9 * (quote / spotPrice) sETH
//       assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), toBN('1000'));
//       assertCloseToPercentage(postBaseBal.sub(preBaseBal), toBN('1000').mul(toBN('0.9')).div(spotPrice));
//     });
//   });

//   // describe('Hedging long calls', async () => {
//   //   it('LONG CALL --> hedger should short and long on close', async () => {
//   //     // Open LONG CALL --> hedger should short
//   //     let positionId = await openPosition(testSystem, market, {
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });
//   //     console.log('gets to here');
//   //     await forceUpdateHedgePosition(testSystem);
//   //     console.log('gets past the hedger')
//   //     let expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     console.log('gets ot line 360');
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     // Open LONG CALL again --> hedger should short more
//   //     positionId = await openPosition(testSystem, market, {
//   //       positionId: positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     // Close half LONG CALL --> hedger should reduce short
//   //     positionId = await closePosition(testSystem, market, {
//   //       positionId: positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });

//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     // Close remaining LONG CALL --> hedger position should be 0
//   //     await closePosition(testSystem, market, {
//   //       positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);
//   //   });
//   // });

//   // describe('Hedging short puts', async () => {
//   //   it('Short puts --> hedger should long and short on close', async () => {
//   //     // Open SHORT PUT --> hedger should long
//   //     const positionId = await openPosition(testSystem, market, {
//   //       amount: toBN('10'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       setCollateralTo: toBN('18000'),
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     let expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     // hedger should long more
//   //     await openPosition(testSystem, market, {
//   //       positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       setCollateralTo: toBN('20000'),
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     // hedger should reduce long
//   //     await closePosition(testSystem, market, {
//   //       positionId: positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       setCollateralTo: toBN('18000'),
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     // Close SHORT PUT --> hedger position should be 0
//   //     await closePosition(testSystem, market, {
//   //       positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);
//   //   });
//   // });

//   // describe('Valid rate tests', async () => {
//   //   it('able to open/close/hedge positions with valid rate', async () => {
//   //     // Open & close positions with valid rate
//   //     const positionId = await openPosition(testSystem, market, {
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });

//   //     await forceUpdateHedgePosition(testSystem);
//   //     let expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     await closePosition(testSystem, market, {
//   //       positionId,
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });

//   //     await forceUpdateHedgePosition(testSystem);
//   //     expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);
//   //   });
//   // });

//   // describe('Rate and fee tests', async () => {
//   //   it('unable to open and close positions with valid rate', async () => {
//   //     const positionId = await openPosition(testSystem, market, {
//   //       amount: toBN('10'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       setCollateralTo: toBN('18000'),
//   //     });

//   //     // Set rate to be stale (invalid)
//   //     await (await getLocalRealSynthetixContract(deployer, 'local', `SystemSettings`)).setRateStalePeriod(0);

//   //     // Invalid rate to hedge
//   //     await expect(forceUpdateHedgePosition(testSystem)).to.revertedWith("reverted with custom error 'RateIsInvalid");

//   //     // Invalid rate to open position
//   //     await expect(
//   //       openPosition(testSystem, market, {
//   //         amount: toBN('10'),
//   //         optionType: OptionType.LONG_CALL,
//   //         strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       }),
//   //     ).to.revertedWith("reverted with custom error 'RateIsInvalid");

//   //     // Invalid rate to close position
//   //     await expect(
//   //       closePosition(testSystem, market, {
//   //         positionId,
//   //         amount: toBN('10'),
//   //         optionType: OptionType.LONG_CALL,
//   //         strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       }),
//   //     ).to.revertedWith("reverted with custom error 'RateIsInvalid");
//   //   });

//   //   it('snx spot feed too volatile', async () => {
//   //     // open some options
//   //     await openPosition(testSystem, market, {
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });

//   //     // volatile price
//   //     await changeRate(testSystem, toBN('1000'), 'sETH');

//   //     // Invalid rate to open position
//   //     await expect(
//   //       openPosition(testSystem, market, {
//   //         amount: toBN('10'),
//   //         optionType: OptionType.LONG_CALL,
//   //         strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       }),
//   //     ).to.revertedWith('too volatile');

//   //     // attempt position hedge
//   //     await expect(testSystem.poolHedger.hedgeDelta()).to.revertedWith('too volatile');
//   //   });

//   //   it('_maybeExchange when fee > maxFeePaid', async () => {
//   //     // set fees to 6%
//   //     await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//   //       [toBytes32('sETH')],
//   //       [toBN('0.03')],
//   //     );
//   //     await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
//   //       [toBytes32('sUSD')],
//   //       [toBN('0.03')],
//   //     );
//   //     await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

//   //     // opens undercollateralized long
//   //     await testSystem.liquidityPool.setLiquidityPoolAndCBParameters({
//   //       ...DEFAULT_LIQUIDITY_POOL_PARAMS,
//   //       maxFeePaid: toBN('0.01'),
//   //     }, {
//   //       ...DEFAULT_CB_PARAMS
//   //     });
//   //     await openPosition(testSystem, market, {
//   //       amount: toBN('10'),
//   //       optionType: OptionType.LONG_CALL,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });

//   //     const fullCollatAmount = await testSystem.liquidityPool.lockedCollateral();
//   //     const baseAmount = await testSystem.snx.baseAsset.balanceOf(testSystem.liquidityPool.address);
//   //     expect(fullCollatAmount.base).to.be.gt(baseAmount);

//   //     // _maybeExchange blocked as fees still high
//   //     await testSystem.liquidityPool.exchangeBase();
//   //     expect(baseAmount).to.eq(await testSystem.snx.baseAsset.balanceOf(testSystem.liquidityPool.address));

//   //     // increase allowed fee and successfuly collateralize
//   //     await testSystem.liquidityPool.setLiquidityPoolAndCBParameters({
//   //       ...DEFAULT_LIQUIDITY_POOL_PARAMS,
//   //       maxFeePaid: toBN('0.1'),
//   //     }, {
//   //       ...DEFAULT_CB_PARAMS
//   //     });
//   //     await testSystem.liquidityPool.exchangeBase();
//   //     expect(baseAmount).to.lt(await testSystem.snx.baseAsset.balanceOf(testSystem.liquidityPool.address));
//   //   });
//   // });

//   // describe('Debt limit tests', async () => {
//   //   it('able to close short if debt limit reached', async () => {
//   //     const newDebt = toBN('0.000000000000000001');
//   //     await setDebtLimit(testSystem, newDebt);
//   //     const maxDebt = await (await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)).maxDebt();
//   //     assertCloseToPercentage(maxDebt, newDebt);

//   //     // Open SHORT PUT --> hedger should long
//   //     const positionId = await openPosition(testSystem, market, {
//   //       amount: toBN('100'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       setCollateralTo: toBN('180000'),
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //     const expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
//   //     await expectHedgeEqualTo(testSystem, expectedHedge);

//   //     await closePosition(testSystem, market, {
//   //       positionId,
//   //       amount: toBN('100'),
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //   });
//   // });

//   // describe('HedgeCap', async () => {
//   //   const hedgeCap = toBN('10');

//   //   beforeEach(async () => {
//   //     await testSystem.poolHedger.setPoolHedgerParams({
//   //       interactionDelay: (await testSystem.poolHedger.getPoolHedgerParams()).interactionDelay,
//   //       hedgeCap,
//   //     });
//   //   });

//   //   it('able to hit the hedge cap going short', async () => {
//   //     const positionId = await openPosition(testSystem, market, {
//   //       amount: toBN('100'),
//   //       iterations: 1,
//   //       optionType: OptionType.LONG_PUT,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });

//   //     await forceUpdateHedgePosition(testSystem);

//   //     // Hits hedge cap going short
//   //     const currentHedgedNetDelta = await testSystem.poolHedger.getCurrentHedgedNetDelta();
//   //     assertCloseToPercentage(currentHedgedNetDelta, hedgeCap.mul(-1));

//   //     await closePosition(testSystem, market, {
//   //       positionId,
//   //       amount: toBN('100'),
//   //       optionType: OptionType.LONG_PUT,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //     });
//   //     await forceUpdateHedgePosition(testSystem);
//   //   });

//   //   it('able to hit the hedge cap going long', async () => {
//   //     await openPosition(testSystem, market, {
//   //       amount: toBN('100'),
//   //       iterations: 1,
//   //       optionType: OptionType.SHORT_PUT_QUOTE,
//   //       strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//   //       setCollateralTo: toBN('100000'),
//   //     });

//   //     await forceUpdateHedgePosition(testSystem);

//   //     // Hits hedge cap going long
//   //     const currentHedgedNetDelta = await testSystem.poolHedger.getCurrentHedgedNetDelta();
//   //     assertCloseToPercentage(currentHedgedNetDelta, hedgeCap);
//   //   });
//   // });

//   describe('futures pool hedger tests', async () => {
//     const marketDepthBuffer = toBN('1.1');
//     // if open interest exceeeds a certain cap will need to block trades.
//     describe('hedging testing', async () => {
//       beforeEach(async () => {
//         // set  FuturesPoolHedger to replace Poolhedger
//         await testSystem.liquidityPool.connect(deployer).setPoolHedger(testSystem.futuresPoolHedger.address);
//       });

//       it('Short puts --> hedger should long and short on close', async () => {
//         // Open SHORT PUT --> hedger should long
//         const positionId = await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('18000'),
//         });
//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // hedger should long more
//         await openPosition(testSystem, market, {
//           positionId,
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('20000'),
//         });
//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // hedger should reduce long
//         await closePosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('18000'),
//         });
//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // Close SHORT PUT --> hedger position should be 0
//         await closePosition(testSystem, market, {
//           positionId,
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });
//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//       });

//       it('LONG CALL --> hedger should short and long on close', async () => {
//         // Open LONG CALL --> hedger should short
//         let positionId = await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         // console.log(testSystem.snx.quoteAsset.functions);
//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // Open LONG CALL again --> hedger should short more
//         positionId = await openPosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('10'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // Close half LONG CALL --> hedger should reduce short
//         positionId = await closePosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('10'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // Close remaining LONG CALL --> hedger position should be 0
//         await closePosition(testSystem, market, {
//           positionId,
//           amount: toBN('10'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });
//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//       });

//       it('SHORT delta to LONG delta', async () => {
//         // Open LONG CALL again --> hedger should short more
//         await openPosition(testSystem, market, {
//           amount: toBN('15'),
//           iterations: 3,
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         await openPosition(testSystem, market, {
//           amount: toBN('20'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('36000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//       });

//       it('LONG delta to SHORT delta', async () => {
//         // Open LONG CALL again --> hedger should short more

//         await openPosition(testSystem, market, {
//           amount: toBN('20'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('36000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         await openPosition(testSystem, market, {
//           amount: toBN('15'),
//           iterations: 3,
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//       });

//       it('FuturesHedger and Futuresmarket have the same amount deltas hedged', async () => {
//         // Long 10 deltas
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         const deltasToHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await forceUpdateFuturesHedgePosition(testSystem);

//         const hedgerPosition = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
//         expect(deltasToHedge).eq(hedgerPosition);
//       });
//     });

//     describe('Collateral Management', () => {
//       const perError = 500; // 1/perError
//       beforeEach(async () => {
//         // set  FuturesPoolHedger to replace Poolhedger
//         await testSystem.liquidityPool.connect(deployer).setPoolHedger(testSystem.futuresPoolHedger.address);
//         await testSystem.futuresPoolHedger.setPoolHedgerParams({
//           interactionDelay: 0,
//           hedgeCap: MAX_UINT,
//         } as PoolHedgerParametersStruct);
//       });

//       it('LONG CALL -> decrease leverage -> margin should increase', async () => {
//         // Open LONG CALL --> hedger should short
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         const expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//         const liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);

//         await testSystem.futuresPoolHedger.updateCollateral();
//         const newLiquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         expect(newLiquidity[1]).closeTo(liquidity[1].mul(10), 1 * 10 ** 13); // slightly off on the 12th digit, negligible?
//       });

//       it('LONG CALL -> decrease leverage -> margin should increase -> decrease delta -> margin should decrease but at the new leverage', async () => {
//         // Open LONG CALL --> hedger should short
//         const positionId = await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         let currentHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, currentHedge);
//         const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//         let liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);

//         await testSystem.futuresPoolHedger.setMaxLeverage(toBN('0.1')); // 10x the required capital
//         await testSystem.futuresPoolHedger.updateCollateral();
//         let newLiquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         expect(newLiquidity[1]).closeTo(liquidity[1].mul(10), 1 * 10 ** 13); // slightly off on the 12th digit, negligible?

//         await closePosition(testSystem, market, {
//           positionId,
//           amount: toBN('5'),
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         // // margin should be roughly half
//         // TODO: check the rounding case.
//         liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);

//         expect(liquidity[1].div(UNIT).toNumber()).closeTo(
//           newLiquidity[1].div(2).div(UNIT).toNumber(),
//           newLiquidity[1].div(perError).div(UNIT).toNumber(),
//         ); // 1%

//         liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         await testSystem.futuresPoolHedger.setMaxLeverage(toBN('1')); // 1/5 the required capital
//         await testSystem.futuresPoolHedger.updateCollateral();
//         newLiquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         expect(newLiquidity[1].div(UNIT).toNumber()).closeTo(
//           liquidity[1].div(10).div(UNIT).toNumber(),
//           newLiquidity[1].div(perError).div(UNIT).toNumber(),
//         ); // 1 to 1 collateralised.

//         currentHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, currentHedge);
//       });

//       it('edge case: long pool -> short equalises deltas -> all margin should be withdrawn from the account', async () => {
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('180000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//         const liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         console.log(liquidity);
//         expect(liquidity[1]).eq(toBN('0')); // 1 to 1 collateralised.
//       });

//       it('Collateral - Long delta to Short delta', async () => {
//         // Open LONG CALL again --> hedger should short more

//         // Long 10 deltas
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('180000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//         const shortSideLiquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);

//         // Short 10 deltas -> 0 delta total
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         let liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         console.log(liquidity);
//         expect(liquidity[1]).eq(toBN('0')); // 1 to 1 collateralised.

//         // short 10 deltas.
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         console.log(liquidity);
//         console.log('short side', shortSideLiquidity);
//         expect(liquidity[1]).eq(shortSideLiquidity[1]); // same deltas short should required the same liquidity as same deltas long.

//         // long 20 deltas -> short 10 deltas total
//         await openPosition(testSystem, market, {
//           amount: toBN('20'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('360000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         console.log('liquidity line 967', liquidity);
//         liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         console.log('liquidity after', liquidity);
//         console.log('short side liquidity', shortSideLiquidity);
//         expect(liquidity[1]).eq(shortSideLiquidity[1]); // double short deltas should equal deltas double long deltas collat.
//       });

//       it('Collateral - Short delta to Long delta', async () => {
//         // Open LONG CALL again --> hedger should short more

//         // Long 10 deltas
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         let expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(testSystem.optionMarket.address);
//         const shortSideLiquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);

//         // Short 10 deltas -> 0 delta total
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('180000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         let liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         console.log(liquidity);
//         expect(liquidity[1]).eq(toBN('0')); // 1 to 1 collateralised.

//         // short 10 deltas.
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('180000'),
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         console.log(liquidity);
//         console.log('short side', shortSideLiquidity);
//         expect(liquidity[1]).eq(shortSideLiquidity[1]); // same deltas short should required the same liquidity as same deltas long.

//         // long 20 deltas -> short 10 deltas total
//         await openPosition(testSystem, market, {
//           amount: toBN('20'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await forceUpdateFuturesHedgePosition(testSystem);
//         expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);
//         liquidity = await testSystem.futuresPoolHedger.getHedgingLiquidity(spotPrice);
//         expect(liquidity[1]).eq(shortSideLiquidity[1]); // double short deltas should equal deltas double long deltas collat.
//       });
//     });

//     describe('Delta threshold testing', () => {
//       beforeEach(async () => {
//         // set  FuturesPoolHedger to replace Poolhedger
//         await testSystem.liquidityPool.connect(deployer).setPoolHedger(testSystem.futuresPoolHedger.address);
//         console.log('does before each finish');

//         const maxDelta = toBN('70');
//         const deltaPerUnitModifier = toBN('8'); // need to consider if this value is relevant
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: maxDelta,
//           deltaPerUnitModifier: deltaPerUnitModifier,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('100'),
//           marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);
//       });

//       it('Will bypass interaction delay if delta is greater than threshold', async () => {
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await testSystem.futuresPoolHedger.hedgeDelta();
//         const expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // small impact on delta
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         // setting deltathreshold to 1 delta threshold.
//         const maxDelta = toBN('70');
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: maxDelta,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('1'),
//           marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);

//         await testSystem.futuresPoolHedger.hedgeDelta();
//       });

//       it('interaction delay will be triggered if already interacted and delta is below threshold', async () => {
//         await openPosition(testSystem, market, {
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await testSystem.futuresPoolHedger.hedgeDelta();
//         const expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
//         await expectFuturesHedgeEqualTo(testSystem, expectedHedge);

//         // small impact on delta
//         await openPosition(testSystem, market, {
//           amount: toBN('1'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         const maxDelta = toBN('70');
//         // setting deltathreshold to max int
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: maxDelta,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: MAX_UINT,
//           marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);

//         await expect(testSystem.futuresPoolHedger.hedgeDelta()).to.be.revertedWith('InteractionDelayNotExpired');
//       });
//     });

//     describe('Hedger Safety tests - hedger params', () => {
//       beforeEach(async () => {
//         // set  FuturesPoolHedger to replace Poolhedger
//         await testSystem.liquidityPool.connect(deployer).setPoolHedger(testSystem.futuresPoolHedger.address);
//         const maxDelta = toBN('70');
//         const deltaPerUnitModifier = toBN('8'); // need to consider if this value is relevant
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: maxDelta,
//           deltaPerUnitModifier: deltaPerUnitModifier,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('100'),
//           marketDepthBuffer: marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);
//       });

//       it('cannot trade if the trade would exceed the maximum delta, 0 to 100 long delta', async () => {
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: toBN('20'),
//           deltaPerUnitModifier: toBN('100'),
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('100'),
//           marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);

//         await expect(
//           openPosition(testSystem, market, {
//             amount: toBN('50'),
//             optionType: OptionType.LONG_CALL,
//             strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           }),
//         ).revertedWith('Delta');
//       });

//       it('will revert if multiple options a purchased continuing in teh same direction', async () => {
//         const optionsPurchased = toBN('50');

//         await openPosition(testSystem, market, {
//           amount: optionsPurchased,
//           optionType: OptionType.LONG_CALL,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await expect(
//           openPosition(testSystem, market, {
//             amount: optionsPurchased,
//             optionType: OptionType.LONG_CALL,
//             strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           }),
//         ).revertedWith('UnableToHedgeDelta');
//       });

//       it('Long to delta threshold and short to delta threshold', async () => {
//         const optionsPurchased = toBN('50');
//         await openPosition(testSystem, market, {
//           amount: optionsPurchased,
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await openPosition(testSystem, market, {
//           amount: optionsPurchased,
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('100000'),
//         });
//       });

//       it.skip('revert if order is larger than the snx pools can handle');

//       it.skip(
//         'prevent further trades if the cummlative hedged amount is greater than can be supported by the snx pool.',
//       );
//     });

//     describe('Futures Pool Hedger -> can always close', () => {
//       beforeEach(async () => {
//         // set  FuturesPoolHedger to replace Poolhedger
//         await testSystem.liquidityPool.connect(deployer).setPoolHedger(testSystem.futuresPoolHedger.address);
//         const maxDelta = toBN('70');
//         const deltaPerUnitModifier = toBN('8'); // need to consider if this value is relevant
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: maxDelta,
//           deltaPerUnitModifier: deltaPerUnitModifier,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('100'),
//           marketDepthBuffer: marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);
//       });

//       it('can always close even if the closed position would be over the delta threshold', async () => {
//         const positionId = await openPosition(testSystem, market, {
//           amount: toBN('15'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         // changing the delta threshold
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: MAX_UINT128,
//           deltaPerUnitModifier: MAX_UINT128,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('10'),
//           marketDepthBuffer: marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);

//         // Close half LONG CALL --> hedger should reduce short
//         await closePosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('1'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });
//       });

//       it('can always close, then can open new position after closed below delta threshold', async () => {
//         const positionId = await openPosition(testSystem, market, {
//           amount: toBN('15'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta();

//         const curHedge = (await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta()).mul(-1);
//         // changing the delta threshold
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: curHedge,
//           deltaPerUnitModifier: MAX_UINT128,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('10'),
//           marketDepthBuffer: marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);

//         // Close half LONG CALL --> hedger should reduce short
//         await closePosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('1'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await closePosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('10'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await expect(
//           openPosition(testSystem, market, {
//             amount: toBN('15'),
//             optionType: OptionType.LONG_PUT,
//             strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           }),
//         ).revertedWith('UnableToHedgeDelta');

//         await closePosition(testSystem, market, {
//           positionId: positionId,
//           amount: toBN('4'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await testSystem.futuresPoolHedger.hedgeDelta();

//         await openPosition(testSystem, market, {
//           amount: toBN('4'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await expect(
//           openPosition(testSystem, market, {
//             amount: toBN('15'),
//             optionType: OptionType.LONG_PUT,
//             strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           }),
//         ).revertedWith('UnableToHedgeDelta');
//       });

//       it('buys to limit, then goes net 0, then should be able to close both positions', async () => {
//         const positionId = await openPosition(testSystem, market, {
//           amount: toBN('15'),
//           optionType: OptionType.LONG_PUT,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });

//         await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta();

//         const curHedge = (await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta()).mul(-1);
//         // changing the delta threshold
//         await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
//           maximumDelta: curHedge,
//           deltaPerUnitModifier: MAX_UINT128,
//           maximumFundingRatePerDelta: MAX_UINT128,
//           deltaThreshold: toBN('10'),
//           marketDepthBuffer: marketDepthBuffer,
//         } as FuturesPoolHedgerParametersStruct);

//         // Close half LONG CALL --> hedger should reduce short
//         const newPositon = await openPosition(testSystem, market, {
//           amount: toBN('15'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           setCollateralTo: toBN('18000'),
//         });

//         await expect(
//           openPosition(testSystem, market, {
//             amount: toBN('20'),
//             optionType: OptionType.LONG_PUT,
//             strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//           }),
//         ).revertedWith('UnableToHedgeDelta');

//         await expect(
//           openPosition(testSystem, market, {
//             amount: toBN('15'),
//             optionType: OptionType.LONG_PUT,
//             strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//             setCollateralTo: toBN('18000'),
//           }),
//         ).revertedWith('UnableToHedgeDelta');

//         // close opposite side to further extend delta
//         await closePosition(testSystem, market, {
//           positionId: newPositon,
//           amount: toBN('15'),
//           optionType: OptionType.SHORT_PUT_QUOTE,
//           strikeId: marketView.liveBoards[0].strikes[0].strikeId,
//         });
//       });
//     });
//   });
// });
