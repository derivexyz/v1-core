import { DAY_SEC, HOUR_SEC, MAX_UINT, MONTH_SEC, toBN, WEEK_SEC, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { LiquidityPoolParametersStruct } from '../../typechain-types/LiquidityPool';
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

export const DEFAULT_LIQUIDITY_POOL_PARAMS: LiquidityPoolParametersStruct = {
  minDepositWithdraw: toBN('1'),
  depositDelay: WEEK_SEC,
  withdrawalDelay: WEEK_SEC,
  withdrawalFee: toBN('0.01'),
  liquidityCBThreshold: toBN('0.01'),
  liquidityCBTimeout: DAY_SEC * 3,
  ivVarianceCBThreshold: toBN('0.1'),
  skewVarianceCBThreshold: toBN('0.35'),
  ivVarianceCBTimeout: HOUR_SEC * 12,
  skewVarianceCBTimeout: HOUR_SEC * 12,
  guardianMultisig: ZERO_ADDRESS,
  guardianDelay: WEEK_SEC * 2,
  boardSettlementCBTimeout: HOUR_SEC * 6,
  maxFeePaid: toBN('0.01'),
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
  rateAndCarry: toBN('0.05'),
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
  vegaFeeCoefficient: toBN('6000'),
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
  defaultVarianceFeeCoefficient: toBN('5'),
  forceCloseVarianceFeeCoefficient: toBN('2'),
  skewAdjustmentCoefficient: toBN('3'),
  referenceSkew: toBN('1'),
  minimumStaticSkewAdjustment: toBN('1'),
  vegaCoefficient: toBN('0.02'),
  minimumStaticVega: toBN('2'),
  ivVarianceCoefficient: toBN('1.5'),
  minimumStaticIvVariance: toBN('1'),
};

export const DEFAULT_SECURITY_MODULE = '0xefeefeefeefeefeefeefeefeefeefeefeefeefee';

export const DEFAULT_OPTION_MARKET_PARAMS: OptionMarketParametersStruct = {
  securityModule: DEFAULT_SECURITY_MODULE,
  feePortionReserved: toBN('0.1'),
  maxBoardExpiry: MONTH_SEC * 12,
};

export const DEFAULT_PARTIAL_COLLAT_PARAMS: PartialCollateralParametersStruct = {
  penaltyRatio: toBN('0.2'),
  liquidatorFeeRatio: toBN('0.4'),
  smFeeRatio: toBN('0.3'),
  minLiquidationFee: toBN('15'),
};

export const DEFAULT_POOL_HEDGER_PARAMS: PoolHedgerParametersStruct = {
  shortBuffer: toBN('2'),
  interactionDelay: 24 * HOUR_SEC,
  hedgeCap: MAX_UINT,
};

export const DEFAULT_BASE_PRICE = toBN('1742.01337');
export const DEFAULT_FEE_RATE_FOR_BASE = toBN('0.0075');
export const DEFAULT_FEE_RATE_FOR_QUOTE = toBN('0.005');

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

export function getMarketPricingParams(market?: string): PricingParametersStruct {
  market = market || 'sETH';
  if (market == 'sBTC') {
    return {
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0.015'),
      standardSize: toBN('5'),
      vegaFeeCoefficient: toBN('600000'),
    };
  } else if (market == 'sLINK') {
    return {
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0.03'),
      standardSize: toBN('40'),
      vegaFeeCoefficient: toBN('400'),
    };
  } else if (market == 'sSOL') {
    return {
      ...DEFAULT_PRICING_PARAMS,
      optionPriceFeeCoefficient: toBN('0.015'),
      standardSize: toBN('100'),
      vegaFeeCoefficient: toBN('2000'),
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

export const DEFAULT_QUOTE_BALANCE = toBN('1000000');

export const DEFAULT_BASE_BALANCE = toBN('10000');

export const DEFAULT_MARKET_ID = 0;
