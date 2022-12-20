import { DEFAULT_SECURITY_MODULE } from '../../test/utils/defaultParams';
import { DeploymentParams, DeploymentType, isMockSnx } from '../util';
import { ParamHandler } from '../util/parseFiles';
import {
  callLyraFunction,
  executeExternalFunction,
  executeLyraFunction,
  getExternalContract,
  getLyraContract,
} from '../util/transactions';
import { fromBN, toBN, toBytes32, UNIT } from '../util/web3utils';

enum PriceType {
  MIN_PRICE,
  MAX_PRICE,
  REFERENCE,
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

export async function initSNXContracts(
  deploymentParams: DeploymentParams,
  systemParams: ParamHandler,
  baseTicker: string,
  id: number,
) {
  if (isMockSnx(deploymentParams.deploymentType)) {
    if (deploymentParams.deploymentType == DeploymentType.MockSnxMockPricing) {
      // Set global contract parameters
      if (!systemParams.get('Markets', baseTicker, 'MockPrice')) {
        throw new Error(`No MockPrice provided for market ${baseTicker}`);
      }
      await executeExternalFunction(deploymentParams, 'Exchanger', 'setFeeRateForExchange', [
        toBytes32(baseTicker),
        toBytes32(systemParams.get('QuoteTicker')),
        toBN('0.0075'),
      ]);
      await executeExternalFunction(deploymentParams, 'Exchanger', 'setFeeRateForExchange', [
        toBytes32(systemParams.get('QuoteTicker')),
        toBytes32(baseTicker),
        toBN('0.005'),
      ]);
      await executeExternalFunction(deploymentParams, 'ExchangeRates', 'setRateAndInvalid', [
        toBytes32(baseTicker),
        toBN(systemParams.get('Markets', baseTicker, 'MockPrice')),
        false,
      ]);
      console.log(`Set price for ${baseTicker} to ${systemParams.get('Markets', baseTicker, 'MockPrice')}`);
    }

    await executeExternalFunction(deploymentParams, 'ProxySynthetix', 'addBaseAsset', [
      toBytes32(baseTicker),
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    ]);
    await executeExternalFunction(deploymentParams, 'CollateralShort', 'addBaseAsset', [
      toBytes32(baseTicker),
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    ]);
    await executeExternalFunction(deploymentParams, 'Proxy' + baseTicker, 'permitMint', [
      getExternalContract(deploymentParams, 'ProxySynthetix').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, 'Proxy' + baseTicker, 'permitMint', [
      getExternalContract(deploymentParams, 'CollateralShort').address,
      true,
    ]);
    await executeExternalFunction(deploymentParams, 'Proxy' + baseTicker, 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);
  }

  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'init',
    [
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
      getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
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
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
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
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortPoolHedger', baseTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
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
  //
  // await executeLyraFunction(
  //   deploymentParams,
  //   'BasicLiquidityCounter',
  //   'setLiquidityToken',
  //   [(getLyraContract(deploymentParams, 'LiquidityToken', baseTicker)).address],
  //   baseTicker,
  // );
  //
  // await executeLyraFunction(
  //   deploymentParams,
  //   'LiquidityToken',
  //   'setLiquidityTracker',
  //   [(getLyraContract(deploymentParams, 'BasicLiquidityCounter', baseTicker)).address],
  //   baseTicker,
  // );
  await executeLyraFunction(
    deploymentParams,
    'ShortPoolHedger',
    'init',
    [
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'ShortCollateral',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      getExternalContract(deploymentParams, 'SynthetixAdapter').address,
      getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
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
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
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
      getLyraContract(deploymentParams, 'SynthetixAdapter').address,
    ],
    baseTicker,
  );

  // Parameter setting

  await executeLyraFunction(deploymentParams, 'SynthetixAdapter', 'setGlobalsForContract', [
    getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    toBytes32(systemParams.get('QuoteTicker')),
    toBytes32(baseTicker),
    DEFAULT_SECURITY_MODULE, // TODO: parameters
    toBytes32('LYRA'),
  ]);

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'setLiquidityPoolParameters',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'LiquidityPoolParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'LiquidityPoolParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'setCircuitBreakerParameters',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'CircuitBreakerParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'CircuitBreakerParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setGreekCacheParameters',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'GreekCacheParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'GreekCacheParams'),
      }),
    ],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setMinCollateralParameters',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'MinCollateralParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'MinCollateralParams'),
      }),
    ],
    baseTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setForceCloseParameters',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'ForceCloseParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'ForceCloseParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setPricingParams',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'PricingParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'PricingParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setTradeLimitParams',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'TradeLimitParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'TradeLimitParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setVarianceFeeParams',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'VarianceFeeParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'VarianceFeeParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionToken',
    'setPartialCollateralParams',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'PartialCollatParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'PartialCollatParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'ShortPoolHedger',
    'setPoolHedgerParams',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'PoolHedgerParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'PoolHedgerParams'),
      }),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'ShortPoolHedger',
    'setShortBuffer',
    [
      toBN(
        systemParams.get('Markets', baseTicker, 'ParameterOverrides', 'PoolHedgerParams', 'shortBuffer') ||
          systemParams.get('Parameters', 'PoolHedgerParams', 'shortBuffer'),
      ),
    ],
    baseTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'setOptionMarketParams',
    [
      convertParams({
        ...systemParams.getObj('Parameters', 'OptionMarketParams'),
        ...systemParams.getObj('Markets', baseTicker, 'ParameterOverrides', 'OptionMarketParams'),
      }),
    ],
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
      poolHedger: getLyraContract(deploymentParams, 'ShortPoolHedger', baseTicker).address,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      baseAsset: getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
      quoteAsset: getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
    },
  ]);

  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addMarket', [
    getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
    id,
    {
      quoteAsset: getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
      baseAsset: getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
      optionToken: getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
    },
  ]);

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'addMarket', [
    {
      liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', baseTicker).address,
      liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', baseTicker).address,
      greekCache: getLyraContract(deploymentParams, 'OptionGreekCache', baseTicker).address,
      optionMarket: getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      optionMarketPricer: getLyraContract(deploymentParams, 'OptionMarketPricer', baseTicker).address,
      optionToken: getLyraContract(deploymentParams, 'OptionToken', baseTicker).address,
      poolHedger: getLyraContract(deploymentParams, 'ShortPoolHedger', baseTicker).address,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', baseTicker).address,
      gwavOracle: getLyraContract(deploymentParams, 'GWAVOracle', baseTicker).address,
      baseAsset: getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
      quoteAsset: getExternalContract(deploymentParams, 'ProxyERC20' + systemParams.get('QuoteTicker')).address,
    },
  ]);

  if (isMockSnx(deploymentParams.deploymentType)) {
    const price = await callLyraFunction(deploymentParams, 'SynthetixAdapter', 'getSpotPriceForMarket', [
      getLyraContract(deploymentParams, 'OptionMarket', baseTicker).address,
      PriceType.REFERENCE,
    ]);
    const faucetAmount = toBN('10000').mul(UNIT).div(price);
    console.log('Setting faucet amount:', fromBN(faucetAmount));
    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
      getExternalContract(deploymentParams, 'Proxy' + baseTicker).address,
      faucetAmount,
    ]);
  }
}
