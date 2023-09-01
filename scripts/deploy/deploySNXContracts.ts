import { DeploymentParams, DeploymentType, isMockSnx, isRealSnx } from '../util';
import { clearLyraContracts, ParamHandler } from '../util/parseFiles';
import {
  deployLyraContract,
  deployLyraContractWithLibraries,
  deployMockExternalContract,
  deployProxyWithLibraries,
  executeExternalFunction,
  executeLyraFunction,
  getExternalContract,
  getLyraContract,
} from '../util/transactions';
import { toBN, toBytes32, ZERO_ADDRESS } from '../util/web3utils';
import { initSNXContracts } from './initSNXContracts';

export async function deploySNXContracts(deploymentParams: DeploymentParams, params: ParamHandler): Promise<void> {
  console.log('\n=== Deploying SNX Contracts ===\n');

  if (!isMockSnx(deploymentParams.deploymentType) && !isRealSnx(deploymentParams.deploymentType)) {
    throw Error('Invalid deployment type');
  }

  await clearLyraContracts(deploymentParams);

  const quoteName = params.get('QuoteAsset');

  let USDC;
  if (isRealSnx(deploymentParams.deploymentType)) {
    USDC = getExternalContract(deploymentParams, 'USDC');
  } else {
    USDC = await deployMockExternalContract(deploymentParams, quoteName, 'TestERC20SetDecimals', 'USDC', 'USDC', 6);

    await deployMockExternalContract(deploymentParams, `ProxyERC20sUSD`, 'TestERC20', 'Synthetic  USD', 'sUSD');

    await deployMockExternalContract(deploymentParams, 'SystemStatus', 'MockSystemStatus');

    await deployMockExternalContract(deploymentParams, 'AddressResolver', 'TestAddressResolver');

    await deployMockExternalContract(deploymentParams, 'PerpsV2MarketSettings', 'TestFuturesMarketSettings');

    await deployMockExternalContract(deploymentParams, 'FuturesMarketManager', 'TestFuturesMarketManager');

    await deployMockExternalContract(deploymentParams, 'CurveRegistry', 'TestCurve');

    await executeExternalFunction(deploymentParams, 'AddressResolver', 'setAddresses', [
      [toBytes32('FuturesMarketManager'), toBytes32('PerpsV2MarketSettings'), toBytes32('SystemStatus')],
      [
        getExternalContract(deploymentParams, 'FuturesMarketManager').address,
        getExternalContract(deploymentParams, 'PerpsV2MarketSettings').address,
        getExternalContract(deploymentParams, 'SystemStatus').address,
      ],
    ]);

    await deployLyraContract(deploymentParams, 'TestFaucet');

    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
      getExternalContract(deploymentParams, quoteName).address,
      toBN('10000'),
    ]);

    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [USDC.address, toBN('10000', 6)]);

    await executeExternalFunction(deploymentParams, 'USDC', 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);

    console.log('quoteName', quoteName);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);

    // set curve rate
    await executeExternalFunction(deploymentParams, 'CurveRegistry', 'setRate', [
      getExternalContract(deploymentParams, 'USDC').address,
      toBN('1'),
    ]);

    await executeExternalFunction(deploymentParams, 'CurveRegistry', 'setRate', [
      getExternalContract(deploymentParams, 'ProxyERC20sUSD').address,
      toBN('1'),
    ]);
  }

  await deployProxyWithLibraries(deploymentParams, 'SNXPerpV2Adapter', 'ExchangeAdapter');
  await deployLyraContract(deploymentParams, 'OptionMarketViewer');
  await deployLyraContract(deploymentParams, 'LyraRegistry');
  await deployLyraContract(deploymentParams, 'GWAV');
  await deployLyraContract(deploymentParams, 'BlackScholes');
  // await deployLyraContract(deploymentParams, 'UniSwapRouter');

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'updateGlobalAddresses', [
    [toBytes32('SYNTHETIX_ADAPTER'), toBytes32('MARKET_VIEWER'), toBytes32('GWAV'), toBytes32('BLACK_SCHOLES')],
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarketViewer').address,
      getLyraContract(deploymentParams, 'GWAV').address,
      getLyraContract(deploymentParams, 'BlackScholes').address,
    ],
  ]);

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setAddressResolver', [
    getExternalContract(deploymentParams, 'AddressResolver').address,
  ]);

  await executeLyraFunction(deploymentParams, 'OptionMarketViewer', 'init', [
    getLyraContract(deploymentParams, 'ExchangeAdapter').address,
  ]);

  console.log('= All contracts deployed adding markets');
  const tickers = Object.keys(params.get('Markets'));
  console.log('tickers', tickers);
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    await addMarket(deploymentParams, params, ticker, i + 1);
  }
}

export async function addMarket(deploymentParams: DeploymentParams, params: ParamHandler, ticker: string, id: number) {
  const market = params.get('Markets', ticker);
  if (!market) {
    throw new Error(`No parameters for market ${ticker}`);
  }
  const baseAsset = params.get('Markets', ticker, 'BaseAsset');

  if (!isMockSnx(deploymentParams.deploymentType)) {
    getExternalContract(deploymentParams, baseAsset);
  } else {
    await deployMockExternalContract(deploymentParams, baseAsset, 'TestERC20', `Proxy${baseAsset}`, baseAsset);

    //deploying proxy perps
    await deployMockExternalContract(deploymentParams, `PerpsV2Proxy${ticker}PERP`, 'MockPerpsV2MarketConsolidated');

    await executeExternalFunction(deploymentParams, `PerpsV2Proxy${ticker}PERP`, 'setAssetPrice', [
      toBN(params.get('Markets', ticker, 'MockPrice')),
      false,
    ]);
  }

  await deployLyraContract(deploymentParams, 'OptionMarket', ticker);
  await deployLyraContract(deploymentParams, 'OptionMarketPricer', ticker);

  await deployLyraContractWithLibraries(deploymentParams, 'OptionGreekCache', ticker, {
    GWAV: getLyraContract(deploymentParams, 'GWAV').address,
    BlackScholes: getLyraContract(deploymentParams, 'BlackScholes').address,
  });
  await deployLyraContract(
    deploymentParams,
    'OptionToken',
    ticker,
    `Lyra ${ticker} market Option Token`,
    `Ly${ticker}ot`,
  );

  await deployLyraContract(deploymentParams, 'LiquidityPool', ticker);
  await deployLyraContract(
    deploymentParams,
    'LiquidityToken',
    ticker,
    `Lyra ${ticker} market Liquidity Pool Token`,
    `Ly${ticker}pt`,
  );
  await deployLyraContract(deploymentParams, 'ShortCollateral', ticker);
  
  await deployLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', ticker);

  await deployLyraContract(deploymentParams, 'KeeperHelper', ticker);

  await deployLyraContractWithLibraries(deploymentParams, 'GWAVOracle', ticker, {
    BlackScholes: getLyraContract(deploymentParams, 'BlackScholes').address,
  });

  await initSNXContracts(deploymentParams, params, ticker, id);
}