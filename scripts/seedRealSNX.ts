import chalk from 'chalk';
import { seedContracts } from './seed/seedContracts';
import { DeploymentType, getSelectedNetwork } from './util';
import { loadEnv, loadParams } from './util/parseFiles';
import { getDeployer } from './util/providers';

async function main() {
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);
  // const deploymentParams = { network, deployer, mockSnx: false, realPricing: false };
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.SNX };
  const params = loadParams(deploymentParams);

  await seedContracts(deploymentParams, params);

  console.log(chalk.greenBright('\n=== Successfully seeded! ===\n'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
