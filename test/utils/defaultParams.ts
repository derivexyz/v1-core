import { LiquidityPoolParametersStruct, CircuitBreakerParametersStruct } from '../../typechain-types/LiquidityPool';
import {
  DAY_SEC,
  DEFAULT_DECIMALS,
  HOUR_SEC,
  MAX_UINT,
  MONTH_SEC,
  toBN,
  UNIT,
  WEEK_SEC,
  YEAR_SEC,
  ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import {
  ForceCloseParametersStruct,
  GreekCacheParametersStruct,
  MinCollateralParametersStruct,
} from '../../typechain-types/OptionGreekCache';
import { OptionMarketParametersStruct } from '../../typechain-types/OptionMarket';
import {
  PricingParametersStruct,
  TradeLimitParametersStruct,
  VarianceFeeParametersStruct,
} from '../../typechain-types/OptionMarketPricer';
import { PartialCollateralParametersStruct } from '../../typechain-types/OptionToken';
import { PoolHedgerParametersStruct } from '../../typechain-types/PoolHedger';
import { FuturesPoolHedgerParametersStruct } from '../../typechain-types/GMXFuturesPoolHedger';
import { MarketPricingParamsStruct } from '../../typechain-types/GMXAdapter';
import { OptionMarketBoundsStruct } from '../../typechain-types/OptionMarketGovernanceWrapper';
import { LiquidityPoolBoundsStruct } from '../../typechain-types/LiquidityPoolGovernanceWrapper';
import { OptionMarketPricerBoundsStruct } from '../../typechain-types/OptionMarketPricerGovernanceWrapper';
import { OptionTokenBoundsStruct } from '../../typechain-types/OptionTokenGovernanceWrapper';
import { GMXAdapterBoundsStruct } from '../../typechain-types/GMXAdapterGovernanceWrapper';
import { GreekCacheBoundsStruct } from '../../typechain-types/OptionGreekCacheGovernanceWrapper';

export enum PricingType {
  MIN_PRICE,
  MAX_PRICE, // maximise the spot based on logic in adapter
  REFERENCE,
  FORCE_MIN,
  FORCE_MAX,
}

export const DEFAULT_SHORT_BUFFER = toBN('2');
export const DEFAULT_BASE_PRICE = toBN('1742.01337');
export const DEFAULT_FEE_RATE_FOR_BASE = toBN('0.0075');
export const DEFAULT_FEE_RATE_FOR_QUOTE = toBN('0.005');
export const DEFAULT_RATE_AND_CARRY = toBN('0.05');

export const DEFAULT_LIQUIDITY_POOL_PARAMS: LiquidityPoolParametersStruct = {
  minDepositWithdraw: toBN('1'),
  depositDelay: WEEK_SEC,
  withdrawalDelay: WEEK_SEC,
  withdrawalFee: toBN('0.01'),
  guardianMultisig: ZERO_ADDRESS,
  guardianDelay: WEEK_SEC * 2,
  adjustmentNetScalingFactor: toBN('0.9'),
  callCollatScalingFactor: toBN('1'),
  putCollatScalingFactor: toBN('1'),
};

export const DEFAULT_CB_PARAMS: CircuitBreakerParametersStruct = {
  liquidityCBThreshold: toBN('0.01'),
  liquidityCBTimeout: DAY_SEC * 3,
  ivVarianceCBThreshold: toBN('0.1'),
  skewVarianceCBThreshold: toBN('0.35'),
  ivVarianceCBTimeout: HOUR_SEC * 12,
  skewVarianceCBTimeout: HOUR_SEC * 12,
  boardSettlementCBTimeout: HOUR_SEC * 6,
  contractAdjustmentCBTimeout: HOUR_SEC * 12,
};

export const DEFAULT_GREEK_CACHE_PARAMS: GreekCacheParametersStruct = {
  maxStrikesPerBoard: 30,
  acceptableSpotPricePercentMove: toBN('0.05'),
  staleUpdateDuration: HOUR_SEC * 3,
  varianceIvGWAVPeriod: DAY_SEC,
  varianceSkewGWAVPeriod: DAY_SEC * 3,
  optionValueIvGWAVPeriod: DAY_SEC,
  optionValueSkewGWAVPeriod: DAY_SEC * 3,
  gwavSkewFloor: toBN('0.5'),
  gwavSkewCap: toBN('2'),
};

export const DEFAULT_MIN_COLLATERAL_PARAMS: MinCollateralParametersStruct = {
  minStaticBaseCollateral: toBN('0.2'),
  minStaticQuoteCollateral: toBN('200'),
  shockVolA: toBN('2.5'),
  shockVolPointA: WEEK_SEC * 2,
  shockVolB: toBN('1.8'),
  shockVolPointB: WEEK_SEC * 8,
  callSpotPriceShock: toBN('1.2'),
  putSpotPriceShock: toBN('0.8'),
};

export const DEFAULT_FUTURES_MAX_LEVERAGE_PARAMS = UNIT;

export const DEFAULT_FORCE_CLOSE_PARAMS: ForceCloseParametersStruct = {
  ivGWAVPeriod: HOUR_SEC * 12,
  skewGWAVPeriod: HOUR_SEC * 24,
  shortVolShock: toBN('1.2'),
  shortPostCutoffVolShock: toBN('1.4'),
  longVolShock: toBN('0.8'),
  longPostCutoffVolShock: toBN('0.5'),
  liquidateVolShock: toBN('1.3'),
  liquidatePostCutoffVolShock: toBN('1.6'),
  shortSpotMin: toBN('0.01'),
  liquidateSpotMin: toBN('0.02'),
};

export const DEFAULT_PRICING_PARAMS: PricingParametersStruct = {
  optionPriceFeeCoefficient: toBN('0.01'),
  optionPriceFee1xPoint: WEEK_SEC * 6,
  optionPriceFee2xPoint: WEEK_SEC * 16,
  spotPriceFeeCoefficient: toBN('0.01'),
  spotPriceFee1xPoint: WEEK_SEC * 6,
  spotPriceFee2xPoint: WEEK_SEC * 12,
  vegaFeeCoefficient: toBN('100'),
  standardSize: toBN('5'),
  skewAdjustmentFactor: toBN('0.75'),
};

export const DEFAULT_TRADE_LIMIT_PARAMS: TradeLimitParametersStruct = {
  maxBaseIV: toBN('2'),
  maxSkew: toBN('1.5'),
  minBaseIV: toBN('0.35'),
  minSkew: toBN('0.5'),
  minDelta: toBN('0.15'),
  minForceCloseDelta: toBN('0.25'),
  minVol: toBN('0.55'),
  maxVol: toBN('3'),
  tradingCutoff: DAY_SEC / 2,
  absMaxSkew: toBN('5'),
  absMinSkew: toBN('0.15'),
  capSkewsToAbs: false,
};

export const DEFAULT_VARIANCE_FEE_PARAMS: VarianceFeeParametersStruct = {
  defaultVarianceFeeCoefficient: toBN('0.25'),
  forceCloseVarianceFeeCoefficient: toBN('0.25'),
  skewAdjustmentCoefficient: toBN('3'),
  referenceSkew: toBN('1'),
  minimumStaticSkewAdjustment: toBN('1'),
  vegaCoefficient: toBN('0.01'),
  minimumStaticVega: toBN('0'),
  ivVarianceCoefficient: toBN('1.5'),
  minimumStaticIvVariance: toBN('1'),
};

export const DEFAULT_SECURITY_MODULE = '0xefeefeefeefeefeefeefeefeefeefeefeefeefee';

export const DEFAULT_OPTION_MARKET_PARAMS: OptionMarketParametersStruct = {
  securityModule: DEFAULT_SECURITY_MODULE,
  feePortionReserved: toBN('0.1'),
  maxBoardExpiry: MONTH_SEC * 12,
  staticBaseSettlementFee: DEFAULT_FEE_RATE_FOR_BASE,
};

export const DEFAULT_PARTIAL_COLLAT_PARAMS: PartialCollateralParametersStruct = {
  penaltyRatio: toBN('0.2'),
  liquidatorFeeRatio: toBN('0.4'),
  smFeeRatio: toBN('0.3'),
  minLiquidationFee: toBN('15'),
};

export const DEFAULT_POOL_HEDGER_PARAMS: PoolHedgerParametersStruct = {
  interactionDelay: 24 * HOUR_SEC,
  hedgeCap: MAX_UINT,
};

export const DEFAULT_GMX_POOL_HEDGER_PARAMS: FuturesPoolHedgerParametersStruct = {
  acceptableSpotSlippage: toBN('1.05'),
  deltaThreshold: toBN('100'),
  marketDepthBuffer: toBN('1'),
  vaultLiquidityCheckEnabled: true,
  targetLeverage: toBN('1.1'),
  maxLeverage: toBN('10'),
  minCollateralUpdate: toBN('5'),
  minCancelDelay: 1200, // 20 minutes
};

export const DEFAULT_GMX_ADAPTER_PARAMS: MarketPricingParamsStruct = {
  staticSwapFeeEstimate: toBN('1.02'),
  gmxUsageThreshold: toBN('0.004'),
  priceVarianceCBPercent: toBN('0.015'),
  // for testing just make it never stale unless we explicitly want to
  chainlinkStalenessCheck: YEAR_SEC,
};

export const DEFAULT_BOARD_PARAMS: BoardParameters = {
  expiresIn: MONTH_SEC,
  baseIV: '1',
  strikePrices: ['1500', '2000', '2500'],
  skews: ['0.9', '1', '1.1'],
};

export type BoardParameters = {
  expiresIn: number;
  baseIV: string;
  strikePrices: string[];
  skews: string[];
};

export const DEFAULT_GOV_GMX_ADAPTER_BOUNDS: GMXAdapterBoundsStruct = {
  minMarketPricingParams: {
    staticSwapFeeEstimate: toBN('1'),
    gmxUsageThreshold: toBN('0'),
    priceVarianceCBPercent: toBN('0'),
    chainlinkStalenessCheck: 60,
  },
  maxMarketPricingParams: {
    staticSwapFeeEstimate: toBN('1.2'),
    gmxUsageThreshold: toBN('0.01'),
    priceVarianceCBPercent: toBN('0.1'),
    chainlinkStalenessCheck: HOUR_SEC,
  },
  minRiskFreeRate: toBN('-0.1'),
  maxRiskFreeRate: toBN('0.2'),
};

export const DEFAULT_GOV_OPTION_MARKET_BOUNDS: OptionMarketBoundsStruct = {
  boardFreezingBlocked: true,
  boardForceSettlingBlocked: true,
  minBaseIv: toBN('0.1'),
  maxBaseIv: toBN('10'),
  minSkew: toBN('0.15'),
  maxSkew: toBN('5'),
  recoverFundsBlocked: true,
};

export const DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS = {
  minLiquidityPoolParams: {
    minDepositWithdraw: toBN('1'),
    depositDelay: 3 * DAY_SEC,
    withdrawalDelay: 3 * DAY_SEC,
    withdrawalFee: toBN('0.005'),
    guardianMultisig: ZERO_ADDRESS,
    guardianDelay: WEEK_SEC,
    adjustmentNetScalingFactor: toBN('0.45'),
    callCollatScalingFactor: toBN('0.5'),
    putCollatScalingFactor: toBN('0.5'),
  } as LiquidityPoolParametersStruct,
  maxLiquidityPoolParams: {
    minDepositWithdraw: toBN('2'),
    depositDelay: 2 * WEEK_SEC,
    withdrawalDelay: 2 * WEEK_SEC,
    withdrawalFee: toBN('0.1'),
    guardianMultisig: ZERO_ADDRESS,
    guardianDelay: WEEK_SEC * 2,
    adjustmentNetScalingFactor: toBN('1.8'),
    callCollatScalingFactor: toBN('2'),
    putCollatScalingFactor: toBN('2'),
  } as LiquidityPoolParametersStruct,
  minCircuitBreakerParams: {
    liquidityCBThreshold: toBN('0.005'),
    liquidityCBTimeout: DAY_SEC,
    ivVarianceCBThreshold: toBN('0.05'),
    skewVarianceCBThreshold: toBN('0.15'),
    ivVarianceCBTimeout: HOUR_SEC * 6,
    skewVarianceCBTimeout: HOUR_SEC * 6,
    boardSettlementCBTimeout: HOUR_SEC * 3,
    contractAdjustmentCBTimeout: HOUR_SEC * 6,
  } as CircuitBreakerParametersStruct,
  maxCircuitBreakerParams: {
    liquidityCBThreshold: toBN('0.02'),
    liquidityCBTimeout: DAY_SEC * 6,
    ivVarianceCBThreshold: toBN('0.2'),
    skewVarianceCBThreshold: toBN('0.7'),
    ivVarianceCBTimeout: DAY_SEC,
    skewVarianceCBTimeout: DAY_SEC,
    boardSettlementCBTimeout: HOUR_SEC * 12,
    contractAdjustmentCBTimeout: DAY_SEC,
  } as CircuitBreakerParametersStruct,
  recoverFundsBlocked: true,
  updateHedgerBlocked: true,
  defaultGuardianMultisig: ZERO_ADDRESS,
} as LiquidityPoolBoundsStruct;

export const DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS: OptionMarketPricerBoundsStruct = {
  minPricingParams: {
    optionPriceFeeCoefficient: toBN('0.005'),
    optionPriceFee1xPoint: WEEK_SEC * 3,
    optionPriceFee2xPoint: WEEK_SEC * 8,
    spotPriceFeeCoefficient: toBN('0.005'),
    spotPriceFee1xPoint: WEEK_SEC * 3,
    spotPriceFee2xPoint: WEEK_SEC * 6,
    vegaFeeCoefficient: toBN('50'),
    standardSize: toBN('2.5'),
    skewAdjustmentFactor: toBN('0.375'),
  } as PricingParametersStruct,
  maxPricingParams: {
    optionPriceFeeCoefficient: toBN('0.04'),
    optionPriceFee1xPoint: WEEK_SEC * 12,
    optionPriceFee2xPoint: WEEK_SEC * 32,
    spotPriceFeeCoefficient: toBN('0.02'),
    spotPriceFee1xPoint: WEEK_SEC * 12,
    spotPriceFee2xPoint: WEEK_SEC * 24,
    vegaFeeCoefficient: toBN('200'),
    standardSize: toBN('10'),
    skewAdjustmentFactor: toBN('0.9'),
  } as PricingParametersStruct,
  minTradeLimitParams: {
    maxBaseIV: toBN('1'),
    maxSkew: toBN('0.75'),
    minBaseIV: toBN('0.175'),
    minSkew: toBN('0.25'),
    minDelta: toBN('0.001'),
    minForceCloseDelta: toBN('0.125'),
    minVol: toBN('0.26'),
    maxVol: toBN('1.5'),
    tradingCutoff: DAY_SEC / 4,
    absMaxSkew: toBN('2.5'),
    absMinSkew: toBN('0.1'),
    capSkewsToAbs: false,
  } as TradeLimitParametersStruct,
  maxTradeLimitParams: {
    maxBaseIV: toBN('4'),
    maxSkew: toBN('3'),
    minBaseIV: toBN('0.7'),
    minSkew: toBN('1'),
    minDelta: toBN('0.3'),
    minForceCloseDelta: toBN('0.5'),
    minVol: toBN('1.1'),
    maxVol: toBN('6'),
    tradingCutoff: DAY_SEC,
    absMaxSkew: toBN('10'),
    absMinSkew: toBN('0.3'),
    capSkewsToAbs: false,
  } as TradeLimitParametersStruct,
  minVarianceFeeParams: {
    defaultVarianceFeeCoefficient: toBN('0.1'),
    forceCloseVarianceFeeCoefficient: toBN('0.1'),
    skewAdjustmentCoefficient: toBN('1.5'),
    referenceSkew: toBN('0.5'),
    minimumStaticSkewAdjustment: toBN('0.5'),
    vegaCoefficient: toBN('0.005'),
    minimumStaticVega: toBN('0'),
    ivVarianceCoefficient: toBN('0.75'),
    minimumStaticIvVariance: toBN('0.5'),
  } as VarianceFeeParametersStruct,
  maxVarianceFeeParams: {
    defaultVarianceFeeCoefficient: toBN('0.5'),
    forceCloseVarianceFeeCoefficient: toBN('0.5'),
    skewAdjustmentCoefficient: toBN('6'),
    referenceSkew: toBN('2'),
    minimumStaticSkewAdjustment: toBN('2'),
    vegaCoefficient: toBN('0.02'),
    minimumStaticVega: toBN('0'),
    ivVarianceCoefficient: toBN('3'),
    minimumStaticIvVariance: toBN('2'),
  } as VarianceFeeParametersStruct,
};

export const DEFAULT_GOV_GREEK_CACHE_BOUNDS: GreekCacheBoundsStruct = {
  minGreekCacheParams: {
    maxStrikesPerBoard: 1,
    acceptableSpotPricePercentMove: toBN('0.01'),
    staleUpdateDuration: HOUR_SEC,
    varianceIvGWAVPeriod: DAY_SEC,
    varianceSkewGWAVPeriod: DAY_SEC,
    optionValueIvGWAVPeriod: DAY_SEC / 2,
    optionValueSkewGWAVPeriod: DAY_SEC,
    gwavSkewFloor: toBN('0.25'),
    gwavSkewCap: toBN('1'),
  } as GreekCacheParametersStruct,
  maxGreekCacheParams: {
    maxStrikesPerBoard: 35,
    acceptableSpotPricePercentMove: toBN('0.1'),
    staleUpdateDuration: HOUR_SEC * 6,
    varianceIvGWAVPeriod: DAY_SEC * 2,
    varianceSkewGWAVPeriod: DAY_SEC * 6,
    optionValueIvGWAVPeriod: DAY_SEC * 2,
    optionValueSkewGWAVPeriod: DAY_SEC * 6,
    gwavSkewFloor: toBN('1'),
    gwavSkewCap: toBN('4'),
  } as GreekCacheParametersStruct,
  minForceCloseParams: {
    ivGWAVPeriod: HOUR_SEC * 6,
    skewGWAVPeriod: HOUR_SEC * 12,
    shortVolShock: toBN('1.001'),
    shortPostCutoffVolShock: toBN('1.001'),
    longVolShock: toBN('0.4'),
    longPostCutoffVolShock: toBN('0.4'),
    liquidateVolShock: toBN('1.0001'),
    liquidatePostCutoffVolShock: toBN('1.0001'),
    shortSpotMin: toBN('0.005'),
    liquidateSpotMin: toBN('0.04'),
  } as ForceCloseParametersStruct,
  maxForceCloseParams: {
    ivGWAVPeriod: HOUR_SEC * 24,
    skewGWAVPeriod: HOUR_SEC * 12,
    shortVolShock: toBN('2'),
    shortPostCutoffVolShock: toBN('2'),
    longVolShock: toBN('0.99'),
    longPostCutoffVolShock: toBN('1'),
    liquidateVolShock: toBN('2.6'),
    liquidatePostCutoffVolShock: toBN('3.2'),
    shortSpotMin: toBN('0.04'),
    liquidateSpotMin: toBN('0.04'),
  } as ForceCloseParametersStruct,
  minMinCollateralParams: {
    minStaticBaseCollateral: toBN('0.1'),
    minStaticQuoteCollateral: toBN('100'),
    shockVolA: toBN('1.25'),
    shockVolPointA: WEEK_SEC,
    shockVolB: toBN('0.9'),
    shockVolPointB: WEEK_SEC + DAY_SEC,
    callSpotPriceShock: toBN('1.001'),
    putSpotPriceShock: toBN('0.4'),
  } as MinCollateralParametersStruct,
  maxMinCollateralParams: {
    minStaticBaseCollateral: toBN('0.4'),
    minStaticQuoteCollateral: toBN('400'),
    shockVolA: toBN('5'),
    shockVolPointA: WEEK_SEC * 4,
    shockVolB: toBN('3.6'),
    shockVolPointB: WEEK_SEC * 8,
    callSpotPriceShock: toBN('1.2'),
    putSpotPriceShock: toBN('0.8'),
  } as MinCollateralParametersStruct,
};

export const DEFAULT_GOV_FUTURES_HEDGER_BOUNDS = {
  minPoolHedgerParams: {
    interactionDelay: HOUR_SEC,
    hedgeCap: toBN('0'),
  } as PoolHedgerParametersStruct,
  maxPoolHedgerParams: {
    interactionDelay: HOUR_SEC * 6,
    hedgeCap: toBN('100'),
  } as PoolHedgerParametersStruct,
  minFuturesPoolHedgerParams: {
    acceptableSpotSlippage: toBN('1.05'),
    deltaThreshold: toBN('100'),
    marketDepthBuffer: toBN('1'),
    vaultLiquidityCheckEnabled: true,
    targetLeverage: toBN('1.1'),
    maxLeverage: toBN('10'),
    minCollateralUpdate: toBN('5'),
    minCancelDelay: 1200, // 20 minutes
  } as FuturesPoolHedgerParametersStruct,
  maxFuturesPoolHedgerParams: {
    acceptableSpotSlippage: toBN('1.5'),
    deltaThreshold: toBN('1000'),
    marketDepthBuffer: toBN('2'),
    vaultLiquidityCheckEnabled: true,
    targetLeverage: toBN('3'),
    maxLeverage: toBN('20'),
    minCollateralUpdate: toBN('10'),
    minCancelDelay: 2400, // 20 minutes
  } as FuturesPoolHedgerParametersStruct,
};

export const DEFAULT_GOV_OPTION_TOKEN_BOUNDS: OptionTokenBoundsStruct = {
  minPartialCollatParams: {
    penaltyRatio: toBN('0.01'),
    liquidatorFeeRatio: toBN('0.1'),
    smFeeRatio: toBN('0.1'),
    minLiquidationFee: toBN('5'),
  } as PartialCollateralParametersStruct,
  maxPartialCollatParams: {
    penaltyRatio: toBN('0.8'),
    liquidatorFeeRatio: toBN('0.8'),
    smFeeRatio: toBN('0.19'),
    minLiquidationFee: toBN('20'),
  } as PartialCollateralParametersStruct,
};

export function getMarketPricingParams(market?: string): PricingParametersStruct {
  market = market || 'sETH';
  if (market == 'sBTC') {
    return {
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0.015'),
      standardSize: toBN('5'),
      vegaFeeCoefficient: toBN('15000'),
    };
  } else if (market == 'sLINK') {
    return {
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0.03'),
      standardSize: toBN('40'),
      vegaFeeCoefficient: toBN('10'),
    };
  } else if (market == 'sSOL') {
    return {
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0.015'),
      standardSize: toBN('100'),
      vegaFeeCoefficient: toBN('50'),
    };
  } else {
    return DEFAULT_PRICING_PARAMS;
  }
}

export function getBasePrice(market?: string) {
  market = market || 'sETH';
  if (market == 'sBTC') {
    return toBN('50000');
  } else if (market == 'sLINK') {
    return toBN('20');
  } else if (market == 'sSOL') {
    return toBN('100');
  } else {
    return DEFAULT_BASE_PRICE;
  }
}

export function getStrikePrices(market?: string): string[] {
  market = market || 'sETH';
  if (market == 'sBTC') {
    return ['45000', '50000', '55000'];
  } else if (market == 'sLINK') {
    return ['15', '20', '25'];
  } else if (market == 'sSOL') {
    return ['90', '100', '110'];
  } else {
    return DEFAULT_BOARD_PARAMS.strikePrices;
  }
}

export const DEFAULT_POOL_DEPOSIT = toBN('500000');
export const DEFAULT_POOL_DEPOSIT_USDC = toBN('500000', DEFAULT_DECIMALS.USDC);

export const DEFAULT_QUOTE_BALANCE = toBN('1000000');
export const DEFAULT_QUOTE_BALANCE_USDC = toBN('1000000', DEFAULT_DECIMALS.USDC);

export const DEFAULT_BASE_BALANCE = toBN('10000');
export const DEFAULT_BASE_BALANCE_BTC = toBN('10000', DEFAULT_DECIMALS.wBTC);

export const DEFAULT_MARKET_ID = 0;
