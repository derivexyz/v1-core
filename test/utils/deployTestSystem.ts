import { BigNumber, Contract, ContractFactory, Signer } from 'ethers';
import { ethers, tracer, upgrades } from 'hardhat';
import { DEFAULT_DECIMALS, toBN, toBytes32, YEAR_SEC } from '../../scripts/util/web3utils';
import {
  BasicFeeCounter,
  BasicLiquidityCounter,
  BlackScholes,
  GWAV,
  GWAVOracle,
  KeeperHelper,
  LiquidityPool,
  LiquidityToken,
  LyraRegistry,
  MockAggregatorV2V3,
  OptionGreekCache,
  OptionMarket,
  OptionMarketPricer,
  OptionMarketViewer,
  OptionMarketWrapper,
  OptionToken,
  ShortCollateral,
  ShortPoolHedger,
  SNXPerpV2Adapter,
  SynthetixAdapter,
  TestAddressResolver,
  TestCollateralShort,
  TestCurve,
  TestDelegateApprovals,
  TestERC20SetDecimalsFail,
  TestExchanger,
  TestExchangeRates,
  TestSynthetixReturnZero,
} from '../../typechain-types';
import { LiquidityPoolParametersStruct } from '../../typechain-types/LiquidityPool';
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
import { DEFAULT_RATE_AND_CARRY, DEFAULT_SECURITY_MODULE } from './defaultParams';
// import _ from 'lodash';
import { mergeDeep } from './package/merge';
import { exportGlobalDeployment, exportMarketDeployment, getLocalRealSynthetixContract } from './package/parseFiles';
import { changeRate, compileAndDeployRealSynthetix, mintsUSD, setDebtLimit } from './package/realSynthetixUtils';

export type TestSystemContractsType = GlobalTestSystemContracts & MarketTestSystemContracts;

export type GlobalTestSystemContracts = {
  synthetixAdapter: SynthetixAdapter;
  synthetixPerpV2Adapter: SNXPerpV2Adapter;
  lyraRegistry: LyraRegistry;
  blackScholes: BlackScholes;
  gwav: GWAV;
  optionMarketViewer: OptionMarketViewer;
  optionMarketWrapper: OptionMarketWrapper;
  testCurve: TestCurve;
  basicFeeCounter: BasicFeeCounter;
  snx: {
    isMockSNX: boolean;
    addressResolver: Contract;
    collateralShort: Contract;
    synthetix: Contract;
    delegateApprovals: Contract;
    quoteAsset: Contract;
    exchangeRates: Contract;
    exchanger: Contract;
    snxMockAggregator?: Contract;
    ethMockAggregator?: Contract;
    btcMockAggregator?: Contract;
    collateralManager?: Contract;
    systemSettings?: Contract;
  };
};

export type MarketTestSystemContracts = {
  optionMarket: OptionMarket;
  optionMarketPricer: OptionMarketPricer;
  optionGreekCache: OptionGreekCache;
  optionToken: OptionToken;
  GWAVOracle: GWAVOracle;
  liquidityPool: LiquidityPool;
  liquidityToken: LiquidityToken;
  basicLiquidityCounter: BasicLiquidityCounter;
  shortCollateral: ShortCollateral;
  poolHedger: ShortPoolHedger;
  keeperHelper: KeeperHelper;
  snx: {
    baseAsset: Contract;
  };
};

export type DeployOverrides = {
  // asset decimals
  quoteDecimals?: number;
  baseDecimals?: number;

  // market parameters
  optionMarketParams?: OptionMarketParametersStruct;
  liquidityPoolParams?: LiquidityPoolParametersStruct;
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
  synthetixAdapter?: string;
  lyraRegistry?: string;
  blackScholes?: string;
  gwav?: string;
  optionMarketViewer?: string;
  optionMarketWrapper?: string;
  testCurve?: string;
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
  poolHedger?: string;
  addressResolver?: string;
  collateralShort?: string;
  synthetix?: string;
  delegateApprovals?: string;
  exchangeRates?: string;
  exchanger?: string;
  quoteAsset?: string;
  baseAsset?: string;
  quoteToken?: string;
  baseToken?: string;

  // set to false to deploy full SNX stack
  // only works when deployed to localhost (not hardhat tests)
  mockSNX?: boolean; // true by default
  compileSNX?: boolean; // only need to compile once
  usePerpsAdapter?: boolean;
};

export async function deployTestSystem(
  deployer: Signer,
  useTracer?: boolean,
  exportAddresses?: boolean,
  overrides?: DeployOverrides,
): Promise<TestSystemContractsType> {
  exportAddresses = exportAddresses || false;
  overrides = overrides || ({} as DeployOverrides);

  const globalSystem = await deployGlobalTestContracts(deployer, exportAddresses, overrides);
  const marketSystem = await deployMarketTestContracts(globalSystem, deployer, 'sETH', exportAddresses, overrides);
  const testSystem: TestSystemContractsType = mergeDeep(globalSystem, marketSystem);

  await initGlobalTestSystem(testSystem, deployer, overrides);
  await initMarketTestSystem('sETH', testSystem, marketSystem, deployer, overrides);

  // linking tracer for easy debugging with events
  if (useTracer === true) {
    await linkEventTracer(testSystem);
  }
  return testSystem;
}

// only used in certain tests
export async function addNewMarketSystem(
  deployer: Signer,
  existingTestSystem: TestSystemContractsType,
  market: string,
  exportAddresses?: boolean,
  overrides?: DeployOverrides,
): Promise<TestSystemContractsType> {
  exportAddresses = exportAddresses || false;
  overrides = overrides || ({} as DeployOverrides);

  const newMarketSystem: MarketTestSystemContracts = await deployMarketTestContracts(
    existingTestSystem,
    deployer,
    market,
    exportAddresses,
    overrides,
  );
  await initMarketTestSystem(market, existingTestSystem, newMarketSystem, deployer, overrides);
  return newTestSystemForMarket(existingTestSystem, newMarketSystem);
}

export async function deployGlobalTestContracts(
  deployer: Signer,
  exportAddresses: boolean,
  overrides: DeployOverrides,
): Promise<GlobalTestSystemContracts> {
  ////////////////////////
  // Libraries & Oracle //
  ////////////////////////

  const gwav = (await ((await ethers.getContractFactory('GWAV')) as ContractFactory)
    .connect(deployer)
    .deploy()) as GWAV;

  const blackScholes = (await ((await ethers.getContractFactory('BlackScholes')) as ContractFactory)
    .connect(deployer)
    .deploy()) as BlackScholes;

  /////////////////////////
  // SNX Proxy vs Direct //
  /////////////////////////

  const filename = __filename.split('.');
  const runEnv = filename[filename.length - 1];
  let synthetixAdapter: SynthetixAdapter;
  let synthetixPerpV2Adapter: SNXPerpV2Adapter;
  if (runEnv == 'ts') {
    // Deploy via proxy if testing within repo
    // deployProxy automatically runs initialize()
    // implementation contracts stored in '.openzeppelin' in project root
    const synthetixAdapterImplementation = (
      (await ethers.getContractFactory('SynthetixAdapter')) as ContractFactory
    ).connect(deployer);

    const synthetixV2PerpAdapterImplementation = (
      (await ethers.getContractFactory('SNXPerpV2Adapter')) as ContractFactory
    ).connect(deployer);

    try {
      synthetixAdapter = (await upgrades.deployProxy(synthetixAdapterImplementation, [], {
        timeout: 60000,
        pollingInterval: 5000,
      })) as SynthetixAdapter;
      await synthetixAdapter.deployed();

      synthetixPerpV2Adapter = (await upgrades.deployProxy(synthetixV2PerpAdapterImplementation, [], {
        timeout: 60000,
        pollingInterval: 5000,
      })) as SNXPerpV2Adapter;
      await synthetixPerpV2Adapter.deployed();
    } catch (e) {
      if (e instanceof Error) {
        // OZ upgrade package uses hre.network when confirming corret deployment
        e.message =
          e.message + '\n\nLyra prompt: if deploying to local, make sure to run using `hardhat run --network local';
      }
      throw e;
    }
  } else {
    // Deploy directly if testing as npm package
    synthetixAdapter = (await ((await ethers.getContractFactory('SynthetixAdapter')) as ContractFactory)
      .connect(deployer)
      .deploy()) as SynthetixAdapter;

    // manually initialize()
    await synthetixAdapter.connect(deployer).initialize();

    synthetixPerpV2Adapter = (await ((await ethers.getContractFactory('SNXPerpV2Adapter')) as ContractFactory)
      .connect(deployer)
      .deploy()) as SNXPerpV2Adapter;
    await synthetixPerpV2Adapter.connect(deployer).initialize();
  }

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
    synthetixAdapter,
    synthetixPerpV2Adapter,
    lyraRegistry,
    blackScholes,
    gwav,
    optionMarketViewer,
    optionMarketWrapper,
    testCurve,
    basicFeeCounter,
    snx: {} as any,
  };

  //////////////////////
  // SNX Mock or Real //
  //////////////////////

  if (overrides.mockSNX || overrides.mockSNX == undefined) {
    testSystem.snx = await deployMockGlobalSNX(deployer, overrides);
  } else {
    await compileAndDeployRealSynthetix(overrides.compileSNX || overrides.compileSNX == undefined);

    const snxMockAggregator = (await ((await ethers.getContractFactory('MockAggregatorV2V3')) as ContractFactory)
      .connect(deployer)
      .deploy()) as MockAggregatorV2V3; // used to mock SNX price

    const ethMockAggregator = (await ((await ethers.getContractFactory('MockAggregatorV2V3')) as ContractFactory)
      .connect(deployer)
      .deploy()) as MockAggregatorV2V3; // used to mock sETH price

    const btcMockAggregator = (await ((await ethers.getContractFactory('MockAggregatorV2V3')) as ContractFactory)
      .connect(deployer)
      .deploy()) as MockAggregatorV2V3; // used to mock sBTC price

    testSystem.snx = {
      isMockSNX: false,
      addressResolver: await getLocalRealSynthetixContract(deployer, 'local', 'AddressResolver'),
      collateralShort: await getLocalRealSynthetixContract(deployer, 'local', 'CollateralShort'),
      synthetix: await getLocalRealSynthetixContract(deployer, 'local', 'ProxySynthetix'),
      delegateApprovals: await getLocalRealSynthetixContract(deployer, 'local', 'DelegateApprovals'),
      quoteAsset: await getLocalRealSynthetixContract(deployer, 'local', `ProxyERC20sUSD`), // not ProxysUSD?
      exchangeRates: await getLocalRealSynthetixContract(deployer, 'local', `ExchangeRates`),
      exchanger: await getLocalRealSynthetixContract(deployer, 'local', `Exchanger`),
      collateralManager: await getLocalRealSynthetixContract(deployer, 'local', 'CollateralManager'),
      systemSettings: await getLocalRealSynthetixContract(deployer, 'local', 'SystemSettings'),
      snxMockAggregator: snxMockAggregator as Contract,
      ethMockAggregator: ethMockAggregator as Contract,
      btcMockAggregator: btcMockAggregator as Contract,
    };

    await testSystem.snx.collateralManager.addCollaterals([testSystem.snx.collateralShort.address]);
    await testSystem.snx.systemSettings.setWaitingPeriodSecs(toBN('0'));
    await testSystem.snx.systemSettings.setInteractionDelay(testSystem.snx.collateralShort.address, toBN('0'));
    await testSystem.snx.systemSettings.setRateStalePeriod(ethers.BigNumber.from(YEAR_SEC));
  }

  if (exportAddresses) {
    await exportGlobalDeployment(testSystem as GlobalTestSystemContracts);
  }
  return testSystem as GlobalTestSystemContracts;
}

export async function deployMarketTestContracts(
  existingSystem: TestSystemContractsType | GlobalTestSystemContracts,
  deployer: Signer,
  market: string,
  exportAddresses: boolean,
  overrides: DeployOverrides,
): Promise<MarketTestSystemContracts> {
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

  const poolHedger = (await ((await ethers.getContractFactory('ShortPoolHedger')) as ContractFactory)
    .connect(deployer)
    .deploy()) as ShortPoolHedger;

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

  const marketSystem: MarketTestSystemContracts = {
    optionMarket,
    optionMarketPricer,
    optionGreekCache,
    optionToken,
    GWAVOracle,
    liquidityPool,
    liquidityToken,
    basicLiquidityCounter,
    shortCollateral,
    poolHedger,
    keeperHelper,
    snx: {} as any,
  };

  if (overrides.mockSNX || overrides.mockSNX == undefined) {
    const baseName = 'Synthetic ' + market.slice(1);

    marketSystem.snx.baseAsset = (await (
      (await ethers.getContractFactory('TestERC20SetDecimalsFail')) as ContractFactory
    )
      .connect(deployer)
      .deploy(baseName, market, overrides?.baseDecimals ? overrides.baseDecimals : 18)) as TestERC20SetDecimalsFail;
  } else {
    marketSystem.snx.baseAsset = await getLocalRealSynthetixContract(deployer, 'local', `Proxy${market}`);
  }

  if (exportAddresses) {
    await exportMarketDeployment(marketSystem, market);
  }
  return marketSystem;
}

export async function initGlobalTestSystem(
  testSystem: GlobalTestSystemContracts,
  deployer: Signer,
  overrides: DeployOverrides,
) {
  //////////////////////////
  // SNX Address Resolver //
  //////////////////////////

  const names = [
    toBytes32('ProxySynthetix'),
    toBytes32('Exchanger'),
    toBytes32('ExchangeRates'),
    toBytes32('CollateralShort'),
    toBytes32('DelegateApprovals'),
  ];
  const addresses = [
    testSystem.snx.synthetix.address,
    testSystem.snx.exchanger.address,
    testSystem.snx.exchangeRates.address,
    testSystem.snx.collateralShort.address,
    testSystem.snx.delegateApprovals.address,
  ];

  if (overrides.mockSNX || overrides.mockSNX == undefined) {
    await testSystem.snx.synthetix
      .connect(deployer)
      .init(
        overrides.synthetixAdapter ||
          (overrides.usePerpsAdapter ? testSystem.synthetixPerpV2Adapter.address : testSystem.synthetixAdapter.address),
        overrides.quoteAsset || testSystem.snx.quoteAsset.address,
        overrides.addressResolver || testSystem.snx.addressResolver.address,
      );

    await testSystem.snx.collateralShort
      .connect(deployer)
      .init(
        overrides.synthetixAdapter ||
          (overrides.usePerpsAdapter ? testSystem.synthetixPerpV2Adapter.address : testSystem.synthetixAdapter.address),
        overrides.quoteAsset || testSystem.snx.quoteAsset.address,
      );

    await testSystem.snx.addressResolver.connect(deployer).setAddresses(names, addresses);

    await testSystem.snx.quoteAsset.connect(deployer).permitMint(testSystem.snx.synthetix.address, true);
    await testSystem.snx.quoteAsset.connect(deployer).permitMint(testSystem.snx.collateralShort.address, true);
  } else {
    testSystem.snx.snxMockAggregator = testSystem.snx.snxMockAggregator || ({} as Contract);
    await testSystem.snx.exchangeRates.addAggregator(toBytes32('SNX'), testSystem.snx.snxMockAggregator.address);

    testSystem.snx.ethMockAggregator = testSystem.snx.ethMockAggregator || ({} as Contract);
    await testSystem.snx.exchangeRates.addAggregator(toBytes32('sETH'), testSystem.snx.ethMockAggregator.address);

    testSystem.snx.btcMockAggregator = testSystem.snx.btcMockAggregator || ({} as Contract);
    await testSystem.snx.exchangeRates.addAggregator(toBytes32('sBTC'), testSystem.snx.btcMockAggregator.address);

    await changeRate(testSystem as TestSystemContractsType, toBN('1000'), 'SNX');

    await changeRate(testSystem as TestSystemContractsType, defaultParams.getBasePrice('sETH'), 'sETH');
    await changeRate(testSystem as TestSystemContractsType, defaultParams.getBasePrice('sBTC'), 'sBTC');

    await setDebtLimit(testSystem as TestSystemContractsType, toBN('1000000000')); // need to double check
    await mintsUSD(testSystem as TestSystemContractsType, deployer, toBN('0')); // need to double check
  }

  //////////////////////////////
  // Lyra Adapters & Wrappers //
  //////////////////////////////
  await testSystem.synthetixAdapter.connect(deployer).setAddressResolver(testSystem.snx.addressResolver.address);
  await testSystem.synthetixAdapter.connect(deployer).updateSynthetixAddresses();

  await testSystem.optionMarketViewer
    .connect(deployer)
    .init(
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter ? testSystem.synthetixPerpV2Adapter.address : testSystem.synthetixAdapter.address),
    );

  await testSystem.optionMarketWrapper.connect(deployer).updateContractParams(
    testSystem.snx.quoteAsset.address, // irrelevant for snx (should be WETH for wrapping)
    overrides.testCurve || testSystem.testCurve.address,
    testSystem.basicFeeCounter.address,
    toBN('0.1'),
  );

  await testSystem.lyraRegistry.updateGlobalAddresses(
    [
      toBytes32('EXCHANGE_ADAPTER'),
      toBytes32('MARKET_VIEWER'),
      toBytes32('MARKET_WRAPPER'),
      toBytes32('GWAV'),
      toBytes32('BLACK_SCHOLES'),
    ],
    [
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter ? testSystem.synthetixPerpV2Adapter.address : testSystem.synthetixAdapter.address),
      testSystem.optionMarketViewer.address,
      testSystem.optionMarketWrapper.address,
      testSystem.gwav.address,
      testSystem.blackScholes.address,
    ],
  );
}

export async function initMarketTestSystem(
  market: string,
  existingTestSystem: TestSystemContractsType,
  marketTestSystem: MarketTestSystemContracts,
  deployer: Signer,
  overrides: DeployOverrides,
) {
  ///////////
  // sBase //
  ///////////
  if (overrides.mockSNX || overrides.mockSNX == undefined) {
    await existingTestSystem.snx.synthetix
      .connect(deployer)
      .addBaseAsset(
        toBytes32(market),
        overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
        marketTestSystem.optionMarket.address,
      );

    await existingTestSystem.snx.collateralShort
      .connect(deployer)
      .addBaseAsset(
        toBytes32(market),
        overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
        marketTestSystem.optionMarket.address,
      );

    await marketTestSystem.snx.baseAsset.permitMint(existingTestSystem.snx.synthetix.address, true);
    await marketTestSystem.snx.baseAsset.permitMint(existingTestSystem.snx.collateralShort.address, true);
  } else {
    // current snx deployment only supports 2 assets. Already manually set during global init.
    // Manually change .snx config files to add other assets.
    // marketTestSystem.snx.baseMockAggregator = marketTestSystem.snx.baseMockAggregator || {} as Contract;
    // await existingTestSystem.snx.exchangeRates.addAggregator(
    //   toBytes32(market),
    //   marketTestSystem.snx.baseMockAggregator.address)
  }

  ///////////////////
  // Set Addresses //
  ///////////////////

  await marketTestSystem.optionMarket
    .connect(deployer)
    .init(
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter
          ? existingTestSystem.synthetixPerpV2Adapter.address
          : existingTestSystem.synthetixAdapter.address),
      overrides.liquidityPool || marketTestSystem.liquidityPool.address,
      overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.shortCollateral || marketTestSystem.shortCollateral.address,
      overrides.optionToken || marketTestSystem.optionToken.address,
      overrides.quoteAsset || existingTestSystem.snx.quoteAsset.address,
      overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
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
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter
          ? existingTestSystem.synthetixPerpV2Adapter.address
          : existingTestSystem.synthetixAdapter.address),
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
    );

  await marketTestSystem.liquidityPool
    .connect(deployer)
    .init(
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter
          ? existingTestSystem.synthetixPerpV2Adapter.address
          : existingTestSystem.synthetixAdapter.address),
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.liquidityToken || marketTestSystem.liquidityToken.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.poolHedger || marketTestSystem.poolHedger.address,
      overrides.shortCollateral || marketTestSystem.shortCollateral.address,
      overrides.quoteAsset || existingTestSystem.snx.quoteAsset.address,
      overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
    );

  await marketTestSystem.liquidityToken
    .connect(deployer)
    .init(overrides.liquidityPool || marketTestSystem.liquidityPool.address);

  await marketTestSystem.poolHedger
    .connect(deployer)
    .init(
      overrides.synthetixAdapter || existingTestSystem.synthetixAdapter.address,
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.liquidityPool || marketTestSystem.liquidityPool.address,
      overrides.quoteAsset || existingTestSystem.snx.quoteAsset.address,
      overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
    );

  await marketTestSystem.shortCollateral
    .connect(deployer)
    .init(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.liquidityPool || marketTestSystem.liquidityPool.address,
      overrides.optionToken || marketTestSystem.optionToken.address,
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter
          ? existingTestSystem.synthetixPerpV2Adapter.address
          : existingTestSystem.synthetixAdapter.address),
      overrides.quoteAsset || existingTestSystem.snx.quoteAsset.address,
      overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
    );

  await marketTestSystem.optionToken
    .connect(deployer)
    .init(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
      overrides.shortCollateral || marketTestSystem.shortCollateral.address,
      overrides.synthetixAdapter ||
        (overrides.usePerpsAdapter
          ? existingTestSystem.synthetixPerpV2Adapter.address
          : existingTestSystem.synthetixAdapter.address),
    );

  await existingTestSystem.synthetixAdapter
    .connect(deployer)
    .setGlobalsForContract(
      marketTestSystem.optionMarket.address,
      toBytes32('sUSD'),
      toBytes32(market),
      DEFAULT_SECURITY_MODULE,
      toBytes32(''),
    );

  await existingTestSystem.synthetixAdapter.setRiskFreeRate(
    marketTestSystem.optionMarket.address,
    DEFAULT_RATE_AND_CARRY,
  );

  await marketTestSystem.GWAVOracle.connect(deployer).init(
    overrides.optionMarket || marketTestSystem.optionMarket.address,
    overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    overrides.synthetixAdapter || existingTestSystem.synthetixAdapter.address,
  );

  await existingTestSystem.optionMarketViewer.connect(deployer).addMarket({
    liquidityPool: overrides.liquidityPool || marketTestSystem.liquidityPool.address,
    liquidityToken: overrides.liquidityToken || marketTestSystem.liquidityToken.address,
    greekCache: overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    optionMarket: overrides.optionMarket || marketTestSystem.optionMarket.address,
    optionMarketPricer: overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
    optionToken: overrides.optionToken || marketTestSystem.optionToken.address,
    poolHedger: overrides.poolHedger || marketTestSystem.poolHedger.address,
    shortCollateral: overrides.shortCollateral || marketTestSystem.shortCollateral.address,
    baseAsset: overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
    quoteAsset: overrides.quoteAsset || existingTestSystem.snx.quoteAsset.address,
  });

  await existingTestSystem.lyraRegistry.connect(deployer).addMarket({
    liquidityPool: overrides.liquidityPool || marketTestSystem.liquidityPool.address,
    liquidityToken: overrides.liquidityToken || marketTestSystem.liquidityToken.address,
    greekCache: overrides.optionGreekCache || marketTestSystem.optionGreekCache.address,
    optionMarket: overrides.optionMarket || marketTestSystem.optionMarket.address,
    optionMarketPricer: overrides.optionMarketPricer || marketTestSystem.optionMarketPricer.address,
    optionToken: overrides.optionToken || marketTestSystem.optionToken.address,
    poolHedger: overrides.poolHedger || marketTestSystem.poolHedger.address,
    shortCollateral: overrides.shortCollateral || marketTestSystem.shortCollateral.address,
    gwavOracle: overrides.GWAVOracle || marketTestSystem.GWAVOracle.address,
    baseAsset: overrides.baseAsset || marketTestSystem.snx.baseAsset.address,
    quoteAsset: overrides.quoteAsset || existingTestSystem.snx.quoteAsset.address,
  });

  await existingTestSystem.optionMarketWrapper
    .connect(deployer)
    .addMarket(
      overrides.optionMarket || marketTestSystem.optionMarket.address,
      overrides.marketId || defaultParams.DEFAULT_MARKET_ID,
      {
        quoteAsset: overrides.quoteToken || existingTestSystem.snx.quoteAsset.address,
        baseAsset: overrides.baseToken || marketTestSystem.snx.baseAsset.address,
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

  ////////////////////////
  // Lyra Market Params //
  ////////////////////////

  await marketTestSystem.liquidityPool
    .connect(deployer)
    .setLiquidityPoolParameters(overrides.liquidityPoolParams || defaultParams.DEFAULT_LIQUIDITY_POOL_PARAMS);

  await marketTestSystem.liquidityPool.connect(deployer).setCircuitBreakerParameters(defaultParams.DEFAULT_CB_PARAMS);

  await marketTestSystem.poolHedger
    .connect(deployer)
    .setPoolHedgerParams(overrides.poolHedgerParams || defaultParams.DEFAULT_POOL_HEDGER_PARAMS);

  await marketTestSystem.poolHedger
    .connect(deployer)
    .setShortBuffer(overrides.hedgerShortBuffer || defaultParams.DEFAULT_SHORT_BUFFER);

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

  if (overrides.mockSNX || overrides.mockSNX == undefined) {
    await existingTestSystem.snx.exchanger
      .connect(deployer)
      .setFeeRateForExchange(
        toBytes32(market),
        toBytes32('sUSD'),
        overrides.feeRateForBase || defaultParams.DEFAULT_FEE_RATE_FOR_BASE,
      );

    await existingTestSystem.snx.exchanger
      .connect(deployer)
      .setFeeRateForExchange(
        toBytes32('sUSD'),
        toBytes32(market),
        overrides.feeRateForQuote || defaultParams.DEFAULT_FEE_RATE_FOR_QUOTE,
      );

    await existingTestSystem.snx.exchangeRates
      .connect(deployer)
      .setRateAndInvalid(toBytes32(market), overrides.basePrice || defaultParams.getBasePrice(market), false);
  } else {
    // this is manually done during deploymer. Current snx deployment only supports sBTC and sETH assets.
    // Need to manually change .snx config files to add other assets + add rate in changeRates.
  }
}

export async function deployMockGlobalSNX(deployer: Signer, overrides?: DeployOverrides) {
  const isMockSNX: boolean = true;

  const exchanger = (await ((await ethers.getContractFactory('TestExchanger')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestExchanger;

  const exchangeRates = (await ((await ethers.getContractFactory('TestExchangeRates')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestExchangeRates;

  const quoteAsset = (await ((await ethers.getContractFactory('TestERC20SetDecimalsFail')) as ContractFactory)
    .connect(deployer)
    .deploy(
      'Synthetic USD',
      'sUSD',
      overrides?.quoteDecimals ? overrides.quoteDecimals : 18,
    )) as TestERC20SetDecimalsFail;

  const synthetix = (await ((await ethers.getContractFactory('TestSynthetixReturnZero')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestSynthetixReturnZero;

  const delegateApprovals = (await ((await ethers.getContractFactory('TestDelegateApprovals')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestDelegateApprovals;

  const collateralShort = (await ((await ethers.getContractFactory('TestCollateralShort')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestCollateralShort;

  const addressResolver = (await ((await ethers.getContractFactory('TestAddressResolver')) as ContractFactory)
    .connect(deployer)
    .deploy()) as TestAddressResolver;

  return {
    isMockSNX,
    addressResolver,
    collateralShort,
    synthetix,
    delegateApprovals,
    quoteAsset,
    exchangeRates,
    exchanger,
  };
}

export function newTestSystemForMarket(
  testSystem: TestSystemContractsType,
  marketTestSystem?: MarketTestSystemContracts,
) {
  const newTestSystem = {} as TestSystemContractsType;

  if (marketTestSystem) {
    // Assigning globals
    newTestSystem.synthetixAdapter = testSystem.synthetixAdapter;
    newTestSystem.lyraRegistry = testSystem.lyraRegistry;
    newTestSystem.blackScholes = testSystem.blackScholes;
    newTestSystem.gwav = testSystem.gwav;
    newTestSystem.optionMarketViewer = testSystem.optionMarketViewer;
    newTestSystem.optionMarketWrapper = testSystem.optionMarketWrapper;
    newTestSystem.testCurve = testSystem.testCurve;
    newTestSystem.basicFeeCounter = testSystem.basicFeeCounter;
    newTestSystem.snx = {
      isMockSNX: testSystem.snx.isMockSNX,
      addressResolver: testSystem.snx.addressResolver,
      collateralShort: testSystem.snx.collateralShort,
      synthetix: testSystem.snx.synthetix,
      delegateApprovals: testSystem.snx.delegateApprovals,
      quoteAsset: testSystem.snx.quoteAsset,
      exchangeRates: testSystem.snx.exchangeRates,
      exchanger: testSystem.snx.exchanger,
      baseAsset: marketTestSystem.snx.baseAsset,
    };

    if (!testSystem.snx.isMockSNX) {
      newTestSystem.snx.snxMockAggregator = testSystem.snx.snxMockAggregator;
      newTestSystem.snx.ethMockAggregator = testSystem.snx.ethMockAggregator;
      newTestSystem.snx.btcMockAggregator = testSystem.snx.btcMockAggregator;
      newTestSystem.snx.collateralManager = testSystem.snx.collateralManager;
      newTestSystem.snx.systemSettings = testSystem.snx.systemSettings;
    }
    // Assigning market
    newTestSystem.optionMarket = marketTestSystem.optionMarket;
    newTestSystem.optionMarketPricer = marketTestSystem.optionMarketPricer;
    newTestSystem.optionGreekCache = marketTestSystem.optionGreekCache;
    newTestSystem.optionToken = marketTestSystem.optionToken;
    newTestSystem.GWAVOracle = marketTestSystem.GWAVOracle;
    newTestSystem.liquidityPool = marketTestSystem.liquidityPool;
    newTestSystem.liquidityToken = marketTestSystem.liquidityToken;
    newTestSystem.basicLiquidityCounter = marketTestSystem.basicLiquidityCounter;
    newTestSystem.shortCollateral = marketTestSystem.shortCollateral;
    newTestSystem.poolHedger = marketTestSystem.poolHedger;
  }
  return newTestSystem;
}

export async function linkEventTracer(testSystem: TestSystemContractsType) {
  // currently only supports default sETH market

  // Lyra
  tracer.nameTags[testSystem.synthetixAdapter.address] = 'synthetixAdapter';
  tracer.nameTags[testSystem.optionMarket.address] = 'optionMarket';
  tracer.nameTags[testSystem.optionMarketPricer.address] = 'optionMarketPricer';
  tracer.nameTags[testSystem.optionGreekCache.address] = 'optionGreekCache';
  tracer.nameTags[testSystem.liquidityPool.address] = 'liquidityPool';
  tracer.nameTags[testSystem.liquidityToken.address] = 'liquidityToken';
  tracer.nameTags[testSystem.optionToken.address] = 'optionToken';
  tracer.nameTags[testSystem.shortCollateral.address] = 'shortCollateral';
  tracer.nameTags[testSystem.optionMarketViewer.address] = 'optionMarketViewer';
  tracer.nameTags[testSystem.poolHedger.address] = 'poolHedger';

  // Synthetix
  tracer.nameTags[testSystem.snx.exchangeRates.address] = 'exchangeRates';
  tracer.nameTags[testSystem.snx.exchanger.address] = 'exchanger';
  tracer.nameTags[testSystem.snx.quoteAsset.address] = 'quoteAsset';
  tracer.nameTags[testSystem.snx.baseAsset.address] = 'baseAsset';
  tracer.nameTags[testSystem.snx.synthetix.address] = 'synthetix';
  tracer.nameTags[testSystem.snx.collateralShort.address] = 'collateralShort';
  tracer.nameTags[testSystem.snx.addressResolver.address] = 'addressResolver';
}
