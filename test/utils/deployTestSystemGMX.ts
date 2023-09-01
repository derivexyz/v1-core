import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { ethers, tracer } from 'hardhat';
import { currentTime, toBN } from '../../scripts/util/web3utils';
import {
  BasicFeeCounter,
  BasicLiquidityCounter,
  BlackScholes,
  GMXAdapter,
  GWAV,
  GWAVOracle,
  KeeperHelper,
  LiquidityPool,
  LiquidityToken,
  LyraRegistry,
  OptionGreekCache,
  OptionMarket,
  OptionMarketPricer,
  OptionMarketViewer,
  OptionMarketWrapper,
  OptionToken,
  ShortCollateral,
  TestCurve,
  Vault,
  USDG,
  Router,
  ShortsTracker,
  PositionRouter,
  ReferralStorage,
  Reader,
  VaultPriceFeed,
  FastPriceEvents,
  FastPriceFeed,
  YieldTracker,
  GMXFuturesPoolHedger,
  MockAggregatorV2V3,
  TestGMXVaultChainlinkPrice,
  Timelock,
  TestWETH,
  TestERC20SetDecimalsFail,
} from '../../typechain-types';
import { CircuitBreakerParametersStruct, LiquidityPoolParametersStruct } from '../../typechain-types/LiquidityPool';
import { GreekCacheParametersStruct, MinCollateralParametersStruct } from '../../typechain-types/OptionGreekCache';
import { OptionMarketParametersStruct } from '../../typechain-types/OptionMarket';
import { VarianceFeeParametersStruct } from '../../typechain-types/OptionMarketPricer';
import {
  ForceCloseParametersStruct,
  PricingParametersStruct,
  TradeLimitParametersStruct,
} from '../../typechain-types/OptionMarketViewer';
import { PartialCollateralParametersStruct } from '../../typechain-types/OptionToken';
import { PoolHedgerParametersStruct } from '../../typechain-types/PoolHedger';
import * as defaultParams from './defaultParams';
import { mergeDeep } from './package/merge';
import { deployRealGMX, initVault } from './package/realGMXUtils';
import chalk from 'chalk';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DEFAULT_GMX_ADAPTER_PARAMS } from './defaultParams';

export type GMXDeployContractsType = {
  isMockGMX: boolean;
  USDC: TestERC20SetDecimalsFail; // quote asset
  btc: TestERC20SetDecimalsFail;
  eth: TestWETH; // base asset
  vault: Vault;
  timelock: Timelock;
  usdg: USDG;
  router: Router;
  shortsTracker: ShortsTracker;
  positionRouter: PositionRouter;
  referralStorage: ReferralStorage;
  distributor: Contract;
  reader: Reader;
  vaultPriceFeed: VaultPriceFeed;
  btcPriceFeed: MockAggregatorV2V3;
  ethPriceFeed: MockAggregatorV2V3;
  usdcPriceFeed: MockAggregatorV2V3;
  fastPriceEvents: FastPriceEvents;
  fastPriceFeed: FastPriceFeed;
  yieldTracker: YieldTracker;
};

export type GlobalTestSystemContractsGMX = {
  GMXAdapter: GMXAdapter;
  lyraRegistry: LyraRegistry;
  blackScholes: BlackScholes;
  gwav: GWAV;
  optionMarketViewer: OptionMarketViewer;
  optionMarketWrapper: OptionMarketWrapper;
  testCurve: TestCurve;
  basicFeeCounter: BasicFeeCounter;
  gmx: GMXDeployContractsType;
};

export type MarketTestSystemContractsGMX = {
  optionMarket: OptionMarket;
  optionMarketPricer: OptionMarketPricer;
  optionGreekCache: OptionGreekCache;
  optionToken: OptionToken;
  GWAVOracle: GWAVOracle;
  liquidityPool: LiquidityPool;
  liquidityToken: LiquidityToken;
  basicLiquidityCounter: BasicLiquidityCounter;
  shortCollateral: ShortCollateral;
  futuresPoolHedger: GMXFuturesPoolHedger;
  keeperHelper: KeeperHelper;
};

export type TestSystemContractsTypeGMX = GlobalTestSystemContractsGMX & MarketTestSystemContractsGMX;

export type DeployOverrides = {
  // market parameters
  optionMarketParams?: OptionMarketParametersStruct;
  liquidityPoolParams?: LiquidityPoolParametersStruct;
  circuitBreakerParams?: CircuitBreakerParametersStruct;
  poolHedgerParams?: PoolHedgerParametersStruct;
  hedgerShortBuffer?: BigNumber;
  greekCacheParams?: GreekCacheParametersStruct;
  minCollateralParams?: MinCollateralParametersStruct;
  forceCloseParams?: ForceCloseParametersStruct;
  pricingParams?: PricingParametersStruct;
  tradeLimitParams?: TradeLimitParametersStruct;
  varianceFeeParams?: VarianceFeeParametersStruct;
  partialCollateralParams?: PartialCollateralParametersStruct;
  feeRateForBase?: BigNumber;
  feeRateForQuote?: BigNumber;
  basePrice?: BigNumber;
  marketId?: string;
  baseLimit?: BigNumber;


  // override contract addresses for mock purposes
  exchangeAdapter?: string;
  synthetixAdapter?: string;
  GMXAdapter?: string;
  lyraRegistry?: string;
  blackScholes?: string;
  gwav?: string;
  optionMarketViewer?: string;
  optionMarketWrapper?: string;
  testCurve?: string;
  testGMXvault?: string;
  testGMXrouter?: string;
  testGMXpriceFeed?: string;
  basicFeeCounter?: string;
  optionMarket?: string;
  optionMarketPricer?: string;
  optionGreekCache?: string;
  optionToken?: string;
  GWAVOracle?: string;
  liquidityPool?: string;
  liquidityToken?: string;
  basicLiquidityCounter?: string;
  shortCollateral?: string;
  futuresPoolHedger?: string;
  addressResolver?: string;
  collateralShort?: string;
  synthetix?: string;
  delegateApprovals?: string;
  exchangeRates?: string;
  exchanger?: string;

  // can be overridden to work with gmx as well
  quoteAsset?: string;
  baseAsset?: string;

  quoteToken?: string;
  baseToken?: string;
  gmxAdapter?: string;
  vault?: string;
  positionRouter?: string;
  router?: string;
  reader?: string;
  priceFeed?: string;
  // set to false to deploy full SNX stack
  // only works when deployed to localhost (not hardhat tests)
  mockSNX?: boolean; // true by default
  compileSNX?: boolean; // only need to compile once

  // GMX stack
  useGMX?: boolean;
  compileGMX?: boolean;
  mockGMX?: boolean; // true by default

  // Futures hedger params
  futuresMaxLeverage?: number;

  usdcDecimals?: number;
  usdcFeedDecimals?: number;
  ethDecimals?: number;
  ethFeedDecimals?: number;
  btcDecimals?: number;
  btcFeedDecimals?: number;

  wethAddress?: string;
};

export async function deployGMXTestSystem(
  deployer: SignerWithAddress,
  useTracer?: boolean,
  exportAddresses?: boolean,
  overrides?: DeployOverrides,
): Promise<TestSystemContractsTypeGMX> {
  exportAddresses = exportAddresses || false;
  overrides = overrides || ({} as DeployOverrides);

  const globalSystem = await deployGlobalTestContractsGMX(deployer, exportAddresses, overrides);
  const marketSystem = await deployMarketTestContractsGMX(globalSystem, deployer, 'sETH', exportAddresses, overrides);

  const testSystem: TestSystemContractsTypeGMX = mergeDeep(globalSystem, marketSystem);

  // add logic here for initalising the gmx contracts and associated market contract
  await initGlobalTestSystemGMX(testSystem, deployer, overrides);
  await initMarketTestSystemGMX('sETH', testSystem, marketSystem, deployer, overrides);

  return testSystem;
}

// intialise global test System GMX
export async function initGlobalTestSystemGMX(
  testSystem: GlobalTestSystemContractsGMX,
  deployer: Signer,
  overrides: DeployOverrides,
) {
  if (overrides.mockGMX) {
    await (testSystem.gmx.vault as any as TestGMXVaultChainlinkPrice).setFeed(
      testSystem.gmx.USDC.address,
      testSystem.gmx.usdcPriceFeed.address,
    );
    await (testSystem.gmx.vault as any as TestGMXVaultChainlinkPrice).setFeed(
      testSystem.gmx.eth.address,
      testSystem.gmx.ethPriceFeed.address,
    );
    await testSystem.gmx.USDC.permitMint(testSystem.gmx.vault.address, true);
    await testSystem.gmx.eth.permitMint(testSystem.gmx.vault.address, true);
  } else {
    // GMX default config
    await testSystem.gmx.shortsTracker.setIsGlobalShortDataReady(true);
    await testSystem.gmx.shortsTracker.setHandler(testSystem.gmx.positionRouter.address, true);

    // convert these to the correct format
    await testSystem.gmx.positionRouter.setReferralStorage(testSystem.gmx.referralStorage.address);
    await testSystem.gmx.referralStorage.setHandler(testSystem.gmx.positionRouter.address, true);

    await initVault(
      testSystem.gmx.vault,
      testSystem.gmx.router,
      testSystem.gmx.usdg,
      testSystem.gmx.vaultPriceFeed as any,
    );

    await testSystem.gmx.yieldTracker.setDistributor(testSystem.gmx.distributor.address);
    await testSystem.gmx.distributor.setDistribution(
      [testSystem.gmx.yieldTracker.address],
      [1000],
      [testSystem.gmx.USDC.address],
    );

    await testSystem.gmx.USDC.mint(testSystem.gmx.distributor.address, 5000);
    await testSystem.gmx.usdg.setYieldTrackers([testSystem.gmx.yieldTracker.address]);

    if (!deployer.provider) {
      throw Error('deployer has no provider');
    }

    // if they enable gas limit
    await testSystem.gmx.positionRouter.setCallbackGasLimit(25000);

    const latestBlock = await deployer.provider.getBlock('latest');

    await testSystem.gmx.vaultPriceFeed.setTokenConfig(
      testSystem.gmx.btc.address,
      testSystem.gmx.btcPriceFeed.address,
      overrides.btcFeedDecimals || 8,
      false,
    );

    await testSystem.gmx.btcPriceFeed.setLatestAnswer(
      toBN('20001', overrides.btcFeedDecimals || 8),
      latestBlock.number,
    );
    await testSystem.gmx.vault.setTokenConfig(
      testSystem.gmx.btc.address,
      overrides.btcDecimals || 8,
      10000,
      75,
      0,
      false,
      true,
    );

    const btcPrice = await testSystem.gmx.vaultPriceFeed.getPrimaryPrice(testSystem.gmx.btc.address, false);

    await testSystem.gmx.vaultPriceFeed.setTokenConfig(
      testSystem.gmx.eth.address,
      testSystem.gmx.ethPriceFeed.address,
      overrides.ethFeedDecimals || 8,
      false,
    );
    await testSystem.gmx.ethPriceFeed.setLatestAnswer(toBN('1551', overrides.ethFeedDecimals || 8), latestBlock.number); // 8dp
    await testSystem.gmx.vault.setTokenConfig(
      testSystem.gmx.eth.address,
      overrides.ethDecimals || 18,
      10000,
      75,
      0,
      false,
      true,
    );
    const ethPrice = await testSystem.gmx.vaultPriceFeed.getPrimaryPrice(testSystem.gmx.eth.address, false);

    await testSystem.gmx.vaultPriceFeed.setTokenConfig(
      testSystem.gmx.USDC.address,
      testSystem.gmx.usdcPriceFeed.address,
      overrides.ethDecimals || 18,
      true,
    );

    await testSystem.gmx.usdcPriceFeed.setLatestAnswer(
      toBN('1', overrides.usdcFeedDecimals || 18),
      await currentTime(),
    );
    await testSystem.gmx.vault.setTokenConfig(
      testSystem.gmx.USDC.address,
      overrides.usdcDecimals || 18,
      10000,
      75,
      0,
      true,
      false,
    );

    await testSystem.gmx.vault.setIsLeverageEnabled(true);
    await testSystem.gmx.vault.setGov(testSystem.gmx.timelock.address);

    await testSystem.gmx.fastPriceFeed.initialize(
      2,
      [await deployer.getAddress(), await (await ethers.getSigners())[1].getAddress()],
      [await deployer.getAddress(), await (await ethers.getSigners())[1].getAddress()],
    );
    await testSystem.gmx.fastPriceEvents.setIsPriceFeed(testSystem.gmx.fastPriceFeed.address, true);

    await testSystem.gmx.fastPriceFeed.setVaultPriceFeed(testSystem.gmx.vaultPriceFeed.address);
    await testSystem.gmx.vaultPriceFeed.setSecondaryPriceFeed(testSystem.gmx.fastPriceFeed.address);
    await testSystem.gmx.positionRouter.setAdmin(await deployer.getAddress());
    await testSystem.gmx.positionRouter.setCallbackGasLimit('8000000000');
    await testSystem.gmx.positionRouter.setDelayValues('1', '1', '10');
    await testSystem.gmx.positionRouter.setPositionKeeper(await deployer.getAddress(), true);
    await testSystem.gmx.fastPriceFeed.setMaxTimeDeviation(1000);
    await testSystem.gmx.vaultPriceFeed.setPriceSampleSpace(1);

    console.log('Fast feed');
    console.log(
      'btc: ',
      ethers.utils.formatUnits(
        await testSystem.gmx.fastPriceFeed.getPrice(testSystem.gmx.btc.address, btcPrice, true),
        30,
      ),
    );
    console.log(
      'eth: ',
      ethers.utils.formatUnits(
        await testSystem.gmx.fastPriceFeed.getPrice(testSystem.gmx.eth.address, ethPrice, true),
        30,
      ),
    );

    console.log('Price feed');
    console.log(
      'btc:',
      ethers.utils.formatUnits(
        await testSystem.gmx.vaultPriceFeed.getPriceV1(testSystem.gmx.btc.address, true, false),
        30,
      ),
    );
    console.log(
      'eth:',
      ethers.utils.formatUnits(
        await testSystem.gmx.vaultPriceFeed.getPriceV1(testSystem.gmx.eth.address, true, false),
        30,
      ),
    );

    console.log('Vault feed');
    console.log(
      'btc min: ',
      ethers.utils.formatUnits(await testSystem.gmx.vault.getMinPrice(testSystem.gmx.btc.address), 30),
    );
    console.log(
      'btc max: ',
      ethers.utils.formatUnits(await testSystem.gmx.vault.getMaxPrice(testSystem.gmx.btc.address), 30),
    );
    console.log(
      'eth min: ',
      ethers.utils.formatUnits(await testSystem.gmx.vault.getMinPrice(testSystem.gmx.eth.address), 30),
    );
    console.log(
      'eth max: ',
      ethers.utils.formatUnits(await testSystem.gmx.vault.getMaxPrice(testSystem.gmx.eth.address), 30),
    );

    // add position router as a plugin
    await testSystem.gmx.router.addPlugin(testSystem.gmx.positionRouter.address);
    await testSystem.gmx.router.connect(deployer).approvePlugin(testSystem.gmx.positionRouter.address);
    // await testSystem.gmx.eth.mint(testSystem.gmx.vault.address, toBN('30000000'))
    // await testSystem.gmx.vault.buyUSDG(testSystem.gmx.eth.address, (await deployer.getAddress()))

    await testSystem.gmx.timelock.setAdmin(await deployer.getAddress());

    await testSystem.gmx.timelock.connect(deployer).setContractHandler(await deployer.getAddress(), true);
    await testSystem.gmx.timelock.connect(deployer).setContractHandler(testSystem.gmx.positionRouter.address, true);
    await testSystem.gmx.timelock.connect(deployer).setContractHandler(testSystem.gmx.vault.address, true);
    await testSystem.gmx.timelock.connect(deployer).setContractHandler(testSystem.gmx.router.address, true);

    await testSystem.gmx.timelock.connect(deployer).setMaxLeverage(testSystem.gmx.vault.address, toBN('30'));
    await testSystem.gmx.timelock.connect(deployer).setShouldToggleIsLeverageEnabled(true);
  }

  //////////////////////////////
  // Lyra Adapters & Wrappers //
  //////////////////////////////

  await testSystem.optionMarketViewer.connect(deployer).init(testSystem.GMXAdapter.address);

  await testSystem.optionMarketWrapper
    .connect(deployer)
    .updateContractParams(
      testSystem.gmx.eth.address,
      overrides.testCurve || testSystem.testCurve.address,
      testSystem.basicFeeCounter.address,
      toBN('0.1'),
    );
}

// initialise the market test system GMX
export async function initMarketTestSystemGMX(
  market: string,
  existingTestSystem: TestSystemContractsTypeGMX,
  marketTestSystem: MarketTestSystemContractsGMX,
  deployer: Signer,
  overrides: DeployOverrides,
) {
  ///////////////////
  // Set Addresses //
  ///////////////////

  await marketTestSystem.optionMarket
    .connect(deployer)
    .init(
      overrides.gmxAdapter || existingTestSystem.GMXAdapter.address,
      overrides.liquidityPool || marketTestSystem.liquidityPool.address,
      overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.shortCollateral || marketTestSystem.shortCollateral.address,
      overrides.optionToken || marketTestSystem.optionToken.address,
      overrides.quoteAsset || existingTestSystem.gmx.USDC.address,
      overrides.baseAsset || existingTestSystem.gmx.eth.address,
    );

  await marketTestSystem.optionMarket.setOptionMarketParams(
    overrides.optionMarketParams || defaultParams.DEFAULT_OPTION_MARKET_PARAMS,
  );

  await marketTestSystem.optionMarket.setBaseLimit(
    overrides.baseLimit || defaultParams.DEFAULT_OPTION_MARKET_BASE_LIMIT,
  );

  await marketTestSystem.optionMarketPricer
    .connect(deployer)
    .init(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    );

  await marketTestSystem.optionGreekCache
    .connect(deployer)
    .init(
      overrides.gmxAdapter || existingTestSystem.GMXAdapter.address,
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
    );

  await marketTestSystem.liquidityPool
    .connect(deployer)
    .init(
      overrides.gmxAdapter || existingTestSystem.GMXAdapter.address,
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.liquidityToken || marketTestSystem.liquidityToken.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.futuresPoolHedger || marketTestSystem.futuresPoolHedger.address,
      overrides.shortCollateral || marketTestSystem.shortCollateral.address,
      overrides.quoteAsset || existingTestSystem.gmx.USDC.address,
      overrides.baseAsset || existingTestSystem.gmx.eth.address,
    );

  await marketTestSystem.liquidityToken
    .connect(deployer)
    .init(overrides.liquidityPool || marketTestSystem.liquidityPool.address);

  await marketTestSystem.shortCollateral
    .connect(deployer)
    .init(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.liquidityPool || marketTestSystem.liquidityPool.address,
      overrides.optionToken || marketTestSystem.optionToken.address,
      overrides.gmxAdapter || existingTestSystem.GMXAdapter.address,
      overrides.quoteAsset || existingTestSystem.gmx.USDC.address,
      overrides.baseAsset || existingTestSystem.gmx.eth.address,
    );

  await marketTestSystem.optionToken
    .connect(deployer)
    .init(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.shortCollateral || marketTestSystem.shortCollateral.address,
      overrides.gmxAdapter || existingTestSystem.GMXAdapter.address,
    );

  await existingTestSystem.GMXAdapter.connect(deployer).setVaultContract(
    overrides.vault || existingTestSystem.gmx.vault.address,
  );

  await existingTestSystem.GMXAdapter.connect(deployer).setRiskFreeRate(
    existingTestSystem.optionMarket.address,
    defaultParams.DEFAULT_RATE_AND_CARRY,
  );

  if (!overrides.mockGMX) {
    await existingTestSystem.GMXAdapter.connect(deployer).setChainlinkFeed(
      existingTestSystem.gmx.btc.address,
      existingTestSystem.gmx.btcPriceFeed.address,
    );
  }

  await existingTestSystem.GMXAdapter.connect(deployer).setChainlinkFeed(
    existingTestSystem.gmx.eth.address,
    existingTestSystem.gmx.ethPriceFeed.address,
  );

  await existingTestSystem.GMXAdapter.setMarketPricingParams(marketTestSystem.optionMarket.address, {
    ...DEFAULT_GMX_ADAPTER_PARAMS,
    staticSwapFeeEstimate: toBN('1.015'),
    priceVarianceCBPercent: toBN('0.015'),
  });

  await marketTestSystem.GWAVOracle.connect(deployer).init(
    overrides.optionMarket || marketTestSystem.optionMarket.address,
    overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    overrides.gmxAdapter || existingTestSystem.GMXAdapter.address,
  );

  await existingTestSystem.optionMarketViewer.connect(deployer).addMarket({
    liquidityPool: overrides.liquidityPool || marketTestSystem.liquidityPool.address,
    liquidityToken: overrides.liquidityToken || marketTestSystem.liquidityToken.address,
    greekCache: overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    optionMarket: overrides.optionMarket || marketTestSystem.optionMarket.address,
    optionMarketPricer: overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
    optionToken: overrides.optionToken || marketTestSystem.optionToken.address,
    poolHedger: overrides.futuresPoolHedger || marketTestSystem.futuresPoolHedger.address,
    shortCollateral: overrides.shortCollateral || marketTestSystem.shortCollateral.address,
    baseAsset: overrides.baseAsset || existingTestSystem.gmx.eth.address,
    quoteAsset: overrides.quoteAsset || existingTestSystem.gmx.USDC.address,
  });

  await existingTestSystem.lyraRegistry.connect(deployer).addMarket({
    liquidityPool: overrides.liquidityPool || marketTestSystem.liquidityPool.address,
    liquidityToken: overrides.liquidityToken || marketTestSystem.liquidityToken.address,
    greekCache: overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    optionMarket: overrides.optionMarket || marketTestSystem.optionMarket.address,
    optionMarketPricer: overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
    optionToken: overrides.optionToken || marketTestSystem.optionToken.address,
    poolHedger: overrides.futuresPoolHedger || marketTestSystem.futuresPoolHedger.address,
    shortCollateral: overrides.shortCollateral || marketTestSystem.shortCollateral.address,
    gwavOracle: overrides.GWAVOracle || marketTestSystem.GWAVOracle.address,
    baseAsset: overrides.baseAsset || existingTestSystem.gmx.eth.address,
    quoteAsset: overrides.quoteAsset || existingTestSystem.gmx.USDC.address,
  });

  await existingTestSystem.optionMarketWrapper
    .connect(deployer)
    .addMarket(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.marketId || defaultParams.DEFAULT_MARKET_ID,
      {
        quoteAsset: overrides.quoteToken || existingTestSystem.gmx.USDC.address,
        baseAsset: overrides.baseToken || existingTestSystem.gmx.eth.address,
        optionToken: overrides.optionToken || marketTestSystem.optionToken.address,
        liquidityPool: overrides.liquidityPool || marketTestSystem.liquidityPool.address,
        liquidityToken: overrides.liquidityToken || marketTestSystem.liquidityToken.address,
      },
    );

  await marketTestSystem.keeperHelper
    .connect(deployer)
    .init(
      marketTestSystem.optionMarket.address,
      marketTestSystem.shortCollateral.address,
      marketTestSystem.optionGreekCache.address,
    );

  await marketTestSystem.futuresPoolHedger.connect(deployer).init(
    overrides.liquidityPool || marketTestSystem.liquidityPool.address,
    overrides.optionMarket || marketTestSystem.optionMarket.address,
    overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    overrides.exchangeAdapter || existingTestSystem.GMXAdapter.address,
    overrides.positionRouter || existingTestSystem.gmx.positionRouter.address,
    overrides.router || existingTestSystem.gmx.router.address,
    overrides.quoteAsset || existingTestSystem.gmx.USDC.address,
    overrides.baseAsset || existingTestSystem.gmx.eth.address,
    // NOTE: for testing we put in btc as all the integration tests use weth already...
    overrides.wethAddress || existingTestSystem.gmx.btc.address,
  );

  ////////////////////////
  // Lyra Market Params //
  ////////////////////////

  await marketTestSystem.liquidityPool
    .connect(deployer)
    .setLiquidityPoolParameters(overrides.liquidityPoolParams || defaultParams.DEFAULT_LIQUIDITY_POOL_PARAMS);

  await marketTestSystem.liquidityPool
    .connect(deployer)
    .setCircuitBreakerParameters(overrides.circuitBreakerParams || defaultParams.DEFAULT_CB_PARAMS);

  await marketTestSystem.futuresPoolHedger
    .connect(deployer)
    .setPoolHedgerParams(overrides.poolHedgerParams || defaultParams.DEFAULT_POOL_HEDGER_PARAMS);

  await marketTestSystem.futuresPoolHedger
    .connect(deployer)
    .setFuturesPoolHedgerParams(defaultParams.DEFAULT_GMX_POOL_HEDGER_PARAMS);

  await marketTestSystem.optionGreekCache
    .connect(deployer)
    .setGreekCacheParameters(overrides.greekCacheParams || defaultParams.DEFAULT_GREEK_CACHE_PARAMS);

  await marketTestSystem.optionGreekCache
    .connect(deployer)
    .setMinCollateralParameters(overrides.minCollateralParams || defaultParams.DEFAULT_MIN_COLLATERAL_PARAMS);

  await marketTestSystem.optionGreekCache
    .connect(deployer)
    .setForceCloseParameters(overrides.forceCloseParams || defaultParams.DEFAULT_FORCE_CLOSE_PARAMS);

  await marketTestSystem.optionMarketPricer
    .connect(deployer)
    .setPricingParams(overrides.pricingParams || defaultParams.getMarketPricingParams(market));

  await marketTestSystem.optionMarketPricer
    .connect(deployer)
    .setTradeLimitParams(overrides.tradeLimitParams || defaultParams.DEFAULT_TRADE_LIMIT_PARAMS);

  await marketTestSystem.optionMarketPricer
    .connect(deployer)
    .setVarianceFeeParams(overrides.varianceFeeParams || defaultParams.DEFAULT_VARIANCE_FEE_PARAMS);

  await marketTestSystem.optionToken
    .connect(deployer)
    .setPartialCollateralParams(overrides.partialCollateralParams || defaultParams.DEFAULT_PARTIAL_COLLAT_PARAMS);
  // TODO: add exchange parameters here.

  console.log(chalk.greenBright('GMX Market deployed successfully!'));
}

export async function deployMarketTestContractsGMX(
  existingSystem: GlobalTestSystemContractsGMX,
  deployer: Signer,
  market: string,
  _exportAddresses: boolean,
  _overrides: DeployOverrides,
): Promise<MarketTestSystemContractsGMX> {
  /////////////////
  // Lyra Market //
  /////////////////

  const optionMarket = (await ((await ethers.getContractFactory('OptionMarket')) as ContractFactory)
    .connect(deployer)
    .deploy()) as OptionMarket;

  const optionMarketPricer = (await ((await ethers.getContractFactory('OptionMarketPricer')) as ContractFactory)
    .connect(deployer)
    .deploy()) as OptionMarketPricer;

  const optionGreekCache = (await (
    await ethers.getContractFactory('OptionGreekCache', {
      signer: deployer,
      libraries: {
        GWAV: existingSystem.gwav.address,
        BlackScholes: existingSystem.blackScholes.address,
      },
    })
  )
    .connect(deployer)
    .deploy()) as OptionGreekCache;

  const liquidityPool = (await ((await ethers.getContractFactory('LiquidityPool')) as ContractFactory)
    .connect(deployer)
    .deploy()) as LiquidityPool;

  const liquidityToken = (await ((await ethers.getContractFactory('LiquidityToken')) as ContractFactory)
    .connect(deployer)
    .deploy(`sUSD/${market} Pool Tokens`, 'LyraELPT')) as LiquidityToken;

  const basicLiquidityCounter = (await ((await ethers.getContractFactory('BasicLiquidityCounter')) as ContractFactory)
    .connect(deployer)
    .deploy()) as BasicLiquidityCounter;

  const optionToken = (await ((await ethers.getContractFactory('OptionToken')) as ContractFactory)
    .connect(deployer)
    .deploy(`sUSD/${market} Option Tokens`, 'LyraEOT')) as OptionToken;

  const shortCollateral = (await ((await ethers.getContractFactory('ShortCollateral')) as ContractFactory)
    .connect(deployer)
    .deploy()) as ShortCollateral;

  const futuresPoolHedger = (await ((await ethers.getContractFactory('GMXFuturesPoolHedger')) as ContractFactory)
    .connect(deployer)
    .deploy()) as GMXFuturesPoolHedger;

  const GWAVOracle = (await (
    await ethers.getContractFactory('GWAVOracle', {
      signer: deployer,
      libraries: {
        BlackScholes: existingSystem.blackScholes.address,
      },
    })
  )
    .connect(deployer)
    .deploy()) as GWAVOracle;

  const keeperHelper = (await ((await ethers.getContractFactory('KeeperHelper')) as ContractFactory)
    .connect(deployer)
    .deploy()) as KeeperHelper;

  ///////////////
  // SNX sBase //
  ///////////////

  const marketSystem: MarketTestSystemContractsGMX = {
    optionMarket,
    optionMarketPricer,
    optionGreekCache,
    optionToken,
    GWAVOracle,
    liquidityPool,
    liquidityToken,
    basicLiquidityCounter,
    shortCollateral,
    futuresPoolHedger,
    keeperHelper,
  };

  console.log(chalk.greenBright('market system deployed - GMX'));

  return marketSystem;
}

// GMX functions to deploy the gmx environment for testing
export async function deployGlobalTestContractsGMX(
  deployer: SignerWithAddress,
  _exportAddresses: boolean,
  _overrides: DeployOverrides,
): Promise<GlobalTestSystemContractsGMX> {
  ////////////////////////
  // Libraries & Oracle //
  ////////////////////////

  const gwav = (await ((await ethers.getContractFactory('GWAV')) as ContractFactory)
    .connect(deployer)
    .deploy()) as GWAV;

  const blackScholes = (await ((await ethers.getContractFactory('BlackScholes')) as ContractFactory)
    .connect(deployer)
    .deploy()) as BlackScholes;

  ////////////////////////////////
  //GMX mock Contract vs direct //
  ////////////////////////////////
  const GMXAdapter = (await ((await ethers.getContractFactory('GMXAdapter')) as ContractFactory)
    .connect(deployer)
    .deploy()) as GMXAdapter;

  // NOTE: this is called atomically by the proxy when deployed
  await GMXAdapter.initialize();

  //////////////////
  // Lyra Globals //
  //////////////////

  const optionMarketViewer = (await ((await ethers.getContractFactory('OptionMarketViewer')) as ContractFactory)
    .connect(deployer)
    .deploy()) as OptionMarketViewer;

  const optionMarketWrapper = (await ((await ethers.getContractFactory('OptionMarketWrapper')) as ContractFactory)
    .connect(deployer)
    .deploy()) as OptionMarketWrapper;

  const lyraRegistry = (await ((await ethers.getContractFactory('LyraRegistry')) as ContractFactory)
    .connect(deployer)
    .deploy()) as LyraRegistry;

  const basicFeeCounter = (await ((await ethers.getContractFactory('BasicFeeCounter')) as ContractFactory)
    .connect(deployer)
    .deploy()) as BasicFeeCounter;

  const testCurve = (await ((await ethers.getContractFactory('TestCurve')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestCurve; // test curve for now

  const testSystem = {
    GMXAdapter,
    lyraRegistry,
    blackScholes,
    gwav,
    optionMarketViewer,
    optionMarketWrapper,
    testCurve,
    basicFeeCounter,
    gmx: {} as any,
  };

  //////////////////
  // GMX Contracts //
  //////////////////

  const contractOverrides: {
    USDC: TestERC20SetDecimalsFail;
    eth: TestWETH;
    btc: TestERC20SetDecimalsFail;
    usdcPriceFeed: MockAggregatorV2V3;
    ethPriceFeed: MockAggregatorV2V3;
    btcPriceFeed: MockAggregatorV2V3;
  } = {
    USDC: (await (
      await ethers.getContractFactory('TestERC20SetDecimalsFail', deployer)
    ).deploy('USDC', 'USDC', _overrides.usdcDecimals || 18)) as any,
    eth: (await (
      await ethers.getContractFactory('TestWETH', deployer)
    ).deploy('WETH', 'WETH', _overrides.ethDecimals || 18)) as any,
    btc: (await (
      await ethers.getContractFactory('TestERC20SetDecimalsFail', deployer)
    ).deploy('wBTC', 'wBTC', _overrides.btcDecimals || 18)) as any,
    usdcPriceFeed: (await ((await ethers.getContractFactory('MockAggregatorV2V3')) as ContractFactory)
      .connect(deployer)
      .deploy()) as MockAggregatorV2V3,
    ethPriceFeed: (await ((await ethers.getContractFactory('MockAggregatorV2V3')) as ContractFactory)
      .connect(deployer)
      .deploy()) as MockAggregatorV2V3,
    btcPriceFeed: (await ((await ethers.getContractFactory('MockAggregatorV2V3')) as ContractFactory)
      .connect(deployer)
      .deploy()) as MockAggregatorV2V3,
  };

  await contractOverrides.usdcPriceFeed.connect(deployer).setDecimals(_overrides.usdcFeedDecimals || 18);
  await contractOverrides.ethPriceFeed.connect(deployer).setDecimals(_overrides.ethFeedDecimals || 8);
  await contractOverrides.btcPriceFeed.connect(deployer).setDecimals(_overrides.btcFeedDecimals || 8);

  if (_overrides.mockGMX) {
    testSystem.gmx = await deployMockGMX(deployer, contractOverrides);
  } else {
    testSystem.gmx = await deployRealGMX(deployer, contractOverrides);
  }

  testSystem.gmx.btcPriceFeed = contractOverrides.btcPriceFeed;
  testSystem.gmx.ethPriceFeed = contractOverrides.ethPriceFeed;
  testSystem.gmx.usdcPriceFeed = contractOverrides.usdcPriceFeed;

  console.log(chalk.greenBright('Global System Deployed - GMX'));
  return testSystem as GlobalTestSystemContractsGMX;
}

async function deployMockGMX(
  deployer: SignerWithAddress,
  contractOverrides: Partial<GMXDeployContractsType>,
): Promise<GMXDeployContractsType> {
  const vault = (await (await ethers.getContractFactory('TestGMXVaultChainlinkPrice', deployer)).deploy()) as any;
  return {
    isMockGMX: true,
    USDC:
      contractOverrides.USDC ||
      ((await (await ethers.getContractFactory('TestERC20SetDecimals', deployer)).deploy('USDC', 'USDC', 18)) as any),
    eth:
      contractOverrides.eth ||
      ((await (await ethers.getContractFactory('TestWETH', deployer)).deploy('WETH', 'WETH', 18)) as any),
    btc:
      contractOverrides.btc ||
      ((await (await ethers.getContractFactory('TestERC20SetDecimals', deployer)).deploy('wBTC', 'wBTC', 18)) as any),
    vault,
    timelock: undefined as any,
    usdg: undefined as any,
    router: (await (await ethers.getContractFactory('TestGMXRouter', deployer)).deploy()) as any,
    shortsTracker: undefined as any,
    positionRouter: (await (
      await ethers.getContractFactory('TestGMXPositionRouter', deployer)
    ).deploy(vault.address)) as any,
    referralStorage: undefined as any,
    distributor: undefined as any,
    reader: undefined as any,
    vaultPriceFeed: undefined as any,
    usdcPriceFeed: undefined as any,
    ethPriceFeed: undefined as any,
    btcPriceFeed: undefined as any,
    fastPriceEvents: undefined as any,
    fastPriceFeed: undefined as any,
    yieldTracker: undefined as any,
  };
}

export async function linkEventTracerGMX(testSystem: TestSystemContractsTypeGMX) {
  // currently only supports default sETH market

  // Lyra
  // tracer.nameTags[testSystem.synthetixAdapter.address] = 'synthetixAdapter';
  tracer.nameTags[testSystem.GMXAdapter.address] = 'exchangeAdapter';
  tracer.nameTags[testSystem.optionMarket.address] = 'optionMarket';
  tracer.nameTags[testSystem.optionMarketPricer.address] = 'optionMarketPricer';
  tracer.nameTags[testSystem.optionGreekCache.address] = 'optionGreekCache';
  tracer.nameTags[testSystem.liquidityPool.address] = 'liquidityPool';
  tracer.nameTags[testSystem.liquidityToken.address] = 'liquidityToken';
  tracer.nameTags[testSystem.optionToken.address] = 'optionToken';
  tracer.nameTags[testSystem.shortCollateral.address] = 'shortCollateral';
  tracer.nameTags[testSystem.optionMarketViewer.address] = 'optionMarketViewer';
  tracer.nameTags[testSystem.futuresPoolHedger.address] = 'futuresPoolHedger';

  // GMX
  tracer.nameTags[testSystem.gmx.eth.address] = 'wETH';
  // Assets
}
