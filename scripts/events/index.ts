import { BigNumber } from 'ethers';
import { OptionMarket } from '../../typechain-types';
import { DeploymentParams } from '../util';
import { getLyraContract } from '../util/transactions';
import { fromBN, OptionType } from '../util/web3utils';

export async function getTradeVolume(deploymentParams: DeploymentParams, tickers: string[]) {
  const uniqueAddresses: { [key: string]: boolean } = {};
  let totalTraders = 0;
  let totalOpens = 0;
  let totalCloses = 0;

  for (const ticker of tickers) {
    const optionMarket = getLyraContract(deploymentParams, 'OptionMarket', ticker) as OptionMarket;
    let totalLongAmountOpen = BigNumber.from(0);
    let totalLongAmountClose = BigNumber.from(0);
    let totalShortAmountOpen = BigNumber.from(0);
    let totalShortAmountClose = BigNumber.from(0);
    let totalLongTotalCostOpen = BigNumber.from(0);
    let totalLongTotalCostClose = BigNumber.from(0);
    let totalShortTotalCostOpen = BigNumber.from(0);
    let totalShortTotalCostClose = BigNumber.from(0);

    const startBlock = 943398;
    const endBlock = (await optionMarket.provider.getBlock('latest')).number;

    for (let start = startBlock; start < endBlock; start += 10000) {
      // console.log({ start, endBlock });
      let filter = optionMarket.filters.Trade(null, null, null, null, null);
      let events = await optionMarket.queryFilter(filter, start, start + 9999);
      // console.log(`${events.length} opens for ${ticker}`);
      totalOpens += events.length;
      for (const i of events) {
        if (uniqueAddresses[i.args.trader] === undefined) {
          uniqueAddresses[i.args.trader] = true;
          totalTraders += 1;
        }
        if (i.args.trade.optionType == OptionType.LONG_CALL || i.args.trade.optionType == OptionType.LONG_PUT) {
          totalLongAmountOpen = totalLongAmountOpen.add(i.args.trade.amount);
          totalLongTotalCostOpen = totalLongTotalCostOpen.add(i.args.trade.totalCost);
        } else {
          totalShortAmountOpen = totalShortAmountOpen.add(i.args.trade.amount);
          totalShortTotalCostOpen = totalShortTotalCostOpen.add(i.args.trade.totalCost);
        }
      }

      filter = optionMarket.filters.Trade(null, null, null, null, null);
      events = await optionMarket.queryFilter(filter, start, start + 9999);
      for (const i of events) {
        if (i.args.trade.optionType == OptionType.LONG_CALL || i.args.trade.optionType == OptionType.LONG_PUT) {
          totalLongAmountClose = totalLongAmountClose.add(i.args.trade.amount);
          totalLongTotalCostClose = totalLongTotalCostClose.add(i.args.trade.totalCost);
        } else {
          totalShortAmountClose = totalShortAmountClose.add(i.args.trade.amount);
          totalShortTotalCostClose = totalShortTotalCostClose.add(i.args.trade.totalCost);
        }
      }
      // console.log(`${events.length} closes for ${ticker}`);
      totalCloses += events.length;
    }
    console.log(`totalLongAmountOpen, ${fromBN(totalLongAmountOpen)}`);
    console.log(`totalLongAmountClose, ${fromBN(totalLongAmountClose)}`);
    console.log(`totalShortAmountOpen, ${fromBN(totalShortAmountOpen)}`);
    console.log(`totalShortAmountClose, ${fromBN(totalShortAmountClose)}`);
    console.log(`totalLongTotalCostOpen, ${fromBN(totalLongTotalCostOpen)}`);
    console.log(`totalLongTotalCostClose, ${fromBN(totalLongTotalCostClose)}`);
    console.log(`totalShortTotalCostOpen, ${fromBN(totalShortTotalCostOpen)}`);
    console.log(`totalShortTotalCostClose, ${fromBN(totalShortTotalCostClose)}`);
  }

  return {
    // uniqueAddresses,
    totalTraders,
    totalOpens,
    totalCloses,
  };
}
