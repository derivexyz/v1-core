import { ethers } from 'hardhat';

export async function deployTestUSDC() {
  const usdc = await ethers.getContractFactory('TestERC20SetDecimals');

  await usdc.deploy('USDC', 'USDC', 6);
}
