/* tslint:disable */
/* eslint-disable */
import chalk from 'chalk';
import dotenv from 'dotenv';
import { Contract } from 'ethers';
import fs from 'fs';
import path, { resolve } from 'path';
import { AllowedNetworks, DeploymentParams, EnvVars, SystemParams } from './index';

function isObject(obj: any) {
  return obj !== null && typeof obj === 'object';
}

export class ParamHandler {
  default: SystemParams;
  overrides: SystemParams;

  constructor(_default: SystemParams, _overrides: SystemParams) {
    this.default = _default;
    this.overrides = _overrides;
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
    const defaultVal = this.getRecursive(this.default, ...keys);
    const override = this.getRecursive(this.overrides, ...keys);
    return override != undefined ? override : defaultVal;
  }

  getObj(...keys: string[]): any {
    const defaultObj = this.getRecursive(this.default, ...keys);
    const overrideObj = this.getRecursive(this.overrides, ...keys);

    const obj = {
      ...(defaultObj || {}),
      ...(overrideObj || {}),
    };

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
  const defaultParams = require(path.join(
    __dirname,
    '../../deployments',
    deploymentParams.network,
    'params.default.json',
  ));
  const overrides = require(path.join(
    __dirname,
    '../../deployments',
    deploymentParams.network,
    `params${deploymentParams.mockSnx ? (deploymentParams.realPricing ? '.realPricing' : '.mockSnx') : ''}.json`,
  ));

  return new ParamHandler(defaultParams, overrides);
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
    txn: c.deployTransaction?.hash,
    blockNumber: c.deployTransaction?.blockNumber || 0,
  };
}

export async function getContractsWithBlockNumber(c: Contract, name: string, source?: string) {
  const details = getContractDetails(c, name, source || name);
  const receipt = await c.deployTransaction?.wait();
  details.blockNumber = receipt?.blockNumber || details.blockNumber || 0;

  return details;
}

export function getContractArtifact(network: AllowedNetworks, contractName: string, artifactPath?: string) {
  // basePath = '../../artifacts/contracts';

  artifactPath = artifactPath || path.join(__dirname, '../../artifacts/contracts');

  try {
    return require(path.join(artifactPath, contractName + '.sol', contractName + '.json'));
  } catch (e) {}
  try {
    return require(path.join(artifactPath, 'periphery', contractName + '.sol', contractName + '.json'));
  } catch (e) {}
  try {
    return require(path.join(artifactPath, 'periphery', 'Wrapper', contractName + '.sol', contractName + '.json'));
  } catch (e) {}
  try {
    return require(path.join(artifactPath, 'synthetix', contractName + '.sol', contractName + '.json'));
  } catch (e) {}
  try {
    return require(path.join(artifactPath, 'test-helpers', contractName + '.sol', contractName + '.json'));
  } catch (e) {}
  try {
    return require(path.join(artifactPath, 'lib', contractName + '.sol', contractName + '.json'));
  } catch (e) {}
  throw new Error('Contract ' + contractName + ' not found');
}

export function addMockedSnxContract(
  deploymentParams: DeploymentParams,
  name: string,
  contractName: string,
  contract: Contract,
) {
  const filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'synthetix.mocked.json');
  let addresses: any;
  try {
    addresses = require(filePath);
  } catch (e) {
    addresses = { targets: {}, sources: {} };
  }
  addresses.targets[name] = getContractDetails(contract, contractName);

  // contract.interface.
  addresses.sources[contractName] = getContractArtifact(deploymentParams.network, contractName);
  saveFile(deploymentParams.network, filePath, addresses);
  console.log(chalk.grey(`Saved contract ${name} to ${filePath}`));
}

export function addLyraContract(deploymentParams: DeploymentParams, name: string, contract: Contract, market?: string) {
  const filePath = path.join(
    __dirname,
    '../../deployments',
    deploymentParams.network,
    'lyra' + (deploymentParams.mockSnx ? (deploymentParams.realPricing ? '.realPricing' : '.mockSnx') : '') + '.json',
  );
  let data: any;
  try {
    data = require(filePath);
  } catch (e) {
    data = { targets: {}, sources: {} };
  }
  if (!market) {
    data.targets[name] = getContractDetails(contract, name);
  } else {
    if (!data.targets.markets) {
      data.targets.markets = {};
    }
    if (!data.targets.markets[market]) {
      data.targets.markets[market] = {};
    }
    data.targets.markets[market][name] = getContractDetails(contract, name);
  }
  data.sources[name] = getContractArtifact(deploymentParams.network, name);
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

export function loadLyraContractData(deploymentParams: DeploymentParams, name: string, market?: string) {
  const filePath = path.join(
    __dirname,
    '../../deployments',
    deploymentParams.network,
    'lyra' + (deploymentParams.mockSnx ? (deploymentParams.realPricing ? '.realPricing' : '.mockSnx') : '') + '.json',
  );
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

export function loadSynthetixContractData(deploymentParams: DeploymentParams, name: string) {
  let filePath;
  if (!deploymentParams.mockSnx || (['Exchanger', 'ExchangeRates'].includes(name) && deploymentParams.realPricing)) {
    filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'synthetix.json');
  } else {
    filePath = path.join(__dirname, '../../deployments', deploymentParams.network, 'synthetix.mocked.json');
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
    'lyra' + (deploymentParams.mockSnx ? (deploymentParams.realPricing ? '.realPricing' : '.mockSnx') : '') + '.json',
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
