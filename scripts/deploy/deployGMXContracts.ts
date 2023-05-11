import { DeploymentParams, DeploymentType, isMockGmx, isRealGmx } from '../util';
import { ParamHandler } from '../util/parseFiles';
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
import { toBN, toBytes32, UNIT, ZERO_ADDRESS } from '../util/web3utils';
import { BigNumber } from 'ethers';
import { initGMXContracts } from './initGMXContracts';

export async function deployGMXContracts(deploymentParams: DeploymentParams, params: ParamHandler): Promise<void> {
  if (!isMockGmx(deploymentParams.deploymentType) && !isRealGmx(deploymentParams.deploymentType)) {
    throw Error('Invalid deployment type');
  }

  // await clearLyraContracts(deploymentParams);

  const quoteName = params.get('QuoteAsset');
  const quoteDecimals = params.get('QuoteDecimals');
  const otherStables: any[] = params.get('OtherStables') || [];
  const useRealFeed = deploymentParams.deploymentType != DeploymentType.MockGmxMockPricing;

  if (isMockGmx(deploymentParams.deploymentType)) {
    await deployMockExternalContract(
      deploymentParams,
      quoteName,
      'TestERC20SetDecimals',
      quoteName,
      quoteName,
      quoteDecimals,
    );
    await deployMockExternalContract(deploymentParams, 'GMX_Vault', 'TestGMXVaultChainlinkPrice');

    if (deploymentParams.deploymentType == DeploymentType.MockGmxMockPricing) {
      await deployMockExternalContract(deploymentParams, `${quoteName}_PriceFeed`, 'MockAggregatorV2V3');
      await executeExternalFunction(deploymentParams, `${quoteName}_PriceFeed`, 'setDecimals', [6]);
      await executeExternalFunction(deploymentParams, `${quoteName}_PriceFeed`, 'setLatestAnswer', [
        BigNumber.from(10)
          .pow(6)
          .mul(toBN(params.get('QuoteMockRate')))
          .div(UNIT),
        (await deploymentParams.deployer.provider.getBlock('latest')).number,
      ]);
    } else if (deploymentParams.deploymentType != DeploymentType.MockGmxRealPricing) {
      throw Error('Invalid path');
    }

    await executeExternalFunction(deploymentParams, 'GMX_Vault', 'setFeed', [
      getExternalContract(deploymentParams, quoteName).address,
      getExternalContract(deploymentParams, `${quoteName}_PriceFeed`, undefined, useRealFeed).address,
    ]);

    await deployMockExternalContract(deploymentParams, 'CurvePool', 'TestCurve');
    await deployMockExternalContract(
      deploymentParams,
      'GMX_PositionRouter',
      'TestGMXPositionRouter',
      getExternalContract(deploymentParams, 'GMX_Vault').address,
    );
    await deployMockExternalContract(deploymentParams, 'GMX_Router', 'TestGMXRouter');

    await deployLyraContract(deploymentParams, 'TestFaucet');

    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
      getExternalContract(deploymentParams, quoteName).address,
      BigNumber.from(10000).mul(BigNumber.from(10).pow(quoteDecimals)),
    ]);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);

    for (const i of otherStables) {
      await deployMockExternalContract(
        deploymentParams,
        i.Ticker,
        'TestERC20SetDecimals',
        i.Ticker,
        i.Ticker,
        i.Decimals,
      );

      await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
        getExternalContract(deploymentParams, i.Ticker).address,
        BigNumber.from(10000).mul(BigNumber.from(10).pow(i.Decimals)),
      ]);
      await executeExternalFunction(deploymentParams, i.Ticker, 'permitMint', [
        getLyraContract(deploymentParams, 'TestFaucet').address,
        true,
      ]);
    }
  }

  await deployLyraContract(deploymentParams, 'LyraRegistry');
  await deployProxyWithLibraries(deploymentParams, 'GMXAdapter', 'ExchangeAdapter', undefined, []);
  await deployLyraContract(deploymentParams, 'OptionMarketViewer');
  // await deployLyraContract(deploymentParams, 'OptionMarketWrapper');
  await deployLyraContract(deploymentParams, 'GWAV');
  await deployLyraContract(deploymentParams, 'BlackScholes');

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'updateGlobalAddresses', [
    [
      toBytes32('GMX_ADAPTER'),
      toBytes32('MARKET_VIEWER'),
      // toBytes32('MARKET_WRAPPER'),
      toBytes32('GWAV'),
      toBytes32('BLACK_SCHOLES'),
    ],
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarketViewer').address,
      // getLyraContract(deploymentParams, 'OptionMarketWrapper').address,
      getLyraContract(deploymentParams, 'GWAV').address,
      getLyraContract(deploymentParams, 'BlackScholes').address,
    ],
  ]);

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setVaultContract', [
    getExternalContract(deploymentParams, 'GMX_Vault').address,
  ]);
  //
  await executeLyraFunction(deploymentParams, 'OptionMarketViewer', 'init', [
    getExternalContract(deploymentParams, 'ExchangeAdapter').address,
  ]);
  // await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'updateContractParams', [
  //   ZERO_ADDRESS,
  //   getExternalContract(deploymentParams, 'CurvePool').address,
  //   ZERO_ADDRESS,
  //   toBN('0.05'),
  // ]);
  //
  // await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addCurveStable', [
  //   getExternalContract(deploymentParams, quoteName).address,
  //   0,
  // ]);

  // let counter = 1;
  for (const i of otherStables) {
    if (isMockGmx(deploymentParams.deploymentType)) {
      await deployMockExternalContract(
        deploymentParams,
        i.Ticker,
        'TestERC20SetDecimals',
        i.Ticker,
        i.Ticker,
        i.Decimals,
      );
    }
    // await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addCurveStable', [
    //   getExternalContract(deploymentParams, i.Ticker).address,
    //   counter,
    // ]);
    // counter += 1;
  }

  if (isMockGmx(deploymentParams.deploymentType)) {
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getExternalContract(deploymentParams, 'GMX_Vault').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getExternalContract(deploymentParams, 'CurvePool').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, 'CurvePool', 'setRate', [
      getExternalContract(deploymentParams, quoteName).address,
      BigNumber.from(10)
        .pow(quoteDecimals)
        .mul(toBN(params.get('QuoteMockRate')))
        .div(UNIT),
    ]);

    for (const i of otherStables) {
      await executeExternalFunction(deploymentParams, i.Ticker, 'permitMint', [
        getExternalContract(deploymentParams, 'CurvePool').address,
        true,
      ]);

      await executeExternalFunction(deploymentParams, 'CurvePool', 'setRate', [
        getExternalContract(deploymentParams, i.Ticker).address,
        BigNumber.from(10).pow(i.Decimals).mul(toBN(i.MockRate)).div(UNIT),
      ]);
    }
  }

  const tickers = Object.keys(params.get('Markets'));
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    await addGMXMarket(deploymentParams, params, ticker, i + 1);
  }
}

export async function addGMXMarket(
  deploymentParams: DeploymentParams,
  params: ParamHandler,
  ticker: string,
  id: number,
) {
  const market = params.get('Markets', ticker);
  if (!market) {
    throw new Error(`No parameters for market ${ticker}`);
  }
  const baseTicker = params.get('Markets', ticker, 'BaseAsset');
  const baseDecimals = params.get('Markets', ticker, 'BaseDecimals');
  const baseMockRate = params.get('Markets', ticker, 'MockPrice');
  const useRealFeed = deploymentParams.deploymentType != DeploymentType.MockGmxMockPricing;

  if (isRealGmx(deploymentParams.deploymentType)) {
    // const baseAsset = getExternalContract(deploymentParams, baseTicker);
  } else {
    if (baseTicker == 'wETH') {
      await deployMockExternalContract(deploymentParams, baseTicker, 'TestWETH', baseTicker, baseTicker, baseDecimals);
    } else {
      await deployMockExternalContract(
        deploymentParams,
        baseTicker,
        'TestERC20SetDecimals',
        baseTicker,
        baseTicker,
        baseDecimals,
      );
    }
    if (deploymentParams.deploymentType == DeploymentType.MockGmxMockPricing) {
      await deployMockExternalContract(deploymentParams, `${baseTicker}_PriceFeed`, 'MockAggregatorV2V3');
      await executeExternalFunction(deploymentParams, `${baseTicker}_PriceFeed`, 'setDecimals', [6]);
      await executeExternalFunction(deploymentParams, `${baseTicker}_PriceFeed`, 'setLatestAnswer', [
        BigNumber.from(10).pow(6).mul(toBN(baseMockRate)).div(UNIT),
        (await deploymentParams.deployer.provider.getBlock('latest')).timestamp,
      ]);
    }
    await executeExternalFunction(deploymentParams, 'GMX_Vault', 'setFeed', [
      getExternalContract(deploymentParams, baseTicker).address,
      getExternalContract(deploymentParams, `${baseTicker}_PriceFeed`, undefined, useRealFeed).address,
    ]);
  }

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setChainlinkFeed', [
    getExternalContract(deploymentParams, baseTicker).address,
    getExternalContract(deploymentParams, `${baseTicker}_PriceFeed`, undefined, useRealFeed).address, // TODO: use isReal flag here
  ]);
  await deployLyraContract(deploymentParams, 'OptionMarket', baseTicker);
  await deployLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker);

  await deployLyraContractWithLibraries(
    deploymentParams,
    'OptionGreekCache',
    baseTicker,
    {
      GWAV: getLyraContract(deploymentParams, 'GWAV').address,
      BlackScholes: getLyraContract(deploymentParams, 'BlackScholes').address,
    },
    [],
  );
  await deployLyraContract(
    deploymentParams,
    'OptionToken',
    baseTicker,
    `Lyra ${baseTicker} market Option Token`,
    `Ly-${baseTicker}-ot`,
  );

  await deployLyraContract(deploymentParams, 'LiquidityPool', baseTicker);
  await deployLyraContract(
    deploymentParams,
    'LiquidityToken',
    baseTicker,
    `Lyra ${baseTicker} market Liquidity Pool Token`,
    `Ly-${baseTicker}-pt`,
  );
  await deployLyraContract(deploymentParams, 'ShortCollateral', baseTicker);

  // await deployLyraContract(deploymentParams, 'GMXFuturesPoolHedger', baseTicker);

  await deployLyraContract(deploymentParams, 'KeeperHelper', baseTicker);

  await deployLyraContractWithLibraries(
    deploymentParams,
    'GWAVOracle',
    baseTicker,
    {
      BlackScholes: getLyraContract(deploymentParams, 'BlackScholes').address,
    },
    [],
  );

  await initGMXContracts(deploymentParams, params, ticker, id);
}
