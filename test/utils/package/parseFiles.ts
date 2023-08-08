/* eslint-disable @typescript-eslint/no-var-requires */
import chalk from 'chalk';
import { Contract, Signer, Wallet } from 'ethers';
import fs from 'fs';
import path, { resolve } from 'path';
import { AllowedNetworks, DeploymentParams, DeploymentType, isMockGmx, isMockSnx } from '../../../scripts/util';
import {
  addLyraContract,
  addMockedExternalContract,
  loadExternalContractData,
  loadLyraContractData,
} from '../../../scripts/util/parseFiles';
import { GlobalTestSystemContracts, MarketTestSystemContracts } from '../deployTestSystem';
import { getArtifacts } from './index-artifacts';

export type LyraGlobal = {
  TestFaucet: LyraArtifact;
  SynthetixAdapter: LyraArtifact;
  OptionMarketViewer: LyraArtifact;
  OptionMarketWrapper: LyraArtifact;
  LyraRegistry: LyraArtifact;
  GWAV: LyraArtifact;
  BlackScholes: LyraArtifact;
  BasicFeeCounter: LyraArtifact;
  QuoteAsset: LyraArtifact;
};

export type LyraMarket = {
  OptionMarket: LyraArtifact;
  OptionMarketPricer: LyraArtifact;
  OptionGreekCache: LyraArtifact;
  OptionToken: LyraArtifact;
  LiquidityPool: LyraArtifact;
  LiquidityToken: LyraArtifact;
  ShortCollateral: LyraArtifact;
  BasicLiquidityCounter: LyraArtifact;
  PoolHedger: LyraArtifact;
  GWAVOracle: LyraArtifact;
  BaseAsset: LyraArtifact;
};

export type LyraArtifact = {
  contractName: string;
  address: string;
  abi: any;
  bytecode: string;
  linkReferences: any;
  blockNumber?: number;
  txn?: string;
};

export type lyraDeployment = {
  globals: {
    [key: string]: {
      contractName: string;
      source: string;
      address: string;
      txn: string;
      blockNumber?: number;
    };
  };
  markets: {
    [key: string]: {
      [key: string]: {
        contractName: string;
        source: string;
        address: string;
        txn: string;
        blockNumber?: number;
      };
    };
  };
};

// loads all of the lyra contracts into a test system dir? ah but not very compatible with ethers vs
export function getGlobalDeploys(network: AllowedNetworks): LyraGlobal {
  const artifacts = getArtifacts();

  const deploymentParams: DeploymentParams = {
    network: network,
    deploymentType:
      network == 'mainnet-ovm'
        ? DeploymentType.SNX
        : network == 'goerli-ovm'
        ? DeploymentType.MockSnxRealPricing
        : DeploymentType.MockSnxMockPricing,
    deployer: {} as Wallet,
  };

  return {
    TestFaucet:
      network != 'local'
        ? assignGlobalArtifact(network, 'TestFaucet', deploymentParams, artifacts, true)
        : EMPTY_LYRA_ARTIFACT,
    SynthetixAdapter: assignGlobalArtifact(network, 'SynthetixAdapter', deploymentParams, artifacts, true),
    OptionMarketViewer: assignGlobalArtifact(network, 'OptionMarketViewer', deploymentParams, artifacts, true),
    OptionMarketWrapper: assignGlobalArtifact(network, 'OptionMarketWrapper', deploymentParams, artifacts, true),
    LyraRegistry: assignGlobalArtifact(network, 'LyraRegistry', deploymentParams, artifacts, true),
    GWAV: assignGlobalArtifact(network, 'GWAV', deploymentParams, artifacts, true),
    BlackScholes: assignGlobalArtifact(network, 'BlackScholes', deploymentParams, artifacts, true),
    BasicFeeCounter: assignGlobalArtifact(network, 'BasicFeeCounter', deploymentParams, artifacts, true),
    QuoteAsset: assignGlobalArtifact(network, `ProxyERC20sUSD`, deploymentParams, artifacts, false, 'TestERC20Fail'),
  };
}

export function getMarketDeploys(network: AllowedNetworks, market: string): LyraMarket {
  const artifacts = getArtifacts();

  const deploymentParams: DeploymentParams = {
    network: network,
    deploymentType:
      network == 'mainnet-ovm'
        ? DeploymentType.SNX
        : network == 'goerli-ovm'
        ? DeploymentType.MockSnxRealPricing
        : DeploymentType.MockSnxMockPricing,
    deployer: {} as Wallet,
  };

  return {
    OptionMarket: assignMarketArtifact(network, 'OptionMarket', deploymentParams, artifacts, market, true),
    OptionMarketPricer: assignMarketArtifact(network, 'OptionMarketPricer', deploymentParams, artifacts, market, true),
    OptionGreekCache: assignMarketArtifact(network, 'OptionGreekCache', deploymentParams, artifacts, market, true),
    OptionToken: assignMarketArtifact(network, 'OptionToken', deploymentParams, artifacts, market, true),
    LiquidityPool: assignMarketArtifact(network, 'LiquidityPool', deploymentParams, artifacts, market, true),
    LiquidityToken: assignMarketArtifact(network, 'LiquidityToken', deploymentParams, artifacts, market, true),
    ShortCollateral: assignMarketArtifact(network, 'ShortCollateral', deploymentParams, artifacts, market, true),
    BasicLiquidityCounter: assignMarketArtifact(
      network,
      'BasicLiquidityCounter',
      deploymentParams,
      artifacts,
      market,
      true,
    ),
    PoolHedger: assignMarketArtifact(
      network,
      'PoolHedger',
      deploymentParams,
      artifacts,
      market,
      true,
      'ShortPoolHedger',
    ),
    GWAVOracle: assignMarketArtifact(network, 'GWAVOracle', deploymentParams, artifacts, market, true),
    BaseAsset: assignMarketArtifact(
      network,
      `Proxy${market}`,
      deploymentParams,
      artifacts,
      undefined,
      false,
      'TestERC20Fail',
    ),
  };
}

export function assignGlobalArtifact(
  network: AllowedNetworks,
  contractName: string,
  deploymentParams: DeploymentParams,
  artifacts: any,
  lyra?: boolean,
  source?: string,
): LyraArtifact {
  try {
    let target;
    if (lyra === undefined || !lyra) {
      target = loadExternalContractData(
        deploymentParams,
        contractName,
        isMockSnx(deploymentParams.deploymentType) || isMockGmx(deploymentParams.deploymentType),
        getSNXDeploymentDir(deploymentParams),
      ).target;
    } else {
      target = loadLyraContractData(deploymentParams, contractName, undefined, getLyraDeploymentDir(network)).target;
    }
    return {
      contractName: contractName,
      address: target.address,
      abi: artifacts[source || contractName].abi,
      bytecode: artifacts[source || contractName].bytecode,
      linkReferences: artifacts[source || contractName].linkReferences,
      blockNumber: target.blockNumber || 0,
      txn: target.txn || '',
    };
  } catch (e) {
    console.log('Artifact ommitted for: ', deploymentParams.network, contractName);
    return { ...EMPTY_LYRA_ARTIFACT };
  }
}

export function assignMarketArtifact(
  network: AllowedNetworks,
  contractName: string,
  deploymentParams: DeploymentParams,
  artifacts: any,
  market?: string,
  lyra?: boolean,
  source?: string,
): LyraArtifact {
  try {
    let target;
    if (lyra === undefined || !lyra) {
      target = loadExternalContractData(
        deploymentParams,
        contractName,
        isMockSnx(deploymentParams.deploymentType) || isMockGmx(deploymentParams.deploymentType),
        getSNXDeploymentDir(deploymentParams),
      ).target;
    } else {
      target = loadLyraContractData(
        deploymentParams,
        contractName == 'PoolHedger' ? 'ShortPoolHedger' : contractName,
        market,
        getLyraDeploymentDir(network),
      ).target;
    }

    return {
      contractName: contractName,
      address: target.address,
      abi: artifacts[source || contractName].abi,
      bytecode: artifacts[source || contractName].bytecode,
      linkReferences: artifacts[source || contractName].linkReferences,
      blockNumber: target.blockNumber || 0,
      txn: target.txn || '',
    };
  } catch (e) {
    if (!(network == 'mainnet-ovm' && contractName == 'TestFaucet')) {
      console.log('Artifact ommitted for: ', deploymentParams.network, contractName);
    }
    return { ...EMPTY_LYRA_ARTIFACT };
  }
}

export function getLyraDeploymentDir(network: AllowedNetworks) {
  if (network == 'local') {
    return resolve(path.join('.lyra', 'local', 'lyra.json'));
  } else if (network == 'goerli-ovm') {
    return path.join(__dirname, '../../../deployments/', 'goerli-ovm', 'lyra.realPricing.json');
  } else if (network == 'mainnet-ovm') {
    try {
      return path.join(__dirname, '../../../deployments/', 'mainnet-ovm', 'lyra.json');
    } catch (e) {
      throw new Error('mainnet contracts not deployed yet...');
    }
  }
}

export function getSNXDeploymentDir(deploymentParams: DeploymentParams) {
  if (deploymentParams.network == 'local') {
    return resolve(path.join('.lyra', 'local', `external.mocked.${deploymentParams.deploymentType}.json`));
  } else if (deploymentParams.network == 'goerli-ovm') {
    return path.join(
      __dirname,
      '../../../deployments/',
      'goerli-ovm',
      `external.mocked.${deploymentParams.deploymentType}.json`,
    );
  } else if (deploymentParams.network == 'mainnet-ovm') {
    try {
      return path.join(__dirname, '../../../deployments/', 'mainnet-ovm', 'external.json');
    } catch (e) {
      throw new Error('mainnet contracts not deployed yet...');
    }
  }
}

export async function exportGlobalDeployment(globalSystem: GlobalTestSystemContracts) {
  if (!fs.existsSync('.lyra')) {
    fs.mkdirSync('.lyra');
  }

  if (!fs.existsSync('.lyra/local')) {
    fs.mkdirSync('.lyra/local');
  }

  const lyraDir = resolve(path.join('.lyra', 'local', 'lyra.json'));
  if (fs.existsSync(lyraDir)) {
    fs.unlinkSync(lyraDir);
  }

  const snxDir = resolve(path.join('.lyra', 'local', 'synthetix.mocked.json'));
  if (fs.existsSync(snxDir)) {
    fs.unlinkSync(snxDir);
  }

  const deploymentParams: DeploymentParams = {
    network: 'local' as AllowedNetworks,
    deploymentType: DeploymentType.MockSnxMockPricing,
    deployer: {} as Wallet,
  };

  addLyraContract(deploymentParams, 'SynthetixAdapter', globalSystem.synthetixAdapter, undefined, lyraDir);
  addLyraContract(deploymentParams, 'OptionMarketViewer', globalSystem.optionMarketViewer, undefined, lyraDir);
  addLyraContract(deploymentParams, 'OptionMarketWrapper', globalSystem.optionMarketWrapper, undefined, lyraDir);
  addLyraContract(deploymentParams, 'LyraRegistry', globalSystem.lyraRegistry, undefined, lyraDir);
  addLyraContract(deploymentParams, 'GWAV', globalSystem.gwav, undefined, lyraDir);
  addLyraContract(deploymentParams, 'BlackScholes', globalSystem.blackScholes, undefined, lyraDir);
  addLyraContract(deploymentParams, 'BasicFeeCounter', globalSystem.basicFeeCounter, undefined, lyraDir);
  addLyraContract(deploymentParams, 'BlackScholes', globalSystem.blackScholes, undefined, lyraDir);
  addMockedExternalContract(deploymentParams, 'ProxyERC20sUSD', 'TestERC20Fail', globalSystem.snx.quoteAsset, snxDir);

  console.log(chalk.greenBright(`\n=== Saved global lyra addresses to ${lyraDir} ===\n`));
  console.log(chalk.greenBright(`=== Saved global snx addresses to ${snxDir} ===\n`));
}

export async function exportMarketDeployment(marketSystem: MarketTestSystemContracts, market: string) {
  const lyraDir = resolve(path.join('.lyra', 'local', 'lyra.json'));
  const snxDir = resolve(path.join('.lyra', 'local', 'synthetix.mocked.json'));

  // let data: lyraDeployment;
  try {
    require(lyraDir);
    require(snxDir);
  } catch (e) {
    throw new Error('must deploy global contracts first');
  }

  const deploymentParams: DeploymentParams = {
    network: 'local' as AllowedNetworks,
    deploymentType: DeploymentType.MockSnxMockPricing,
    deployer: {} as Wallet,
  };

  // todo: currently returns blockNumber = 0. Can add later if needed:
  // while ((await ethers.provider.getTransactionReceipt(contract.deployTransaction.hash)) == null) {
  //  await sleep(100);
  // }
  addLyraContract(deploymentParams, 'OptionMarket', marketSystem.optionMarket, market, lyraDir);
  addLyraContract(deploymentParams, 'OptionMarketPricer', marketSystem.optionMarketPricer, market, lyraDir);
  addLyraContract(deploymentParams, 'OptionGreekCache', marketSystem.optionGreekCache, market, lyraDir);
  addLyraContract(deploymentParams, 'OptionToken', marketSystem.optionToken, market, lyraDir);
  addLyraContract(deploymentParams, 'LiquidityPool', marketSystem.liquidityPool, market, lyraDir);
  addLyraContract(deploymentParams, 'LiquidityToken', marketSystem.liquidityToken, market, lyraDir);
  addLyraContract(deploymentParams, 'ShortCollateral', marketSystem.shortCollateral, market, lyraDir);
  addLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', marketSystem.poolHedger, market, lyraDir);
  addLyraContract(deploymentParams, 'GWAVOracle', marketSystem.GWAVOracle, market, lyraDir);
  addLyraContract(deploymentParams, 'BasicLiquidityCounter', marketSystem.basicLiquidityCounter, market, lyraDir);
  addMockedExternalContract(deploymentParams, `Proxy${market}`, 'TestERC20Fail', marketSystem.snx.baseAsset, snxDir);

  console.log(chalk.greenBright(`\n=== Saved ${market} market to ${lyraDir} ===\n`));
  console.log(chalk.greenBright(`=== Saved ${market} snx asset to ${snxDir} ===\n`));
}

export function deleteRecursive(path: string) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file) {
      const curPath = path + '/' + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

export async function getLocalRealSynthetixContract(
  deployer: Signer,
  network: AllowedNetworks,
  contractName: string,
): Promise<Contract> {
  const data = require(resolve(path.join('.lyra', network, 'real-synthetix.json')));
  if (network == 'local' && contractName == 'ProxyERC20sUSD') {
    contractName = 'ProxysUSD';
  }

  const address = data.targets[contractName].address;
  let abi = data.sources[data.targets[contractName].source].abi;

  if (network == 'local' && contractName == 'ProxySynthetix') {
    abi = data.sources[data.targets['Synthetix'].source].abi;
  }

  return new Contract(address, abi, deployer);
}

export const EMPTY_LYRA_ARTIFACT = {
  contractName: '',
  address: '',
  abi: '',
  bytecode: '',
  linkReferences: '',
  blockNumber: 0,
  txn: '',
};
