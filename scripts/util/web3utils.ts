import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider';
import { BigNumberish, ContractReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { TypedEvent } from '../../typechain-types/common';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const HOUR_SEC = 60 * 60;
export const DAY_SEC = 24 * HOUR_SEC;
export const WEEK_SEC = 7 * DAY_SEC;
export const MONTH_SEC = 28 * DAY_SEC;
export const YEAR_SEC = 365 * DAY_SEC;
export const MAX_UINT = ethers.BigNumber.from(2).pow(256).sub(1);
export const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
export const UNIT = ethers.BigNumber.from(10).pow(18);
export const CONVERTUSDC = ethers.BigNumber.from(10).pow(12);
export const CONVERTWBTC = ethers.BigNumber.from(10).pow(10);

export const DEFAULT_DECIMALS = { ETH: 8, wBTC: 8, USDC: 6 };

export enum OptionType {
  LONG_CALL,
  LONG_PUT,
  SHORT_CALL_BASE,
  SHORT_CALL_QUOTE,
  SHORT_PUT_QUOTE,
}

export enum PositionState {
  EMPTY,
  ACTIVE,
  CLOSED,
  LIQUIDATED,
  SETTLED,
  MERGED,
}

export enum TradeDirection {
  OPEN,
  CLOSE,
  LIQUIDATE,
}

export function toBN18(val: string) {
  return toBN(val, 18);
}

// allow for decimals to be passed in up to 9dp of precision
export function toBN(val: string, decimals?: number) {
  decimals = decimals || 18;
  // multiplier is to handle decimals
  if (val.includes('e')) {
    if (parseFloat(val) > 1) {
      const x = val.split('.');
      const y = x[1].split('e+');
      const exponent = parseFloat(y[1]);
      const newVal = x[0] + y[0] + '0'.repeat(exponent - y[0].length);
      console.warn(`Warning: toBN of val with exponent, converting to string. (${val}) converted to (${newVal})`);
      val = newVal;
    } else {
      console.warn(
        `Warning: toBN of val with exponent, converting to float. (${val}) converted to (${parseFloat(val).toFixed(
          decimals,
        )})`,
      );
      val = parseFloat(val).toFixed(decimals);
    }
  } else if (val.includes('.') && val.split('.')[1].length > decimals) {
    console.warn(`Warning: toBN of val with more than ${decimals} decimals. Stripping excess. (${val})`);
    const x = val.split('.');
    x[1] = x[1].slice(0, decimals);
    val = x[0] + '.' + x[1];
  }
  return ethers.utils.parseUnits(val, decimals);
}

export function fromBN(val: BigNumberish, dec?: number): string {
  return ethers.utils.formatUnits(val, dec || 18);
}

export function toBytes32(msg: string): string {
  return ethers.utils.formatBytes32String(msg);
}

export async function currentTime() {
  const { timestamp } = await ethers.provider.getBlock('latest');
  return timestamp;
}

export async function getTxTimestamp(txResponse: TransactionResponse) {
  const result: TransactionReceipt = await txResponse.wait();
  return (await ethers.provider.getBlock(result.blockNumber)).timestamp;
}

export function getEvent(receipt: ContractReceipt, eventName: string): TypedEvent {
  if (!receipt.events) {
    throw Error('no events on contract receipt');
  }
  const value = receipt.events.find(e => e.event === eventName);
  if (value == undefined || value.args == undefined) {
    throw new Error(`Could not find event ${eventName}`);
  }
  return value as any;
}

export function getAllMatchingEvents(receipt: ContractReceipt, eventNames: string[]): TypedEvent[] {
  if (!receipt.events) {
    throw Error('no events on contract receipt');
  }
  const values = receipt.events.filter(e => eventNames.includes(e.event || '_'));
  if (values.length == 0) {
    throw new Error(`Could not find event ${eventNames}`);
  }

  for (const event of values) {
    if (event == undefined || event.args == undefined) {
      throw new Error(`Could not find event ${eventNames}`);
    }
  }
  return values as any;
}

export function getEventArgs(receipt: ContractReceipt, eventName: string) {
  return getEvent(receipt, eventName).args;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getOptionTypeName(optionType: OptionType) {
  switch (optionType) {
    case OptionType.LONG_CALL:
      return 'LONG_CALL';
    case OptionType.SHORT_CALL_BASE:
      return 'SHORT_CALL_BASE';
    case OptionType.SHORT_CALL_QUOTE:
      return 'SHORT_CALL_QUOTE';
    case OptionType.SHORT_PUT_QUOTE:
      return 'SHORT_PUT_QUOTE';
    default:
      return 'LONG_PUT';
  }
}
