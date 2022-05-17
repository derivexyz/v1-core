import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { fromBN, getEventArgs, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import {
  packAddLongParams,
  packAddShortParams,
  packCloseLongParams,
  packCloseShortParams,
  packOpenLongParams,
  packOpenShortParams,
  packReduceLongParams,
  packReduceShortParams,
} from '../../../scripts/util/wrapperPacking';
import { DEFAULT_MARKET_ID } from '../defaultParams';
import { expect, hre } from '../testSetup';

const LOG_EVENTS = false;

export enum STABLE_IDS {
  sUSD,
  DAI,
  USDC,
}

export function toUint64(amount: BigNumberish) {
  // This is converting to 1dp of precision
  return BigNumber.from(amount).mul(100_000_000);
}

export function stringToUint64(amount: string) {
  return toBN(amount).mul(100_000_000).div(UNIT);
}

export function toUint32(amount: BigNumberish) {
  // This is converting to 1dp of precision
  return BigNumber.from(amount).mul(100);
}

export async function parseTradeEvent(tx: ContractTransaction) {
  const event = getEventArgs(await tx.wait(), 'PositionTraded');
  if (LOG_EVENTS) {
    console.log(`--- PositionTraded ---------------------------------`);
    console.log(`isLong    ${event.isLong}`);
    console.log(`isOpen    ${event.isOpen}`);
    console.log(`Market    ${event.market}`);
    console.log(`PositinID ${event.positionId}`);
    console.log(`Owner     ${event.owner}`);
    console.log(`Amount    ${fromBN(event.amount)}`);
    console.log(`TotalCost ${fromBN(event.totalCost)}`);
    console.log(`TotalFee  ${fromBN(event.totalFee)}`);
    console.log(`SwapFee   ${fromBN(event.swapFee)}`);
    console.log(`Token     ${event.token}`);
  }
  return event.positionId;
}

export async function wrapperOpenLong(overrides: {
  token?: STABLE_IDS;
  isCall: boolean;
  maxCost: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    iterations: 1,
    strikeId: hre.f.strike.strikeId,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.openLong(
      packOpenLongParams({
        ...params,
        maxCost: toUint32(params.maxCost),
        inputAmount: toUint32(params.inputAmount),
        size: toUint64(params.size),
      }),
    ),
  );
}

export async function wrapperAddLong(overrides: {
  token?: STABLE_IDS;
  positionId: BigNumberish;
  maxCost: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.addLong(
      packAddLongParams({
        ...params,
        maxCost: toUint32(params.maxCost),
        inputAmount: toUint32(params.inputAmount),
        size: toUint64(params.size),
      }),
    ),
  );
}

export async function wrapperReduceLong(overrides: {
  token?: STABLE_IDS;
  isForceClose?: boolean;
  positionId: BigNumberish;
  minReceived: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    isForceClose: false,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.reduceLong(
      packReduceLongParams({
        ...params,
        minReceived: toUint32(params.minReceived),
        inputAmount: toUint32(params.inputAmount),
        size: toUint64(params.size),
      }),
    ),
  );
}

export async function wrapperCloseLong(overrides: {
  token?: STABLE_IDS;
  isForceClose?: boolean;
  positionId: BigNumberish;
  minReceived: BigNumberish;
  inputAmount: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    isForceClose: false,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.closeLong(
      packCloseLongParams({
        ...params,
        minReceived: toUint32(params.minReceived),
        inputAmount: toUint32(params.inputAmount),
      }),
    ),
  );
}

export async function wrapperOpenShort(overrides: {
  token?: STABLE_IDS;
  optionType: OptionType;
  minReceived: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
  collateral: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    iterations: 1,
    strikeId: hre.f.strike.strikeId,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.openShort(
      packOpenShortParams({
        ...params,
        minReceived: toUint32(params.minReceived),
        inputAmount: toUint32(params.inputAmount),
        size: toUint64(params.size),
        collateral: toUint64(params.collateral),
      }),
    ),
  );
}

export async function wrapperAddShort(overrides: {
  token?: STABLE_IDS;
  positionId: BigNumberish;
  minReceived: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
  absoluteCollateral: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.addShort(
      packAddShortParams({
        ...params,
        minReceived: toUint32(params.minReceived),
        inputAmount: toUint32(params.inputAmount),
        size: toUint64(params.size),
        absoluteCollateral: toUint64(params.absoluteCollateral),
      }),
    ),
  );
}

export async function wrapperStringAddShort(overrides: {
  token?: STABLE_IDS;
  positionId: BigNumberish;
  minReceived: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
  absoluteCollateral: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.addShort(
      packAddShortParams({
        ...params,
        minReceived: toUint32(params.minReceived),
        inputAmount: toUint32(params.inputAmount),
        size: stringToUint64(params.size.toString()),
        absoluteCollateral: stringToUint64(params.absoluteCollateral.toString()),
      }),
    ),
  );
}

export async function wrapperReduceShort(overrides: {
  token?: STABLE_IDS;
  positionId: BigNumberish;
  maxCost: BigNumberish;
  isForceClose?: boolean;
  inputAmount: BigNumberish;
  size: BigNumberish;
  absoluteCollateral: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    isForceClose: false,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.reduceShort(
      packReduceShortParams({
        ...params,
        maxCost: toUint32(params.maxCost),
        inputAmount: toUint32(params.inputAmount),
        size: toUint64(params.size),
        absoluteCollateral: toUint64(params.absoluteCollateral),
      }),
    ),
  );
}

export async function wrapperCloseShort(overrides: {
  token?: STABLE_IDS;
  positionId: BigNumberish;
  maxCost: BigNumberish;
  isForceClose?: boolean;
  inputAmount: BigNumberish;
}) {
  const params = {
    token: STABLE_IDS.sUSD,
    market: DEFAULT_MARKET_ID,
    isForceClose: false,
    iterations: 1,
    ...overrides,
  };
  return await parseTradeEvent(
    await hre.f.c.optionMarketWrapper.closeShort(
      packCloseShortParams({
        ...params,
        maxCost: toUint32(params.maxCost),
        inputAmount: toUint32(params.inputAmount),
      }),
    ),
  );
}

export async function checkContractFunds(contract: string) {
  const wrapperQuote = await hre.f.c.snx.quoteAsset.balanceOf(contract);
  const wrapperDAI = await hre.f.DAI.balanceOf(contract);
  const wrapperUSDC = await hre.f.USDC.balanceOf(contract);
  const wrapperBase = await hre.f.c.snx.baseAsset.balanceOf(contract);
  // console.log(` sUSD ${wrapperQuote}`)
  // console.log(`  DAI ${wrapperDAI}`)
  // console.log(` USDC ${wrapperUSDC}`)
  // console.log(` base ${wrapperBase}`)
  expect(wrapperQuote).to.eq(0);
  expect(wrapperDAI).to.eq(0);
  expect(wrapperUSDC).to.eq(0);
  expect(wrapperBase).to.eq(0);
}
