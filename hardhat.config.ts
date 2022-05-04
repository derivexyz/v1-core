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

dotenvConfig({ path: resolve(__dirname, './deployments/.env.private') });
const etherscanApiKey = process.env.ETHERSCAN_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.9',
    settings: {
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    local: {
      url: 'http://127.0.0.1:8545',
      accounts: {
        mnemonic:
          'test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers junk',
      },
    },
    kovan: {
      url: 'https://kovan.infura.io/v3/',
    },
    'kovan-ovm': {
      url: 'https://kovan.optimism.io',
    },
    'mainnet-ovm': {
      url: 'https://mainnet.optimism.io',
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
