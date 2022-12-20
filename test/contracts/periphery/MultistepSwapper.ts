// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
// import { ethers } from 'hardhat';
// import { MAX_UINT, toBN, toBytes32, UNIT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
// import { MultistepSwapper, TestERC20, TestSwapRouter } from '../../../typechain-types';
// import { TestSystemContractsType } from '../../utils/deployTestSystem';
// import { restoreSnapshot, takeSnapshot } from '../../utils/evm';
// import { deployFixture } from '../../utils/fixture';
// import { expect, hre } from '../../utils/testSetup';

// enum SwapType {
//   Synthetix = '0',
//   Uniswap = '1',
// }

// const EMPTY_KEY = toBytes32('');
// const SUSD_KEY = toBytes32('sUSD');
// const SETH_KEY = toBytes32('sETH');

// type TestSwapSystemContractsType = {
//   multistepSwapper: MultistepSwapper;
//   swapRouter: TestSwapRouter;
//   ETH: TestERC20;
//   USDC: TestERC20;
//   DAI: TestERC20;
// };

// export async function deployAndInitTestContracts(
//   deployer: SignerWithAddress,
//   c: TestSystemContractsType,
// ): Promise<TestSwapSystemContractsType> {
//   const multistepSwapper = (await (await ethers.getContractFactory('MultistepSwapper'))
//     .connect(deployer)
//     .deploy()) as MultistepSwapper;
//   const ETH = (await (await ethers.getContractFactory('TestERC20'))
//     .connect(deployer)
//     .deploy('Ethereum', 'ETH')) as TestERC20;
//   const swapRouter = (await (await ethers.getContractFactory('TestSwapRouter'))
//     .connect(deployer)
//     .deploy(ZERO_ADDRESS, ETH.address)) as TestSwapRouter;
//   const USDC = (await (await ethers.getContractFactory('TestERC20SetDecimals'))
//     .connect(deployer)
//     .deploy('USDC', 'USDC', 6)) as TestERC20;
//   const DAI = (await (await ethers.getContractFactory('TestERC20'))
//     .connect(deployer)
//     .deploy('DAI', 'DAI')) as TestERC20;
//   await swapRouter.addToken(ETH.address, toBN('3000'));
//   await swapRouter.addToken(USDC.address, toBN('1.1'));
//   await swapRouter.addToken(DAI.address, toBN('0.9'));
//   await swapRouter.addToken(c.snx.quoteAsset.address, toBN('1'));
//   await swapRouter.addToken(c.snx.baseAsset.address, toBN('2500'));

//   await c.snx.quoteAsset.permitMint(swapRouter.address, true);
//   await c.snx.baseAsset.permitMint(swapRouter.address, true);
//   await ETH.permitMint(swapRouter.address, true);
//   await USDC.permitMint(swapRouter.address, true);
//   await DAI.permitMint(swapRouter.address, true);
//   return {
//     multistepSwapper,
//     swapRouter,
//     ETH,
//     USDC,
//     DAI,
//   };
// }

// describe.skip('MultistepSwapper - unit tests', async () => {
//   let deployer: SignerWithAddress;
//   let alice: SignerWithAddress;
//   let c: TestSystemContractsType;
//   let swapC: TestSwapSystemContractsType;
//   let snap: number;

//   before(async () => {
//     [deployer, alice] = await ethers.getSigners();
//     // c = await deployTestSystem(deployer);
//     await deployFixture();
//     c = hre.f.c;

//     swapC = await deployAndInitTestContracts(deployer, c);
//     await swapC.multistepSwapper.init(swapC.swapRouter.address, c.snx.synthetix.address);
//     await c.snx.baseAsset.connect(alice).approve(swapC.multistepSwapper.address, MAX_UINT);
//     await c.snx.quoteAsset.connect(alice).approve(swapC.multistepSwapper.address, MAX_UINT);
//     await swapC.ETH.connect(alice).approve(swapC.multistepSwapper.address, MAX_UINT);
//     await swapC.USDC.connect(alice).approve(swapC.multistepSwapper.address, MAX_UINT);
//     await swapC.DAI.connect(alice).approve(swapC.multistepSwapper.address, MAX_UINT);
//   });

//   beforeEach(async () => {
//     snap = await takeSnapshot();
//   });

//   afterEach(async () => {
//     await restoreSnapshot(snap);
//   });

//   describe('init', async () => {
//     it('should not allow init twice', async () => {
//       await expect(swapC.multistepSwapper.init(swapC.swapRouter.address, c.snx.synthetix.address)).revertedWith(
//         'already initialized',
//       );
//     });
//   });

//   describe('swaps', async () => {
//     it('swap synth to synth via synthetix', async () => {
//       const amountIn = toBN('5');
//       await c.snx.baseAsset.mint(alice.address, amountIn);
//       const tokenInSpot = (await c.snx.exchangeRates.rateAndInvalid(toBytes32('sETH'))).rate;
//       const tokenOutSpot = await swapC.swapRouter.rates(c.snx.quoteAsset.address);
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         c.snx.baseAsset.address,
//         SETH_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Synthetix,
//             tokenOut: c.snx.quoteAsset.address,
//             tokenOutCurrencyKey: SUSD_KEY,
//             poolFee: 0,
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await c.snx.baseAsset.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.quoteAsset.balanceOf(alice.address)).gte(minAmountOut);
//     });
//     it('swap token to token via uniswap', async () => {
//       const amountIn = toBN('5');
//       await swapC.ETH.mint(alice.address, amountIn);
//       const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
//       const tokenOutSpot = await swapC.swapRouter.rates(swapC.USDC.address);
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         swapC.ETH.address,
//         EMPTY_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: swapC.USDC.address,
//             tokenOutCurrencyKey: EMPTY_KEY,
//             poolFee: '3000',
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await swapC.ETH.balanceOf(alice.address)).eq('0');
//       expect(await swapC.USDC.balanceOf(alice.address)).gt('0');
//     });
//     it('swap token to token to token via uniswap', async () => {
//       const amountIn = toBN('5');
//       await swapC.ETH.mint(alice.address, amountIn);
//       const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
//       const tokenOutSpot = await swapC.swapRouter.rates(swapC.DAI.address);
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         swapC.ETH.address,
//         EMPTY_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: swapC.USDC.address,
//             tokenOutCurrencyKey: EMPTY_KEY,
//             poolFee: '3000',
//           },
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: swapC.DAI.address,
//             tokenOutCurrencyKey: EMPTY_KEY,
//             poolFee: '1000',
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await swapC.ETH.balanceOf(alice.address)).eq('0');
//       expect(await swapC.DAI.balanceOf(alice.address)).gte(minAmountOut);
//     });
//     it('swap ETH to sUSD via uniswap', async () => {
//       const amountIn = toBN('10');
//       await swapC.ETH.mint(alice.address, amountIn);
//       const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
//       const tokenOutSpot = await swapC.swapRouter.rates(c.snx.quoteAsset.address);
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         swapC.ETH.address,
//         EMPTY_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: c.snx.quoteAsset.address,
//             tokenOutCurrencyKey: SUSD_KEY,
//             poolFee: '1000',
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await swapC.ETH.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.quoteAsset.balanceOf(alice.address)).gte(minAmountOut);
//     });
//     it('swap ETH to sUSD to sETH via uniswap and synthetix', async () => {
//       const amountIn = toBN('5');
//       await swapC.ETH.mint(alice.address, amountIn);
//       const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
//       const tokenOutSpot = (await c.snx.exchangeRates.rateAndInvalid(toBytes32('sETH'))).rate;
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         swapC.ETH.address,
//         EMPTY_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: c.snx.quoteAsset.address,
//             tokenOutCurrencyKey: SUSD_KEY,
//             poolFee: '3000',
//           },
//           {
//             swapType: SwapType.Synthetix,
//             tokenOut: c.snx.baseAsset.address,
//             tokenOutCurrencyKey: SETH_KEY,
//             poolFee: '0',
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await swapC.ETH.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.quoteAsset.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.baseAsset.balanceOf(alice.address)).gte(minAmountOut);
//     });
//     it('swap ETH to DAI to sUSD to sETH via uniswap and synthetix', async () => {
//       const amountIn = toBN('5');
//       await swapC.ETH.mint(alice.address, amountIn);
//       const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
//       const tokenOutSpot = (await c.snx.exchangeRates.rateAndInvalid(toBytes32('sETH'))).rate;
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         swapC.ETH.address,
//         EMPTY_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: swapC.DAI.address,
//             tokenOutCurrencyKey: EMPTY_KEY,
//             poolFee: '3000',
//           },
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: c.snx.quoteAsset.address,
//             tokenOutCurrencyKey: SUSD_KEY,
//             poolFee: '1000',
//           },
//           {
//             swapType: SwapType.Synthetix,
//             tokenOut: c.snx.baseAsset.address,
//             tokenOutCurrencyKey: SETH_KEY,
//             poolFee: '0',
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await swapC.ETH.balanceOf(alice.address)).eq('0');
//       expect(await swapC.DAI.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.quoteAsset.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.baseAsset.balanceOf(alice.address)).gte(minAmountOut);
//     });

//     it('swap ETH to sUSD to sETH to sUSD to DAI via uniswap and synthetix', async () => {
//       const amountIn = toBN('5');
//       await swapC.ETH.mint(alice.address, amountIn);
//       const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
//       const tokenOutSpot = await swapC.swapRouter.rates(swapC.DAI.address);
//       const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
//       await swapC.multistepSwapper.connect(alice).swap(
//         swapC.ETH.address,
//         EMPTY_KEY,
//         amountIn,
//         [
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: c.snx.quoteAsset.address,
//             tokenOutCurrencyKey: SUSD_KEY,
//             poolFee: '3000',
//           },
//           {
//             swapType: SwapType.Synthetix,
//             tokenOut: c.snx.baseAsset.address,
//             tokenOutCurrencyKey: SETH_KEY,
//             poolFee: '0',
//           },
//           {
//             swapType: SwapType.Synthetix,
//             tokenOut: c.snx.quoteAsset.address,
//             tokenOutCurrencyKey: SUSD_KEY,
//             poolFee: '0',
//           },
//           {
//             swapType: SwapType.Uniswap,
//             tokenOut: swapC.DAI.address,
//             tokenOutCurrencyKey: EMPTY_KEY,
//             poolFee: '1000',
//           },
//         ],
//         minAmountOut,
//       );
//       expect(await swapC.ETH.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.quoteAsset.balanceOf(alice.address)).eq('0');
//       expect(await c.snx.baseAsset.balanceOf(alice.address)).eq('0');
//       expect(await swapC.DAI.balanceOf(alice.address)).gte(minAmountOut);
//     });
//   });
// });
