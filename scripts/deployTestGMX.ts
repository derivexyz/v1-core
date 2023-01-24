import chalk from 'chalk';
import { deployGMXContracts } from './deploy/deployGMXContracts';
import { DeploymentType, getSelectedNetwork } from './util';
import { loadEnv, loadParams } from './util/parseFiles';
import { getDeployer } from './util/providers';

async function main() {
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.MockGmxMockPricing };
  const params = loadParams(deploymentParams);

  console.log(`Deploying contracts with mocked snx to ${network}`);

  await deployGMXContracts(deploymentParams, params);

  console.log(chalk.greenBright('\n=== Successfully deployed! ===\n'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
