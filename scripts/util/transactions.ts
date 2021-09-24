import chalk from 'chalk';
import { Contract } from 'ethers';
import { getNetworkProvider, Params } from './index';
import { loadLyraContractData, loadSynthetixContractData } from './parseFiles';

const contracts: any = {};

export async function getLyraContract(params: Params, contractName: string, market?: string): Promise<Contract> {
  if (!!market && !!contracts.markets && !!contracts.markets[market] && !!contracts.markets[market][contractName]) {
    return contracts.markets[market][contractName];
  }
  if (contracts[contractName]) {
    return contracts[contractName];
  }

  const data = loadLyraContractData(params, contractName, market);

  const contract = new Contract(
    data.target.address,
    data.source.abi,
    params.wallet || getNetworkProvider(params.network),
  );
  if (market) {
    if (!contracts.markets) {
      contracts.markets = {};
    }
    if (!contracts.markets[market]) {
      contracts.markets[market] = {};
    }
    contracts.markets[market][contractName] = contract;
  } else {
    contracts[contractName] = contract;
  }

  return contract;
}

export async function getSynthetixContract(params: Params, contractName: string): Promise<Contract> {
  if (contracts[contractName]) {
    return contracts[contractName];
  }

  const data = loadSynthetixContractData(params, contractName);

  const contract = new Contract(
    data.target.address,
    data.source.abi,
    params.wallet || getNetworkProvider(params.network),
  );
  contracts[contractName] = contract;
  return contract;
}

export async function callLyraFunction(
  deploymentParams: Params,
  contractName: string,
  fn: string,
  args: any[],
  market?: string,
): Promise<any> {
  const contract = await getLyraContract(deploymentParams, contractName, market);
  console.log(chalk.grey(`Calling ${fn} on ${contract.address} with args ${args}`));
  return await contract[fn](...args);
}

export async function callSynthetixFunction(
  deploymentParams: Params,
  contractName: string,
  fn: string,
  args: any[],
): Promise<any> {
  const contract = await getSynthetixContract(deploymentParams, contractName);
  console.log(chalk.grey(`Calling ${fn} on ${contract.address} with args ${args}`));
  return await contract[fn](...args);
}
