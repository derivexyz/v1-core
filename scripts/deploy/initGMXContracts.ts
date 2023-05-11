import { DEFAULT_SECURITY_MODULE } from '../../test/utils/defaultParams';
import { DeploymentParams, isMockGmx, isRealGmx } from '../util';
import { ParamHandler } from '../util/parseFiles';
import {
  callLyraFunction,
  executeExternalFunction,
  executeLyraFunction,
  getExternalContract,
  getLyraContract,
} from '../util/transactions';
import { fromBN, toBN, UNIT, ZERO_ADDRESS } from '../util/web3utils';

enum PriceType {
  MIN_PRICE,
  MAX_PRICE,
  REFERENCE,
  FORCE_MIN,
  FORCE_MAX,
}

function convertParams(params: any) {
  const res: any = {};
  for (const param in params) {
    const val = params[param];
    if (typeof val === 'string' && val.slice(0, 2) !== '0x') {
      res[param] = toBN(val);
    } else {
      res[param] = val;
    }
  }
  return res;
}

export async function initGMXContracts(
  deploymentParams: DeploymentParams,
  systemParams: ParamHandler,
  baseTicker: string,
  _: number,
) {
  if (!isMockGmx(deploymentParams.deploymentType) && !isRealGmx(deploymentParams.deploymentType)) {
    throw Error('Invalid deploy type');
  }

  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'init',
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, baseTicker).address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'init',
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker).address,
    ],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'init',
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      ZERO_ADDRESS,
      // getLyraContract(deploymentParams, 'GMXFuturesPoolHedger', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, baseTicker).address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'LiquidityToken',
    'init',
    [getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address],
    baseTicker,
  );

  // let weth;
  // try {
  //   weth = getExternalContract(deploymentParams, 'wETH');
  // } catch (e) {
  //   if (['mainnet', 'goerli'].includes(deploymentParams.network.split('-')[0])) {
  //     throw Error('Missing required wETH address');
  //   }
  // }
  //
  // await executeLyraFunction(
  //   deploymentParams,
  //   'GMXFuturesPoolHedger',
  //   'init',
  //   [
  //     getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
  //     getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
  //     getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
  //     getLyraContract(deploymentParams, 'ExchangeAdapter').address,
  //     getExternalContract(deploymentParams, 'GMX_PositionRouter').address,
  //     getExternalContract(deploymentParams, 'GMX_Router').address,
  //     getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
  //     getExternalContract(deploymentParams, baseTicker).address,
  //     weth?.address || ZERO_ADDRESS,
  //   ],
  //   baseTicker,
  // );

  await executeLyraFunction(
    deploymentParams,
    'ShortCollateral',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, baseTicker).address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionToken',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'KeeperHelper',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'GWAVOracle',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
    ],
    baseTicker,
  );

  // Parameter setting

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'setLiquidityPoolParameters',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'LiquidityPoolParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'setCircuitBreakerParameters',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'CircuitBreakerParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setGreekCacheParameters',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'GreekCacheParams'))],
    baseTicker,
  );

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setRiskFreeRate', [
    getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'GreekCacheParams')).rateAndCarry,
  ]);

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setMarketPricingParams', [
    getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'MarketPricingParams')),
  ]);

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setMinCollateralParameters',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'MinCollateralParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setForceCloseParameters',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'ForceCloseParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setPricingParams',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'PricingParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setTradeLimitParams',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'TradeLimitParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setVarianceFeeParams',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'VarianceFeeParams'))],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionToken',
    'setPartialCollateralParams',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'PartialCollatParams'))],
    baseTicker,
  );
  //
  // await executeLyraFunction(
  //   deploymentParams,
  //   'GMXFuturesPoolHedger',
  //   'setPoolHedgerParams',
  //   [
  //     convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'PoolHedgerParams')),
  //   ],
  //   baseTicker,
  // );
  //
  // await executeLyraFunction(
  //   deploymentParams,
  //   'GMXFuturesPoolHedger',
  //   'setFuturesPoolHedgerParams',
  //   [
  //     convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'FuturesPoolHedgerParams')),
  //   ],
  //   baseTicker,
  // );
    
  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'setOptionMarketParams',
    [convertParams(systemParams.getObj('Markets', baseTicker, 'Parameters', 'OptionMarketParams'))],
    baseTicker,
  );

  await executeLyraFunction(deploymentParams, 'OptionMarketViewer', 'addMarket', [
    {
      liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
      greekCache: getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      optionMarket: getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      optionMarketPricer: getLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker).address,
      optionToken: getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      // poolHedger: getLyraContract(deploymentParams, 'GMXFuturesPoolHedger', baseTicker).address,
      poolHedger: ZERO_ADDRESS,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      baseAsset: getExternalContract(deploymentParams, baseTicker).address,
      quoteAsset: getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
    },
  ]);
  //
  // await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addMarket', [
  //   getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
  //   id,
  //   {
  //     quoteAsset: getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
  //     baseAsset: getExternalContract(deploymentParams, baseTicker).address,
  //     optionToken: getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
  //     liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
  //     liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
  //   },
  // ]);

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'addMarket', [
    {
      liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
      greekCache: getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      optionMarket: getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      optionMarketPricer: getLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker).address,
      optionToken: getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      poolHedger: ZERO_ADDRESS,
      // poolHedger: getLyraContract(deploymentParams, 'GMXFuturesPoolHedger', baseTicker).address,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      gwavOracle: getLyraContract(deploymentParams, 'GWAVOracle', baseTicker).address,
      baseAsset: getExternalContract(deploymentParams, baseTicker).address,
      quoteAsset: getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
    },
  ]);

  if (isMockGmx(deploymentParams.deploymentType)) {
    const price = await callLyraFunction(deploymentParams, 'ExchangeAdapter', 'getSpotPriceForMarket', [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      PriceType.REFERENCE,
    ]);
    const faucetAmount = toBN('10000').mul(UNIT).div(price);
    console.log('Setting faucet amount:', fromBN(faucetAmount));
    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
      getExternalContract(deploymentParams, baseTicker).address,
      faucetAmount,
    ]);
    await executeExternalFunction(deploymentParams, baseTicker, 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);
  }
}
