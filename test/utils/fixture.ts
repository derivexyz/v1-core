import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/src/types/runtime';
import {
  DEFAULT_DECIMALS,
  MAX_UINT,
  OptionType,
  toBN,
  toBytes32,
  TradeDirection,
  ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import {
  ISwapRouter,
  IUniswapV3Pool,
  MockSystemStatus,
  SNXPerpsV2PoolHedger,
  TestERC20Fail,
  TestERC20SetDecimals,
  TestFuturesMarketSettings,
  TestPerpsMarket,
  TestWETH,
} from '../../typechain-types';
import { BoardViewStruct, MarketViewStruct, StrikeViewStruct } from '../../typechain-types/OptionMarketViewer';
import { TradeParametersStruct } from '../../typechain-types/OptionToken';
import { openAllTrades } from './contractHelpers';
import { STABLE_IDS } from './contractHelpers/wrapper';
import { deployTestSystem, TestSystemContractsType } from './deployTestSystem';
import { fastForward, mineBlock, restoreSnapshot, takeSnapshot } from './evm';
import { SeedOverrides, seedTestSystem } from './seedTestSystem';
import { hre } from './testSetup';
import { DEFAULT_BASE_PRICE, DEFAULT_POOL_HEDGER_PARAMS, DEFAULT_SNX_FUTURES_HEDGER_PARAMS } from './defaultParams';
import { deployGMXTestSystem, TestSystemContractsTypeGMX } from './deployTestSystemGMX';
import { seedTestSystemGMX } from './seedTestSystemGMX';
import { deployUniswap, deployUniswapPool } from '../../scripts/deploy/deployUniswap';

export type Fixture = {
  c: TestSystemContractsType;
  gc: TestSystemContractsTypeGMX;
  pc: TestSystemContractsTypePerps;
  deploySnap: number;
  deploySnapPerps: number;
  deploySnapUSDC: number;
  deployer: SignerWithAddress;
  alice: SignerWithAddress;
  signers: SignerWithAddress[];
  // Seed fixture
  seedSnap: number;
  gmxCurrenciesSnap: number;
  USDCSeedSnap: number;
  USDCwBTCSeedSnap: number;
  market: MarketViewStruct;
  board: BoardViewStruct;
  strike: StrikeViewStruct;
  defaultTradeParametersStruct: TradeParametersStruct;
  // All trades
  allTradesSnap: number;
  positionIds: BigNumber[];
  // All currencies
  allCurrenciesSnap: number;
  USDC: TestERC20SetDecimals;
  DAI: TestERC20Fail;
};

export type TestSystemContractsTypePerps = {
  factory: Contract;
  weth: TestWETH;
  swapRouter: ISwapRouter;
  positionManager: Contract;
  uniPool: IUniswapV3Pool;
  perpMarket: TestPerpsMarket;
  systemStatus: MockSystemStatus;
  perpHedger: SNXPerpsV2PoolHedger;
  sUSD: TestERC20SetDecimals;
  perpMarketSettings: TestFuturesMarketSettings;
};

export type HardhatRuntimeEnvironmentWithFixture = HardhatRuntimeEnvironment & { f: Fixture; tracer: any };

// Meant to be used in the main "before" block
// to reduce unnecessary deploys/seeds across test scripts.
// NOTE: does not work for jumps to future snapshots
// For overrides can use standard deployTest/seedTest scripts.

// Example:
// (1) Run seedFixture() to test first describe block
// (2) Custom board is deployed, so deployFixture() called
//     seedTestSystem snap is erased
// (3) Run seedFixture()
//     re-run seedTestSystem since seed snap was deleted in #2

export async function deployFixture() {
  if (!hre.f.deploySnap) {
    hre.f.signers = await ethers.getSigners();
    hre.f.deployer = hre.f.signers[0];
    hre.f.alice = hre.f.signers[1];
    hre.f.c = await deployTestSystem(hre.f.deployer, true, undefined);
  } else {
    await restoreSnapshot(hre.f.deploySnap);
  }
  await resetAllSnaps();

  hre.f.deploySnap = await takeSnapshot();

  hre.f.board = undefined as any;
  hre.f.strike = undefined as any;
  hre.f.market = undefined as any;
  hre.f.defaultTradeParametersStruct = undefined as any;
  hre.f.positionIds = undefined as any;
}

export async function deployFixturePerpsAdapter() {
  if (!hre.f.deploySnapPerps) {
    hre.f.signers = await ethers.getSigners();
    hre.f.deployer = hre.f.signers[0];
    hre.f.alice = hre.f.signers[1];
    hre.f.c = await deployTestSystem(hre.f.deployer, true, undefined, {
      usePerpsAdapter: true,
      poolHedger: ZERO_ADDRESS,
      quoteDecimals: 18, // TODO: 6
    });

    const sUSD = (await ((await ethers.getContractFactory('TestERC20SetDecimalsFail')) as ContractFactory).deploy(
      'Synthetic USD',
      'sUSD',
      18,
    )) as TestERC20SetDecimals;

    await hre.f.c.snx.quoteAsset.mint(hre.f.deployer.address, toBN('10000000'));
    await hre.f.c.snx.baseAsset.mint(hre.f.deployer.address, toBN('10000'));

    hre.f.pc = { ...(await deployUniswap(hre.f.deployer)) } as any;

    hre.f.pc.sUSD = sUSD;

    // deploy uniswap pool, with init price of $2000
    const { pool, isBaseToken0 } = await deployUniswapPool(
      hre.f.pc.factory,
      hre.f.pc.positionManager,
      hre.f.c.snx.baseAsset,
      hre.f.c.snx.quoteAsset,
      '2000',
    );
    hre.f.pc.uniPool = pool;
    hre.f.pc.perpHedger = (await (
      (await ethers.getContractFactory('SNXPerpsV2PoolHedger')) as ContractFactory
    ).deploy()) as SNXPerpsV2PoolHedger;

    hre.f.pc.perpMarket = (await (await ethers.getContractFactory('TestPerpsMarket')).deploy()) as TestPerpsMarket;
    hre.f.pc.systemStatus = (await (await ethers.getContractFactory('MockSystemStatus')).deploy()) as MockSystemStatus;
    hre.f.pc.perpMarketSettings = (await (
      await ethers.getContractFactory('TestFuturesMarketSettings')
    ).deploy()) as TestFuturesMarketSettings;

    await hre.f.c.snx.addressResolver.setAddresses(
      [toBytes32('PerpsV2MarketSettings'), toBytes32('SystemStatus')],
      [hre.f.pc.perpMarketSettings.address, hre.f.pc.systemStatus.address],
    );

    await hre.f.c.liquidityPool.setPoolHedger(hre.f.pc.perpHedger.address);
    await hre.f.pc.perpHedger.init(
      hre.f.c.snx.addressResolver.address,
      hre.f.c.synthetixPerpV2Adapter.address,
      hre.f.c.optionMarket.address,
      hre.f.c.optionGreekCache.address,
      hre.f.c.liquidityPool.address,
      hre.f.pc.perpMarket.address,
      hre.f.c.snx.quoteAsset.address,
      hre.f.pc.sUSD.address,
      hre.f.c.testCurve.address,
      toBytes32('sETHPERP'),
    );

    const baseAmount = toBN('100'); // 100 eth
    const quoteAmount = toBN('200000'); // 200K USD

    // add liquidity from position manager
    await hre.f.c.snx.baseAsset.approve(hre.f.pc.positionManager.address, baseAmount);
    await hre.f.c.snx.quoteAsset.approve(hre.f.pc.positionManager.address, quoteAmount);
    await hre.f.pc.positionManager.mint({
      token0: isBaseToken0 ? hre.f.c.snx.baseAsset.address : hre.f.c.snx.quoteAsset.address,
      token1: isBaseToken0 ? hre.f.c.snx.quoteAsset.address : hre.f.c.snx.baseAsset.address,
      fee: 3000,
      tickLower: -887220,
      tickUpper: 887220,
      amount0Desired: isBaseToken0 ? baseAmount : quoteAmount,
      amount1Desired: isBaseToken0 ? quoteAmount : baseAmount,
      amount0Min: 0,
      amount1Min: 0,
      recipient: hre.f.deployer.address,
      deadline: Date.now() + 1000 * 60 * 10,
    });

    // set adapter
    // const adapter = (await (await ethers.getContractFactory("SNXPerpV2Adapter")).deploy()) as BaseExchangeAdapter;
    await hre.f.c.synthetixPerpV2Adapter.setUniswapRouter(hre.f.pc.swapRouter.address);

    await hre.f.c.synthetixPerpV2Adapter.setUniSwapDeviation(toBN('0.97'));

    // set config for "option market"
    await hre.f.c.synthetixPerpV2Adapter.setMarketAdapterConfiguration(
      hre.f.c.optionMarket.address,
      toBN('0.03'), // 3% static exchange slippage
      hre.f.pc.perpMarket.address,
      hre.f.pc.uniPool.address,
      3000, // feeTier
    );

    await hre.f.c.synthetixPerpV2Adapter.setAddressResolver(hre.f.c.snx.addressResolver.address);

    await hre.f.c.synthetixPerpV2Adapter.approveRouter(hre.f.c.snx.baseAsset.address);
    await hre.f.c.synthetixPerpV2Adapter.approveRouter(hre.f.c.snx.quoteAsset.address);

    // allow trading
    await hre.f.c.snx.baseAsset.approve(hre.f.c.synthetixPerpV2Adapter.address, MAX_UINT);
    await hre.f.c.snx.quoteAsset.approve(hre.f.c.synthetixPerpV2Adapter.address, MAX_UINT);

    await hre.f.pc.perpMarket.setAssetPrice(toBN('2000'), false);

    // More setup for the hedger

    // added so that test Curve can swap and burn sUSD
    await hre.f.c.snx.quoteAsset.permitMint(hre.f.c.testCurve.address, true);
    await hre.f.pc.sUSD.permitMint(hre.f.c.testCurve.address, true);
    await hre.f.pc.sUSD.permitMint(hre.f.pc.perpMarket.address, true);
    await hre.f.pc.perpMarketSettings.init(toBN('1.4'));

    await hre.f.pc.perpMarket.init(
      toBytes32('sETHPERP'),
      hre.f.c.synthetixPerpV2Adapter.address,
      hre.f.pc.sUSD.address,
    );

    await hre.f.pc.perpMarket.addMarket(
      toBytes32('sETHPERP'), // TODO: change this to match the market
      hre.f.c.optionMarket.address,
    );

    await hre.f.c.testCurve.setRate(hre.f.c.snx.quoteAsset.address, toBN('1'));
    await hre.f.c.testCurve.setRate(hre.f.pc.sUSD.address, toBN('1'));

    await hre.f.pc.perpHedger.setPoolHedgerParams(DEFAULT_POOL_HEDGER_PARAMS);

    await hre.f.pc.perpHedger.setFuturesPoolHedgerParams(DEFAULT_SNX_FUTURES_HEDGER_PARAMS);

    // account for mineBlock() delay after takeSnapshot() in "else"
    await mineBlock();
    // make sure uniswap twap period is passed
    await fastForward(600);
  } else {
    await restoreSnapshot(hre.f.deploySnapPerps);
  }
  await resetAllSnaps();

  hre.f.deploySnapPerps = await takeSnapshot();

  hre.f.board = undefined as any;
  hre.f.strike = undefined as any;
  hre.f.market = undefined as any;
  hre.f.defaultTradeParametersStruct = undefined as any;
  hre.f.positionIds = undefined as any;
}

export async function deployFixtureUSDC() {
  if (!hre.f.deploySnapUSDC) {
    hre.f.signers = await ethers.getSigners();
    hre.f.deployer = hre.f.signers[0];
    hre.f.alice = hre.f.signers[1];
    hre.f.c = await deployTestSystem(hre.f.deployer, true, undefined, { quoteDecimals: 6 });
  } else {
    await restoreSnapshot(hre.f.deploySnapUSDC);
  }
  await resetAllSnaps();

  hre.f.deploySnapUSDC = await takeSnapshot();

  hre.f.board = undefined as any;
  hre.f.strike = undefined as any;
  hre.f.market = undefined as any;
  hre.f.defaultTradeParametersStruct = undefined as any;
  hre.f.positionIds = undefined as any;
}

export async function deployFixtureUSDCwBTC() {
  if (!hre.f.USDCwBTCSeedSnap) {
    hre.f.signers = await ethers.getSigners();
    hre.f.deployer = hre.f.signers[0];
    hre.f.alice = hre.f.signers[1];
    hre.f.c = await deployTestSystem(hre.f.deployer, true, undefined, { quoteDecimals: 6, baseDecimals: 8 });
  } else {
    await restoreSnapshot(hre.f.USDCwBTCSeedSnap);
  }
  await resetAllSnaps();

  hre.f.USDCwBTCSeedSnap = await takeSnapshot();

  hre.f.board = undefined as any;
  hre.f.strike = undefined as any;
  hre.f.market = undefined as any;
  hre.f.defaultTradeParametersStruct = undefined as any;
  hre.f.positionIds = undefined as any;
}

export async function seedFixture() {
  if (!hre.f.seedSnap) {
    await deployFixture();
    await seedTestSystem(hre.f.deployer, hre.f.c);
    hre.f.market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    hre.f.board = hre.f.market.liveBoards[0];
    hre.f.strike = hre.f.board.strikes[0];

    const spotPrice = await hre.f.c.synthetixAdapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, 2);
    const liquidity = await hre.f.c.liquidityPool.getLiquidity();

    hre.f.defaultTradeParametersStruct = {
      amount: toBN('1'),
      spotPrice,
      expiry: hre.f.board.expiry,
      isBuy: true,
      isForceClose: false,
      liquidity,
      optionType: OptionType.LONG_CALL,
      strikePrice: hre.f.strike.strikePrice,
      tradeDirection: TradeDirection.OPEN,
    };
    // account for mineBlock() delay after takeSnapshot() in "else"
    await mineBlock();
  } else {
    await restoreSnapshot(hre.f.seedSnap);
  }
  await resetAllSnaps();

  hre.f.seedSnap = await takeSnapshot();

  hre.f.positionIds = undefined as any;
}

export async function seedFixtureUSDC(overrides?: SeedOverrides) {
  if (!hre.f.USDCSeedSnap) {
    await deployFixtureUSDC();
    // await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: false, useUSDC: true }); // no hedger setup to test contract adjustments
    await seedTestSystem(hre.f.deployer, hre.f.c, overrides); // no hedger setup to test contract adjustments
    hre.f.market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    hre.f.board = hre.f.market.liveBoards[0];
    hre.f.strike = hre.f.board.strikes[0];

    const exchangeParams = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
    const liquidity = await hre.f.c.liquidityPool.getLiquidity();

    hre.f.defaultTradeParametersStruct = {
      amount: toBN('1'),
      spotPrice: exchangeParams.spotPrice,
      expiry: hre.f.board.expiry,
      isBuy: true,
      isForceClose: false,
      liquidity,
      optionType: OptionType.LONG_CALL,
      strikePrice: hre.f.strike.strikePrice,
      tradeDirection: TradeDirection.OPEN,
    };
    // account for mineBlock() delay after takeSnapshot() in "else"
    await mineBlock();
  } else {
    await restoreSnapshot(hre.f.USDCSeedSnap);
  }
  await resetAllSnaps();
  hre.f.USDCSeedSnap = await takeSnapshot();

  hre.f.positionIds = undefined as any;
}

export async function seedFixtureUSDCwBTC() {
  if (!hre.f.USDCwBTCSeedSnap) {
    await deployFixtureUSDCwBTC();
    await seedTestSystem(hre.f.deployer, hre.f.c, { /*noHedger: true,*/ useUSDC: true, useBTC: true });
    hre.f.market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    hre.f.board = hre.f.market.liveBoards[0];
    hre.f.strike = hre.f.board.strikes[0];

    const exchangeParams = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
    const liquidity = await hre.f.c.liquidityPool.getLiquidity();

    hre.f.defaultTradeParametersStruct = {
      amount: toBN('1'),
      spotPrice: exchangeParams.spotPrice,
      expiry: hre.f.board.expiry,
      isBuy: true,
      isForceClose: false,
      liquidity,
      optionType: OptionType.LONG_CALL,
      strikePrice: hre.f.strike.strikePrice,
      tradeDirection: TradeDirection.OPEN,
    };
    // account for mineBlock() delay after takeSnapshot() in "else"
    await mineBlock();
  } else {
    await restoreSnapshot(hre.f.USDCwBTCSeedSnap);
  }
  await resetAllSnaps();

  hre.f.USDCwBTCSeedSnap = await takeSnapshot();
  hre.f.positionIds = undefined as any;
}

export async function allTradesFixture() {
  if (!hre.f.allTradesSnap) {
    await seedFixture();
    hre.f.positionIds = await openAllTrades();
  } else {
    await restoreSnapshot(hre.f.allTradesSnap);
  }
  await resetAllSnaps();
  hre.f.allTradesSnap = await takeSnapshot();
}

export async function allCurrenciesFixture() {
  if (!hre.f.allCurrenciesSnap) {
    await seedFixture();

    hre.f.USDC = (await (await ethers.getContractFactory('TestERC20SetDecimals'))
      .connect(hre.f.deployer)
      .deploy('USDC', 'USDC', 6)) as TestERC20SetDecimals;
    hre.f.DAI = (await (await ethers.getContractFactory('TestERC20Fail'))
      .connect(hre.f.deployer)
      .deploy('DAI', 'DAI')) as unknown as TestERC20Fail;

    await hre.f.USDC.mint(hre.f.deployer.address, 100000 * 1e6);
    await hre.f.DAI.mint(hre.f.deployer.address, toBN('100000'));

    await hre.f.c.snx.quoteAsset.connect(hre.f.deployer).approve(hre.f.c.optionMarketWrapper.address, MAX_UINT);
    await hre.f.c.snx.baseAsset.connect(hre.f.deployer).approve(hre.f.c.optionMarketWrapper.address, MAX_UINT);
    await hre.f.USDC.connect(hre.f.deployer).approve(hre.f.c.optionMarketWrapper.address, MAX_UINT);
    await hre.f.DAI.connect(hre.f.deployer).approve(hre.f.c.optionMarketWrapper.address, MAX_UINT);

    await hre.f.c.snx.quoteAsset.permitMint(hre.f.c.testCurve.address, true);
    await hre.f.USDC.permitMint(hre.f.c.testCurve.address, true);
    await hre.f.DAI.permitMint(hre.f.c.testCurve.address, true);

    await hre.f.c.testCurve.setRate(hre.f.USDC.address, 1010000);
    await hre.f.c.testCurve.setRate(hre.f.DAI.address, toBN('1.01'));
    await hre.f.c.testCurve.setRate(hre.f.c.snx.quoteAsset.address, toBN('0.999'));

    await hre.f.c.optionMarketWrapper.addCurveStable(hre.f.c.snx.quoteAsset.address, STABLE_IDS.sUSD);
    await hre.f.c.optionMarketWrapper.addCurveStable(hre.f.DAI.address, STABLE_IDS.DAI);
    await hre.f.c.optionMarketWrapper.addCurveStable(hre.f.USDC.address, STABLE_IDS.USDC);

    await hre.f.c.optionToken.setApprovalForAll(hre.f.c.optionMarketWrapper.address, true);
    await hre.f.c.basicFeeCounter.setTrustedCounter(hre.f.c.optionMarketWrapper.address, true);
    hre.f.positionIds = await openAllTrades();
  } else {
    await restoreSnapshot(hre.f.allCurrenciesSnap);
  }
  await resetAllSnaps();

  hre.f.allCurrenciesSnap = await takeSnapshot();
}

export async function allCurrenciesFixtureGMX() {
  if (!hre.f.gmxCurrenciesSnap) {
    hre.f.signers = await ethers.getSigners();
    hre.f.deployer = hre.f.signers[0];
    hre.f.alice = hre.f.signers[1];
    hre.f.gc = await deployGMXTestSystem(hre.f.deployer, true, undefined, {
      mockGMX: true,
      ethDecimals: DEFAULT_DECIMALS.ETH,
      btcDecimals: DEFAULT_DECIMALS.wBTC,
      usdcDecimals: DEFAULT_DECIMALS.USDC,
    });
    await seedTestSystemGMX(hre.f.deployer, hre.f.gc);
    hre.f.market = await hre.f.gc.optionMarketViewer.getMarket(hre.f.gc.optionMarket.address);
    hre.f.board = hre.f.market.liveBoards[0];
    hre.f.strike = hre.f.board.strikes[0];

    const spotPrice = await hre.f.gc.GMXAdapter.getSpotPriceForMarket(hre.f.gc.optionMarket.address, 2);
    const liquidity = await hre.f.gc.liquidityPool.getLiquidity();

    hre.f.defaultTradeParametersStruct = {
      amount: toBN('1'),
      spotPrice,
      expiry: hre.f.board.expiry,
      isBuy: true,
      isForceClose: false,
      liquidity,
      optionType: OptionType.LONG_CALL,
      strikePrice: hre.f.strike.strikePrice,
      tradeDirection: TradeDirection.OPEN,
    };

    await hre.f.gc.gmx.USDC.connect(hre.f.deployer).approve(hre.f.gc.optionMarketWrapper.address, MAX_UINT);
    await hre.f.gc.gmx.eth.connect(hre.f.deployer).approve(hre.f.gc.optionMarketWrapper.address, MAX_UINT);

    await hre.f.gc.gmx.eth.permitMint(hre.f.gc.optionMarketWrapper.address, true);
    await hre.f.gc.gmx.eth.permitMint(hre.f.deployer.address, true);

    await hre.f.gc.testCurve.setRate(hre.f.gc.gmx.USDC.address, toBN('0.999'));

    await hre.f.gc.optionMarketWrapper.addCurveStable(hre.f.gc.gmx.USDC.address, 0);

    await hre.f.gc.optionToken.setApprovalForAll(hre.f.gc.optionMarketWrapper.address, true);
    await hre.f.gc.basicFeeCounter.setTrustedCounter(hre.f.gc.optionMarketWrapper.address, true);

    hre.f.positionIds = await openAllTrades(hre.f.gc);
  } else {
    await restoreSnapshot(hre.f.gmxCurrenciesSnap);
  }
  await resetAllSnaps();
  hre.f.gmxCurrenciesSnap = await takeSnapshot();

  hre.f.DAI = undefined as any;
  hre.f.USDC = undefined as any;
  hre.f.defaultTradeParametersStruct = undefined as any;
}

async function resetAllSnaps() {
  hre.f.deploySnapPerps = undefined as any;
  hre.f.deploySnap = undefined as any;
  hre.f.deploySnapUSDC = undefined as any;
  hre.f.seedSnap = undefined as any;
  hre.f.gmxCurrenciesSnap = undefined as any;
  hre.f.USDCSeedSnap = undefined as any;
  hre.f.USDCwBTCSeedSnap = undefined as any;
  hre.f.allTradesSnap = undefined as any;
  hre.f.allCurrenciesSnap = undefined as any;
}
