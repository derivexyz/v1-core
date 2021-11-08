import { BigNumber } from 'ethers';
import { Params } from '../util';
import { callLyraFunction } from '../util/transactions';
import { fromBN, UNIT } from '../util/web3utils';

export async function getPerListingBreakdown(params: Params, tickers: string[]) {
  console.log('=================');
  console.log('= Listing stats =');
  console.log('=================');

  for (const ticker of tickers) {
    console.log(`\n= ${ticker} market =\n`);
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
        const listingCache: any = await callLyraFunction(
          params,
          'OptionGreekCache',
          'listingCaches',
          [listing.listingId],
          ticker,
        );

        const callExposure = listing.longCall.sub(listing.shortCall);
        const putExposure = listing.longPut.sub(listing.shortPut);

        const callNetDelta = listingCache.callDelta.mul(callExposure).div(UNIT);
        const putNetDelta = listingCache.putDelta.mul(putExposure).div(UNIT);

        console.log('-----')
        console.log(`Listing id: ${listing.listingId}\nstrike: ${fromBN(listing.strike)}\nexpiry: ${listing.expiry.toNumber()}\n`);
        console.log(`call delta: ${fromBN(listingCache.callDelta)}\nput delta: ${fromBN(listingCache.putDelta)}\nstd vega: ${fromBN(listingCache.stdVega)}\n`);
        console.log(`long calls: ${fromBN(listing.longCall)}\nlong put: ${fromBN(listing.longPut)}\nshort calls: ${fromBN(listing.shortCall)}\nshort put: ${fromBN(listing.shortPut)}\n`);


        console.log(`net delta: ${fromBN(callNetDelta.add(putNetDelta))}`);
        console.log(`net std vega: ${fromBN(callExposure.add(putExposure).mul(listingCache.stdVega).div(UNIT))}`);
      }
    }
  }
}
