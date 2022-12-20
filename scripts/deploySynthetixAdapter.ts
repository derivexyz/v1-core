import chalk from 'chalk';
import { DeploymentType, getSelectedNetwork } from './util';
import { loadEnv } from './util/parseFiles';
import { deployProxyWithLibraries } from './util/transactions';
import { getDeployer } from './util/providers';

async function main() {
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);
  // const deploymentParams = { network, mockSnx: false, realPricing: false, deployer };
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.SNX };

  console.log(`Deploying SynthetixAdapter linked to snx to ${network}`);

  await deployProxyWithLibraries(deploymentParams, 'SynthetixAdapter', 'SynthetixAdapter', undefined, undefined, []);

  console.log(chalk.greenBright('\n=== Successfully deployed! ===\n'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
