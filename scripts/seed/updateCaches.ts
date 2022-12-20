import { BigNumberish } from 'ethers';
import { DeploymentParams } from '../util';
import { callLyraFunction, executeLyraFunction } from '../util/transactions';

export async function updateCaches(deploymentParams: DeploymentParams, market: string) {
  console.log(`Updating greeks per board for market ${market}`);

  const liveBoards = (await callLyraFunction(
    deploymentParams,
    'OptionMarket',
    'getLiveBoards',
    [],
    market,
  )) as BigNumberish[];

  for (const boardId of liveBoards) {
    await executeLyraFunction(deploymentParams, 'OptionGreekCache', 'updateBoardCachedGreeks', [boardId], market);
  }
}
