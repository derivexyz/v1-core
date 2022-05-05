import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import chalk from 'chalk';
import { BigNumberish, Contract, ContractFactory, ContractTransaction, Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { TradeInputParametersStruct } from '../../typechain-types/OptionMarket';
import { DeploymentParams } from './index';
import { addLyraContract, addMockedSnxContract, loadLyraContractData, loadSynthetixContractData } from './parseFiles';
import { etherscanVerification } from './verification';
import { fromBN, getEventArgs, MAX_UINT128, OptionType } from './web3utils';

const contracts: any = {};

export async function getLyraContract(
  deploymentParams: DeploymentParams,
  contractName: string,
  market?: string,
): Promise<Contract> {
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

export async function getSynthetixContract(
  deploymentParams: DeploymentParams,
  contractName: string,
): Promise<Contract> {
  if (contracts[contractName]) {
    return contracts[contractName];
  }

  const data = loadSynthetixContractData(deploymentParams, contractName);

  const contract = new Contract(data.target.address, data.source.abi, deploymentParams.deployer);
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
  contractName: string,
  market?: string,
  libs?: any,
  ...args: any
): Promise<Contract> {
  const contract = await deployProxyContract(contractName, deploymentParams.deployer, libs, ...args);
  // TODO:
  //  addLyraContract(deploymentParams, contractName + 'Proxy', contract, market);
  addLyraContract(deploymentParams, contractName, contract, market);
  return contract;
}

export async function deployMockSynthetixContract(
  deploymentParams: DeploymentParams,
  name: string,
  contractName: string,
  ...args: any
): Promise<Contract> {
  const contract = await deployContract(contractName, deploymentParams.deployer, undefined, ...args);
  addMockedSnxContract(deploymentParams, name, contractName, contract);
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
  let count = 3;

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
  let count = 3;

  while (true) {
    try {
      contract = await (
        await ethers.getContractFactory(contractName, {
          libraries: libs,
        })
      )
        .connect(deployer)
        .deploy(...args);

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

export async function executeLyraFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
  market?: string,
  signer?: Signer,
): Promise<ContractTransaction> {
  const contract = await getLyraContract(deploymentParams, contractName, market);
  return await execute(signer ? contract.connect(signer) : contract, fn, args);
}

export async function executeSynthetixFunction(
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
  signer?: Signer,
): Promise<ContractTransaction> {
  const contract = await getSynthetixContract(deploymentParams, contractName);
  return await execute(signer ? contract.connect(signer) : contract, fn, args);
}

export async function callLyraFunction(
  deploymentParams: DeploymentParams,
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
  deploymentParams: DeploymentParams,
  contractName: string,
  fn: string,
  args: any[],
): Promise<any> {
  const contract = await getSynthetixContract(deploymentParams, contractName);
  console.log(chalk.grey(`Calling ${fn} on ${contract.address} with args ${args}`));
  return await contract[fn](...args);
}

export async function execute(c: Contract, fn: string, args: any[]): Promise<ContractTransaction> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log(chalk.grey(`Executing ${fn} on ${c.address} with args ${JSON.stringify(args)}`));
      const overrides: any = { gasLimit: 15000000 }; // TODO: ok to leave like this?
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
  const marketTradeArgs = await getMarketTradeArgs(openParams);

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
export async function getMarketTradeArgs(parameters: {
  strikeId: BigNumberish;
  positionId?: BigNumberish;
  optionType: OptionType;
  amount: BigNumberish;
  setCollateralTo?: BigNumberish;
  iterations?: BigNumberish;
  minTotalCost?: BigNumberish;
  maxTotalCost?: BigNumberish;
}): Promise<TradeInputParametersStruct> {
  return {
    strikeId: parameters.strikeId,
    positionId: parameters.positionId || 0,
    amount: parameters.amount,
    setCollateralTo: parameters.setCollateralTo || 0,
    iterations: parameters.iterations || 1,
    minTotalCost: parameters.minTotalCost || 0,
    maxTotalCost: parameters.maxTotalCost || MAX_UINT128,
    optionType: parameters.optionType,
  };
}
