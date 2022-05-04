import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { allNetworks } from './util';
import { copySynthetixDeploy, loadEnv } from './util/parseFiles';

async function main() {
  const envVars = loadEnv('local');

  let baseDir = envVars.SYNTHETIX_LOCATION || '~/Synthetix';
  if (baseDir[0] === '~') {
    baseDir = path.join(process.env.HOME || '', baseDir.slice(1));
  }

  if (!fs.existsSync('deployments/')) {
    fs.mkdirSync('deployments/');
  }

  for (const network of allNetworks) {
    console.log(chalk.grey(`Processing ${network}`));
    const deployDir = path.join(baseDir, 'publish/deployed', network, 'deployment.json');
    copySynthetixDeploy(deployDir, network);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
