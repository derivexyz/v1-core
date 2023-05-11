import { ethers } from 'hardhat';
import { EnvVars } from './index';

export async function getDeployer(envVars: EnvVars) {
  const provider = new ethers.providers.JsonRpcProvider(envVars.RPC_URL);

  if (envVars.GAS_PRICE) {
    provider.getGasPrice = async () => {
      return ethers.BigNumber.from(envVars.GAS_PRICE);
    };
  }
  if (envVars.GAS_LIMIT) {
    provider.estimateGas = async () => {
      return ethers.BigNumber.from(envVars.GAS_LIMIT);
    };
  }
  
  return new ethers.Wallet(envVars.PRIVATE_KEY, provider);
}

export async function getAltSigner(envVars: any) {
  const provider = new ethers.providers.JsonRpcProvider(envVars.RPC_URL);
  return new ethers.Wallet(envVars.ALT_SIGNER_KEY, provider);
}
