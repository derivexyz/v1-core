import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { MAX_UINT, toBN, toBytes32, UNIT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { MultistepSwapper, TestERC20, TestSwapRouter } from '../../../typechain';
import { restoreSnapshot, takeSnapshot } from '../../utils';
import { deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { expect } from '../../utils/testSetup';

enum SwapType {
  Synthetix = '0',
  Uniswap = '1',
}

const EMPTY_KEY = toBytes32('');
const SUSD_KEY = toBytes32('sUSD');
const SETH_KEY = toBytes32('sETH');

type TestSwapSystemContractsType = {
  multistepSwapper: MultistepSwapper;
  swapRouter: TestSwapRouter;
  ETH: TestERC20;
  USDC: TestERC20;
  DAI: TestERC20;
};

export async function deployAndInitTestContracts(
  deployer: Signer,
  c: TestSystemContractsType,
): Promise<TestSwapSystemContractsType> {
  const multistepSwapper = (await (await ethers.getContractFactory('MultistepSwapper'))
    .connect(deployer)
    .deploy()) as MultistepSwapper;
  const ETH = (await (await ethers.getContractFactory('TestERC20'))
    .connect(deployer)
    .deploy('Ethereum', 'ETH')) as TestERC20;
  const swapRouter = (await (await ethers.getContractFactory('TestSwapRouter'))
    .connect(deployer)
    .deploy(ZERO_ADDRESS, ETH.address)) as TestSwapRouter;
  const USDC = (await (await ethers.getContractFactory('TestERC20SetDecimals'))
    .connect(deployer)
    .deploy('USDC', 'USDC', 6)) as TestERC20;
  const DAI = (await (await ethers.getContractFactory('TestERC20'))
    .connect(deployer)
    .deploy('DAI', 'DAI')) as TestERC20;
  await swapRouter.addToken(ETH.address, toBN('3000'));
  await swapRouter.addToken(USDC.address, toBN('1.1'));
  await swapRouter.addToken(DAI.address, toBN('0.9'));
  await swapRouter.addToken(c.test.quoteToken.address, toBN('1'));
  await swapRouter.addToken(c.test.baseToken.address, toBN('2500'));

  await c.test.quoteToken.permitMint(swapRouter.address, true);
  await c.test.baseToken.permitMint(swapRouter.address, true);
  await ETH.permitMint(swapRouter.address, true);
  await USDC.permitMint(swapRouter.address, true);
  await DAI.permitMint(swapRouter.address, true);
  return {
    multistepSwapper,
    swapRouter,
    ETH,
    USDC,
    DAI,
  };
}

describe('MultistepSwapper - unit tests', async () => {
  let deployer: Signer;
  let account: Signer;
  let accountAddr: string;
  let c: TestSystemContractsType;
  let swapC: TestSwapSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    account = signers[1];
    accountAddr = await account.getAddress();
    c = await deployTestSystem(deployer);
    swapC = await deployAndInitTestContracts(deployer, c);
    await swapC.multistepSwapper.init(swapC.swapRouter.address, c.test.synthetix.address);
    await c.test.baseToken.connect(account).approve(swapC.multistepSwapper.address, MAX_UINT);
    await c.test.quoteToken.connect(account).approve(swapC.multistepSwapper.address, MAX_UINT);
    await swapC.ETH.connect(account).approve(swapC.multistepSwapper.address, MAX_UINT);
    await swapC.USDC.connect(account).approve(swapC.multistepSwapper.address, MAX_UINT);
    await swapC.DAI.connect(account).approve(swapC.multistepSwapper.address, MAX_UINT);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('should not allow init twice', async () => {
      await expect(swapC.multistepSwapper.init(swapC.swapRouter.address, c.test.synthetix.address)).revertedWith(
        'contract already initialized',
      );
    });
  });

  describe('swaps', async () => {
    it('swap synth to synth via synthetix', async () => {
      const amountIn = toBN('5');
      await c.test.baseToken.mint(accountAddr, amountIn);
      const tokenInSpot = (await c.mocked.exchangeRates.contract.rateAndInvalid(toBytes32('sETH'))).rate;
      const tokenOutSpot = await swapC.swapRouter.rates(c.test.quoteToken.address);
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        c.test.baseToken.address,
        SETH_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Synthetix,
            tokenOut: c.test.quoteToken.address,
            tokenOutCurrencyKey: SUSD_KEY,
            poolFee: toBN('0'),
          },
        ],
        minAmountOut,
      );
      expect(await c.test.baseToken.balanceOf(accountAddr)).eq('0');
      expect(await c.test.quoteToken.balanceOf(accountAddr)).gte(minAmountOut);
    });
    it('swap token to token via uniswap', async () => {
      const amountIn = toBN('5');
      await swapC.ETH.mint(accountAddr, amountIn);
      const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
      const tokenOutSpot = await swapC.swapRouter.rates(swapC.USDC.address);
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        swapC.ETH.address,
        EMPTY_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Uniswap,
            tokenOut: swapC.USDC.address,
            tokenOutCurrencyKey: EMPTY_KEY,
            poolFee: '3000',
          },
        ],
        minAmountOut,
      );
      expect(await swapC.ETH.balanceOf(accountAddr)).eq('0');
      expect(await swapC.USDC.balanceOf(accountAddr)).gt('0');
    });
    it('swap token to token to token via uniswap', async () => {
      const amountIn = toBN('5');
      await swapC.ETH.mint(accountAddr, amountIn);
      const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
      const tokenOutSpot = await swapC.swapRouter.rates(swapC.DAI.address);
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        swapC.ETH.address,
        EMPTY_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Uniswap,
            tokenOut: swapC.USDC.address,
            tokenOutCurrencyKey: EMPTY_KEY,
            poolFee: '3000',
          },
          {
            swapType: SwapType.Uniswap,
            tokenOut: swapC.DAI.address,
            tokenOutCurrencyKey: EMPTY_KEY,
            poolFee: '1000',
          },
        ],
        minAmountOut,
      );
      expect(await swapC.ETH.balanceOf(accountAddr)).eq('0');
      expect(await swapC.DAI.balanceOf(accountAddr)).gte(minAmountOut);
    });
    it('swap ETH to sUSD via uniswap', async () => {
      const amountIn = toBN('10');
      await swapC.ETH.mint(accountAddr, amountIn);
      const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
      const tokenOutSpot = await swapC.swapRouter.rates(c.test.quoteToken.address);
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        swapC.ETH.address,
        EMPTY_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Uniswap,
            tokenOut: c.test.quoteToken.address,
            tokenOutCurrencyKey: SUSD_KEY,
            poolFee: '1000',
          },
        ],
        minAmountOut,
      );
      expect(await swapC.ETH.balanceOf(accountAddr)).eq('0');
      expect(await c.test.quoteToken.balanceOf(accountAddr)).gte(minAmountOut);
    });
    it('swap ETH to sUSD to sETH via uniswap and synthetix', async () => {
      const amountIn = toBN('5');
      await swapC.ETH.mint(accountAddr, amountIn);
      const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
      const tokenOutSpot = (await c.mocked.exchangeRates.contract.rateAndInvalid(toBytes32('sETH'))).rate;
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        swapC.ETH.address,
        EMPTY_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Uniswap,
            tokenOut: c.test.quoteToken.address,
            tokenOutCurrencyKey: SUSD_KEY,
            poolFee: '3000',
          },
          {
            swapType: SwapType.Synthetix,
            tokenOut: c.test.baseToken.address,
            tokenOutCurrencyKey: SETH_KEY,
            poolFee: '0',
          },
        ],
        minAmountOut,
      );
      expect(await swapC.ETH.balanceOf(accountAddr)).eq('0');
      expect(await c.test.quoteToken.balanceOf(accountAddr)).eq('0');
      expect(await c.test.baseToken.balanceOf(accountAddr)).gte(minAmountOut);
    });
    it('swap ETH to DAI to sUSD to sETH via uniswap and synthetix', async () => {
      const amountIn = toBN('5');
      await swapC.ETH.mint(accountAddr, amountIn);
      const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
      const tokenOutSpot = (await c.mocked.exchangeRates.contract.rateAndInvalid(toBytes32('sETH'))).rate;
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        swapC.ETH.address,
        EMPTY_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Uniswap,
            tokenOut: swapC.DAI.address,
            tokenOutCurrencyKey: EMPTY_KEY,
            poolFee: '3000',
          },
          {
            swapType: SwapType.Uniswap,
            tokenOut: c.test.quoteToken.address,
            tokenOutCurrencyKey: SUSD_KEY,
            poolFee: '1000',
          },
          {
            swapType: SwapType.Synthetix,
            tokenOut: c.test.baseToken.address,
            tokenOutCurrencyKey: SETH_KEY,
            poolFee: '0',
          },
        ],
        minAmountOut,
      );
      expect(await swapC.ETH.balanceOf(accountAddr)).eq('0');
      expect(await swapC.DAI.balanceOf(accountAddr)).eq('0');
      expect(await c.test.quoteToken.balanceOf(accountAddr)).eq('0');
      expect(await c.test.baseToken.balanceOf(accountAddr)).gte(minAmountOut);
    });

    it('swap ETH to sUSD to sETH to sUSD to DAI via uniswap and synthetix', async () => {
      const amountIn = toBN('5');
      await swapC.ETH.mint(accountAddr, amountIn);
      const tokenInSpot = await swapC.swapRouter.rates(swapC.ETH.address);
      const tokenOutSpot = await swapC.swapRouter.rates(swapC.DAI.address);
      const minAmountOut = tokenInSpot.mul(amountIn).div(tokenOutSpot).mul(toBN('0.95')).div(UNIT); // 5% slippage
      await swapC.multistepSwapper.connect(account).swap(
        swapC.ETH.address,
        EMPTY_KEY,
        amountIn,
        [
          {
            swapType: SwapType.Uniswap,
            tokenOut: c.test.quoteToken.address,
            tokenOutCurrencyKey: SUSD_KEY,
            poolFee: '3000',
          },
          {
            swapType: SwapType.Synthetix,
            tokenOut: c.test.baseToken.address,
            tokenOutCurrencyKey: SETH_KEY,
            poolFee: '0',
          },
          {
            swapType: SwapType.Synthetix,
            tokenOut: c.test.quoteToken.address,
            tokenOutCurrencyKey: SUSD_KEY,
            poolFee: '0',
          },
          {
            swapType: SwapType.Uniswap,
            tokenOut: swapC.DAI.address,
            tokenOutCurrencyKey: EMPTY_KEY,
            poolFee: '1000',
          },
        ],
        minAmountOut,
      );
      expect(await swapC.ETH.balanceOf(accountAddr)).eq('0');
      expect(await c.test.quoteToken.balanceOf(accountAddr)).eq('0');
      expect(await c.test.baseToken.balanceOf(accountAddr)).eq('0');
      expect(await swapC.DAI.balanceOf(accountAddr)).gte(minAmountOut);
    });
  });
});
