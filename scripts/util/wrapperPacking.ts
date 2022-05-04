import { BigNumber, BigNumberish } from 'ethers';
import { OptionType } from './web3utils';

const TWO = BigNumber.from(2);

enum datatypes {
  uint8,
  uint32,
  uint64,
  bool,
}

const packedParams: { [key: string]: { [key: string]: { offset: number; type: datatypes } } } = {
  openLong: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    isCall: { offset: 16, type: datatypes.bool },
    iterations: { offset: 24, type: datatypes.uint8 },
    strikeId: { offset: 32, type: datatypes.uint32 },
    maxCost: { offset: 64, type: datatypes.uint32 },
    inputAmount: { offset: 96, type: datatypes.uint32 },
    size: { offset: 128, type: datatypes.uint64 },
  },
  addLong: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    iterations: { offset: 16, type: datatypes.uint8 },
    positionId: { offset: 24, type: datatypes.uint32 },
    maxCost: { offset: 56, type: datatypes.uint32 },
    inputAmount: { offset: 88, type: datatypes.uint32 },
    size: { offset: 120, type: datatypes.uint64 },
  },
  reduceLong: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    iterations: { offset: 16, type: datatypes.uint8 },
    isForceClose: { offset: 24, type: datatypes.bool },
    positionId: { offset: 32, type: datatypes.uint32 },
    inputAmount: { offset: 64, type: datatypes.uint32 },
    size: { offset: 96, type: datatypes.uint64 },
    minReceived: { offset: 160, type: datatypes.uint32 },
  },
  closeLong: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    iterations: { offset: 16, type: datatypes.uint8 },
    isForceClose: { offset: 24, type: datatypes.bool },
    positionId: { offset: 32, type: datatypes.uint32 },
    inputAmount: { offset: 64, type: datatypes.uint32 },
    minReceived: { offset: 96, type: datatypes.uint32 },
  },
  openShort: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    optionType: { offset: 16, type: datatypes.uint8 },
    iterations: { offset: 24, type: datatypes.uint8 },
    strikeId: { offset: 32, type: datatypes.uint32 },
    minReceived: { offset: 64, type: datatypes.uint32 },
    inputAmount: { offset: 96, type: datatypes.uint32 },
    size: { offset: 128, type: datatypes.uint64 },
    collateral: { offset: 192, type: datatypes.uint64 },
  },
  addShort: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    iterations: { offset: 16, type: datatypes.uint8 },
    positionId: { offset: 24, type: datatypes.uint32 },
    inputAmount: { offset: 56, type: datatypes.uint32 },
    minReceived: { offset: 88, type: datatypes.uint32 },
    size: { offset: 120, type: datatypes.uint64 },
    absoluteCollateral: { offset: 184, type: datatypes.uint64 },
  },
  reduceShort: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    iterations: { offset: 16, type: datatypes.uint8 },
    isForceClose: { offset: 24, type: datatypes.bool },
    positionId: { offset: 32, type: datatypes.uint32 },
    inputAmount: { offset: 64, type: datatypes.uint32 },
    maxCost: { offset: 96, type: datatypes.uint32 },
    size: { offset: 128, type: datatypes.uint64 },
    absoluteCollateral: { offset: 196, type: datatypes.uint64 },
  },
  closeShort: {
    market: { offset: 0, type: datatypes.uint8 },
    token: { offset: 8, type: datatypes.uint8 },
    iterations: { offset: 16, type: datatypes.uint8 },
    isForceClose: { offset: 24, type: datatypes.bool },
    positionId: { offset: 32, type: datatypes.uint32 },
    inputAmount: { offset: 64, type: datatypes.uint32 },
    maxCost: { offset: 96, type: datatypes.uint32 },
  },
};

function paramAddValue(val: BigNumberish | boolean, paramMeta: { offset: number; type: datatypes }) {
  // return BigNumber.from(0)
  if (val === true || val === false) {
    if (paramMeta.type == datatypes.bool) {
      return BigNumber.from(val ? 1 : 0).mul(TWO.pow(paramMeta.offset));
    }
    throw Error('boolean value has non bool datatype');
  }

  const bnVal = BigNumber.from(val);

  if (paramMeta.type == datatypes.uint8 && bnVal.gte(TWO.pow(8))) throw Error('value too large for datatype uint8');
  if (paramMeta.type == datatypes.uint32 && bnVal.gte(TWO.pow(32))) throw Error('value too large for datatype uint8');
  if (paramMeta.type == datatypes.uint64 && bnVal.gte(TWO.pow(64))) throw Error('value too large for datatype uint8');

  return bnVal.mul(TWO.pow(paramMeta.offset));
}

function getPackedParams(params: any, paramsForType: { [key: string]: { offset: number; type: datatypes } }) {
  let res = BigNumber.from(0);
  for (const key of Object.keys(params)) {
    if (!paramsForType[key]) throw Error(`key ${key} missing from paramsForType ${JSON.stringify(paramsForType)}`);
    res = res.add(paramAddValue((params as any)[key], paramsForType[key]));
  }
  return res;
}

export function packOpenLongParams(params: {
  market: BigNumberish; // 8
  token: BigNumberish; // 16
  isCall: boolean; // 24
  iterations: BigNumberish; // 32
  strikeId: BigNumberish; // 64
  maxCost: BigNumberish; // 96
  inputAmount: BigNumberish; // 128
  size: BigNumberish; // 192
}): BigNumber {
  return getPackedParams(params, packedParams.openLong);
}

export function packAddLongParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  iterations: BigNumberish;
  positionId: BigNumberish;
  maxCost: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.addLong);
}

export function packReduceLongParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  iterations: BigNumberish;
  isForceClose: boolean;
  positionId: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
  minReceived: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.reduceLong);
}

export function packCloseLongParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  iterations: BigNumberish;
  isForceClose: boolean;
  positionId: BigNumberish;
  inputAmount: BigNumberish;
  minReceived: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.closeLong);
}

export function packOpenShortParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  optionType: OptionType;
  iterations: BigNumberish;
  strikeId: BigNumberish;
  minReceived: BigNumberish;
  inputAmount: BigNumberish;
  size: BigNumberish;
  collateral: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.openShort);
}

export function packAddShortParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  iterations: BigNumberish;
  positionId: BigNumberish;
  inputAmount: BigNumberish;
  minReceived: BigNumberish;
  size: BigNumberish;
  absoluteCollateral: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.addShort);
}

export function packReduceShortParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  iterations: BigNumberish;
  isForceClose: boolean;
  positionId: BigNumberish;
  inputAmount: BigNumberish;
  maxCost: BigNumberish;
  size: BigNumberish;
  absoluteCollateral: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.reduceShort);
}

export function packCloseShortParams(params: {
  market: BigNumberish;
  token: BigNumberish;
  iterations: BigNumberish;
  isForceClose: boolean;
  positionId: BigNumberish;
  inputAmount: BigNumberish;
  maxCost: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.closeShort);
}
