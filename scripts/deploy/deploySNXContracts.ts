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
  if (!isMockSnx(deploymentParams.deploymentType) && !isRealSnx(deploymentParams.deploymentType)) {
    throw Error('Invalid deployment type');
  }

  await clearLyraContracts(deploymentParams);

  const quoteName = 'ProxyERC20' + params.get('QuoteTicker');
  if (deploymentParams.deploymentType == DeploymentType.MockSnxMockPricing) {
    await deployMockExternalContract(deploymentParams, 'Exchanger', 'TestExchanger');
    await deployMockExternalContract(deploymentParams, 'ExchangeRates', 'TestExchangeRates');
  }

  let USDC;
  let DAI;
  if (isRealSnx(deploymentParams.deploymentType)) {
    // TODO: move these to external.json
    USDC = { address: '0x7f5c764cbc14f9669b88837ca1490cca17c31607' };
    DAI = { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1' };
  } else {
    USDC = await deployMockExternalContract(deploymentParams, 'USDC', 'TestERC20SetDecimals', 'USDC', 'USDC', 6);
    DAI = await deployMockExternalContract(deploymentParams, 'DAI', 'TestERC20Fail', 'DAI', 'DAI');

    await deployMockExternalContract(deploymentParams, 'ProxySynthetix', 'TestSynthetix');

    await deployMockExternalContract(deploymentParams, 'CollateralShort', 'TestCollateralShort');

    await deployMockExternalContract(
      deploymentParams,
      `ProxyERC20${params.get('QuoteTicker')}`,
      'TestERC20',
      'Synthetic  USD',
      'sUSD',
    );

    await deployMockExternalContract(deploymentParams, 'DelegateApprovals', 'TestDelegateApprovals');

    await deployMockExternalContract(deploymentParams, 'FuturesMarket', 'TestFuturesMarket');
    await deployMockExternalContract(deploymentParams, 'AddressResolver', 'TestAddressResolver');
    await executeExternalFunction(deploymentParams, 'AddressResolver', 'setAddresses', [
      [
        toBytes32('ProxySynthetix'),
        toBytes32('Exchanger'),
        toBytes32('ExchangeRates'),
        toBytes32('CollateralShort'),
        toBytes32('DelegateApprovals'),
        toBytes32('FuturesMarket'),
      ],
      [
        getExternalContract(deploymentParams, 'ProxySynthetix').address,
        getExternalContract(deploymentParams, 'Exchanger').address,
        getExternalContract(deploymentParams, 'ExchangeRates').address,
        getExternalContract(deploymentParams, 'CollateralShort').address,
        getExternalContract(deploymentParams, 'DelegateApprovals').address,
        getExternalContract(deploymentParams, 'FuturesMarket').address,
      ],
    ]);

    await deployLyraContract(deploymentParams, 'TestFaucet');

    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
      getExternalContract(deploymentParams, quoteName).address,
      toBN('10000'),
    ]);
    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [DAI.address, toBN('10000')]);
    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [USDC.address, 10_000_000_000]); // 10,000 USDC
    await executeExternalFunction(deploymentParams, 'USDC', 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, 'DAI', 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);
  }

  await deployProxyWithLibraries(deploymentParams, 'SynthetixAdapter', 'SynthetixAdapter', undefined, undefined, []);
  await deployLyraContract(deploymentParams, 'OptionMarketViewer');
  await deployLyraContract(deploymentParams, 'OptionMarketWrapper');
  await deployLyraContract(deploymentParams, 'LyraRegistry');
  await deployLyraContract(deploymentParams, 'GWAV');
  await deployLyraContract(deploymentParams, 'BlackScholes');

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'updateGlobalAddresses', [
    [
      toBytes32('SYNTHETIX_ADAPTER'),
      toBytes32('MARKET_VIEWER'),
      toBytes32('MARKET_WRAPPER'),
      toBytes32('GWAV'),
      toBytes32('BLACK_SCHOLES'),
    ],
    [
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarketViewer').address,
      getLyraContract(deploymentParams, 'OptionMarketWrapper').address,
      getLyraContract(deploymentParams, 'GWAV').address,
      getLyraContract(deploymentParams, 'BlackScholes').address,
    ],
  ]);

  await executeLyraFunction(deploymentParams, 'SynthetixAdapter', 'setAddressResolver', [
    getExternalContract(deploymentParams, 'AddressResolver').address,
  ]);
  await executeLyraFunction(deploymentParams, 'SynthetixAdapter', 'updateSynthetixAddresses', []);

  await executeLyraFunction(deploymentParams, 'OptionMarketViewer', 'init', [
    getLyraContract(deploymentParams, 'SynthetixAdapter').address,
  ]);
  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'updateContractParams', [
    getExternalContract(deploymentParams, 'CurvePool').address,
    ZERO_ADDRESS,
    toBN('0.1'),
  ]);

  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addCurveStable', [
    getExternalContract(deploymentParams, quoteName).address,
    0,
  ]);
  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addCurveStable', [
    getExternalContract(deploymentParams, 'DAI').address,
    1,
  ]);
  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addCurveStable', [
    getExternalContract(deploymentParams, 'USDC').address,
    2,
  ]);

  if (isMockSnx(deploymentParams.deploymentType)) {
    await executeExternalFunction(deploymentParams, 'ProxySynthetix', 'init', [
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
      getExternalContract(deploymentParams, quoteName).address,
      getExternalContract(deploymentParams, 'AddressResolver').address,
    ]);
    await executeExternalFunction(deploymentParams, 'CollateralShort', 'init', [
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
      getExternalContract(deploymentParams, quoteName).address,
    ]);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getExternalContract(deploymentParams, 'ProxySynthetix').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getExternalContract(deploymentParams, 'CollateralShort').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, quoteName, 'permitMint', [
      getExternalContract(deploymentParams, 'CurvePool').address,
      true,
    ]);
    // if (DAI) await execute(DAI, 'permitMint', [c.curvePool.address, true]);
    // if (USDC) await execute(USDC, 'permitMint', [c.curvePool.address, true]);

    await executeExternalFunction(deploymentParams, 'CurvePool', 'setRate', [
      getExternalContract(deploymentParams, 'DAI').address,
      toBN('0.999'),
    ]);
    await executeExternalFunction(deploymentParams, 'CurvePool', 'setRate', [
      getExternalContract(deploymentParams, 'USDC').address,
      999999,
    ]);
    await executeExternalFunction(deploymentParams, 'CurvePool', 'setRate', [
      getExternalContract(deploymentParams, quoteName).address,
      toBN('1.001'),
    ]);
  }

  const tickers = Object.keys(params.get('Markets'));
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
  const baseTicker = params.get('Markets', ticker, 'BaseTicker');
  if (!isMockSnx(deploymentParams.deploymentType)) {
    const baseAsset = getExternalContract(deploymentParams, `Proxy${baseTicker}`);
    if ((await baseAsset.currencyKey()) !== toBytes32(baseTicker)) {
      throw Error(`baseAsset.currencyKey() did not return ${baseTicker}`);
    }
  } else {
    await deployMockExternalContract(
      deploymentParams,
      `Proxy${baseTicker}`,
      'TestERC20',
      `Synth ${baseTicker}`,
      baseTicker,
    );
  }

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
    `Ly${baseTicker.slice(1)}ot`,
  );

  await deployLyraContract(deploymentParams, 'LiquidityPool', baseTicker);
  await deployLyraContract(
    deploymentParams,
    'LiquidityToken',
    baseTicker,
    `Lyra ${baseTicker.slice(1)} market Liquidity Pool Token`,
    `Ly${baseTicker.slice(1)}pt`,
  );
  await deployLyraContract(deploymentParams, 'ShortCollateral', baseTicker);

  // await deployLyraContract(deploymentParams, 'BasicLiquidityCounter', baseTicker);

  await deployLyraContract(deploymentParams, 'ShortPoolHedger', baseTicker);

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

  await initSNXContracts(deploymentParams, params, ticker, id);
}
