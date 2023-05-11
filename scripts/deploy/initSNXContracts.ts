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
import { fromBN, HOUR_SEC, toBN, toBytes32, UNIT, ZERO_ADDRESS } from '../util/web3utils';

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
  marketTicker: string,
  _id: number,
) {
  const baseAsset = systemParams.get('Markets', marketTicker, 'BaseAsset');
  if (isMockSnx(deploymentParams.deploymentType)) {
    if (deploymentParams.deploymentType == DeploymentType.MockSnxMockPricing) {
      // Set global contract parameters
      if (!systemParams.get('Markets', marketTicker, 'MockPrice')) {
        throw new Error(`No MockPrice provided for market ${marketTicker}`);
      }

      console.log(`Set price for ${marketTicker} to ${systemParams.get('Markets', marketTicker, 'MockPrice')}`);
    }

    await executeExternalFunction(deploymentParams, baseAsset, 'permitMint', [
      getLyraContract(deploymentParams, 'TestFaucet').address,
      true,
    ]);
  }

  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'init',
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'LiquidityPool', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionMarketPricer', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionToken', marketTicker).address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, baseAsset).address,
    ],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
    ],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'init',
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionMarketPricer', marketTicker).address,
    ],
    marketTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'init',
    [
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'LiquidityToken', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', marketTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', marketTicker).address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, baseAsset).address,
    ],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'LiquidityToken',
    'init',
    [getLyraContract(deploymentParams, 'LiquidityPool', marketTicker).address],
    marketTicker,
  );
  
  await executeLyraFunction(
    deploymentParams,
    'SNXPerpsV2PoolHedger',
    'init',
    [
      getExternalContract(deploymentParams, 'AddressResolver').address,
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      getLyraContract(deploymentParams, 'LiquidityPool', marketTicker).address,
      getExternalContract(deploymentParams, `PerpsV2Proxy${marketTicker}PERP`).address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, 'ProxyERC20sUSD').address,
      getExternalContract(deploymentParams, 'CurveRegistry').address,
      toBytes32(`s${marketTicker}PERP`),
    ],
    marketTicker,
  );
  
  

  await executeLyraFunction(
    deploymentParams,
    'ShortCollateral',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'LiquidityPool', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionToken', marketTicker).address,
      getExternalContract(deploymentParams, 'ExchangeAdapter').address,
      getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
      getExternalContract(deploymentParams, baseAsset).address,
    ],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionToken',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', marketTicker).address,
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
    ],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'KeeperHelper',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'ShortCollateral', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
    ],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'GWAVOracle',
    'init',
    [
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      getLyraContract(deploymentParams, 'ExchangeAdapter').address,
    ],
    marketTicker,
  );

  // Parameter setting

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setMarketAdapterConfiguration', [
    // address _optionMarket,
    getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
    // uint _staticEstimationDiscount,
    toBN('0.05'),
    // address _snxPerpV2MarketAddress,
    getExternalContract(deploymentParams, `PerpsV2Proxy${marketTicker}PERP`).address,
    // address _uniswapPool,
    ZERO_ADDRESS,
    // uint24 _uniswapFeeTier,
    3000, // must be > 0
  ]);

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'setLiquidityPoolParameters',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'LiquidityPoolParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'setCircuitBreakerParameters',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'CircuitBreakerParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setGreekCacheParameters',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'GreekCacheParams'))],
    marketTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setMinCollateralParameters',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'MinCollateralParams'))],
    marketTicker,
  );
  await executeLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'setForceCloseParameters',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'ForceCloseParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setPricingParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'PricingParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setTradeLimitParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'TradeLimitParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarketPricer',
    'setVarianceFeeParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'VarianceFeeParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionToken',
    'setPartialCollateralParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'PartialCollatParams'))],
    marketTicker,
  );
  
  await executeLyraFunction(
    deploymentParams,
    'SNXPerpsV2PoolHedger',
    'setPoolHedgerParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'PoolHedgerParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'SNXPerpsV2PoolHedger',
    'setFuturesPoolHedgerParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'FuturesPoolHedgerParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'setOptionMarketParams',
    [convertParams(systemParams.getObj('Markets', marketTicker, 'Parameters', 'OptionMarketParams'))],
    marketTicker,
  );

  await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'setBaseLimit',
    [toBN('1000000000000')],
    marketTicker
  )

  // await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setUniswapRouter', [
  //   getExternalContract(deploymentParams, 'UniSwapRouter').address,
  // ]);

  await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'setUniSwapDeviation', [toBN('0.97')]);

  await executeLyraFunction(deploymentParams, 'OptionMarketViewer', 'addMarket', [
    {
      liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', marketTicker).address,
      liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', marketTicker).address,
      greekCache: getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      optionMarket: getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      optionMarketPricer: getLyraContract(deploymentParams, 'OptionMarketPricer', marketTicker).address,
      optionToken: getLyraContract(deploymentParams, 'OptionToken', marketTicker).address,
      poolHedger: getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', marketTicker).address,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', marketTicker).address,
      baseAsset: getExternalContract(deploymentParams, baseAsset).address,
      quoteAsset: getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
    },
  ]);

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'addMarket', [
    {
      liquidityPool: getLyraContract(deploymentParams, 'LiquidityPool', marketTicker).address,
      liquidityToken: getLyraContract(deploymentParams, 'LiquidityToken', marketTicker).address,
      greekCache: getLyraContract(deploymentParams, 'OptionGreekCache', marketTicker).address,
      optionMarket: getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      optionMarketPricer: getLyraContract(deploymentParams, 'OptionMarketPricer', marketTicker).address,
      optionToken: getLyraContract(deploymentParams, 'OptionToken', marketTicker).address,
      poolHedger: getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', marketTicker).address,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', marketTicker).address,
      gwavOracle: getLyraContract(deploymentParams, 'GWAVOracle', marketTicker).address,
      baseAsset: getExternalContract(deploymentParams, baseAsset).address,
      quoteAsset: getExternalContract(deploymentParams, systemParams.get('QuoteAsset')).address,
    },
  ]);

  if (isMockSnx(deploymentParams.deploymentType)) {
    const price = await callLyraFunction(deploymentParams, 'ExchangeAdapter', 'getSpotPriceForMarket', [
      getLyraContract(deploymentParams, 'OptionMarket', marketTicker).address,
      PriceType.REFERENCE,
    ]);
    const faucetAmount = toBN('10000').mul(UNIT).div(price);
    console.log('Setting faucet amount:', fromBN(faucetAmount));
    await executeLyraFunction(deploymentParams, 'TestFaucet', 'setDripAmount', [
      getExternalContract(deploymentParams, baseAsset).address,
      faucetAmount,
    ]);
  }
}
