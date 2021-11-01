import { getEventsFromLyraContract} from './index';
import { Params } from '../util';
import {decimalToBN, fromBN, UNIT } from "../util/web3utils";
import {callLyraFunction, callSynthetixFunction, getLyraContract} from "../util/transactions";
import {BigNumber} from "ethers";


export async function getLPExposure(params: Params, address: string, tickers: string[]) {
  console.log('===============');
  console.log('= LP exposure =');
  console.log('===============');

  for (const ticker of tickers) {
    console.log(`\n= ${ticker} market =\n`);

    const roundEndedEvents = await getEventsFromLyraContract(params, 'LiquidityPool', 'RoundEnded', {}, ticker);
    const roundStartedEvents = await getEventsFromLyraContract(params, 'LiquidityPool', 'RoundStarted', {}, ticker);

    const expiryToTokenValue: {[key:number]: number} = {
      0: 1e18,
    }
    roundEndedEvents.forEach((x) => {
      expiryToTokenValue[x.maxExpiryTimestamp] = x.pricePerToken
    })

    const latestRoundStartedEvent = roundStartedEvents.reduce(
      (a: any, b: any) => a.newMaxExpiryTimestamp > b.newMaxExpiryTimestamp ? a : b,
      {newMaxExpiryTimestamp: 0}
    )

    const certificates = await callLyraFunction(params, 'LiquidityCertificate', 'certificates', [address], ticker);

    let totalValue = decimalToBN(latestRoundStartedEvent.totalTokenSupply);

    let totalValueForAddress = BigNumber.from(0);

    for (const certificateId in certificates) {
      const certData = await callLyraFunction(params, 'LiquidityCertificate', 'certificateData', [certificateId], ticker)
      totalValueForAddress = totalValueForAddress.add(
        certData.liquidity.mul(expiryToTokenValue[certData.enteredAt.toNumber()].toString()).div(UNIT)
      )
    }

    const shareOfPool = totalValueForAddress.mul(UNIT).div(totalValue);

    console.log(`${address} is ${parseFloat(fromBN(shareOfPool)) * 100}% of the total pool`)

    console.log("== Delta exposure ==")

    const liveBoards: BigNumber[] = await callLyraFunction(params, 'OptionMarket', 'getLiveBoards', [], ticker);
    const deltaExposurePerListing: any = {};

    for (const boardId of liveBoards) {
      const listings: any = await callLyraFunction(
        params,
        'OptionMarketViewer',
        'getListingsForBoard',
        [boardId],
        ticker,
      );
      for (const listing of listings) {
        deltaExposurePerListing[listing.listingId.toNumber()] = {
          listingDeltaExposure: listing.longCall.mul(listing.callDelta).div(UNIT).sub(
            listing.shortCall.mul(listing.callDelta).div(UNIT)
          ).add(
            listing.longPut.mul(listing.putDelta).div(UNIT)
          ).sub(
            listing.shortPut.mul(listing.putDelta).div(UNIT)
          ),
          // Could look at the actual balance that is held in the contract
          // but this splits it up over all options (as the total balance should match total longCall exposure)
          collateralExposure: listing.longCall
        }
      }
    }

    const netDelta: any = Object.values(deltaExposurePerListing).reduce((a: any, b: any) => a.add(b.listingDeltaExposure), BigNumber.from(0))
    const collateralExposure: any = Object.values(deltaExposurePerListing).reduce((a: any, b: any) => a.add(b.collateralExposure), BigNumber.from(0))

    const cacheNetDelta: BigNumber = await callLyraFunction(params, 'OptionGreekCache', 'getGlobalNetDelta', [], ticker);
    const baseBalance: BigNumber = await callSynthetixFunction(params, 'Proxy'+ticker, 'balanceOf', [(await getLyraContract(params, 'LiquidityPool', ticker)).address]);

    console.log("Totals:")
    console.log({
      netDelta: fromBN(netDelta),
      cacheNetDelta: fromBN(cacheNetDelta),
      collateralExposure: fromBN(collateralExposure),
      baseBalance: fromBN(baseBalance)
    })

    console.log("\nFor given address:")
    console.log({
      netDelta: fromBN(netDelta.mul(shareOfPool).div(UNIT)),
      cacheNetDelta: fromBN(cacheNetDelta.mul(shareOfPool).div(UNIT)),
      collateralExposure: fromBN(collateralExposure.mul(shareOfPool).div(UNIT)),
      baseBalance: fromBN(baseBalance.mul(shareOfPool).div(UNIT))
    })
  }
}
