import { BigNumber, BigNumberish } from 'ethers';

const TWO = BigNumber.from(2);

enum datatypes {
  uint32,
  uint64,
}

const packedParams: { [key: string]: { [key: string]: { offset: number; type: datatypes } } } = {
  pid8: {
    pid1: { offset: 0, type: datatypes.uint32 },
    pid2: { offset: 32, type: datatypes.uint32 },
    pid3: { offset: 64, type: datatypes.uint32 },
    pid4: { offset: 96, type: datatypes.uint32 },
    pid5: { offset: 128, type: datatypes.uint32 },
    pid6: { offset: 160, type: datatypes.uint32 },
    pid7: { offset: 192, type: datatypes.uint32 },
    pid8: { offset: 224, type: datatypes.uint32 },
  },
};

function paramAddValue(val: BigNumberish | boolean, paramMeta: { offset: number; type: datatypes }) {
  const bnVal = BigNumber.from(val);
  if (paramMeta.type == datatypes.uint32 && bnVal.gte(TWO.pow(32))) throw Error('value too large for datatype uint32');
  if (paramMeta.type == datatypes.uint64 && bnVal.gte(TWO.pow(64))) throw Error('value too large for datatype uint64');
  // console.log(`bnVal ${bnVal.mul(TWO.pow(paramMeta.offset))}`);
  return bnVal.mul(TWO.pow(paramMeta.offset));
}

function getPackedParams(params: any, paramsForType: { [key: string]: { offset: number; type: datatypes } }) {
  let res = BigNumber.from(0);
  for (const key of Object.keys(params)) {
    if (!paramsForType[key]) throw Error(`key ${key} missing from paramsForType ${JSON.stringify(paramsForType)}`);
    if (params[key] == undefined) continue;
    // console.log(`paramAddValue ${(params)[key]}`)
    res = res.add(paramAddValue((params as any)[key], paramsForType[key]));
    // console.log(`res   ${res}`)
  }
  return res;
}

function packBatch(params: {
  pid1: BigNumberish;
  pid2: BigNumberish;
  pid3: BigNumberish;
  pid4: BigNumberish;
  pid5: BigNumberish;
  pid6: BigNumberish;
  pid7: BigNumberish;
  pid8: BigNumberish;
}): BigNumber {
  return getPackedParams(params, packedParams.pid8);
}

export function getBatches(positions: BigNumberish[]) {
  // Create packed batches for optimising calldata
  const numBatches: number = Math.ceil(positions.length / 8);
  const batches = [];

  for (let i = 0; i < numBatches; i++) {
    const pids: BigNumberish[] = [];
    for (let j = i * 8; j < (i + 1) * 8; j++) {
      if (positions[j] == undefined) continue;
      pids[j] = positions[j];
    }

    batches[i] = packBatch({
      pid1: pids[i * 8],
      pid2: pids[i * 8 + 1],
      pid3: pids[i * 8 + 2],
      pid4: pids[i * 8 + 3],
      pid5: pids[i * 8 + 4],
      pid6: pids[i * 8 + 5],
      pid7: pids[i * 8 + 6],
      pid8: pids[i * 8 + 7],
    });
  }
  return batches;
}
