import { BigNumber } from 'ethers';
import { getEventsFromLyraContract } from '../events';
import { Params } from '../util';
import { callLyraFunction } from '../util/transactions';
import { decimalToBN, fromBN, toBytes32, UNIT } from '../util/web3utils';

export async function getCurrentLPPosition(params: Params, tickers: string[]) {
  console.log('============');
  console.log('= LP stats =');
  console.log('============');

  for (const ticker of tickers) {
    console.log(`\n= ${ticker} market =\n`);
    let longCallExposure = BigNumber.from(0);
    let longPutExposure = BigNumber.from(0);
    let shortCallExposure = BigNumber.from(0);
    let shortPutExposure = BigNumber.from(0);
    let longCallDebt = BigNumber.from(0);
    let longPutDebt = BigNumber.from(0);
    let shortCallCredit = BigNumber.from(0);
    let shortPutCredit = BigNumber.from(0);

    let avgBasePurchasePrice = BigNumber.from(0);
    let basePurchasedAmount = BigNumber.from(0);
    let avgBaseSalePrice = BigNumber.from(0);
    let baseSoldAmount = BigNumber.from(0);

    const roundStartedEvents = await getEventsFromLyraContract(params, 'LiquidityPool', 'RoundStarted', {}, ticker);

    const latestRoundStartedEvent = roundStartedEvents.reduce(
      (a: any, b: any) => (a.newMaxExpiryTimestamp > b.newMaxExpiryTimestamp ? a : b),
      { newMaxExpiryTimestamp: 0 },
    );

    const liveBoards: BigNumber[] = await callLyraFunction(params, 'OptionMarket', 'getLiveBoards', [], ticker);

    for (const boardId of liveBoards) {
      const listings: any = await callLyraFunction(
        params,
        'OptionMarketViewer',
        'getListingsForBoard',
        [boardId],
        ticker,
      );
      for (const listing of listings) {
        longCallExposure = longCallExposure.add(listing.longCall);
        longPutExposure = longPutExposure.add(listing.longPut);
        shortCallExposure = shortCallExposure.add(listing.shortCall);
        shortPutExposure = shortPutExposure.add(listing.shortPut);
        longCallDebt = longCallDebt.add(listing.longCall.mul(listing.callPrice).div(UNIT));
        longPutDebt = longPutDebt.add(listing.longPut.mul(listing.putPrice).div(UNIT));
        shortCallCredit = shortCallCredit.add(listing.shortCall.mul(listing.callPrice).div(UNIT));
        shortPutCredit = shortPutCredit.add(listing.shortPut.mul(listing.putPrice).div(UNIT));
      }
    }

    const basePurchasedEvents = await getEventsFromLyraContract(params, 'LiquidityPool', 'BasePurchased', {}, ticker);
    for (const basePurchasedEvent of basePurchasedEvents) {
      if (basePurchasedEvent.blockNumber < latestRoundStartedEvent.blockNumber) {
        continue;
      }
      const newTotal = basePurchasedAmount.add(decimalToBN(basePurchasedEvent.amountPurchased));
      avgBasePurchasePrice = avgBasePurchasePrice
        .mul(basePurchasedAmount)
        .add(decimalToBN(basePurchasedEvent.quoteSpent).mul(UNIT))
        .div(newTotal); // (1e36 + 1e36) / 1e18 => factors out correctly
      basePurchasedAmount = newTotal;
    }
    const baseSoldEvents = await getEventsFromLyraContract(params, 'LiquidityPool', 'BaseSold', {}, ticker);
    for (const baseSoldEvent of baseSoldEvents) {
      if (baseSoldEvent.blockNumber < latestRoundStartedEvent.blockNumber) {
        continue;
      }
      const newTotal = baseSoldAmount.add(decimalToBN(baseSoldEvent.amountSold));
      avgBaseSalePrice = avgBaseSalePrice
        .mul(baseSoldAmount)
        .add(decimalToBN(baseSoldEvent.quoteReceived).mul(UNIT))
        .div(newTotal); // (1e36 + 1e36) / 1e18 => factors out correctly
      baseSoldAmount = newTotal;
    }

    const currentBasePrice = await callLyraFunction(params, 'LyraGlobals', 'getSpotPrice', [toBytes32(ticker)]);
    const currentBaseBalance = basePurchasedAmount.sub(baseSoldAmount);
    const currentBaseValue = currentBaseBalance.mul(currentBasePrice).div(UNIT);

    console.log('longCallExposure     - ', fromBN(longCallExposure));
    console.log('longPutExposure      - ', fromBN(longPutExposure));
    console.log('shortCallExposure    - ', fromBN(shortCallExposure));
    console.log('shortPutExposure     - ', fromBN(shortPutExposure));
    console.log();
    console.log('longCallDebt         - ', fromBN(longCallDebt));
    console.log('longPutDebt          - ', fromBN(longPutDebt));
    console.log('shortCallCredit      - ', fromBN(shortCallCredit));
    console.log('shortPutCredit       - ', fromBN(shortPutCredit));
    console.log();
    console.log('avgBasePurchasePrice - ', fromBN(avgBasePurchasePrice));
    console.log('basePurchasedAmount  - ', fromBN(basePurchasedAmount));
    console.log('avgBaseSalePrice     - ', fromBN(avgBaseSalePrice));
    console.log('baseSoldAmount       - ', fromBN(baseSoldAmount));
    console.log();
    console.log('currentBasePrice     - ', fromBN(currentBasePrice));
    console.log('currentBaseBalance   - ', fromBN(currentBaseBalance));
    console.log('currentBaseValue     - ', fromBN(currentBaseValue));
  }
}
