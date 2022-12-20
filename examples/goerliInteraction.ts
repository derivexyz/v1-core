import { JsonRpcProvider } from '@ethersproject/providers';
import chalk from 'chalk';
import { Contract, ethers } from 'ethers';
import { MAX_UINT, OptionType, toBN } from '../scripts/util/web3utils';
import { getGlobalDeploys, getMarketDeploys } from '../test/utils/package/parseFiles';

async function main() {
  // 1. get deployer and network
  const provider = new ethers.providers.JsonRpcProvider(
    'https://optimism-kovan.infura.io/v3/561ebceae957407ea6699a474aa4f7b0',
  );

  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // enter address with ETH
  const deployer = new ethers.Wallet(privateKey, provider);

  // 2. get lyra contracts
  let lyraGlobal = getGlobalDeploys('goerli-arbi');
  let lyraMarket = getMarketDeploys('goerli-arbi', 'sETH');

  const testFaucet = new Contract(lyraGlobal.TestFaucet.address, lyraGlobal.TestFaucet.abi, deployer);
  const sUSD = new Contract(lyraGlobal.QuoteAsset.address, lyraGlobal.QuoteAsset.abi, deployer);
  const optionMarket = new Contract(lyraMarket.OptionMarket.address, lyraMarket.OptionMarket.abi, deployer);

  // 3. call lyra
  // await execute(testFaucet, 'drip', [] as any, provider);
  await execute(sUSD, 'approve', [optionMarket.address, MAX_UINT], provider);

  const tradeParams = {
    strikeId: 1,
    positionId: 0,
    iterations: 5,
    optionType: OptionType.LONG_CALL,
    amount: toBN('1'),
    setCollateralTo: toBN('0'),
    minTotalCost: toBN('0'),
    maxTotalCost: MAX_UINT,
  };
  await execute(optionMarket, 'openPosition', [tradeParams], provider);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function execute(contract: Contract, func: string, args: any[], provider: JsonRpcProvider) {
  while (true) {
    try {
      console.log(chalk.grey(`Executing ${contract.address}`));
      const overrides: any = { gasLimit: 15000000 };
      const tx = await contract[func](...args, overrides);
      while ((await provider.getTransactionReceipt(tx.hash)) == null) {
        await sleep(100);
      }
      const receipt = await tx.wait();
      console.log(`Gas used for tx ${chalk.blueBright(receipt.transactionHash)}:`, receipt.gasUsed.toNumber());
      return tx;
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message.slice(0, 27));
        if (e.message.slice(0, 27) == 'nonce has already been used') {
          continue;
        }
        throw e;
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
