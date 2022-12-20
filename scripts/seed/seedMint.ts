import { DeploymentParams } from '../util';
import { executeExternalFunction } from '../util/transactions';
import { ParamHandler } from '../util/parseFiles';
import { BigNumber } from 'ethers';

export async function seedMint(deploymentParams: DeploymentParams, params: ParamHandler, market: string) {
  const quoteTicker = params.get('QuoteTicker');
  const quoteDecimals = params.get('QuoteDecimals');
  const baseTicker = params.get('Markets', market, 'BaseTicker');
  const baseDecimals = params.get('Markets', market, 'BaseDecimals');
  const mintParams = params.getObj('Seed', 'mintFunds');

  console.log({
    quoteTicker,
    baseTicker,
    mintParams,
  });
  ////
  // Setup balances and approvals for opening positions
  ////
  console.log(`\n= Minting balances for market ${market}`);

  const quoteAmount = mintParams.markets[market].quoteAmount;
  const baseAmount = mintParams.markets[market].baseAmount;
  // Mint tokens
  console.log(`Minting ${quoteAmount} ${quoteTicker}`);
  await executeExternalFunction(deploymentParams, quoteTicker, 'mint', [
    deploymentParams.deployer.address,
    BigNumber.from('10').pow(quoteDecimals).mul(quoteAmount),
  ]);

  console.log(`Minting ${baseAmount} ${market}`);
  await executeExternalFunction(deploymentParams, baseTicker, 'mint', [
    deploymentParams.deployer.address,
    BigNumber.from('10').pow(baseDecimals).mul(baseAmount),
  ]);

  console.log('= Seeding balances done');
}
