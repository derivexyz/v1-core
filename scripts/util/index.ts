import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import {
  LiquidityPool,
  // BlackScholes,
  LiquidityToken,
  OptionGreekCache,
  OptionMarket,
  OptionMarketPricer,
  OptionMarketViewer,
  OptionToken,
  PoolHedger,
  ShortCollateral,
  TestERC20,
} from '../../typechain-types';
// import { MultistepSwapper } from '../../typechain-types/MultistepSwapper';

(global as any).hashes = [];

export type MarketContracts = {
  optionMarket: OptionMarket;
  optionMarketPricer: OptionMarketPricer;
  optionGreekCache: OptionGreekCache;
  optionToken: OptionToken;
  liquidityPool: LiquidityPool;
  liquidityToken: LiquidityToken;
  optionMarketViewer: OptionMarketViewer;
  shortCollateral: ShortCollateral;
  poolHedger: PoolHedger;
  baseAsset: TestERC20;
  // multistepSwapper: MultistepSwapper;
};

export type EnvVars = {
  GAS_PRICE: string;
  GAS_LIMIT: string;
  PRIVATE_KEY: string;
  INFURA_PROJECT_ID: string;
  ETHERSCAN_KEY: string;
  RPC_URL: string;
  SYNTHETIX_LOCATION: string;
};

export type AllParams = {
  OptionMarketParams: {
    maxBoardExpiry: number;
    securityModule: string;
    feePortionReserved: string;
  };
  LiquidityPoolParams: {
    minDepositWithdraw: string;
    depositDelay: number;
    withdrawalDelay: number;
    withdrawalFee: string;
    liquidityCBThreshold: string;
    liquidityCBTimeout: number;
    ivVarianceCBThreshold: string;
    skewVarianceCBThreshold: string;
    ivVarianceCBTimeout: string;
    skewVarianceCBTimeout: string;
    guardianMultisig: string;
    guardianDelay: number;
    boardSettlementCBTimeout: number;
  };
  GreekCacheParams: {
    maxStrikesPerBoard: number;
    acceptableSpotPricePercentMove: string;
    staleUpdateDuration: number;
    varianceIvGWAVPeriod: number;
    varianceSkewGWAVPeriod: number;
    optionValueIvGWAVPeriod: number;
    optionValueSkewGWAVPeriod: number;
    gwavSkewFloor: string;
    gwavSkewCap: string;
    rateAndCarry: string;
  };
  MinCollateralParams: {
    minStaticBaseCollateral: string;
    minStaticQuoteCollateral: string;
    shockVolA: string;
    shockVolPointA: number;
    shockVolB: string;
    shockVolPointB: number;
    callSpotPriceShock: string;
    putSpotPriceShock: string;
  };
  ForceCloseParams: {
    ivGWAVPeriod: number;
    skewGWAVPeriod: number;
    shortVolShock: string;
    shortPostCutoffVolShock: string;
    longVolShock: string;
    longPostCutoffVolShock: string;
    liquidateVolShock: string;
    liquidatePostCutoffVolShock: string;
    shortSpotMin: string;
    liquidateSpotMin: string;
  };
  PricingParams: {
    optionPriceFeeCoefficient: string;
    optionPriceFee1xPoint: number;
    optionPriceFee2xPoint: number;
    spotPriceFeeCoefficient: string;
    spotPriceFee1xPoint: number;
    spotPriceFee2xPoint: number;
    vegaFeeCoefficient: string;
    standardSize: string;
    skewAdjustmentFactor: string;
  };
  TradeLimitParams: {
    maxBaseIV: string;
    maxSkew: string;
    minBaseIV: string;
    minSkew: string;
    minDelta: string;
    minForceCloseDelta: string;
    minVol: string;
    maxVol: string;
    tradingCutoff: number;
    absMaxSkew: string;
    absMinSkew: string;
  };
  PartialCollatParams: {
    penaltyRatio: string;
    liquidatorFeeRatio: string;
    smFeeRatio: string;
    minLiquidationFee: string;
    securityModule: string;
  };
  PoolHedgerParams: {
    shortBuffer: string;
    interactionDelay: number;
    hedgeCap: string;
  };
};

export type MarketParams = {
  BaseTicker: string;
  MockPrice?: string;
  ParameterOverrides: AllParams;
  // Boards: { BaseIv: string; Expiry: number; Skews: string[]; Strikes: string[] }[];
};

export type MintParams = {
  run: boolean;
  markets: {
    [key: string]: {
      quoteAmount: string;
      baseAmount: string;
    };
  };
};

export type DepositParams = {
  run: boolean;
  markets: {
    [key: string]: {
      quoteAmount: string;
    };
  };
};

export type TradeSeedingParams = {
  repetitionProbabilityPerBoard: number;
  maxPerBoard: number;
};

export type ExercisableOptionsParams = {
  markets: {
    [key: string]: {
      run: boolean;
    };
  };
};

export type AddBoardsParams = {
  run: boolean;
  markets: {
    [key: string]: {
      generated: boolean; // If not generated, use static
      staticBoards: { BaseIv: string; Expiry: number; Skews: string[]; Strikes: string[] }[];
    };
  };
};

export type SeedParams = {
  mintFunds: MintParams;
  deposit: DepositParams;
  addExercisableOptions: ExercisableOptionsParams;
  addBoards: AddBoardsParams;
  updateCaches: { markets: { [key: string]: boolean } };
  hedgeDelta: { markets: { [key: string]: boolean } };
  seedTrades: { markets: { [key: string]: boolean }; populationParameters: TradeSeedingParams };
  seedLiquidations: { markets: { [key: string]: { [key: string]: boolean } } }; // if false will make puts insolvent
  changeOwner: { run: boolean; globalOwner: string; markets: { [key: string]: string } };
};

export type SystemParams = {
  QuoteTicker: string;
  Parameters: AllParams;
  SwapRouter: string;
  SwapTestERC20s: { [key: string]: { Ticker: string; Decimals: number; Name: string; Rate: string } };
  Markets: { [key: string]: MarketParams };
  Seed: SeedParams;
};

export type AllowedNetworks = 'goerli-ovm' | 'mainnet-ovm' | 'local';
export const allNetworks = ['goerli-ovm', 'mainnet-ovm', 'local'];

export type DeploymentParams = {
  network: AllowedNetworks;
  mockSnx: boolean;
  realPricing: boolean;
  deployer: Wallet;
};
