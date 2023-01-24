import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/src/types/runtime';
import { DEFAULT_DECIMALS, MAX_UINT, OptionType, toBN, TradeDirection } from '../../scripts/util/web3utils';
import { TestERC20Fail, TestERC20SetDecimals } from '../../typechain-types';
import {
  BoardViewStruct,
  MarketViewStruct,
  StrikeViewStruct,
} from '../../typechain-types/OptionMarketViewer';
import { TradeParametersStruct } from '../../typechain-types/OptionToken';
import { openAllTrades } from './contractHelpers';
import { STABLE_IDS } from './contractHelpers/wrapper';
import { deployTestSystem, TestSystemContractsType } from './deployTestSystem';
import { mineBlock, restoreSnapshot, takeSnapshot } from './evm';
import { SeedOverrides, seedTestSystem } from './seedTestSystem';
import { hre } from './testSetup';
import { DEFAULT_BASE_PRICE } from './defaultParams';
import { deployGMXTestSystem, TestSystemContractsTypeGMX } from './deployTestSystemGMX';
import { seedTestSystemGMX } from './seedTestSystemGMX';

export type Fixture = {
  c: TestSystemContractsType;
  gc: TestSystemContractsTypeGMX;
  deploySnap: number;
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
  hre.f.deploySnap = undefined as any;
  hre.f.deploySnapUSDC = undefined as any;
  hre.f.seedSnap = undefined as any;
  hre.f.gmxCurrenciesSnap = undefined as any;
  hre.f.USDCSeedSnap = undefined as any;
  hre.f.USDCwBTCSeedSnap = undefined as any;
  hre.f.allTradesSnap = undefined as any;
  hre.f.allCurrenciesSnap = undefined as any;
}
