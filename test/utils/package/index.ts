import {
  currentTime,
  DAY_SEC,
  fromBN,
  getEvent,
  getEventArgs,
  HOUR_SEC,
  MAX_UINT,
  MONTH_SEC,
  OptionType,
  PositionState,
  toBN,
  toBytes32,
  TradeDirection,
  UNIT,
  WEEK_SEC,
  YEAR_SEC,
  ZERO_ADDRESS,
} from '../../../scripts/util/web3utils';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_BOARD_PARAMS,
  DEFAULT_FEE_RATE_FOR_BASE,
  DEFAULT_FEE_RATE_FOR_QUOTE,
  DEFAULT_FORCE_CLOSE_PARAMS,
  DEFAULT_GREEK_CACHE_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_MIN_COLLATERAL_PARAMS,
  DEFAULT_OPTION_MARKET_PARAMS,
  DEFAULT_PARTIAL_COLLAT_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_PRICING_PARAMS,
  DEFAULT_TRADE_LIMIT_PARAMS,
} from '../defaultParams';
import { deployTestSystem } from '../deployTestSystem';
import { fastForward, mineBlock, restoreSnapshot, takeSnapshot } from '../evm';
import {
  createDefaultBoardWithOverrides,
  mockPrice,
  seedBalanceAndApprovalFor,
  seedTestSystem,
} from '../seedTestSystem';

export { TestSystemContractsType } from '../deployTestSystem';
export { getGlobalDeploys, getMarketDeploys } from './parseFiles';

export const TestSystem = {
  deploy: deployTestSystem,
  seed: seedTestSystem,
  seedBalanceAndApprovalFor: seedBalanceAndApprovalFor,
  marketActions: {
    createBoard: createDefaultBoardWithOverrides,
    mockPrice: mockPrice,
  },
  OptionType,
  PositionState,
  TradeDirection,
};

export const lyraDefaultParams = {
  OPTION_MARKET: DEFAULT_OPTION_MARKET_PARAMS,
  LIQUIDITY_POOL_PARAMS: DEFAULT_LIQUIDITY_POOL_PARAMS,
  POOL_HEDGER_PARAMS: DEFAULT_POOL_HEDGER_PARAMS,
  GREEK_CACHE_PARAMS: DEFAULT_GREEK_CACHE_PARAMS,
  MIN_COLLATERAL_PARAMS: DEFAULT_MIN_COLLATERAL_PARAMS,
  FORCE_CLOSE_PARAMS: DEFAULT_FORCE_CLOSE_PARAMS,
  PRICING_PARAMS: DEFAULT_PRICING_PARAMS,
  TRADE_LIMIT_PARAMS: DEFAULT_TRADE_LIMIT_PARAMS,
  PARTIAL_COLLAT_PARAMS: DEFAULT_PARTIAL_COLLAT_PARAMS,
  FEE_RATE_FOR_BASE: DEFAULT_FEE_RATE_FOR_BASE,
  FEE_RATE_FOR_QUOTE: DEFAULT_FEE_RATE_FOR_QUOTE,
  BASE_PRICE: DEFAULT_BASE_PRICE,
  BOARD_PARAMS: DEFAULT_BOARD_PARAMS,
};

export const lyraConstants = {
  ZERO_ADDRESS,
  HOUR_SEC,
  DAY_SEC,
  WEEK_SEC,
  MONTH_SEC,
  YEAR_SEC,
  MAX_UINT,
  UNIT,
};

export const lyraUtils = {
  toBN,
  fromBN,
  toBytes32,
  currentTime,
  getEvent,
  getEventArgs,
};

export const lyraEvm = {
  fastForward,
  takeSnapshot,
  restoreSnapshot,
  mineBlock,
};
