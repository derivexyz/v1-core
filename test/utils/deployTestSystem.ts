import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { MockContract } from 'ethereum-waffle';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { DAY_SEC, toBN, toBytes32 } from '../../scripts/util/web3utils';
import {
  BlackScholes,
  IExchanger,
  IExchangeRates,
  LiquidityCertificate,
  LyraGlobals,
  LyraMarketsRegistry,
  OptionGreekCache,
  OptionMarket,
  OptionMarketPricer,
  OptionMarketSafeSlippage,
  OptionMarketViewer,
  OptionToken,
  PoolHedger,
  ShortCollateral,
  TestCollateralShort,
  TestERC20Fail,
  TestLiquidityPool,
  TestSynthetixReturnZero,
} from '../../typechain';
import * as IExchangerJson from './mocked/interfaces/IExchanger.json';
import * as IExchangeRatesJson from './mocked/interfaces/IExchangeRates.json';
import { MockedExchanger } from './mocked/MockedExchanger';
import { MockedExchangeRates } from './mocked/MockedExchangeRates';

export type TestSystemContractsType = {
  lyraGlobals: LyraGlobals;
  registry: LyraMarketsRegistry;
  optionMarket: OptionMarket;
  optionMarketPricer: OptionMarketPricer;
  optionGreekCache: OptionGreekCache;
  optionToken: OptionToken;
  liquidityPool: TestLiquidityPool;
  liquidityCertificate: LiquidityCertificate;
  blackScholes: BlackScholes;
  shortCollateral: ShortCollateral;
  optionMarketViewer: OptionMarketViewer;
  optionMarketSafeSlippage: OptionMarketSafeSlippage;
  poolHedger: PoolHedger;
  test: {
    collateralShort: TestCollateralShort;
    synthetix: TestSynthetixReturnZero;
    quoteToken: TestERC20Fail;
    baseToken: TestERC20Fail;
  };
  mocked: {
    exchangeRates: MockedExchangeRates;
    exchanger: MockedExchanger;
  };
};

export async function deployTestContracts(deployer: Signer): Promise<TestSystemContractsType> {
  // Deploy mocked contracts
  const mockedExchangeRatesContract = await deployMockContract(deployer, IExchangeRatesJson.abi);
  const exchangeRates = new MockedExchangeRates(mockedExchangeRatesContract as MockContract & IExchangeRates);

  const mockedExchangerContract = await deployMockContract(deployer, IExchangerJson.abi);
  const exchanger = new MockedExchanger(mockedExchangerContract as MockContract & IExchanger);

  // Deploy real contracts

  const lyraGlobals = (await (await ethers.getContractFactory('LyraGlobals'))
    .connect(deployer)
    .deploy()) as LyraGlobals;

  const blackScholes = (await (await ethers.getContractFactory('BlackScholes'))
    .connect(deployer)
    .deploy()) as BlackScholes;

  const registry = (await (await ethers.getContractFactory('LyraMarketsRegistry'))
    .connect(deployer)
    .deploy()) as LyraMarketsRegistry;

  const optionMarket = (await (await ethers.getContractFactory('OptionMarket'))
    .connect(deployer)
    .deploy()) as OptionMarket;

  const optionMarketPricer = (await (await ethers.getContractFactory('OptionMarketPricer'))
    .connect(deployer)
    .deploy()) as OptionMarketPricer;

  const optionGreekCache = (await (await ethers.getContractFactory('OptionGreekCache'))
    .connect(deployer)
    .deploy()) as OptionGreekCache;

  const liquidityPool = (await (await ethers.getContractFactory('TestLiquidityPool'))
    .connect(deployer)
    .deploy()) as TestLiquidityPool;

  const liquidityCertificate = (await (await ethers.getContractFactory('LiquidityCertificate'))
    .connect(deployer)
    .deploy('USD/ETH Pool Certificate', 'UEP')) as LiquidityCertificate;

  const optionToken = (await (await ethers.getContractFactory('OptionToken'))
    .connect(deployer)
    .deploy('USD/ETH Option Tokens')) as OptionToken;

  const shortCollateral = (await (await ethers.getContractFactory('ShortCollateral'))
    .connect(deployer)
    .deploy()) as ShortCollateral;

  const optionMarketViewer = (await (await ethers.getContractFactory('OptionMarketViewer'))
    .connect(deployer)
    .deploy()) as OptionMarketViewer;

  const optionMarketSafeSlippage = (await (await ethers.getContractFactory('OptionMarketSafeSlippage'))
    .connect(deployer)
    .deploy()) as OptionMarketSafeSlippage;

  // Test Contracts

  const quoteToken = (await (await ethers.getContractFactory('TestERC20Fail'))
    .connect(deployer)
    .deploy('Synthetic USD', 'sUSD')) as TestERC20Fail;

  const baseToken = (await (await ethers.getContractFactory('TestERC20Fail'))
    .connect(deployer)
    .deploy('Synthetic ETH', 'sETH')) as TestERC20Fail;

  const synthetix = (await (await ethers.getContractFactory('TestSynthetixReturnZero'))
    .connect(deployer)
    .deploy()) as TestSynthetixReturnZero;

  const poolHedger = (await (await ethers.getContractFactory('PoolHedger')).connect(deployer).deploy()) as PoolHedger;

  const collateralShort = (await (await ethers.getContractFactory('TestCollateralShort'))
    .connect(deployer)
    .deploy()) as TestCollateralShort;

  return {
    lyraGlobals,
    registry,
    optionMarket,
    optionGreekCache,
    optionMarketPricer,
    optionToken,
    blackScholes,
    liquidityPool,
    liquidityCertificate,
    shortCollateral,
    optionMarketViewer,
    optionMarketSafeSlippage,
    poolHedger,
    mocked: {
      exchangeRates,
      exchanger,
    },
    test: {
      quoteToken,
      baseToken,
      synthetix,
      collateralShort,
    },
  };
}

export async function initTestSystem(c: TestSystemContractsType, overrides: any) {
  await c.mocked.exchanger.mockFeeFor('sETH', 'sUSD', toBN('0.0075'));
  await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('0.005'));
  await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));

  // Initialize the contracts

  await c.lyraGlobals.setGlobals(
    c.test.synthetix.address,
    c.mocked.exchanger.contract.address,
    c.mocked.exchangeRates.contract.address,
    c.test.collateralShort.address,
  );

  await c.lyraGlobals.setGlobalsForContract(
    c.optionMarket.address,
    DAY_SEC / 2,
    {
      optionPriceFeeCoefficient: toBN('0.01'),
      spotPriceFeeCoefficient: toBN('0.01'),
      vegaFeeCoefficient: toBN('300'),
      vegaNormFactor: toBN('0.2'),
      standardSize: toBN('5'),
      skewAdjustmentFactor: toBN('0.75'),
      rateAndCarry: toBN('0.1'),
      minDelta: toBN('0.15'),
      volatilityCutoff: toBN('0.55'),
      spotPrice: 0,
    },
    toBytes32('sUSD'),
    toBytes32('sETH'),
  );

  await c.optionMarket.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.liquidityPool || c.liquidityPool.address,
    overrides.optionMarketPricer || c.optionMarketPricer.address,
    overrides.optionGreekCache || c.optionGreekCache.address,
    overrides.shortCollateral || c.shortCollateral.address,
    overrides.optionToken || c.optionToken.address,
    overrides.quoteToken || c.test.quoteToken.address,
    overrides.baseToken || c.test.baseToken.address,
    [
      'TransferOwnerToZero',
      'InvalidBoardId',
      'InvalidBoardIdOrNotFrozen',
      'InvalidListingIdOrNotFrozen',
      'StrikeSkewLengthMismatch',
      'BoardMaxExpiryReached',
      'CannotStartNewRoundWhenBoardsExist',
      'ZeroAmountOrInvalidTradeType',
      'BoardFrozenOrTradingCutoffReached',
      'QuoteTransferFailed',
      'BaseTransferFailed',
      'BoardNotExpired',
      'BoardAlreadyLiquidated',
      'OnlyOwner',
    ],
  );

  await c.optionMarketPricer.init(
    overrides.optionMarket || c.optionMarket.address,
    overrides.optionGreekCache || c.optionGreekCache.address,
  );

  await c.optionGreekCache.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.optionMarket || c.optionMarket.address,
    overrides.optionMarketPricer || c.optionMarketPricer.address,
    overrides.blackScholes || c.blackScholes.address,
  );

  await c.liquidityPool.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.optionMarket || c.optionMarket.address,
    overrides.liquidityCertificate || c.liquidityCertificate.address,
    overrides.poolHedger || c.poolHedger.address,
    overrides.shortCollateral || c.shortCollateral.address,
    overrides.quoteToken || c.test.quoteToken.address,
    overrides.baseToken || c.test.baseToken.address,
    [
      'QuoteTransferFailed',
      'AlreadySignalledWithdrawal',
      'SignallingBetweenRounds',
      'UnSignalMustSignalFirst',
      'UnSignalAlreadyBurnable',
      'WithdrawNotBurnable',
      'EndRoundWithLiveBoards',
      'EndRoundAlreadyEnded',
      'EndRoundMustExchangeBase',
      'EndRoundMustHedgeDelta',
      'StartRoundMustEndRound',
      'ReceivedZeroFromBaseQuoteExchange',
      'ReceivedZeroFromQuoteBaseExchange',
      'LockingMoreQuoteThanIsFree',
      'LockingMoreBaseThanCanBeExchanged',
      'FreeingMoreBaseThanLocked',
      'SendPremiumNotEnoughCollateral',
      'OnlyPoolHedger',
      'OnlyOptionMarket',
      'OnlyShortCollateral',
      'ReentrancyDetected',
    ],
  );

  await c.liquidityCertificate.init(overrides.liquidityPool || c.liquidityPool.address);

  await c.poolHedger.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.optionMarket || c.optionMarket.address,
    overrides.optionGreekCache || c.optionGreekCache.address,
    overrides.liquidityPool || c.liquidityPool.address,
    overrides.quoteToken || c.test.quoteToken.address,
    overrides.baseToken || c.test.baseToken.address,
  );

  await c.shortCollateral.init(
    overrides.optionMarket || c.optionMarket.address,
    overrides.liquidityPool || c.liquidityPool.address,
    overrides.quoteToken || c.test.quoteToken.address,
    overrides.baseToken || c.test.baseToken.address,
  );

  await c.optionMarketViewer.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.optionMarket || c.optionMarket.address,
    overrides.optionMarketPricer || c.optionMarketPricer.address,
    overrides.optionGreekCache || c.optionGreekCache.address,
    overrides.optionToken || c.optionToken.address,
    overrides.liquidityPool || c.liquidityPool.address,
    overrides.blackScholes || c.blackScholes.address,
  );

  await c.optionMarketSafeSlippage.init(
    overrides.optionMarket || c.optionMarket.address,
    overrides.optionToken || c.optionToken.address,
    overrides.quoteToken || c.test.quoteToken.address,
    overrides.baseToken || c.test.baseToken.address,
  );

  await c.optionToken.init(overrides.optionMarket || c.optionMarket.address);

  await c.test.synthetix.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.quoteToken || c.test.quoteToken.address,
  );

  await c.test.synthetix.addBaseAsset(
    toBytes32('sETH'),
    overrides.baseToken || c.test.baseToken.address,
    c.optionMarket.address,
  );

  await c.test.collateralShort.init(
    overrides.lyraGlobals || c.lyraGlobals.address,
    overrides.quoteToken || c.test.quoteToken.address,
  );

  await c.test.collateralShort.addBaseAsset(
    toBytes32('sETH'),
    overrides.baseToken || c.test.baseToken.address,
    c.optionMarket.address,
  );

  await c.test.baseToken.permitMint(c.test.synthetix.address, true);
  await c.test.baseToken.permitMint(c.test.collateralShort.address, true);
  await c.test.quoteToken.permitMint(c.test.synthetix.address, true);
  await c.test.quoteToken.permitMint(c.test.collateralShort.address, true);
}

export async function deployTestSystem(deployer: Signer): Promise<TestSystemContractsType> {
  const c = await deployTestContracts(deployer);
  await initTestSystem(c, {});
  return c;
}
