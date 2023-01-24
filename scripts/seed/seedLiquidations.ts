import { BigNumber } from 'ethers';
import { DeploymentParams } from '../util';
import {
  callLyraFunction,
  callExternalFunction,
  executeExternalFunction,
  getLyraContract,
  openPosition,
} from '../util/transactions';
import { currentTime, MAX_UINT, MONTH_SEC, OptionType, toBN, toBytes32, UNIT } from '../util/web3utils';
import { createBoards } from './createBoards';

// Places the AMM into a state where one board has multiple options that vary from liquidatable to insolvent.
export async function seedLiquidations(deploymentParams: DeploymentParams, market: string, price: string) {
  console.log('\n= seed liquidations...');

  if (deploymentParams.network != 'local') {
    throw new Error('invalid network for liquidatable positions');
  }

  await executeExternalFunction(deploymentParams, 'ProxyERC20sUSD', 'approve', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    MAX_UINT,
  ]);

  await executeExternalFunction(deploymentParams, 'Proxy' + market, 'approve', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    MAX_UINT,
  ]);

  console.log(
    'quote balance of user',
    await callExternalFunction(deploymentParams, 'ProxyERC20sUSD', 'balanceOf', [deploymentParams.deployer.address]),
  );

  console.log(
    'Base balance of user',
    await callExternalFunction(deploymentParams, 'Proxy' + market, 'balanceOf', [deploymentParams.deployer.address]),
  );

  const boards = await createWideBoard(price);
  await createBoards(deploymentParams, boards, market);

  const liveBoards = (await callLyraFunction(deploymentParams, 'OptionMarket', 'getLiveBoards', [], market)) as any;

  console.log(`Getting strikes for board ${liveBoards[0]}`);

  // open positions that should be liquidateable

  const board = (await callLyraFunction(deploymentParams, 'OptionMarketViewer', 'getBoard', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    liveBoards[0],
  ])) as any;
  const strikes = board.strikes;

  // Set price to 1/3rd
  await executeExternalFunction(deploymentParams, 'ExchangeRates', 'setRateAndInvalid', [
    toBytes32(market),
    toBN(price).div(3),
    false,
  ]);
  await openPosition(deploymentParams, market, {
    strikeId: strikes[0].strikeId,
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('10'),
    setCollateralTo: toBN(price).div(4).mul(10),
  });
  await openPosition(deploymentParams, market, {
    strikeId: strikes[0].strikeId,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: toBN('10'),
    setCollateralTo: toBN('5'),
  });

  // Set price to 3x
  await executeExternalFunction(deploymentParams, 'ExchangeRates', 'setRateAndInvalid', [
    toBytes32(market),
    toBN(price).mul(3),
    false,
  ]);
  const minCollat: BigNumber = await callLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'getMinCollateral',
    [OptionType.SHORT_PUT_QUOTE, strikes[2].strikePrice, board.expiry, toBN(price).mul(3), toBN('10')],
    market,
  );

  await openPosition(deploymentParams, market, {
    strikeId: strikes[2].strikeId,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: toBN('10'),
    setCollateralTo: minCollat.add(UNIT),
  });

  await executeExternalFunction(deploymentParams, 'ExchangeRates', 'setRateAndInvalid', [
    toBytes32(market),
    toBN(price),
    false,
  ]);

  console.log('= seed Liquidations Complete\n');
}

async function createWideBoard(mockPrice: string) {
  const now = await currentTime();
  const basePrice = parseFloat(mockPrice);
  const longStrikes = [basePrice * 0.33, basePrice, basePrice * 3].map(x => x.toString());
  return [
    {
      BaseIv: '1.3',
      Expiry: roundTimestamp(now + MONTH_SEC),
      Skews: ['1', '1', '1'],
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
