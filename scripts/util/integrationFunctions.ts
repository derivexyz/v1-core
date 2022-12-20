import { BigNumber, BigNumberish } from 'ethers';
import { assertCloseToPercentage } from '../../test/utils/assert';
import { TestSystemContractsType } from '../../test/utils/deployTestSystem';
import { fastForward } from '../../test/utils/evm';
import { expect } from '../../test/utils/testSetup';
import { TradeInputParametersStruct } from '../../typechain-types/OptionMarket';
import { currentTime, fromBN, getEventArgs, MAX_UINT128, OptionType } from './web3utils';
import { TestSystemContractsTypeGMX } from '../../test/utils/deployTestSystemGMX';

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function openPosition(
  testSystem: TestSystemContractsType | TestSystemContractsTypeGMX,
  _: string,
  openParams: {
    strikeId: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    positionId?: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: number;
  },
) {
  const marketTradeArgs = getMarketTradeArgs(openParams);
  const tx = await testSystem.optionMarket.openPosition(marketTradeArgs);
  const receipt = await tx.wait();

  // console.log(`TotalCost for trade: ${ fromBN(getEventArgs(receipt, 'PositionOpened').totalCost) } `);
  // console.log('-'.repeat(10));
  return getEventArgs(receipt, 'Trade').positionId;
}

export async function closePosition(
  testSystem: TestSystemContractsType | TestSystemContractsTypeGMX,
  market: string,
  closeParams: {
    strikeId: BigNumberish;
    positionId: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: number;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
) {
  const marketTradeArgs = getMarketTradeArgs(closeParams);
  const tx = await testSystem.optionMarket.closePosition(marketTradeArgs);
  const receipt = await tx.wait();

  // console.log(`TotalCost for trade: ${ fromBN(getEventArgs(receipt, 'PositionClosed').totalCost) } `);
  // console.log('-'.repeat(10));
  return getEventArgs(receipt, 'Trade').positionId;
}
export function getMarketTradeArgs(parameters: {
  strikeId: BigNumberish;
  positionId?: BigNumberish;
  optionType: OptionType;
  amount: BigNumberish;
  setCollateralTo?: BigNumberish;
  iterations?: BigNumberish;
  minTotalCost?: BigNumberish;
  maxTotalCost?: BigNumberish;
}): TradeInputParametersStruct {
  return {
    strikeId: parameters.strikeId,
    positionId: parameters.positionId || 0,
    amount: parameters.amount,
    setCollateralTo: parameters.setCollateralTo || 0,
    iterations: parameters.iterations || 1,
    minTotalCost: parameters.minTotalCost || 0,
    maxTotalCost: parameters.maxTotalCost || MAX_UINT128,
    optionType: parameters.optionType,
  };
}

export async function forceUpdateHedgePosition(testSetup: TestSystemContractsType) {
  const expectedHedge = await testSetup.poolHedger.getCappedExpectedHedge();
  const currentHedge = await testSetup.poolHedger.getCurrentHedgedNetDelta();

  if (expectedHedge.eq(currentHedge)) {
    console.log(`Expected == current`);
    return;
  }
  if (currentHedge.eq(0)) {
    if (!expectedHedge.eq(0)) {
      await testSetup.poolHedger.hedgeDelta();
    }
    await printDelta(testSetup);
    return;
  }

  const interactionDelay = (await testSetup.poolHedger.getPoolHedgerParams()).interactionDelay;
  const lastInteraction = await testSetup.poolHedger.lastInteraction();
  const currentBlockTime = BigNumber.from(await currentTime());
  const timeSinceLastUpdate = currentBlockTime.sub(lastInteraction);

  if (timeSinceLastUpdate.lt(interactionDelay)) {
    await fastForward(interactionDelay.sub(timeSinceLastUpdate).add(1).toNumber());
  }

  await testSetup.poolHedger.hedgeDelta();
  await printDelta(testSetup);
}

export async function printDelta(testSystem: TestSystemContractsType) {
  console.log(`Expected hedge position: ${fromBN(await testSystem.poolHedger.getCappedExpectedHedge())} `);
  console.log(`Current hedged position: ${fromBN(await testSystem.poolHedger.getCurrentHedgedNetDelta())} `);
}

export async function printFuturesDelta(testSystem: TestSystemContractsType) {
  console.log(`Expected hedge position: ${fromBN(await testSystem.poolHedger.getCappedExpectedHedge())} `);
  console.log(`Current hedged position: ${fromBN(await testSystem.poolHedger.getCurrentHedgedNetDelta())} `);
}

export async function updateCaches(testSystem: TestSystemContractsType) {
  const liveBoards = await testSystem.optionMarket.getLiveBoards();
  for (const boardId of liveBoards) {
    await testSystem.optionGreekCache.updateBoardCachedGreeks(boardId);
  }
}

export async function expectHedgeEqualTo(testSystem: TestSystemContractsType, expectedHedge: BigNumber) {
  const currentHedgedNetDelta = await testSystem.poolHedger.getCurrentHedgedNetDelta();
  expect(assertCloseToPercentage(currentHedgedNetDelta, expectedHedge));
}

export async function expectFuturesHedgeEqualTo(testSystem: TestSystemContractsType, expectedHedge: BigNumber) {
  const currentHedgedNetDelta = await testSystem.poolHedger.getCurrentHedgedNetDelta();
  expect(assertCloseToPercentage(currentHedgedNetDelta, expectedHedge));
}

export async function forceUpdateFuturesHedgePosition(testSetup: TestSystemContractsType) {
  const expectedHedge = await testSetup.poolHedger.getCappedExpectedHedge();
  const currentHedge = await testSetup.poolHedger.getCurrentHedgedNetDelta();

  if (expectedHedge.eq(currentHedge)) {
    console.log(`Expected == current`);
    return;
  }

  const interactionDelay = (await testSetup.poolHedger.getPoolHedgerParams()).interactionDelay;

  // TODO: why would this work.
  // tries to hedge immediatley after
  if (currentHedge.eq(0)) {
    console.log('expected hedge', expectedHedge);
    if (!expectedHedge.eq(0)) {
      console.log('hedges delta with out adjusting timestamp');
      await testSetup.poolHedger.hedgeDelta();
    }
    await printFuturesDelta(testSetup);
    return;
  }

  const lastInteraction = await testSetup.poolHedger.lastInteraction();
  const currentBlockTime = BigNumber.from(await currentTime());
  const timeSinceLastUpdate = currentBlockTime.sub(lastInteraction);

  if (timeSinceLastUpdate.lt(interactionDelay)) {
    console.log('fast forwarding');
    await fastForward(interactionDelay.sub(timeSinceLastUpdate).add(3).toNumber());
  }

  await testSetup.poolHedger.hedgeDelta();
}
