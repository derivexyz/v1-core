import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'synthetix';
import { config as dotenvConfig } from 'dotenv';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'hardhat-tracer';
import { extendEnvironment, HardhatUserConfig, task } from 'hardhat/config';
import { resolve } from 'path';
import 'solidity-coverage';
import { loadEnv } from './scripts/util/parseFiles';
import 'hardhat-interface-generator';

dotenvConfig({ path: resolve(__dirname, './deployments/.env.private') });
const etherscanApiKey = process.env.ETHERSCAN_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.16',
        settings: {
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
          optimizer: {
            enabled: true,
            runs: 20,
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    local: {
      url: 'http://127.0.0.1:8545',
    },
    'goerli-ovm': {
      url: loadEnv('goerli-ovm').RPC_URL,
      accounts: [loadEnv('goerli-ovm').PRIVATE_KEY],
    },
    'goerli-arbi': {
      url: loadEnv('goerli-arbi').RPC_URL,
      accounts: [loadEnv('goerli-arbi').PRIVATE_KEY],
    },
    'mainnet-arbi': {
      url: loadEnv('mainnet-arbi').RPC_URL,
      accounts: [loadEnv('mainnet-arbi').PRIVATE_KEY],
    },
    'mainnet-ovm': {
      url: loadEnv('mainnet-ovm').RPC_URL,
    },
  },
  mocha: {
    timeout: 1_000_000,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    // enabled: true,
  },
  etherscan: {
    apiKey: {
      optimisticEthereum: etherscanApiKey,
      arbitrumOne: loadEnv('mainnet-arbi').ETHERSCAN_KEY,
      arbitrumGoerli: loadEnv('goerli-arbi').ETHERSCAN_KEY,
    },
    customChains: [
      {
        network: 'goerli-ovm',
        chainId: 420,
        urls: {
          apiURL: 'https://api-goerli-optimism.etherscan.io/api',
          browserURL: 'https://goerli-optimism.etherscan.io',
        },
      },
    ] as any,
  },
};

task('test:heavy')
  .addOptionalVariadicPositionalParam('testFiles', 'An optional list of files to test', [])
  .setAction(async (taskArgs, hre) => {
    (global as any).HEAVY_TESTS = true;
    await hre.run('test', taskArgs);
  });

extendEnvironment(hre => {
  (hre as any).f = {
    c: undefined,
    deploySnap: undefined,
    boardId: undefined,
    market: undefined,
    seedSnap: undefined,
  };
});

export default config;
