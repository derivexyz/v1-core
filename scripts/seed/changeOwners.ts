import { DeploymentParams } from '../util';
import { executeLyraFunction } from '../util/transactions';

export async function updateMarketOwners(deploymentParams: DeploymentParams, market: string, newOwner: string) {
  console.log(`Updating owner for market ${market} to ${newOwner}`);
  await executeLyraFunction(deploymentParams, 'LiquidityPool', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'LiquidityToken', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'OptionGreekCache', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'OptionMarket', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'OptionMarketPricer', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'OptionToken', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'GMXFuturesPoolHedger', 'nominateNewOwner', [newOwner], market);
  await executeLyraFunction(deploymentParams, 'ShortCollateral', 'nominateNewOwner', [newOwner], market);
}

export async function updateGlobalOwners(deploymentParams: DeploymentParams, newOwner: string) {
  console.log(`Updating SynthetixAdapter and LyraRegistry owner to ${newOwner}`);

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'nominateNewOwner', [newOwner]);
  await executeLyraFunction(deploymentParams, 'SynthetixAdapter', 'nominateNewOwner', [newOwner]);
  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'nominateNewOwner', [newOwner]);
  await executeLyraFunction(deploymentParams, 'OptionMarketViewer', 'nominateNewOwner', [newOwner]);
}
