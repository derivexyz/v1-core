import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { CONVERTUSDC, getEventArgs, toBN, UNIT } from '../../../scripts/util/web3utils';
import { TradeEvent } from '../../../typechain-types/OptionMarket';
import { hre } from '../testSetup';

export function calculateReservedFee(event: any, feePortion: BigNumberish) {
  let totalFee: BigNumber = toBN('0');

  for (const result of event.tradeResults) {
    totalFee = totalFee.add(result.totalFee);
  }

  return totalFee.mul(feePortion).div(UNIT);
}

export async function getRoutedFunds(
  tx: ContractTransaction,
  isOpen?: boolean,
): Promise<{ userDiff: BigNumber; optionMarketDiff: BigNumber; lpDiff: BigNumber }> {
  let args: any;
  if (isOpen || isOpen == undefined) {
    args = getEventArgs(await tx.wait(), 'Trade') as TradeEvent['args'];
  } else {
    args = getEventArgs(await tx.wait(), 'Trade') as TradeEvent['args'];
  }

  const reservedFee = calculateReservedFee(
    args,
    (await hre.f.c.optionMarket.getOptionMarketParams()).feePortionReserved,
  );
  return {
    userDiff: args.trade.totalCost,
    optionMarketDiff: reservedFee,
    lpDiff: args.trade.totalCost.sub(reservedFee),
  };
}

export async function getRoutedFunds6dp(
  tx: ContractTransaction,
  isOpen?: boolean,
): Promise<{ userDiff: BigNumber; optionMarketDiff: BigNumber; lpDiff: BigNumber }> {
  let args: any;
  if (isOpen || isOpen == undefined) {
    args = getEventArgs(await tx.wait(), 'Trade') as TradeEvent['args'];
  } else {
    args = getEventArgs(await tx.wait(), 'Trade') as TradeEvent['args'];
  }

  const reservedFee = calculateReservedFee(
    args,
    (await hre.f.c.optionMarket.getOptionMarketParams()).feePortionReserved,
  );
  return {
    userDiff: args.trade.totalCost.div(CONVERTUSDC),
    optionMarketDiff: reservedFee.div(CONVERTUSDC),
    lpDiff: args.trade.totalCost.sub(reservedFee).div(CONVERTUSDC),
  };
}
