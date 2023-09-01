import { BigNumber } from 'ethers';
import { MarketViewStruct } from '../../typechain-types/OptionMarketViewer';
import { ExchangeParamsStruct } from '../../typechain-types/SynthetixAdapter';
import { DeploymentParams } from '../util';
import { callLyraFunction, executeExternalFunction, getLyraContract, openPosition } from '../util/transactions';
import { fromBN, getOptionTypeName, MAX_UINT, OptionType, toBN } from '../util/web3utils';
import { ParamHandler } from '../util/parseFiles';
import { PricingType } from '../../test/utils/defaultParams';

export async function seedTrades(deploymentParams: DeploymentParams, params: ParamHandler, market: string) {
  const quoteTicker = params.get('QuoteAsset');
  const baseTicker = params.get('Markets', market, 'BaseAsset');

  const tradeSeedParams = params.get('Seed', 'seedTrades', 'populationParameters');
  await executeExternalFunction(deploymentParams, quoteTicker, 'approve', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    MAX_UINT,
  ]);

  await executeExternalFunction(deploymentParams, baseTicker, 'approve', [
    getLyraContract(deploymentParams, 'OptionMarket', market).address,
    MAX_UINT,
  ]);

  console.log('\n= Seeding trades for all strikes');
  const optionMarketAddress = getLyraContract(deploymentParams, 'OptionMarket', market).address as string;
  const spotPrice = (await callLyraFunction(deploymentParams, 'ExchangeAdapter', 'getSpotPriceForMarket', [
    optionMarketAddress,
    PricingType.REFERENCE,
  ])) as ExchangeParamsStruct;

  const marketView: MarketViewStruct = await callLyraFunction(deploymentParams, 'OptionMarketViewer', 'getMarket', [
    optionMarketAddress,
  ]);

  for (const board of marketView.liveBoards) {
    let boardTotal = 0;
    for (const strike of board.strikes) {
      // probability of running a openPosition on this strike
      if (
        Math.random() >= (tradeSeedParams?.repetitionProbabilityPerBoard || 0.5) ||
        boardTotal == (tradeSeedParams?.maxPerBoard || 10) ||
        strike.cachedGreeks.callDelta < toBN('0.15') ||
        strike.cachedGreeks.callDelta > toBN('0.85')
      ) {
        continue;
      }

      const optionType = Math.floor(Math.random() * 5);
      const amount = Math.floor(Math.random() * 1000) / 100000 + 0.002;

      let setCollateralTo = BigNumber.from(0);
      switch (optionType) {
        case OptionType.SHORT_CALL_QUOTE:
          continue;
        case OptionType.SHORT_CALL_BASE:
        case OptionType.SHORT_PUT_QUOTE: {
          const minCollat: BigNumber = await callLyraFunction(
            deploymentParams,
            'OptionGreekCache',
            'getMinCollateral',
            [optionType, strike.strikePrice, board.expiry, spotPrice, toBN(amount.toString())],
            market,
          );
          setCollateralTo = minCollat.mul('11').div('10');
        }
      }

      console.log(
        `Opening ${amount.toPrecision(2)} ${getOptionTypeName(optionType)} for strike ${
          strike.strikeId
        }; collateral: ${fromBN(setCollateralTo)}`,
      );

      try {
        await openPosition(deploymentParams, market, {
          strikeId: strike.strikeId,
          optionType,
          amount: toBN(amount.toString()),
          setCollateralTo,
        });
      } catch (e) {
        if (!((e as any).message as string).includes('TradeDeltaOutOfRange')) {
          throw e;
        }
      }

      boardTotal++;
    }
  }

  console.log('= Trades seeded');
}
