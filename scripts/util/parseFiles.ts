/* tslint:disable */
/* eslint-disable */
import chalk from 'chalk';
import dotenv from 'dotenv';
import { Contract } from 'ethers';
import fs from 'fs';
import path, { resolve } from 'path';
import {
  AllowedNetworks,
  DeploymentParams,
  DeploymentType,
  EnvVars,
  isMockGmx,
  isMockSnx,
  SystemParams,
} from './index';

function isObject(obj: any) {
  return obj !== null && typeof obj === 'object';
}

export class ParamHandler {
  params: SystemParams;

  constructor(_params: SystemParams) {
    this.params = _params;
  }

  getRecursive(val?: any, ...keys: string[]): any {
    if (keys.length == 0) {
      if (val === undefined) {
        return null;
      }
      return val;
    }

    const nextKey = keys[0];

    if (val[nextKey] === undefined) {
      return null;
    }

    return this.getRecursive(val[nextKey], ...keys.slice(1));
  }

  get(...keys: string[]): any {
    return this.getRecursive(this.params, ...keys);
  }

  getObj(...keys: string[]): any {
    const obj = this.getRecursive(this.params, ...keys);

    if (!isObject(obj)) {
      console.log('warning: no object for', keys);
      return {};
    }
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = this.get(...keys, key);
    }
    return res;
  }
}

export function loadParams(deploymentParams: DeploymentParams): ParamHandler {
  console.log(deploymentParams.deploymentType);
  const params = require(path.join(
    __dirname,
    '../../deployments',
    deploymentParams.network,
    `params.${deploymentParams.deploymentType}.json`,
  ));
  
  console.log('params', params);
  return new ParamHandler(params);
}

export function loadEnv(network: AllowedNetworks): EnvVars {
  const defaultEnv = dotenv.config({
    path: 'deployments/.env.defaults',
  }) as any;

  const pubEnv = dotenv.config({
    path: path.join('deployments', network, '.env.public'),
  }) as any;

  const defaultPrivEnv = dotenv.config({
    path: path.join('deployments', '.env.private'),
  }) as any;

  const privEnv = dotenv.config({
    path: path.join('deployments', network, '.env.private'),
  }) as any;

  return {
    ...defaultEnv.parsed,
    ...pubEnv.parsed,
    ...defaultPrivEnv.parsed,
    ...privEnv.parsed,
  };
}

export function getContractDetails(c: Contract, name: string, source?: string) {
  return {
    contractName: name,
    source: source || name,
    address: c.address,
    // TODO: hacky skip
    txn: c.deployTransaction?.hash || '',
    blockNumber: c.deployTransaction?.blockNumber || 0,
  };
}

export async function getContractsWithBlockNumber(c: Contract, name: string, source?: string) {
  const details = getContractDetails(c, name, source || name);
  const receipt = await c.deployTransaction?.wait();
  details.blockNumber = receipt?.blockNumber || details.blockNumber || 0;

  return details;
}


export function getContractArtifactRecursive(network: AllowedNetworks, contractName: string, artifactPath: string): string | null {
  const files = fs.readdirSync(artifactPath);
  for (const file of files) {
    const joinedPath = path.join(artifactPath, file);
    if (fs.statSync(joinedPath).isDirectory()) {
      if (file === contractName + '.sol') {
        return require(path.resolve(joinedPath, contractName + '.json'));
      } else {
        const res: string | null = getContractArtifactRecursive(network, contractName, joinedPath)
        if (res) {
          return res;
        }
      }
    }
  }
  return null;
}


export function getContractArtifact(network: AllowedNetworks, contractName: string, artifactPath?: string) {
  artifactPath = artifactPath || './artifacts';
  const res = getContractArtifactRecursive(network, contractName, artifactPath);
  if (!res) {
    throw new Error(`Could not find artifact for ${contractName}`);
  }
  return res;
}

export function addMockedExternalContract(
  deploymentParams: DeploymentParams,
  name: string,
  contractName: string,
  contract: Contract,
  filePath?: string,
  artifactPath?: string,
) {
  if (deploymentParams.deploymentType == DeploymentType.SNXCannon) {
    console.log('NOT SAVING MOCKED EXTERNAL CONTRACT FOR CANNON DEPLOYMENT');
    return;
  }
  if (filePath === undefined) {
    filePath = path.join(
      __dirname,
      '../../deployments',
      deploymentParams.network,
      `external.mocked.${deploymentParams.deploymentType}.json`,
    );
  }
  let addresses: any;
  try {
    addresses = require(filePath);
  } catch (e) {
    addresses = { targets: {}, sources: {} };
  }
  addresses.targets[name] = getContractDetails(contract, contractName);

  // contract.interface.
  addresses.sources[contractName] = getContractArtifact(deploymentParams.network, contractName, artifactPath);
  saveFile(deploymentParams.network, filePath, addresses);
  console.log(chalk.grey(`Saved contract ${name} to ${filePath}`));
}

export function addLyraContract(
  deploymentParams: DeploymentParams,
  source: string,
  contract: Contract,
  market?: string,
  filePath?: string,
  artifactPath?: string,
  name?: string,
) {
  if (filePath === undefined) {
    filePath = path.join(
      __dirname,
      '../../deployments',
      deploymentParams.network,
      `lyra.${deploymentParams.deploymentType}.json`,
    );
  }
  console.log({ name, source });
  name = name || source;

  let data: any;
  try {
    data = require(filePath);
  } catch (e) {
    data = { targets: {}, sources: {} };
  }
  if (!market) {
    data.targets[name] = getContractDetails(contract, name, source);
  } else {
    if (!data.targets.markets) {
      data.targets.markets = {};
    }
    if (!data.targets.markets[market]) {
      data.targets.markets[market] = {};
    }
    data.targets.markets[market][name] = getContractDetails(contract, name, source);
  }

  data.sources[source] = getContractArtifact(deploymentParams.network, source, artifactPath);
  saveFile(deploymentParams.network, filePath, data);
  console.log(chalk.grey(`Saved contract ${name} to ${filePath}`));
}

// to allow for deploying contracts that have references else where
export function addEmptyContract(
  deploymentParams: DeploymentParams,
  source: string,
  name: string,
  toSave: any,
  market?: string,
  filePath?: string,
  artifactPath?: string,
) {
  if (filePath === undefined) {
    filePath = path.join(
      __dirname,
      '../../deployments',
      deploymentParams.network,
      `lyra.${deploymentParams.deploymentType}.json`,
    );
  }
  console.log({ name, source });
  name = name || source;

  let data: any;
  try {
    data = require(filePath);
  } catch (e) {
    data = { targets: {}, sources: {} };
  }
  if (!market) {
    data.targets[name] = toSave;
  } else {
    if (!data.targets.markets) {
      data.targets.markets = {};
    }
    if (!data.targets.markets[market]) {
      data.targets.markets[market] = {};
    }
    data.targets.markets[market][name] = toSave;
  }

  data.sources[source] = {};
  saveFile(deploymentParams.network, filePath, data);
  console.log(chalk.grey(`Saved contract ${name} to ${filePath}`));
}

function saveFile(network: string, filePath: string, data: any) {
  if (!fs.existsSync('deployments/')) {
    fs.mkdirSync('deployments/');
  }

  if (!fs.existsSync(path.join('deployments', network))) {
    fs.mkdirSync(path.join('deployments', network));
  }

  fs.writeFileSync(filePath, JSON.stringify(data, undefined, 2));
}

export function loadLyraContractData(
  deploymentParams: DeploymentParams,
  name: string,
  market?: string,
  filePath?: string,
) {
  if (filePath === undefined) {
    filePath = path.join(
      __dirname,
      '../../deployments',
      deploymentParams.network,
      `lyra.${deploymentParams.deploymentType}.json`,
    );
  }
  const data = require(filePath);
  try {
    if (market) {
      return {
        target: data.targets.markets[market][name],
        source: data.sources[data.targets.markets[market][name].source],
      };
    }
    return {
      target: data.targets[name],
      source: data.sources[data.targets[name].source],
    };
  } catch (e) {
    console.log({ filePath, name, market, deploymentParams });
    throw e;
  }
}

export function loadExternalContractData(
  deploymentParams: DeploymentParams,
  name: string,
  mockOverride?: boolean,
  filePath?: string,
) {
  if (deploymentParams.deploymentType == DeploymentType.SNXCannon) {
    const data = require(path.join(__dirname, '../../.cannon-deployment', `${name}.json`));

    return {
      source: {
        abi: data.abi,
      },
      target: {
        address: data.address,
      },
    };
  }

  if (filePath === undefined) {
    if (mockOverride === true) {
      filePath = path.join(
        __dirname,
        '../../deployments',
        deploymentParams.network,
        `external.mocked.${deploymentParams.deploymentType}.json`,
      );
    } else if (mockOverride === false) {
      filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'external.json');
    } else if (isMockSnx(deploymentParams.deploymentType) || isMockGmx(deploymentParams.deploymentType)) {
      filePath = path.join(
        __dirname,
        '../../deployments',
        deploymentParams.network,
        `external.mocked.${deploymentParams.deploymentType}.json`,
      );
    } else {
      filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'external.json');
    }
  }
  const data = require(filePath);

  try {
    const source = data.targets[name].source;
    return {
      target: data.targets[name],
      // Treat proxy as Synth
      source: data.sources[source == 'ProxyERC20' ? 'MultiCollateralSynth' : data.targets[name].source],
    };
  } catch (e) {
    console.log({ filePath, name, deploymentParams });
    throw e;
  }
}

export function clearLyraContracts(deploymentParams: DeploymentParams) {
  const filePath = path.join(
    __dirname,
    '../../deployments',
    deploymentParams.network,
    `lyra.${deploymentParams.deploymentType}.json`,
  );
  fs.writeFileSync(filePath, '');
}

export function copySynthetixDeploy(snxDeployDir: string, network: string) {
  const lyraDeployDir = resolve(path.join('.lyra', 'local'));
  if (!fs.existsSync(lyraDeployDir)) {
    fs.mkdirSync(lyraDeployDir, { recursive: true });
  }
  try {
    fs.copyFileSync(snxDeployDir, path.join(lyraDeployDir, 'real-synthetix.json'));
  } catch (e) {
    console.log(chalk.yellow(`Skipping ${network} - no deployed synthetix found`));
  }
}

/* tslint:enable */
/* eslint-enable */
