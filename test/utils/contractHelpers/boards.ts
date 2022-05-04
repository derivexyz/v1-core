import { BigNumber } from 'ethers';
import { MONTH_SEC } from '../../../scripts/util/web3utils';
import { StrikeStruct } from '../../../typechain-types/OptionMarket';
import { fastForward } from '../evm';
import { createDefaultBoardWithOverrides } from '../seedTestSystem';
import { hre } from '../testSetup';
import { setETHPrice } from './synthetix';

export async function createBoard(overrides?: {
  expiresIn?: number;
  baseIV?: string;
  strikePrices?: string[];
  skews?: string[];
}) {
  return await createDefaultBoardWithOverrides(hre.f.c, overrides);
}

export async function settleBoardAtPrice(price: BigNumber) {
  await fastForward(MONTH_SEC);
  await setETHPrice(price);
  await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
}

export const emptyStrikeObject: StrikeStruct = {
  boardId: 0,
  id: 0,
  longCall: 0,
  longPut: 0,
  shortCallBase: 0,
  shortCallQuote: 0,
  shortPut: 0,
  skew: 0,
  strikePrice: 0,
};
