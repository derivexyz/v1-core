// import { ethers } from 'ethers';
// import { toBN } from './util/web3utils';
// import { deployTestSystem } from '../test/utils/deployTestSystem';
// import { DEFAULT_OPTION_MARKET_PARAMS } from '../test/utils/defaultParams';
// import { seedTestSystem } from '../test/utils/seedTestSystem';
// import { integrationTests } from './integration';
//
// // run this script using `yarn hardhat run --network local` if running directly from repo (not @lyrafinance/core)
// export async function setupIntegration() {
//   // 1. get deployer and network
//   const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
//
//   const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // enter address with ETH
//   provider.getGasPrice = async () => {
//     return ethers.BigNumber.from('0');
//   };
//   provider.estimateGas = async () => {
//     return ethers.BigNumber.from(15000000);
//   };
//   const deployer = new ethers.Wallet(privateKey, provider);
//
//   // 2. deploy and seed market
//   const exportAddresses = true;
//   const localTestSystem = await deployTestSystem(
//     deployer, false, exportAddresses,
//     { mockSNX: false, compileSNX: false, optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') } });
//
//   await seedTestSystem(deployer, localTestSystem);
//   return localTestSystem;
//   // Run integration tests
//   // console.log(`Running test`)
//   // await integrationTests(localTestSystem, deployer, 'sETH');
// }
//
//
// async function main() {
//   // 1. get deployer and network
//   const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
//
//   const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // enter address with ETH
//   provider.getGasPrice = async () => {
//     return ethers.BigNumber.from('0');
//   };
//   provider.estimateGas = async () => {
//     return ethers.BigNumber.from(15000000);
//   };
//   const deployer = new ethers.Wallet(privateKey, provider);
//
//   // 2. deploy and seed market
//   const exportAddresses = true;
//   const localTestSystem = await deployTestSystem(
//     deployer, false, exportAddresses,
//     { mockSNX: false, compileSNX: false, optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') } });
//
//   await seedTestSystem(deployer, localTestSystem);
//
//   // Run integration tests
//   console.log(`Running test`)
//   await integrationTests(localTestSystem, deployer, 'sETH');
// }
//
// main()
//   .then(() => process.exit(0))
//   .catch(error => {
//     console.error(error);
//     process.exit(1);
//   });
