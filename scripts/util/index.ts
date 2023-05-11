import { Wallet } from 'ethers';
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
import { JsonRpcProvider } from '@ethersproject/providers';

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
  BaseAsset: string;
  MockPrice?: string;
  Parameters: AllParams;
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
  QuoteAsset: string;
  Parameters: AllParams;
  SwapRouter: string;
  SwapTestERC20s: { [key: string]: { Ticker: string; Decimals: number; Name: string; Rate: string } };
  Markets: { [key: string]: MarketParams };
  Seed: SeedParams;
};

export type AllowedNetworks = 'goerli-ovm' | 'goerli-arbi' | 'mainnet-ovm' | 'mainnet-arbi' | 'local';
export const allNetworks = ['goerli-ovm', 'goerli-arbi', 'mainnet-ovm', 'mainnet-arbi', 'local'];

export enum DeploymentType {
  MockSnxMockPricing = 'mockSnx',
  MockGmxMockPricing = 'mockGmx',
  MockSnxRealPricing = 'realPricingMockSnx',
  MockGmxRealPricing = 'realPricingMockGmx',
  GMX = 'realGMX',
  SNX = 'realSNX',
  SNXCannon = 'snxCannon',
}

export type DeploymentParams = {
  network: AllowedNetworks;
  deploymentType: DeploymentType;
  deployer: Wallet;
  provider?: JsonRpcProvider;
};

export function isMockSnx(deploymentType: DeploymentType) {
  return [DeploymentType.MockSnxMockPricing, DeploymentType.MockSnxRealPricing].includes(deploymentType);
}

export function isRealSnx(deploymentType: DeploymentType) {
  return [DeploymentType.SNX, DeploymentType.SNXCannon].includes(deploymentType);
}

export function isMockGmx(deploymentType: DeploymentType) {
  return [DeploymentType.MockGmxMockPricing, DeploymentType.MockGmxRealPricing].includes(deploymentType);
}

export function isRealGmx(deploymentType: DeploymentType) {
  return [DeploymentType.GMX].includes(deploymentType);
}

export function isGMX(deploymentType: DeploymentType) {
  return [DeploymentType.GMX, DeploymentType.MockGmxMockPricing, DeploymentType.MockGmxRealPricing].includes(
    deploymentType,
  );
}

export function getSelectedNetwork(): AllowedNetworks {
  const network = process.env.HARDHAT_NETWORK == undefined ? '' : process.env.HARDHAT_NETWORK;
  if (allNetworks.includes(network) || network == undefined) {
    return network as AllowedNetworks;
  }
  throw Error('Invalid network ' + network);
}
