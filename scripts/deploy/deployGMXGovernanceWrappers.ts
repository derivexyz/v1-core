import { DeploymentParams, isMockGmx, isRealGmx } from '../util';
import { ParamHandler } from '../util/parseFiles';
import { deployLyraContract, executeLyraFunction, getLyraContract } from '../util/transactions';
import { toBN } from '../util/web3utils';

function convertParams(params: any) {
  const res: any = {};
  for (const param in params) {
    const val = params[param];
    if (typeof val === 'string' && val.slice(0, 2) !== '0x') {
      res[param] = toBN(val);
    } else if (typeof val === 'object') {
      res[param] = convertParams(val);
    } else {
      res[param] = val;
    }
  }
  return res;
}

export async function deployGMXGovernanceWrapper(
  deploymentParams: DeploymentParams,
  params: ParamHandler,
): Promise<void> {
  if (!isMockGmx(deploymentParams.deploymentType) && !isRealGmx(deploymentParams.deploymentType)) {
    throw Error('Invalid deployment type');
  }
  //
  // await deployLyraContract(deploymentParams, 'GovernanceWrapperViewerGMX');
  // await deployLyraContract(deploymentParams, 'GMXAdapterGovernanceWrapper');

  const tickers = Object.keys(params.get('Markets'));
  for (let i = 1; i < tickers.length; i++) {
    const ticker = tickers[i];
    await addGMXMarketGovernanceWrappers(deploymentParams, params, ticker);
  }
}

export async function addGMXMarketGovernanceWrappers(
  deploymentParams: DeploymentParams,
  params: ParamHandler,
  ticker: string,
) {
  const market = params.get('Markets', ticker);
  if (!market) {
    throw new Error(`No parameters for market ${ticker}`);
  }

  await deployLyraContract(deploymentParams, 'LiquidityPoolGovernanceWrapper', ticker);
  await deployLyraContract(deploymentParams, 'OptionGreekCacheGovernanceWrapper', ticker);
  await deployLyraContract(deploymentParams, 'OptionMarketGovernanceWrapper', ticker);
  await deployLyraContract(deploymentParams, 'OptionMarketPricerGovernanceWrapper', ticker);
  await deployLyraContract(deploymentParams, 'OptionTokenGovernanceWrapper', ticker);
  await deployLyraContract(deploymentParams, 'GMXHedgerGovernanceWrapper', ticker);

  await initGovernanceWrappers(deploymentParams, params, ticker);
}

export async function initGovernanceWrappers(
  deploymentParams: DeploymentParams,
  systemParams: ParamHandler,
  baseTicker: string,
) {
  await executeLyraFunction(
    deploymentParams,
    'LiquidityPoolGovernanceWrapper',
    'setLiquidityPoolBounds',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'LiquidityPoolBounds'))],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCacheGovernanceWrapper',
    'setGreekCacheBounds',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'GreekCacheBounds'))],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionMarketGovernanceWrapper',
    'setOptionMarketBounds',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'OptionMarketBounds'))],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricerGovernanceWrapper',
    'setOptionMarketPricerBounds',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'OptionMarketPricerBounds'))],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionTokenGovernanceWrapper',
    'setOptionTokenBounds',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'OptionTokenBounds'))],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'GMXHedgerGovernanceWrapper',
    'setHedgerBounds',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'GMXHedgerBounds'))],
    baseTicker,
  );
  await executeLyraFunction(deploymentParams, 'GMXAdapterGovernanceWrapper', 'setGMXAdapterBounds', [
    getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    convertParams(systemParams.getObj('Markets', baseTicker, 'GovWrapperBounds', 'GMXAdapterBounds')),
  ]);

  await executeLyraFunction(deploymentParams, 'GovernanceWrapperViewerGMX', 'addGMXGovernanceWrappers', [
    getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    {
      gmxAdapterGovernanceWrapper: getLyraContract(deploymentParams, 'GMXAdapterGovernanceWrapper').address,
      gmxHedgerGovernanceWrapper: getLyraContract(deploymentParams, 'GMXHedgerGovernanceWrapper', baseTicker).address,
      liquidityPoolGovernanceWrapper: getLyraContract(deploymentParams, 'LiquidityPoolGovernanceWrapper', baseTicker)
        .address,
      optionGreekCacheGovernanceWrapper: getLyraContract(
        deploymentParams,
        'OptionGreekCacheGovernanceWrapper',
        baseTicker,
      ).address,
      optionMarketGovernanceWrapper: getLyraContract(deploymentParams, 'OptionMarketGovernanceWrapper', baseTicker)
        .address,
      optionMarketPricerGovernanceWrapper: getLyraContract(
        deploymentParams,
        'OptionMarketPricerGovernanceWrapper',
        baseTicker,
      ).address,
      optionTokenGovernanceWrapper: getLyraContract(deploymentParams, 'OptionTokenGovernanceWrapper', baseTicker)
        .address,
    },
  ]);
}

export async function ownershipTransferWrappers(deploymentParams: DeploymentParams, params: ParamHandler) {
  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'nominateNewOwner', [
    getLyraContract(deploymentParams, 'GMXAdapterGovernanceWrapper').address,
  ]);
  await executeLyraFunction(deploymentParams, 'GMXAdapterGovernanceWrapper', 'setGMXAdapter', [
    getLyraContract(deploymentParams, 'ExchangeAdapter').address,
  ]);

  const tickers = Object.keys(params.get('Markets'));
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];

    // Nominate owner of contracts to be wrapper
    await executeLyraFunction(
      deploymentParams,
      'LiquidityPool',
      'nominateNewOwner',
      [getLyraContract(deploymentParams, 'LiquidityPoolGovernanceWrapper', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionGreekCache',
      'nominateNewOwner',
      [getLyraContract(deploymentParams, 'OptionGreekCacheGovernanceWrapper', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionMarket',
      'nominateNewOwner',
      [getLyraContract(deploymentParams, 'OptionMarketGovernanceWrapper', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionMarketPricer',
      'nominateNewOwner',
      [getLyraContract(deploymentParams, 'OptionMarketPricerGovernanceWrapper', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionToken',
      'nominateNewOwner',
      [getLyraContract(deploymentParams, 'OptionTokenGovernanceWrapper', ticker).address],
      ticker,
    );

    await executeLyraFunction(
      deploymentParams,
      'LiquidityPoolGovernanceWrapper',
      'setLiquidityPool',
      [getLyraContract(deploymentParams, 'LiquidityPool', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionGreekCacheGovernanceWrapper',
      'setOptionGreekCache',
      [getLyraContract(deploymentParams, 'OptionGreekCache', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionMarketGovernanceWrapper',
      'setOptionMarket',
      [getLyraContract(deploymentParams, 'OptionMarket', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionMarketPricerGovernanceWrapper',
      'setOptionMarketPricer',
      [getLyraContract(deploymentParams, 'OptionMarketPricer', ticker).address],
      ticker,
    );
    await executeLyraFunction(
      deploymentParams,
      'OptionTokenGovernanceWrapper',
      'setOptionToken',
      [getLyraContract(deploymentParams, 'OptionToken', ticker).address],
      ticker,
    );
  }
}
