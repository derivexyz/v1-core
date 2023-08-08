import { BigNumber, Signer } from 'ethers';
import path from 'path';
import { copySynthetixDeploy } from '../../../scripts/util/parseFiles';
import { currentTime, toBN, toBytes32, UNIT } from '../../../scripts/util/web3utils';
import { TestSystemContractsType } from '../deployTestSystem';
import * as snxIntegration from 'synthetix/test/integration/utils/deploy';

export async function compileAndDeployRealSynthetix(compileSNX: boolean) {
  const synthsToAdd = [{ asset: 'USD' }];

  const network = 'local'; // changed from local
  const useOvm = false;
  const futuresMarketManager = true;

  const buildPath = path.join('.snx', 'contracts');
  const deploymentPath = '.snx';

  if (compileSNX) {
    await snxIntegration.compileInstance({
      useOvm,
      buildPath,
    });
  }
  try {
    console.log('snx integration', snxIntegration);
    await snxIntegration.prepareDeploy({ network, synthsToAdd, useOvm, useReleases: false, useSips: false });
  } catch (e: any) {
    console.log('snx integration error');
    console.log(e);
  }

  console.log('\ndeployInstance\n');
  await snxIntegration.deployInstance({
    addNewSynths: true,
    buildPath,
    deploymentPath,
    providerPort: 8545,
    providerUrl: 'http://localhost',
    useOvm,
    futuresMarketManager,
  });

  copySynthetixDeploy(path.join(deploymentPath, 'deployment.json'), network);
}

export async function setDebtLimit(c: TestSystemContractsType, maxDebt: BigNumber) {
  if (c.snx.collateralManager == undefined) {
    throw new Error('must deploy with mockSNX == false to debt limit realSNX rates');
  }
  await c.snx.collateralManager.setMaxDebt(maxDebt);
}

export async function swapForBase(c: TestSystemContractsType, amountToSwap: BigNumber, market: string) {
  await c.snx.synthetix.exchange(toBytes32('sUSD'), amountToSwap, toBytes32(market));
}

export async function mintsUSD(c: TestSystemContractsType, deployer: Signer, minRequired?: BigNumber) {
  await c.snx.synthetix['issueMaxSynths']();
  const bal: BigNumber = await c.snx.quoteAsset.balanceOf(deployer.getAddress());

  if (bal.lt(minRequired || 0)) {
    throw Error('Cannot mint enough sUSD, up SNX price or redeploy...');
  }
}

// market is sBase or SNX
export async function changeRate(c: TestSystemContractsType, price: BigNumber, market: string) {
  let aggregator: any;
  if (market == 'SNX') {
    aggregator = c.snx.snxMockAggregator;
  } else if (market == 'sUSD') {
    throw new Error('cannot change realSNX rate for sUSD');
  } else if (market == 'sETH') {
    aggregator = c.snx.ethMockAggregator;
  } else if (market == 'sBTC') {
    aggregator = c.snx.btcMockAggregator;
  } else {
    throw new Error('only sBTC and sETH supported for real SNX deployments');
  }
  // aggregator
  if (aggregator == undefined) {
    throw new Error('must deploy with mockSNX == false to change realSNX rates');
  }
  await aggregator.setLatestAnswer(price, await currentTime());
}

export async function mintBase(
  c: TestSystemContractsType,
  market: string,
  receiver: Signer,
  amount: BigNumber,
  useBTC?: boolean,
) {
  // deployer is the original caller of lyraCore.deploy()
  const rate = ((await c.snx.exchangeRates.rateForCurrency(toBytes32(market))) as BigNumber).div(UNIT).mul(toBN('1.1'));

  let quoteToSwap;
  if (useBTC) {
    quoteToSwap = amount.div(1e8).mul(rate);
  } else {
    quoteToSwap = amount.div(UNIT).mul(rate);
  }

  // rate = await callExternalFunction(deploymentParams, 'ExchangeRates', 'rateForCurrency', [toBytes32(market || 'SNX')]);
  // console.log('After rate:', fromBN(rate));
  await swapForBase(c, quoteToSwap, market);
  await c.snx.baseAsset.transfer(receiver.getAddress(), amount);
}

export async function mintQuote(
  testSystem: TestSystemContractsType,
  receiver: Signer,
  amount: BigNumber,
  useUSDC?: boolean,
) {
  // deployer is the original caller of lyraCore.deploy()
  if (useUSDC) {
    amount = amount.div(1e12); // convert to 6 decimals
  }
  await testSystem.snx.quoteAsset.transfer(receiver.getAddress(), amount);
}

export async function changeRates(c: TestSystemContractsType) {
  await changeRate(c, toBN('1000'), 'SNX');
  await changeRate(c, toBN('100'), 'sETH');
  await changeRate(c, toBN('1000'), 'sBTC');
}

// compileAndDeployRealSynthetix(false).then(console.log).catch(console.log);
