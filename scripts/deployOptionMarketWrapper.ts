import { DeploymentType, getSelectedNetwork } from './util';
import { loadEnv } from './util/parseFiles';
import {
  deployLyraContract,
  execute,
  executeLyraFunction,
  getLyraContract,
  getExternalContract,
} from './util/transactions';
import { toBN, toBytes32, ZERO_ADDRESS } from './util/web3utils';
import { getDeployer } from './util/providers';

async function main() {
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);
  // const deployerAddr = await deployer.getAddress();
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.MockGmxMockPricing };
  const market = 'sETH';
  const marketId = 0;

  console.log(`Deploying OptionMarketWrapper to ${network}`);

  const wrapper = await deployLyraContract(deploymentParams, 'OptionMarketWrapper');

  await executeLyraFunction(deploymentParams, 'LyraRegistry', 'updateGlobalAddresses', [
    [toBytes32('MARKET_WRAPPER')],
    [wrapper.address],
  ]);

  await execute(wrapper, 'updateContractParams', [
    ZERO_ADDRESS,
    getExternalContract(deploymentParams, 'CurvePool').address,
    ZERO_ADDRESS,
    toBN('0.1'),
  ]);

  await execute(wrapper, 'addCurveStable', [getExternalContract(deploymentParams, 'ProxyERC20sUSD').address, 0]);
  await execute(wrapper, 'addCurveStable', [getExternalContract(deploymentParams, 'DAI').address, 1]);
  await execute(wrapper, 'addCurveStable', [getExternalContract(deploymentParams, 'USDC').address, 2]);

  await executeLyraFunction(deploymentParams, 'OptionMarketWrapper', 'addMarket', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    marketId,
    {
      optionToken: getLyraContract(deploymentParams, 'OptionToken', market).address,
      shortCollateral: getLyraContract(deploymentParams, 'ShortCollateral', market).address,
      baseAsset: getExternalContract(deploymentParams, 'Proxy' + market).address,
      quoteAsset: getExternalContract(deploymentParams, 'ProxyERC20sUSD').address,
    },
  ]);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
