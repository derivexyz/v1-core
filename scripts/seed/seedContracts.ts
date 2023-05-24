import { BigNumber } from 'ethers';
import { DeploymentParams, isRealGmx, isRealSnx } from '../util';
import { ParamHandler } from '../util/parseFiles';
import { callLyraFunction, getLyraContract } from '../util/transactions';
import { fromBN } from '../util/web3utils';
import { createBoards, generateBoards } from './createBoards';
import { hedgeDelta } from './hedgeDelta';
import { seedDeposit } from './seedDeposit';
import { seedMint } from './seedMint';
import { seedTrades } from './seedTrades';
import { updateGlobalOwners, updateMarketOwners } from './changeOwners';

export async function seedContracts(deploymentParams: DeploymentParams, params: ParamHandler) {
  
  if (isRealSnx(deploymentParams.deploymentType)) {
    await callLyraFunction(deploymentParams, 'TestFaucet', 'drip', []);
    console.log('params', params);

    console.log('Seed minting running');
    if (params.get('Seed', 'mintFunds', 'run')) {
      for (const market in params.get('Seed', 'mintFunds', 'markets')) {
        console.log('PARAMS being passed into seedMint', params);
        await seedMint(deploymentParams, params, market);
      }
    }

    console.log('seed deposit running');
    if (params.get('Seed', 'deposit', 'run')) {
      for (const market in params.get('Seed', 'deposit', 'markets')) {
        await seedDeposit(deploymentParams, params, market);
      }
    }
  } else {
    console.log('real snx, skipping minting');
  }
  

  // TODO: generalise/remove references to SNX in following functions
  // exercisable board simulation
  // for (const market in params.get('Seed', 'addExercisableOptions', 'markets')) {
  //   if (params.get('Seed', 'addExercisableOptions', 'markets', market, 'run')) {
  //     await exercisableBoardScenario(deploymentParams, market, params.get('Markets', market, 'MockPrice'));
  //   }
  // }
  //
  // // Liquidation seeding, partial collateral and insolvency
  // for (const market in params.get('Seed', 'seedLiquidations', 'markets')) {
  //   if (params.get('Seed', 'seedLiquidations', 'markets', market)) {
  //     await seedLiquidations(deploymentParams, market, params.get('Markets', market, 'MockPrice'));
  //   }
  // }

  if (params.get('Seed', 'addBoards', 'run')) {
    for (const market in params.get('Seed', 'addBoards', 'markets')) {
      let boards = params.get('Seed', 'addBoards', 'markets', market, 'staticBoards');

      if (!boards && params.get('Seed', 'addBoards', 'markets', market, 'generated')) {
        let price = params.get('Markets', market, 'MockPrice');
        if (!price || isRealGmx(deploymentParams.deploymentType) || isRealSnx(deploymentParams.deploymentType)) {
          const rate: BigNumber = await callLyraFunction(deploymentParams, 'ExchangeAdapter', 'getSpotPriceForMarket', [
            getLyraContract(deploymentParams, 'OptionMarket', market).address,
            0,
          ]);
          price = fromBN(rate);
        }
        boards = await generateBoards(price);
      }
      await createBoards(deploymentParams, boards, market);
    }
  }

  // seedRandomTrades
  // for (const market in params.get('Seed', 'seedTrades', 'markets')) {
  //   if (params.get('Seed', 'seedTrades', 'markets', market)) {
  //     await seedTrades(deploymentParams, params, market);
  //   }
  // }

  // for (const market in params.get('Seed', 'hedgeDelta', 'markets')) {
  //   if (params.get('Seed', 'hedgeDelta', 'markets', market)) {
  //     // await updateCaches(deploymentParams, market);
  //     await hedgeDelta(deploymentParams, market);
  //   }
  // }

  // if (params.get('Seed', 'changeOwner', 'run')) {
  //   if (params.get('Seed', 'changeOwner', 'globalOwner')) {
  //     await updateGlobalOwners(deploymentParams, params.get('Seed', 'changeOwner', 'globalOwner'));
  //   }
  //   for (const market in params.get('Seed', 'changeOwner', 'markets')) {
  //     await updateMarketOwners(deploymentParams, market, params.get('Seed', 'changeOwner', 'markets', market));
  //   }
  // }
}
