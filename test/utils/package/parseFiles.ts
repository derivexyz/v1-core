/* eslint-disable @typescript-eslint/no-var-requires */
import { fetchJson } from '@ethersproject/web';
import chalk from 'chalk';
import { BaseContract, Signer } from 'ethers';
import fs from 'fs';
import path, { resolve } from 'path';
import { AllowedNetworks } from '../../../scripts/util';
import { getContractsWithBlockNumber } from '../../../scripts/util/parseFiles';
import { GlobalTestSystemContracts, MarketTestSystemContracts } from '../deployTestSystem';
import { artifacts } from '../package/index-artifacts';

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
  LiquidityTokens: LyraArtifact;
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
export async function getGlobalDeploys(network: AllowedNetworks): Promise<LyraGlobal> {
  const lyraDeployment = await getDeployment(network);

  let snxDeployment;
  let quoteName;
  if (network == 'local') {
    snxDeployment = lyraDeployment;
    quoteName = 'QuoteAsset';
  } else if (network == 'kovan-ovm') {
    snxDeployment = await fetchJson(PUBLIC_DEPLOYMENTS + '/kovan-ovm/synthetix.mocked.json');
    quoteName = `ProxyERC20sUSD`;
  } else {
    try {
      snxDeployment = await fetchJson(PUBLIC_DEPLOYMENTS + '/mainnet-ovm/synthetix.json');
      quoteName = `ProxyERC20sUSD`;
    } catch (e) {
      throw new Error('mainnet contracts not deployed yet...');
    }
  }

  console.log(chalk.greenBright(`\n=== Loaded global contracts from ${network} ===\n`));

  return {
    TestFaucet: assignGlobalArtifact('TestFaucet', lyraDeployment, artifacts),
    SynthetixAdapter: assignGlobalArtifact('SynthetixAdapter', lyraDeployment, artifacts),
    OptionMarketViewer: assignGlobalArtifact('OptionMarketViewer', lyraDeployment, artifacts),
    OptionMarketWrapper: assignGlobalArtifact('OptionMarketWrapper', lyraDeployment, artifacts),
    LyraRegistry: assignGlobalArtifact('LyraRegistry', lyraDeployment, artifacts),
    GWAV: assignGlobalArtifact('GWAV', lyraDeployment, artifacts),
    BlackScholes: assignGlobalArtifact('BlackScholes', lyraDeployment, artifacts),
    BasicFeeCounter: assignGlobalArtifact('BasicFeeCounter', lyraDeployment, artifacts),
    QuoteAsset: assignGlobalArtifact(quoteName, snxDeployment, artifacts, 'TestERC20Fail'),
  };
}

export async function getMarketDeploys(network: AllowedNetworks, market: string): Promise<LyraMarket> {
  const lyraDeployment = await getDeployment(network);

  let snxDeployment;
  let baseName;
  if (network == 'local') {
    snxDeployment = lyraDeployment;
    baseName = 'BaseAsset';
  } else if (network == 'kovan-ovm') {
    snxDeployment = await fetchJson(PUBLIC_DEPLOYMENTS + '/kovan-ovm/synthetix.mocked.json');
    baseName = `Proxy${market}`;
  } else {
    try {
      snxDeployment = await fetchJson(PUBLIC_DEPLOYMENTS + '/mainnet-ovm/synthetix.json');
      baseName = `Proxy${market}`;
    } catch (e) {
      throw new Error('mainnet contracts not deployed yet...');
    }
  }

  console.log(chalk.greenBright(`\n=== Loaded market contracts for ${network} ===\n`));

  return {
    OptionMarket: assignMarketArtifact('OptionMarket', lyraDeployment, artifacts, market),
    OptionMarketPricer: assignMarketArtifact('OptionMarketPricer', lyraDeployment, artifacts, market),
    OptionGreekCache: assignMarketArtifact('OptionGreekCache', lyraDeployment, artifacts, market),
    OptionToken: assignMarketArtifact('OptionToken', lyraDeployment, artifacts, market),
    LiquidityPool: assignMarketArtifact('LiquidityPool', lyraDeployment, artifacts, market),
    LiquidityTokens: assignMarketArtifact('LiquidityTokens', lyraDeployment, artifacts, market),
    ShortCollateral: assignMarketArtifact('ShortCollateral', lyraDeployment, artifacts, market),
    BasicLiquidityCounter: assignMarketArtifact('BasicLiquidityCounter', lyraDeployment, artifacts, market),
    PoolHedger: assignMarketArtifact('PoolHedger', lyraDeployment, artifacts, market),
    GWAVOracle: assignMarketArtifact('GWAVOracle', lyraDeployment, artifacts, market),
    BaseAsset: assignMarketArtifact(baseName, snxDeployment, artifacts, market, 'TestERC20Fail'),
  };
}

export function assignGlobalArtifact(
  contractName: string,
  deployment: any,
  artifacts: any,
  source?: string,
): LyraArtifact {
  const target = deployment.globals == undefined ? deployment.targets : deployment.globals;

  try {
    return {
      contractName: contractName,
      address: target[contractName].address,
      abi: artifacts[source || contractName].abi,
      bytecode: artifacts[source || contractName].bytecode,
      linkReferences: artifacts[source || contractName].linkReferences,
      blockNumber: target[contractName].blockNumber || 0,
      txn: target[contractName].txn || '',
    };
  } catch (e) {
    console.log('Could not locate contract: ', contractName);
    return { ...EMPTY_LYRA_ARTIFACT };
  }
}

export function assignMarketArtifact(
  contractName: string,
  deployment: any,
  artifacts: any,
  market: string,
  source?: string,
): LyraArtifact {
  let target;
  if (deployment.targets == undefined) {
    // local lyra
    target = deployment.markets[market];
  } else if (deployment.targets.markets == undefined) {
    // real kovan/mainnet snx
    target = deployment.targets;
  } else {
    // kovan/mainnet lyra
    target = deployment.targets.markets[market];
  }

  try {
    return {
      contractName: contractName,
      address: target[contractName].address,
      abi: artifacts[source || contractName].abi,
      bytecode: artifacts[source || contractName].bytecode,
      linkReferences: artifacts[source || contractName].linkReferences,
      blockNumber: target[contractName].blockNumber || 0,
      txn: target[contractName].txn || '',
    };
  } catch (e) {
    console.log('Could not locate contract: ', contractName);
    return { ...EMPTY_LYRA_ARTIFACT };
  }
}

export async function getDeployment(network: AllowedNetworks) {
  if (network == 'local') {
    return require(resolve(path.join('.lyra', 'local', 'lyra.json')));
  } else if (network == 'kovan-ovm') {
    return await fetchJson(PUBLIC_DEPLOYMENTS + '/kovan-ovm/lyra.realPricing.json');
  } else if (network == 'mainnet-ovm') {
    try {
      return await fetchJson(PUBLIC_DEPLOYMENTS + '/mainnet-ovm/lyra.json');
    } catch (e) {
      throw new Error('mainnet contracts not deployed yet...');
    }
  } else {
    throw 'Unrecognized network';
  }
}

// todo: need to append to current market addresses
// todo: need to add "exportMarketAddress" since this one won't overwrite
export async function exportGlobalDeployment(globalSystem: GlobalTestSystemContracts) {
  if (!fs.existsSync('.lyra')) {
    fs.mkdirSync('.lyra');
  }

  if (!fs.existsSync('.lyra/local')) {
    fs.mkdirSync('.lyra/local');
  }

  const outDir = resolve(path.join('.lyra', 'local', 'lyra.json'));
  if (fs.existsSync(outDir)) {
    fs.unlinkSync(outDir);
  }

  const data = {} as lyraDeployment;
  data.globals = {
    TestFaucet: { contractName: 'TestFaucet', source: 'TestFaucet', address: '', txn: '', blockNumber: 0 },
    SynthetixAdapter: await getContractsWithBlockNumber(globalSystem.synthetixAdapter, 'SynthetixAdapter'),
    OptionMarketViewer: await getContractsWithBlockNumber(globalSystem.optionMarketViewer, 'OptionMarketViewer'),
    OptionMarketWrapper: await getContractsWithBlockNumber(globalSystem.optionMarketWrapper, 'OptionMarketWrapper'),
    LyraRegistry: await getContractsWithBlockNumber(globalSystem.lyraRegistry, 'LyraRegistry'),
    GWAV: await getContractsWithBlockNumber(globalSystem.gwav, 'GWAV'),
    BlackScholes: await getContractsWithBlockNumber(globalSystem.blackScholes, 'BlackScholes'),
    BasicFeeCounter: await getContractsWithBlockNumber(globalSystem.basicFeeCounter, 'BasicFeeCounter'),
    QuoteAsset: await getContractsWithBlockNumber(globalSystem.snx.quoteAsset, 'QuoteAsset', 'TestERC20Fail'),
  };

  fs.writeFileSync(outDir, JSON.stringify(data, undefined, 2));
  console.log(chalk.greenBright(`\n=== Saved global addresses to ${outDir} ===\n`));
}

export async function exportMarketDeployment(marketSystem: MarketTestSystemContracts, market: string) {
  const outDir = resolve(path.join('.lyra', 'local', 'lyra.json'));

  let data: lyraDeployment;
  try {
    data = require(outDir);
  } catch (e) {
    throw new Error('must deploy global contracts first');
  }

  if (!data.markets) {
    data.markets = {};
  }

  data.markets[market] = {
    OptionMarket: await getContractsWithBlockNumber(marketSystem.optionMarket, 'OptionMarket'),
    OptionMarketPricer: await getContractsWithBlockNumber(marketSystem.optionMarketPricer, 'OptionMarketPricer'),
    OptionGreekCache: await getContractsWithBlockNumber(marketSystem.optionGreekCache, 'OptionGreekCache'),
    OptionToken: await getContractsWithBlockNumber(marketSystem.optionToken, 'OptionToken'),
    LiquidityPool: await getContractsWithBlockNumber(marketSystem.liquidityPool, 'LiquidityPool'),
    LiquidityTokens: await getContractsWithBlockNumber(marketSystem.liquidityTokens, 'LiquidityTokens'),
    ShortCollateral: await getContractsWithBlockNumber(marketSystem.shortCollateral, 'ShortCollateral'),
    PoolHedger: await getContractsWithBlockNumber(marketSystem.poolHedger, 'PoolHedger'),
    GWAVOracle: await getContractsWithBlockNumber(marketSystem.GWAVOracle, 'GWAVOracle'),
    BasicLiquidityCounter: await getContractsWithBlockNumber(
      marketSystem.basicLiquidityCounter,
      'BasicLiquidityCounter',
    ),
    BaseAsset: await getContractsWithBlockNumber(marketSystem.snx.baseAsset, 'BaseAsset', 'TestERC20Fail'),
  };

  fs.writeFileSync(outDir, JSON.stringify(data, undefined, 2));
  console.log(chalk.greenBright(`\n=== Saved ${market} market to ${outDir} ===\n`));
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
): Promise<BaseContract> {
  const data = require(resolve(path.join('.lyra', network, 'real-synthetix.json')));
  if (network == 'local' && contractName == 'ProxyERC20sUSD') {
    contractName = 'ProxysUSD';
  }

  const address = data.targets[contractName].address;
  let abi = data.sources[data.targets[contractName].source].abi;

  if (network == 'local' && contractName == 'ProxySynthetix') {
    abi = data.sources[data.targets['Synthetix'].source].abi;
  }

  return new BaseContract(address, abi, deployer);
  // need to figure out where this is disappearing
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

export const PUBLIC_DEPLOYMENTS = 'https://raw.githubusercontent.com/lyra-finance/lyra-protocol/avalon/deployments';
