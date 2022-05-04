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
export function getGlobalDeploys(network: AllowedNetworks): LyraGlobal {
  const lyraDeployment: lyraDeployment = require(getDeploymentPath(network));
  console.log(chalk.greenBright(`\n=== Loaded deployed contracts from ${getDeploymentPath(network)} ===\n`));

  return {
    TestFaucet: assignGlobalArtifact('TestFaucet', lyraDeployment, artifacts),
    SynthetixAdapter: assignGlobalArtifact('SynthetixAdapter', lyraDeployment, artifacts),
    OptionMarketViewer: assignGlobalArtifact('OptionMarketViewer', lyraDeployment, artifacts),
    OptionMarketWrapper: assignGlobalArtifact('OptionMarketWrapper', lyraDeployment, artifacts),
    LyraRegistry: assignGlobalArtifact('LyraRegistry', lyraDeployment, artifacts),
    GWAV: assignGlobalArtifact('GWAV', lyraDeployment, artifacts),
    BlackScholes: assignGlobalArtifact('BlackScholes', lyraDeployment, artifacts),
    BasicFeeCounter: assignGlobalArtifact('BasicFeeCounter', lyraDeployment, artifacts),
    QuoteAsset: assignGlobalArtifact('QuoteAsset', lyraDeployment, artifacts, 'TestERC20Fail'),
  };
}

export function getMarketDeploys(network: AllowedNetworks, market: string): LyraMarket {
  const lyraDeployment: lyraDeployment = require(getDeploymentPath(network));
  console.log(chalk.greenBright(`\n=== Loaded deployed contracts from ${getDeploymentPath(network)} ===\n`));

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
    BaseAsset: assignMarketArtifact('BaseAsset', lyraDeployment, artifacts, market, 'TestERC20Fail'),
  };
}

export function assignGlobalArtifact(
  contractName: string,
  deployment: lyraDeployment,
  artifacts: any,
  source?: string,
): LyraArtifact {
  return {
    contractName: contractName,
    address: deployment.globals[contractName].address,
    abi: artifacts[source || contractName].abi,
    bytecode: artifacts[source || contractName].bytecode,
    linkReferences: artifacts[source || contractName].linkReferences,
    blockNumber: deployment.globals[contractName].blockNumber || 0,
    txn: deployment.globals[contractName].txn || '',
  };
}

export function assignMarketArtifact(
  contractName: string,
  deployment: lyraDeployment,
  artifacts: any,
  market: string,
  source?: string,
): LyraArtifact {
  return {
    contractName: contractName,
    address: deployment.markets[market][contractName].address,
    abi: artifacts[source || contractName].abi,
    bytecode: artifacts[source || contractName].bytecode,
    linkReferences: artifacts[source || contractName].linkReferences,
    blockNumber: deployment.markets[market][contractName].blockNumber || 0,
    txn: deployment.markets[market][contractName].txn || '',
  };
}

export function getDeploymentPath(network: AllowedNetworks) {
  let filePath: string;
  if (network == 'local') {
    filePath = path.join('.lyra', 'local', 'lyra.json');
  } else if (network == 'kovan-ovm') {
    filePath = path.join(__dirname, '../../../deployments/', 'kovan-ovm', 'deployment.json');
  } else if (network == 'mainnet-ovm') {
    throw new Error('mainnet contracts not deployed yet...');
  } else {
    throw 'Unrecognized network';
  }
  return resolve(filePath);
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

export async function getSynthetixContract(
  deployer: Signer,
  network: AllowedNetworks,
  contractName: string,
): Promise<BaseContract> {
  const data = require(resolve(path.join('.lyra', network, 'real-synthetix.json')));
  return new BaseContract(
    data.targets[contractName].address,
    data.sources[data.targets[contractName].source].abi,
    deployer,
  );
  // need to figure out where this is dissappearing
}
