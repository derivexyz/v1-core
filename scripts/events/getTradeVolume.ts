import { BigNumber } from 'ethers';
import { getEventsFromLyraContract } from '../events';
import { Params } from '../util';
import { decimalToBN, fromBN, TradeType, UNIT } from '../util/web3utils';

export async function getTradeVolume(params: Params, tickers: string[]) {
  console.log('================');
  console.log('= Trade Volume =');
  console.log('================');

  const uniqueAddresses: { [key: string]: boolean } = {};

  for (const ticker of tickers) {
    const roundStartedEvents = await getEventsFromLyraContract(params, 'LiquidityPool', 'RoundStarted', {}, ticker);

    const latestRoundStartedEvent = roundStartedEvents.reduce(
      (a: any, b: any) => (a.newMaxExpiryTimestamp > b.newMaxExpiryTimestamp ? a : b),
      { newMaxExpiryTimestamp: 0 },
    );

    console.log(`\n= ${ticker} market =\n`);
    let totalLongAmountOpen = BigNumber.from(0);
    let totalLongAmountClose = BigNumber.from(0);
    let totalShortAmountOpen = BigNumber.from(0);
    let totalShortAmountClose = BigNumber.from(0);

    let totalLongTotalCostOpen = BigNumber.from(0);
    let totalLongTotalCostClose = BigNumber.from(0);
    let totalShortTotalCostOpen = BigNumber.from(0);
    let totalShortTotalCostClose = BigNumber.from(0);

    let totalLongSettleValue = BigNumber.from(0);
    let totalShortSettleValue = BigNumber.from(0);

    const openEvents = (await getEventsFromLyraContract(params, 'OptionMarket', 'PositionOpened', {}, ticker)).filter(
      x => x.blockNumber >= latestRoundStartedEvent.blockNumber,
    );

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

    const closeEvents = (await getEventsFromLyraContract(params, 'OptionMarket', 'PositionClosed', {}, ticker)).filter(
      x => x.blockNumber >= latestRoundStartedEvent.blockNumber,
    );

    for (const i of closeEvents) {
      if (i.tradeType == TradeType.LONG_CALL || i.tradeType == TradeType.LONG_PUT) {
        totalLongAmountClose = totalLongAmountClose.add(decimalToBN(i.amount));
        totalLongTotalCostClose = totalLongTotalCostClose.add(decimalToBN(i.totalCost));
      } else {
        totalShortAmountClose = totalShortAmountClose.add(decimalToBN(i.amount.toString()));
        totalShortTotalCostClose = totalShortTotalCostClose.add(decimalToBN(i.totalCost.toString()));
      }
    }

    const settleEvents = (
      await getEventsFromLyraContract(params, 'ShortCollateral', 'OptionsSettled', {}, ticker)
    ).filter(x => x.blockNumber >= latestRoundStartedEvent.blockNumber);

    for (const i of settleEvents) {
      const strike = decimalToBN(i.strike);
      const priceAtExpiry = decimalToBN(i.priceAtExpiry);
      const amount = decimalToBN(i.amount);
      if (i.tradeType == TradeType.LONG_CALL && priceAtExpiry.gt(strike)) {
        totalLongSettleValue = totalLongSettleValue.add(priceAtExpiry.sub(strike).mul(amount).div(UNIT));
      } else if (i.tradeType == TradeType.LONG_PUT && strike.gt(priceAtExpiry)) {
        totalLongSettleValue = totalLongSettleValue.add(strike.sub(priceAtExpiry).mul(amount).div(UNIT));
      } else if (i.tradeType == TradeType.SHORT_CALL && priceAtExpiry.gt(strike)) {
        totalShortSettleValue = totalShortSettleValue.add(priceAtExpiry.sub(strike).mul(amount).div(UNIT));
      } else if (i.tradeType == TradeType.SHORT_PUT && strike.gt(priceAtExpiry)) {
        totalShortSettleValue = totalShortSettleValue.add(strike.sub(priceAtExpiry).mul(amount).div(UNIT));
      }
    }

    console.log(`${ticker} amount of opens          - ${openEvents.length}`);
    console.log(`${ticker} amount of closes         - ${closeEvents.length}`);
    console.log();
    console.log(`${ticker} totalLongAmountOpen      - ${fromBN(totalLongAmountOpen)}`);
    console.log(`${ticker} totalLongAmountClose     - ${fromBN(totalLongAmountClose)}`);
    console.log(`${ticker} totalShortAmountOpen     - ${fromBN(totalShortAmountOpen)}`);
    console.log(`${ticker} totalShortAmountClose    - ${fromBN(totalShortAmountClose)}`);
    console.log();
    console.log(`${ticker} totalLongTotalCostOpen   - ${fromBN(totalLongTotalCostOpen)}`);
    console.log(`${ticker} totalLongTotalCostClose  - ${fromBN(totalLongTotalCostClose)}`);
    console.log(`${ticker} totalShortTotalCostOpen  - ${fromBN(totalShortTotalCostOpen)}`);
    console.log(`${ticker} totalShortTotalCostClose - ${fromBN(totalShortTotalCostClose)}`);
    console.log();
    console.log(`${ticker} totalLongSettleValue     - ${fromBN(totalLongSettleValue)}`);
    console.log(`${ticker} totalShortSettleValue    - ${fromBN(totalShortSettleValue)}`);
    console.log();
    console.log(`${ticker} unique traders           - ${Object.keys(uniqueAddresses).length}`);
  }
}
