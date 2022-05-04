import { ethers } from 'ethers';
import { toBN } from '../scripts/util/web3utils';
import { DEFAULT_OPTION_MARKET_PARAMS } from '../test/utils/defaultParams';
import { deployTestSystem } from '../test/utils/deployTestSystem';
import { getGlobalDeploys, getMarketDeploys, LyraGlobal, LyraMarket } from '../test/utils/package/parseFiles';
import { seedTestSystem } from '../test/utils/seedTestSystem';

// run this script using `yarn hardhat run --network local` if running directly from repo (not @lyrafinance/core)
// otherwise OZ will think it's deploying to hardhat network and not local
async function main() {
  // 1. get deployer and network
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // enter address with ETH
  provider.getGasPrice = async () => {
    return ethers.BigNumber.from('0');
  };
  provider.estimateGas = async () => {
    return ethers.BigNumber.from(15000000);
  }; // max limit to prevent run out of gas errors
  const deployer = new ethers.Wallet(privateKey, provider);

  // 2. deploy and seed market
  const exportAddresses = true;
  let localTestSystem = await deployTestSystem(deployer, false, exportAddresses, {
    mockSNX: true,
    compileSNX: false,
    optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') },
  });

  await seedTestSystem(deployer, localTestSystem);

  // // 3. add new BTC market
  // let newMarketSystem = await addNewMarketSystem(deployer, localTestSystem, 'sBTC', exportAddresses)
  // await seedNewMarketSystem(deployer, localTestSystem, newMarketSystem)

  // 4. get global contracts
  let lyraGlobal: LyraGlobal = getGlobalDeploys('local');
  console.log('contract name:', lyraGlobal.SynthetixAdapter.contractName);
  console.log('address:', lyraGlobal.SynthetixAdapter.address);
  // console.log("abi:", lyraGlobal.SynthetixAdapter.abi)
  console.log('bytecode:', lyraGlobal.SynthetixAdapter.bytecode.slice(0, 20) + '...');

  // 5. get market contracts
  let lyraMarket: LyraMarket = getMarketDeploys('local', 'sETH');
  console.log('contract name:', lyraMarket.OptionMarket.contractName);
  console.log('address:', lyraMarket.OptionMarket.address);
  // console.log("abi:", lyraMarket.OptionMarket.abi)
  console.log('bytecode:', lyraMarket.OptionMarket.bytecode.slice(0, 20) + '...');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
