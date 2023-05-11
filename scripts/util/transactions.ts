import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import chalk from 'chalk';
import { BigNumberish, Contract, ContractFactory, ContractTransaction, PopulatedTransaction, Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { TradeInputParametersStruct } from '../../typechain-types/OptionMarket';
import { DeploymentParams, DeploymentType } from './index';
import {
  addLyraContract,
  addMockedExternalContract,
  loadExternalContractData,
  loadLyraContractData,
} from './parseFiles';
import { etherscanVerification } from './verification';
import { fromBN, getEventArgs, MAX_UINT128, OptionType, ZERO_ADDRESS } from './web3utils';

const contracts: any = {};

export function getLyraContract(deploymentParams: DeploymentParams, contractName: string, market?: string): Contract {
  if (!!market && !!contracts.markets && !!contracts.markets[market] && !!contracts.markets[market][contractName]) {
    return contracts.markets[market][contractName];
  }
  if (!market && contracts[contractName]) {
    return contracts[contractName];
  }

  const data = loadLyraContractData(deploymentParams, contractName, market);

  const contract = new Contract(data.target.address, data.source.abi, deploymentParams.deployer);
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

export function getExternalContract(
  deploymentParams: DeploymentParams,
  contractName: string,
  contractAbiOverride?: string,
  useReal = false,
): Contract {
  if (contracts[contractName] && !contractAbiOverride) {
    return contracts[contractName];
  }
  useReal =
    useReal ||
    (deploymentParams.deploymentType == DeploymentType.MockSnxRealPricing &&
      ['Exchanger', 'ExchangeRates'].includes(contractName));

  console.log({ useReal, contractName });

  const data = loadExternalContractData(deploymentParams, contractName, useReal ? false : undefined);
  let abi = data.source.abi;
  if (contractAbiOverride) {
    const overrideData = loadExternalContractData(deploymentParams, contractAbiOverride, useReal ? false : undefined);
    abi = overrideData.source.abi;
  }
  const contract = new Contract(data.target.address, abi, deploymentParams.deployer);
  contracts[contractName] = contract;
  return contract;
}

export async function deployLyraContract(
  deploymentParams: DeploymentParams,
  contractName: string,
  market?: string,
  ...args: any
): Promise<Contract> {
  const contract = await deployContract(contractName, deploymentParams.deployer, undefined, ...args);
  addLyraContract(deploymentParams, contractName, contract, market);
  return contract;
}

export async function deployLyraContractWithLibraries(
  deploymentParams: DeploymentParams,
  contractName: string,
  market?: string,
  libs?: any,
  ...args: any
): Promise<Contract> {
  const contract = await deployContract(contractName, deploymentParams.deployer, libs, ...args);
  addLyraContract(deploymentParams, contractName, contract, market);
  return contract;
}

export async function deployProxyWithLibraries(
  deploymentParams: DeploymentParams,
  source: string,
  contractName: string,
  market?: string,
  libs?: any,
  ...args: any
): Promise<Contract> {
  const contract = await deployProxyContract(source, deploymentParams.deployer, libs, ...args);
  // TODO:
  //  addLyraContract(deploymentParams, contractName + 'Proxy', contract, market);
  addLyraContract(deploymentParams, source, contract, market, undefined, undefined, contractName);
  return contract;
}

export async function deployMockExternalContract(
  deploymentParams: DeploymentParams,
  name: string,
  contractName: string,
  ...args: any
): Promise<Contract> {
  const contract = await deployContract(contractName, deploymentParams.deployer, undefined, ...args);
  addMockedExternalContract(deploymentParams, name, contractName, contract);
  return contract;
}

export async function deployMockExternalContractWithLibraries(
  deploymentParams: DeploymentParams,
  name: string,
  contractName: string,
  libs?: any,
  ...args: any
): Promise<Contract> {
  const contract = await deployContract(contractName, deploymentParams.deployer, libs, ...args);
  console.log(name, contractName);
  addMockedExternalContract(deploymentParams, name, contractName, contract);
  return contract;
}

export async function deployProxyContract(
  contractName: string,
  deployer: Signer,
  libs?: any,
  ...args: any
): Promise<Contract> {
  console.log('='.repeat(24));
  console.log(`= Deploying ${contractName}`);
  console.log(`= With args: ${args}`);
  let contract: Contract;
  let implementation: ContractFactory;
  let implementationAddress: string;
  let count = 2;
  console.log('deployer', deployer);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      implementation = (await ethers.getContractFactory(contractName, { libraries: libs })).connect(deployer);
      
      // proxy deployment: deployProxy automatically runs initialize()
      contract = await upgrades.deployProxy(implementation, ...args);
      await contract.deployed();
      console.log('= Proxy Address:', chalk.green(contract.address));

      // all proxy/implementation deployment details in root '.openzeppelin' folder
      implementationAddress = await getImplementationAddress(ethers.provider, contract.address);
      console.log('= Implementation Address:', chalk.green(implementationAddress));

      (global as any).hashes.push(contract.deployTransaction.hash);
      console.log('= Tx hash:', chalk.blueBright(contract.deployTransaction.hash));
      console.log('= Nonce:', contract.deployTransaction.nonce);

      while ((await ethers.provider.getTransactionReceipt(contract.deployTransaction.hash)) == null) {
        await sleep(100);
      }
      const receipt = await contract.deployTransaction.wait();
      contract.deployTransaction.blockNumber = contract.deployTransaction.blockNumber || receipt.blockNumber;
      break;
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message.slice(0, 27));
        if (e.message.slice(0, 27) == 'nonce has already been used') {
          continue;
        }
        count--;
        if (count > 0) {
          continue;
        }
        throw e;
      }
    }
  }

  console.log('= Size:', contract.deployTransaction.data.length);
  console.log('='.repeat(24));

  if (!(global as any).pending) {
    (global as any).pending = [];
  }
  (global as any).pending.push(etherscanVerification(contract.address, [...args]));
  (global as any).pending.push(etherscanVerification(implementationAddress, [...args]));
  return contract;
}

export async function deployContract(
  contractName: string,
  deployer: Signer,
  libs?: any,
  ...args: any
): Promise<Contract> {
  console.log('='.repeat(24));
  console.log(`= Deploying ${contractName}`);
  console.log(`= With args: ${args}`);
  let contract: Contract;
  let count = 0;
  console.log('args', args);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      contract = await (
        await ethers.getContractFactory(contractName, {
          libraries: libs,
        })
      )
        .connect(deployer)
        .deploy(...args, {
          gasLimit: 15000000,
          gasPrice: 1000000000,
        });

      console.log('= Address:', chalk.green(contract.address));

      (global as any).hashes.push(contract.deployTransaction.hash);
      console.log('= Tx hash:', chalk.blueBright(contract.deployTransaction.hash));
      console.log('= Nonce:', contract.deployTransaction.nonce);

      while ((await ethers.provider.getTransactionReceipt(contract.deployTransaction.hash)) == null) {
        await sleep(100);
      }
      const receipt = await contract.deployTransaction.wait();
      contract.deployTransaction.blockNumber = contract.deployTransaction.blockNumber || receipt.blockNumber;
      break;
    } catch (e) {
      console.log(e);
      if (e instanceof Error) {
        console.log(e.message.slice(0, 27));
        if (e.message.slice(0, 27) == 'nonce has already been used') {
          continue;
        }
        count--;
        if (count > 0) {
          continue;
        }
        throw e;
      }
    }
  }

  console.log('= Size:', contract.deployTransaction.data.length);
  console.log('='.repeat(24));

  if (!(global as any).pending) {
    (global as any).pending = [];
  }
  (global as any).pending.push(etherscanVerification(contract.address, [...args]));
  return contract;
}

export async function populateLyraFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
  market?: string,
  signer?: Signer,
): Promise<PopulatedTransaction> {
  let contract = getLyraContract(deploymentParams, contractName, market);
  if (signer) {
    contract = contract.connect(signer);
  }
  return contract.populateTransaction[fn](args);
}

export async function executeLyraFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
  market?: string,
  signer?: Signer,
  overrides?: any,
): Promise<ContractTransaction> {
  const contract = getLyraContract(deploymentParams, contractName, market);
  return await execute(signer ? contract.connect(signer) : contract, fn, args, overrides);
}

export async function executeExternalFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
  signer?: Signer,
): Promise<ContractTransaction> {
  const contract = getExternalContract(deploymentParams, contractName);
  return await execute(signer ? contract.connect(signer) : contract, fn, args);
}

export async function callLyraFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
  market?: string,
): Promise<any> {
  const contract = getLyraContract(deploymentParams, contractName, market);
  console.log(chalk.grey(`Calling ${fn} on ${contract.address} with args ${args}`));
  return await contract[fn](...args);
}

export async function callExternalFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
): Promise<any> {
  const contract = getExternalContract(deploymentParams, contractName);
  console.log(chalk.grey(`Calling ${fn} on ${contract.address} with args ${args}`));
  return await contract[fn](...args);
}

export async function execute(c: Contract, fn: string, args: any[], overrides: any = {}): Promise<ContractTransaction> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log(chalk.grey(`Executing ${fn} on ${c.address} with args ${JSON.stringify(args)}`));
      overrides = { gasLimit: 15000000, ...overrides }; // TODO: ok to leave like this?
      const tx = await c[fn](...args, overrides);
      while ((await ethers.provider.getTransactionReceipt(tx.hash)) == null) {
        await sleep(100);
      }
      const receipt = await tx.wait();
      console.log(`Gas used for tx ${chalk.blueBright(receipt.transactionHash)}:`, receipt.gasUsed.toNumber());
      return tx;
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message.slice(0, 27));
        if (e.message.slice(0, 27) == 'nonce has already been used') {
          continue;
        }
        throw e;
      }
    }
  }
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function openPosition(
  deploymentParams: DeploymentParams,
  market: string,
  openParams: {
    strikeId: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    positionId?: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: number;
  },
) {
  const marketTradeArgs = getMarketTradeArgs(openParams);

  const tx = (await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'openPosition',
    [marketTradeArgs],
    market,
  )) as any;

  const receipt = await tx.wait();

  console.log(`TotalCost for trade: ${fromBN(getEventArgs(receipt, 'Trade').trade.totalCost)}`);
  console.log('-'.repeat(10));
  return getEventArgs(receipt, 'Trade').positionId;
}

export async function closePosition(
  deploymentParams: DeploymentParams,
  market: string,
  closeParams: {
    strikeId: BigNumberish;
    positionId: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: number;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
) {
  const marketTradeArgs = getMarketTradeArgs(closeParams);

  const tx = (await executeLyraFunction(
    deploymentParams,
    'OptionMarket',
    'closePosition',
    [marketTradeArgs],
    market,
  )) as any;

  const receipt = await tx.wait();

  console.log(`TotalCost for trade: ${fromBN(getEventArgs(receipt, 'Trade').trade.totalCost)}`);
  console.log('-'.repeat(10));
  return getEventArgs(receipt, 'Trade').positionId;
}

export function getMarketTradeArgs(parameters: {
  strikeId: BigNumberish;
  positionId?: BigNumberish;
  optionType: OptionType;
  amount: BigNumberish;
  setCollateralTo?: BigNumberish;
  iterations?: BigNumberish;
  minTotalCost?: BigNumberish;
  maxTotalCost?: BigNumberish;
}): TradeInputParametersStruct {
  return {
    strikeId: parameters.strikeId,
    positionId: parameters.positionId || 0,
    amount: parameters.amount,
    setCollateralTo: parameters.setCollateralTo || 0,
    iterations: parameters.iterations || 1,
    minTotalCost: parameters.minTotalCost || 0,
    maxTotalCost: parameters.maxTotalCost || MAX_UINT128,
    optionType: parameters.optionType,
    referrer: ZERO_ADDRESS,
  };
}
