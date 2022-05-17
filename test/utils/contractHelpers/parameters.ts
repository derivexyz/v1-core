import { LiquidityPoolParametersStruct } from '../../../typechain-types/LiquidityPool';
import {
  ForceCloseParametersStruct,
  GreekCacheParametersStruct,
  MinCollateralParametersStruct,
} from '../../../typechain-types/OptionGreekCache';
import { OptionMarketParametersStruct } from '../../../typechain-types/OptionMarket';
import {
  PricingParametersStruct,
  TradeLimitParametersStruct,
  VarianceFeeParametersStruct,
} from '../../../typechain-types/OptionMarketPricer';
import { PartialCollateralParametersStruct } from '../../../typechain-types/OptionToken';
import { PoolHedgerParametersStruct } from '../../../typechain-types/PoolHedger';
import * as defaultParams from '../defaultParams';
import { hre } from '../testSetup';

export async function resetLiquidityPoolParameters(overrides?: Partial<LiquidityPoolParametersStruct>) {
  await hre.f.c.liquidityPool.setLiquidityPoolParameters({
    ...defaultParams.DEFAULT_LIQUIDITY_POOL_PARAMS,
    ...overrides,
  });
}

export async function resetPoolHedgerParams(overrides?: Partial<PoolHedgerParametersStruct>) {
  await hre.f.c.poolHedger.setPoolHedgerParams({
    ...defaultParams.DEFAULT_POOL_HEDGER_PARAMS,
    ...overrides,
  });
}

export async function resetGreekCacheParameters(overrides?: Partial<GreekCacheParametersStruct>) {
  await hre.f.c.optionGreekCache.setGreekCacheParameters({
    ...defaultParams.DEFAULT_GREEK_CACHE_PARAMS,
    ...overrides,
  });
}

export async function resetMinCollateralParameters(overrides?: Partial<MinCollateralParametersStruct>) {
  await hre.f.c.optionGreekCache.setMinCollateralParameters({
    ...defaultParams.DEFAULT_MIN_COLLATERAL_PARAMS,
    ...overrides,
  });
}

export async function resetForceCloseParameters(overrides?: Partial<ForceCloseParametersStruct>) {
  await hre.f.c.optionGreekCache.setForceCloseParameters({
    ...defaultParams.DEFAULT_FORCE_CLOSE_PARAMS,
    ...overrides,
  });
}

export async function resetPricingParams(overrides?: Partial<PricingParametersStruct>) {
  await hre.f.c.optionMarketPricer.setPricingParams({
    ...defaultParams.DEFAULT_PRICING_PARAMS,
    ...overrides,
  });
}

export async function resetTradeLimitParams(overrides?: Partial<TradeLimitParametersStruct>) {
  await hre.f.c.optionMarketPricer.setTradeLimitParams({
    ...defaultParams.DEFAULT_TRADE_LIMIT_PARAMS,
    ...overrides,
  });
}

export async function resetVarianceFeeParams(overrides?: Partial<VarianceFeeParametersStruct>) {
  await hre.f.c.optionMarketPricer.setVarianceFeeParams({
    ...defaultParams.DEFAULT_VARIANCE_FEE_PARAMS,
    ...overrides,
  });
}

export async function resetPartialCollateralParams(overrides?: Partial<PartialCollateralParametersStruct>) {
  await hre.f.c.optionToken.setPartialCollateralParams({
    ...defaultParams.DEFAULT_PARTIAL_COLLAT_PARAMS,
    ...overrides,
  });
}

export async function resetOptionMarketParams(overrides?: Partial<OptionMarketParametersStruct>) {
  await hre.f.c.optionMarket.setOptionMarketParams({
    ...defaultParams.DEFAULT_OPTION_MARKET_PARAMS,
    ...overrides,
  });
}
