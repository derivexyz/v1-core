import { BigNumber } from 'ethers';
import { GlobalCacheStruct } from '../../typechain-types/OptionGreekCache';
import { DeploymentParams } from '../util';
import { callLyraFunction } from '../util/transactions';
import { fromBN } from '../util/web3utils';

export async function hedgeDelta(deploymentParams: DeploymentParams, market: string) {
  console.log(`\n= Hedging market ${market}`);

  const globalCache = (await callLyraFunction(
    deploymentParams,
    'OptionGreekCache',
    'getGlobalCache',
    [],
    market,
  )) as GlobalCacheStruct;

  console.log(`Current netDelta: ${fromBN(globalCache.netGreeks.netDelta)}`);
  console.log(`Current netStdVega: ${fromBN(globalCache.netGreeks.netStdVega)}`);
  //
  // console.log('Opening short account...');
  // try {
  //   await executeLyraFunction(deploymentParams, 'ShortPoolHedger', 'openShortAccount', [], market);
  // } catch (e) {
  //   console.log('Not able to openShortAccount');
  //   console.log(e);
  // }

  // await executeLyraFunction(deploymentParams, 'GMXFuturesPoolHedger', 'hedgeDelta', [], market, deploymentParams.deployer, {value: toBN('0.005')});
  const currentHedgedNetDelta = (await callLyraFunction(
    deploymentParams,
    'GMXFuturesPoolHedger',
    'getCurrentHedgedNetDelta',
    [],
    market,
  )) as BigNumber;
  console.log(`Current netDelta: ${fromBN(BigNumber.from(globalCache.netGreeks.netDelta))}`);
  console.log(`Current netStdVega: ${fromBN(BigNumber.from(globalCache.netGreeks.netStdVega))}`);

  console.log('Current poolHedger position:', fromBN(currentHedgedNetDelta));

  console.log('= Hedging complete');
}
