import { fastForward } from '../../test/utils/evm';
import { DeploymentParams } from '../util';
import {
  callLyraFunction,
  executeLyraFunction,
  executeExternalFunction,
  getLyraContract,
  openPosition,
} from '../util/transactions';
import { currentTime, MAX_UINT, MONTH_SEC, OptionType, toBN } from '../util/web3utils';
import { createBoards } from './createBoards';

export async function exercisableBoardScenario(deploymentParams: DeploymentParams, market: string, price: string) {
  console.log('\n= liquidated board scenario...');

  if (deploymentParams.network != 'local') {
    throw new Error('invalid network for settle scenario');
  }

  console.log('approving balance for test');

  await executeExternalFunction(deploymentParams, 'ProxyERC20sUSD', 'approve', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    MAX_UINT,
  ]);

  await executeExternalFunction(deploymentParams, 'Proxy' + market, 'approve', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    MAX_UINT,
  ]);

  const boards = await createSingleBoard(price);
  await createBoards(deploymentParams, boards, market);

  let liveBoards = (await callLyraFunction(deploymentParams, 'OptionMarket', 'getLiveBoards', [], market)) as any;

  for (const board of liveBoards) {
    await executeLyraFunction(deploymentParams, 'OptionGreekCache', 'updateBoardCachedGreeks', [board], market);
  }

  console.log(`Getting strikes for board ${liveBoards[0]}`);

  const board = (await callLyraFunction(deploymentParams, 'OptionMarketViewer', 'getBoard', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    liveBoards[0],
  ])) as any;
  const strikes = board.strikes;

  console.log(`board set up complete for ${market}`);

  console.log('buying 1 long call that finishes in the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[0].strikeId,
    optionType: OptionType.LONG_CALL,
    amount: toBN('1'),
  });

  console.log('Buying 1 long put that finishes out of the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[0].strikeId,
    optionType: OptionType.LONG_PUT,
    amount: toBN('1'),
  });

  console.log('Buying 1 short call that finishes in the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[1].strikeId,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: toBN('1'),
    setCollateralTo: toBN('1'),
  });

  console.log('Buying 1 short put that finishes out of the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[1].strikeId,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: toBN('1'),
    setCollateralTo: strikes[1].strikePrice,
  });

  console.log('Buying 1 short call that finishes in of the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[2].strikeId,
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('1'),
    setCollateralTo: strikes[2].strikePrice,
  });

  console.log('Buying 1 short put that finishes out of the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[2].strikeId,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: toBN('1'),
    setCollateralTo: strikes[1].strikePrice,
  });

  console.log('Buying 1 long call that finishes in the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[3].strikeId,
    optionType: OptionType.LONG_CALL,
    amount: toBN('1'),
  });

  console.log('Buying 1 long put that finishes out of the money');
  await openPosition(deploymentParams, market, {
    strikeId: strikes[3].strikeId,
    optionType: OptionType.LONG_PUT,
    amount: toBN('1'),
  });

  console.log('= adjusting hedging delta');

  console.log('= Fast forwarding');

  if (deploymentParams.network == 'local') {
    await fastForward(MONTH_SEC * 1.1);
  }

  console.log('= liquidating board(s)');

  //getting all the boards
  liveBoards = (await callLyraFunction(deploymentParams, 'OptionMarket', 'getLiveBoards', [], market)) as any;

  for (const board of liveBoards) {
    // liquidate the boards
    await executeLyraFunction(deploymentParams, 'OptionMarket', 'settleExpiredBoard', [board], market);
  }

  console.log('= exercisableBoardScenario Complete\n');
}

async function createSingleBoard(mockPrice: string) {
  const now = await currentTime();
  const basePrice = parseFloat(mockPrice);
  const longStrikes = [basePrice * 0.9, basePrice * 0.95, basePrice * 1.05, basePrice * 1.1].map(x => x.toString());
  return [
    {
      BaseIv: '1.3',
      Expiry: roundTimestamp(now + MONTH_SEC),
      Skews: ['1.02', '1', '1.02', '1.02'],
      Strikes: longStrikes,
    },
  ];
}

function roundTimestamp(timestamp: number) {
  const d = new Date(timestamp * 1000);
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  return d.getTime() / 1000;
}
