import { Result } from '@ethersproject/abi';
import { BigNumber, ContractReceipt, ethers } from 'ethers';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const HOUR_SEC = 60 * 60;
export const DAY_SEC = 24 * HOUR_SEC;
export const WEEK_SEC = 7 * DAY_SEC;
export const MONTH_SEC = 28 * DAY_SEC;
export const YEAR_SEC = 365 * DAY_SEC;
export const MAX_UINT = BigNumber.from(2).pow(256).sub(1);
export const UNIT = BigNumber.from(10).pow(18);

export const TradeType = {
  LONG_CALL: 0,
  SHORT_CALL: 1,
  LONG_PUT: 2,
  SHORT_PUT: 3,
};

// allow for decimals to be passed in up to 9dp of precision
export function toBN(val: string) {
  // multiplier is to handle decimals
  if (val.includes('e')) {
    if (parseFloat(val) > 1) {
      const x = val.split('.');
      const y = x[1].split('e+');
      const exponent = parseFloat(y[1]);
      const newVal = x[0] + y[0] + '0'.repeat(exponent - y[0].length);
      // console.warn(`Warning: toBN of val with exponent, converting to string. (${val}) converted to (${newVal})`);
      val = newVal;
    } else {
      // console.warn(
      //   `Warning: toBN of val with exponent, converting to float. (${val}) converted to (${parseFloat(val).toFixed(
      //     18,
      //   )})`,
      // );
      val = parseFloat(val).toFixed(18);
    }
  } else if (val.includes('.') && val.split('.')[1].length > 18) {
    // console.warn(`Warning: toBN of val with more than 18 decimals. Stripping excess. (${val})`);
    const x = val.split('.');
    x[1] = x[1].slice(0, 18);
    val = x[0] + '.' + x[1];
  }
  return ethers.utils.parseUnits(val, 18);
}

// allow for decimals to be passed in up to 9dp of precision
export function decimalToBN(v: number) {
  let val = v.toString();
  // multiplier is to handle decimals
  if (val.includes('e')) {
    if (parseFloat(val) > 1) {
      const x = val.split('.');
      let y;
      if (x.length == 1) {
        y = x[0].split('e+');
        x[0] = y[0];
      } else {
        y = x[1].split('e+');
      }
      const exponent = parseFloat(y[1]);
      const newVal = x[0] + y[0] + '0'.repeat(exponent - y[0].length);
      // console.warn(`Warning: toBN of val with exponent, converting to string. (${val}) converted to (${newVal})`);
      val = newVal;
    } else {
      console.warn(
        `Warning: toBN of val with exponent, converting to float. (${val}) converted to (${parseFloat(val).toFixed(
          18,
        )})`,
      );
      val = parseFloat(val).toFixed(18);
    }
  } else if (val.includes('.') && val.split('.')[1].length > 18) {
    // console.warn(`Warning: toBN of val with more than 18 decimals. Stripping excess. (${val})`);
    const x = val.split('.');
    x[1] = x[1].slice(0, 18);
    val = x[0] + '.' + x[1];
  }
  return BigNumber.from(val);
}

export function fromBN(val: BigNumber): string {
  return ethers.utils.formatUnits(val, 18);
}

export function toBytes32(msg: string): string {
  return ethers.utils.formatBytes32String(msg);
}

export function getEventArgs(receipt: ContractReceipt, eventName: string): Result {
  const value = receipt.events!.find(e => e.event === eventName);
  if (value == undefined || value.args == undefined) {
    throw new Error(`Could not find event ${eventName}`);
  }
  return value.args;
}
