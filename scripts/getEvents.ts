import chalk from 'chalk';
import { getTradeVolume } from './events';
import { DeploymentType, getSelectedNetwork } from './util';
import { loadEnv } from './util/parseFiles';
import { getDeployer } from './util/providers';

async function main() {
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);
  // const deploymentParams = { network, deployer, mockSnx: false, realPricing: true };
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.GMX };
  // const params = loadParams(deploymentParams);

  const x = await getTradeVolume(deploymentParams, ['sETH']);

  console.log({ x });

  console.log(chalk.greenBright('\n=== Successfully seeded! ===\n'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
