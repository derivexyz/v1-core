import { DeploymentParams } from '../util';
import { executeLyraFunction, executeExternalFunction, getLyraContract } from '../util/transactions';
import { fromBN, toBN } from '../util/web3utils';
import { ParamHandler } from '../util/parseFiles';

export async function seedDeposit(deploymentParams: DeploymentParams, params: ParamHandler, market: string) {
  console.log(`\n= Depositing to LP for market ${market}`);

  const quoteTicker = params.get('QuoteAsset');

  const depositParams = params.get('Seed', 'deposit');
  const quoteDecimals = params.get('QuoteDecimals');

  const amount = toBN(depositParams.markets[market].quoteAmount, quoteDecimals);

  console.log('amount', amount);
  console.log(`Approving LP for ${fromBN(amount)} sUSD`);
  await executeExternalFunction(deploymentParams, quoteTicker, 'approve', [
    getLyraContract(deploymentParams, 'LiquidityPool', market).address,
    amount,
  ]);

  console.log(`Fund LP with ${amount} sUSD`);

  await executeLyraFunction(
    deploymentParams,
    'LiquidityPool',
    'initiateDeposit',
    [deploymentParams.deployer.address, amount],
    market,
  );

  await executeLyraFunction(deploymentParams, 'LiquidityPool', 'processDepositQueue', [10], market);

  console.log(`= Depositing for market ${market} done`);
}
