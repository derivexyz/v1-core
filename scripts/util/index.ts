import { Provider } from '@ethersproject/providers';
import { ethers } from 'ethers';

(global as any).hashes = [];

export type AllowedNetworks = 'kovan-ovm' | 'mainnet-ovm';

export type Params = {
  network: AllowedNetworks;
  provider: Provider;
  wallet?: ethers.Wallet;
};

export function getNetworkProvider(network: AllowedNetworks): Provider {
  if (network == 'kovan-ovm') {
    return new ethers.providers.JsonRpcProvider('https://kovan.optimism.io');
  } else {
    return new ethers.providers.JsonRpcProvider('https://mainnet.optimism.io');
  }
}

export function getWallet(network: AllowedNetworks) {
  return new ethers.Wallet(
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    getNetworkProvider(network),
  );
}

export function getSelectedNetwork(): AllowedNetworks {
  const foundFlag = process.argv.find(arg => arg.includes('--network='));

  if (!foundFlag) {
    throw new Error('Missing --network=<kovan-ovm|mainnet-ovm> flag');
  }

  const network = foundFlag.split('network=').pop();

  if (network === 'kovan-ovm' || network === 'mainnet-ovm') {
    return network;
  }
  throw Error('Invalid network ' + network);
}
