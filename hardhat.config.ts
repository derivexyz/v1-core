import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
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
            runs: 1000,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
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
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
        // mnemonic:
        //   'test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers junk',
      },
    },
    'goerli-arbi': {
      url: loadEnv('goerli-arbi').RPC_URL,
      accounts: [loadEnv('goerli-arbi').PRIVATE_KEY],
    },
    'mainnet-arbi': {
      url: loadEnv('mainnet-arbi').RPC_URL,
      accounts: [loadEnv('mainnet-arbi').PRIVATE_KEY],
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
    apiKey: etherscanApiKey,
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
