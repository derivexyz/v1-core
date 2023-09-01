import { DeploymentParams } from '../util';
import { executeExternalFunction } from '../util/transactions';
import { ParamHandler } from '../util/parseFiles';
import { toBN } from '../util/web3utils';

export async function seedMint(deploymentParams: DeploymentParams, params: ParamHandler, market: string) {
  const quoteDecimals = params.get('QuoteDecimals');
  const baseDecimals = params.get('Markets', market, 'BaseDecimals');
  const mintParams = params.getObj('Seed', 'mintFunds');

  console.log('market', market);
  console.log('params.get("Markets", market, "BaseAsset")', params.get('Markets', market, 'BaseAsset'));
  console.log('just get markets', params.get('Markets'));

  const quoteTicker = params.get('QuoteAsset');
  const baseTicker = params.get('Markets', market, 'BaseAsset');

  ////
  // Setup balances and approvals for opening positions
  ////
  console.log(`\n= Minting balances for market ${market}`);

  const quoteAmount = mintParams.markets[market].quoteAmount;
  const baseAmount = mintParams.markets[market].baseAmount;
  // Mint tokens
  await executeExternalFunction(deploymentParams, quoteTicker, 'mint', [
    deploymentParams.deployer.address,
    toBN(quoteAmount, quoteDecimals),
  ]);

  console.log(`Minting ${baseAmount} ${market}`);
  // await executeExternalFunction(deploymentParams, baseTicker, 'mint', [
  //   deploymentParams.deployer.address,
  //   BigNumber.from('10').pow(baseDecimals).mul(baseAmount),
  // ]);
  console.log('Base ticker', baseTicker);
  await executeExternalFunction(deploymentParams, baseTicker, 'mint', [
    deploymentParams.deployer.address,
    toBN(baseAmount, baseDecimals),
  ]);

  console.log('= Seeding balances done');
}
