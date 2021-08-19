import { BigNumber } from 'ethers';
import { currentTime, getEventArgs, MONTH_SEC, toBN } from '../../scripts/util/web3utils';
import { TestSystemContractsType } from './deployTestSystem';

export async function createDefaultBoardWithOverrides(
  c: TestSystemContractsType,
  overrides?: {
    expiresIn?: number;
    baseIV?: string;
    strikes?: string[];
    skews?: string[];
  },
): Promise<BigNumber> {
  let expiresIn = MONTH_SEC;
  let baseIV = '1';
  let strikes = ['1000', '1500', '2000', '2500', '3000'];
  let skews = ['1', '1', '1', '1', '1'];

  if (overrides) {
    expiresIn = overrides.expiresIn || expiresIn;
    baseIV = overrides.baseIV || baseIV;
    strikes = overrides.strikes || strikes;
    skews = overrides.skews || skews;
  }

  const tx = await c.optionMarket.createOptionBoard(
    (await currentTime()) + expiresIn,
    toBN(baseIV),
    strikes.map(toBN),
    skews.map(toBN),
  );

  const boardId = getEventArgs(await tx.wait(), 'BoardCreated').boardId;
  await c.optionGreekCache.updateBoardCachedGreeks(boardId);
  return boardId;
}
