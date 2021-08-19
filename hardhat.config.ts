import '@eth-optimism/plugins/hardhat/compiler';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'hardhat-typechain';
import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
  ovm: { solcVersion: '0.7.6' },
  solidity: {
    version: '0.7.6',
    settings: {
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
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
      gasPrice: 0,
    },
    kovan: {
      url: 'https://kovan.infura.io/v3/',
    },
    'local-ovm': {
      url: 'http://127.0.0.1:8545',
      accounts: {
        mnemonic:
          'test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers test-helpers junk',
      },
      gasPrice: 0,
      ovm: true,
    },
    'kovan-ovm': {
      url: 'https://kovan.optimism.io',
      ovm: true,
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
    enabled: false,
  },
};

export default config;
