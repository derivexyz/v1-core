import chalk from 'chalk';
import { DeploymentType, getSelectedNetwork } from './util';
import { loadEnv, loadParams } from './util/parseFiles';
import { getDeployer } from './util/providers';
import { deployGMXGovernanceWrapper, ownershipTransferWrappers } from './deploy/deployGMXGovernanceWrappers';

async function main() {
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.GMX };
  const params = loadParams(deploymentParams);

  await deployGMXGovernanceWrapper(deploymentParams, params);
  await ownershipTransferWrappers(deploymentParams, params);

  console.log(chalk.greenBright('\n=== Successfully seeded! ===\n'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
