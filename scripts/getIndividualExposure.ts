import chalk from 'chalk';
import {cacheAllEventsForLyraContract } from './events';
import {getAddressParameter, getNetworkProvider, getSelectedNetwork} from './util';
import {getLPExposure} from "./events/getLPExposure";

const RUN_PARAMS = {
  updateEvents: true,
};

const tickers = ['sETH', 'sBTC', 'sLINK'];

async function main() {
  const network = getSelectedNetwork();
  const params = { network, provider: getNetworkProvider(network) };
  const address = getAddressParameter();

  if (RUN_PARAMS.updateEvents) {
    const endBlock = (await params.provider.getBlock('latest')).number;
    for (const ticker of tickers) {
      await cacheAllEventsForLyraContract(params, 'LiquidityPool', endBlock, ticker, ['RoundEnded', 'RoundStarted']);
    }
  }

  await getLPExposure(params, address, tickers);

  console.log(chalk.greenBright('\n=== Success! ===\n'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
