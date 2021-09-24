import { BigNumber } from 'ethers';
import { getEventsFromLyraContract } from '../events';
import { Params } from '../util';
import { decimalToBN, fromBN, toBN, TradeType, UNIT } from '../util/web3utils';

export async function getTradeVolume(params: Params, tickers: string[]) {
  console.log('================');
  console.log('= Trade Volume =');
  console.log('================');

  const uniqueAddresses: { [key: string]: boolean } = {};

  for (const ticker of tickers) {
    let totalLongAmountOpen = BigNumber.from(0);
    let totalLongAmountClose = BigNumber.from(0);
    let totalShortAmountOpen = BigNumber.from(0);
    let totalShortAmountClose = BigNumber.from(0);
    let totalLongTotalCostOpen = BigNumber.from(0);
    let totalLongTotalCostClose = BigNumber.from(0);
    let totalShortTotalCostOpen = BigNumber.from(0);
    let totalShortTotalCostClose = BigNumber.from(0);

    const openEvents = await getEventsFromLyraContract(params, 'OptionMarket', 'PositionOpened', {}, ticker);
    for (const i of openEvents) {
      if (uniqueAddresses[i.trader] === undefined) {
        uniqueAddresses[i.trader] = true;
      }
      if (i.tradeType == TradeType.LONG_CALL || i.tradeType == TradeType.LONG_PUT) {
        totalLongAmountOpen = totalLongAmountOpen.add(decimalToBN(i.amount));
        totalLongTotalCostOpen = totalLongTotalCostOpen.add(decimalToBN(i.totalCost));
      } else {
        totalShortAmountOpen = totalShortAmountOpen.add(decimalToBN(i.amount));
        totalShortTotalCostOpen = totalShortTotalCostOpen.add(decimalToBN(i.totalCost));
      }
    }

    const closeEvents = await getEventsFromLyraContract(params, 'OptionMarket', 'PositionClosed', {}, ticker);

    for (const i of closeEvents) {
      if (i.tradeType == TradeType.LONG_CALL || i.tradeType == TradeType.LONG_PUT) {
        totalLongAmountClose = totalLongAmountClose.add(toBN(i.amount.toString()).div(UNIT));
        totalLongTotalCostClose = totalLongTotalCostClose.add(toBN(i.totalCost.toString()).div(UNIT));
      } else {
        totalShortAmountClose = totalShortAmountClose.add(toBN(i.amount.toString()).div(UNIT));
        totalShortTotalCostClose = totalShortTotalCostClose.add(toBN(i.totalCost.toString()).div(UNIT));
      }
    }

    console.log(`${ticker} amount of opens          - ${openEvents.length}`);
    console.log(`${ticker} amount of closes         - ${closeEvents.length}`);
    console.log(`${ticker} totalLongAmountOpen      - ${fromBN(totalLongAmountOpen)}`);
    console.log(`${ticker} totalLongAmountClose     - ${fromBN(totalLongAmountClose)}`);
    console.log(`${ticker} totalShortAmountOpen     - ${fromBN(totalShortAmountOpen)}`);
    console.log(`${ticker} totalShortAmountClose    - ${fromBN(totalShortAmountClose)}`);
    console.log(`${ticker} totalLongTotalCostOpen   - ${fromBN(totalLongTotalCostOpen)}`);
    console.log(`${ticker} totalLongTotalCostClose  - ${fromBN(totalLongTotalCostClose)}`);
    console.log(`${ticker} totalShortTotalCostOpen  - ${fromBN(totalShortTotalCostOpen)}`);
    console.log(`${ticker} totalShortTotalCostClose - ${fromBN(totalShortTotalCostClose)}`);
    console.log(`${ticker} unique traders           - ${Object.keys(uniqueAddresses).length}`);
  }
}
