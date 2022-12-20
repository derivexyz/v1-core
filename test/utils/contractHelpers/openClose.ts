import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { getEventArgs, MAX_UINT128, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { TradeEvent, TradeInputParametersStruct } from '../../../typechain-types/OptionMarket';
import { PositionWithOwnerStructOutput, TradeParametersStruct } from '../../../typechain-types/OptionToken';
import { assertCloseToPercentage } from '../assert';
import { TestSystemContractsType } from '../deployTestSystem';
import { expect, hre } from '../testSetup';
import { getSpotPrice } from './synthetix';
import { TestSystemContractsTypeGMX } from '../deployTestSystemGMX';

function getMarketTradeArgs(
  c: TestSystemContractsType | TestSystemContractsTypeGMX,
  parameters: {
    strikeId: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
): TradeInputParametersStruct {
  return {
    strikeId: parameters.strikeId,
    positionId: parameters.positionId || 0,
    amount: parameters.amount,
    setCollateralTo: parameters.setCollateralTo || 0,
    iterations: parameters.iterations === undefined ? 1 : parameters.iterations,
    minTotalCost: parameters.minTotalCost === undefined ? 0 : parameters.minTotalCost,
    maxTotalCost: parameters.maxTotalCost === undefined ? MAX_UINT128 : parameters.maxTotalCost,
    optionType: parameters.optionType,
  };
}

export async function openPositionWithOverrides(
  c: TestSystemContractsType | TestSystemContractsTypeGMX,
  parameters: {
    strikeId: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
  sender?: SignerWithAddress,
): Promise<[ContractTransaction, BigNumber]> {
  // console.log(`Position opening amount ${parameters.amount}`)
  const tx = await (sender ? c.optionMarket.connect(sender) : c.optionMarket).openPosition(
    getMarketTradeArgs(c, parameters),
  );
  // console.log(`Position opened`)
  const event = getEventArgs(await tx.wait(), 'Trade');
  return [tx, event.positionId];
}

export async function closePositionWithOverrides(
  c: TestSystemContractsType | TestSystemContractsTypeGMX,
  parameters: {
    strikeId: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
    forceClose?: boolean;
  },
  sender?: SignerWithAddress,
): Promise<ContractTransaction> {
  return await (sender ? c.optionMarket.connect(sender) : c.optionMarket).closePosition(
    getMarketTradeArgs(c, parameters),
  );
}

export async function fullyClosePosition(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
): Promise<ContractTransaction> {
  const position: PositionWithOwnerStructOutput = await hre.f.c.optionToken.getPositionWithOwner(positionId);
  return closePositionWithOverrides(
    testSystemOverride || hre.f.c,
    {
      strikeId: position.strikeId,
      positionId: position.positionId,
      optionType: position.optionType,
      amount: position.amount,
    },
    sender ? sender : hre.f.signers[0],
  );
}

export async function partiallyClosePosition(
  positionId: BigNumberish,
  amount: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
): Promise<ContractTransaction> {
  const position: PositionWithOwnerStructOutput = await hre.f.c.optionToken.getPositionWithOwner(positionId);
  return closePositionWithOverrides(
    testSystemOverride || hre.f.c,
    {
      strikeId: position.strikeId,
      positionId: position.positionId,
      optionType: position.optionType,
      amount: amount,
      setCollateralTo: position.collateral,
    },
    sender ? sender : hre.f.signers[0],
  );
}

export async function forceClosePositionWithOverrides(
  c: TestSystemContractsType | TestSystemContractsTypeGMX,
  parameters: {
    strikeId: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    beneficiary?: string;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
    forceClose?: boolean;
  },
  sender?: SignerWithAddress,
): Promise<ContractTransaction> {
  return await (sender ? c.optionMarket.connect(sender) : c.optionMarket).forceClosePosition(
    getMarketTradeArgs(c, parameters),
  );
}

export const DEFAULT_SHORT_CALL_BASE = {
  amount: toBN('1'),
  optionType: OptionType.SHORT_CALL_BASE,
  setCollateralTo: toBN('0.5'),
};

export const DEFAULT_SHORT_CALL_QUOTE = {
  amount: toBN('1'),
  optionType: OptionType.SHORT_CALL_QUOTE,
  setCollateralTo: toBN('1000'),
};

export const DEFAULT_SHORT_PUT_QUOTE = {
  amount: toBN('1'),
  optionType: OptionType.SHORT_PUT_QUOTE,
  setCollateralTo: toBN('1000'),
};

export const DEFAULT_LONG_CALL = {
  amount: toBN('1'),
  optionType: OptionType.LONG_CALL,
  setCollateralTo: toBN('0'),
};

export const DEFAULT_LONG_PUT = {
  amount: toBN('1'),
  optionType: OptionType.LONG_PUT,
  setCollateralTo: toBN('0'),
};

export const DEFAULT_OPTIONS = {
  [OptionType.LONG_CALL]: DEFAULT_LONG_CALL,
  [OptionType.SHORT_CALL_BASE]: DEFAULT_SHORT_CALL_BASE,
  [OptionType.SHORT_CALL_QUOTE]: DEFAULT_SHORT_CALL_QUOTE,
  [OptionType.LONG_PUT]: DEFAULT_LONG_PUT,
  [OptionType.SHORT_PUT_QUOTE]: DEFAULT_SHORT_PUT_QUOTE,
};

export const CLOSE_FUNCTIONS = {
  [OptionType.LONG_CALL]: closeLongCall,
  [OptionType.SHORT_CALL_BASE]: closeShortCallBase,
  [OptionType.SHORT_CALL_QUOTE]: closeShortCallQuote,
  [OptionType.LONG_PUT]: closeLongPut,
  [OptionType.SHORT_PUT_QUOTE]: closeShortPutQuote,
};

export const OPEN_FUNCTIONS = {
  [OptionType.LONG_CALL]: openDefaultLongCall,
  [OptionType.SHORT_CALL_BASE]: openDefaultShortCallBase,
  [OptionType.SHORT_CALL_QUOTE]: openDefaultShortCallQuote,
  [OptionType.LONG_PUT]: openDefaultLongPut,
  [OptionType.SHORT_PUT_QUOTE]: openDefaultShortPutQuote,
};

export const ALL_TYPES = [
  OptionType.LONG_CALL,
  OptionType.SHORT_CALL_BASE,
  OptionType.SHORT_CALL_QUOTE,
  OptionType.LONG_PUT,
  OptionType.SHORT_PUT_QUOTE,
];

export async function openPosition(
  parameters: {
    strikeId?: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  return await openPositionWithOverrides(
    testSystemOverride || hre.f.c,
    {
      strikeId: parameters.strikeId || hre.f.strike.strikeId,
      ...parameters,
    },
    sender,
  );
}

export async function closePosition(
  parameters: {
    strikeId?: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  return await closePositionWithOverrides(
    testSystemOverride || hre.f.c,
    {
      strikeId: hre.f.strike.strikeId,
      ...parameters,
    },
    sender,
  );
}

export async function forceClosePosition(
  parameters: {
    strikeId?: BigNumberish;
    positionId?: BigNumberish;
    optionType: OptionType;
    amount: BigNumberish;
    setCollateralTo?: BigNumberish;
    iterations?: BigNumberish;
    minTotalCost?: BigNumberish;
    maxTotalCost?: BigNumberish;
  },
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  return await forceClosePositionWithOverrides(
    testSystemOverride || hre.f.c,
    {
      strikeId: hre.f.strike.strikeId,
      ...parameters,
    },
    sender,
  );
}

export async function getTotalCost(tx: ContractTransaction): Promise<[BigNumber, BigNumber]> {
  const receipt = await tx.wait();
  const tradeEvent = getEventArgs(receipt, 'Trade');
  return [tradeEvent.trade.totalCost, tradeEvent.trade.reservedFee];
}

export async function openDefaultLongCall(
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  const [, positionId] = await openPosition(
    {
      ...DEFAULT_LONG_CALL,
      strikeId: hre.f.strike.strikeId,
    },
    sender,
    testSystemOverride,
  );
  return positionId;
}

export async function openDefaultLongPut(
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  const [, positionId] = await openPosition(
    {
      ...DEFAULT_LONG_PUT,
      strikeId: hre.f.strike.strikeId,
    },
    sender,
    testSystemOverride,
  );
  return positionId;
}

export async function openDefaultShortCallBase(
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  const [, positionId] = await openPosition(
    {
      ...DEFAULT_SHORT_CALL_BASE,
      strikeId: hre.f.strike.strikeId,
    },
    sender,
    testSystemOverride,
  );
  return positionId;
}

export async function openDefaultShortCallQuote(
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  const [, positionId] = await openPosition(
    {
      ...DEFAULT_SHORT_CALL_QUOTE,
      strikeId: hre.f.strike.strikeId,
    },
    sender,
    testSystemOverride,
  );
  return positionId;
}

export async function openDefaultShortPutQuote(
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  const [, positionId] = await openPosition(
    {
      ...DEFAULT_SHORT_PUT_QUOTE,
      strikeId: hre.f.strike.strikeId,
    },
    sender,
    testSystemOverride,
  );
  return positionId;
}

export async function closeLongCall(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await closePosition(
    {
      ...DEFAULT_LONG_CALL,
      strikeId: hre.f.strike.strikeId,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function closeLongPut(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await closePosition(
    {
      ...DEFAULT_LONG_PUT,
      strikeId: hre.f.strike.strikeId,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function closeShortCallBase(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await closePosition(
    {
      ...DEFAULT_SHORT_CALL_BASE,
      strikeId: hre.f.strike.strikeId,
      setCollateralTo: 0,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function closeShortCallQuote(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await closePosition(
    {
      ...DEFAULT_SHORT_CALL_QUOTE,
      strikeId: hre.f.strike.strikeId,
      setCollateralTo: 0,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function closeShortPutQuote(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await closePosition(
    {
      ...DEFAULT_SHORT_PUT_QUOTE,
      strikeId: hre.f.strike.strikeId,
      setCollateralTo: 0,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function forceCloseLongCall(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await forceClosePosition(
    {
      ...DEFAULT_LONG_CALL,
      strikeId: hre.f.strike.strikeId,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function forceCloseLongPut(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await forceClosePosition(
    {
      ...DEFAULT_LONG_PUT,
      strikeId: hre.f.strike.strikeId,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function forceCloseShortCallBase(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await forceClosePosition(
    {
      ...DEFAULT_SHORT_CALL_BASE,
      strikeId: hre.f.strike.strikeId,
      setCollateralTo: 0,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function forceCloseShortCallQuote(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await forceClosePosition(
    {
      ...DEFAULT_SHORT_CALL_QUOTE,
      strikeId: hre.f.strike.strikeId,
      setCollateralTo: 0,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function forceCloseShortPutQuote(
  positionId: BigNumberish,
  sender?: SignerWithAddress,
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
) {
  await forceClosePosition(
    {
      ...DEFAULT_SHORT_PUT_QUOTE,
      strikeId: hre.f.strike.strikeId,
      setCollateralTo: 0,
      positionId,
    },
    sender,
    testSystemOverride,
  );
}

export async function openAllTrades(
  testSystemOverride?: TestSystemContractsType | TestSystemContractsTypeGMX,
): Promise<[BigNumber, BigNumber, BigNumber, BigNumber, BigNumber]> {
  return [
    await openDefaultLongCall(hre.f.deployer, testSystemOverride),
    await openDefaultLongPut(hre.f.deployer, testSystemOverride),
    await openDefaultShortCallBase(hre.f.deployer, testSystemOverride),
    await openDefaultShortCallQuote(hre.f.deployer, testSystemOverride),
    await openDefaultShortPutQuote(hre.f.deployer, testSystemOverride),
  ];
}

export async function openAllTradesWithEvents(): Promise<[any[], BigNumber[]]> {
  const [longCalltx, longCallId] = await openPosition({
    optionType: OptionType.LONG_CALL,
    amount: toBN('10'),
    strikeId: hre.f.strike.strikeId,
  });
  const longCallEvent = getEventArgs(await longCalltx.wait(), 'Trade');

  const [longPuttx, longPutId] = await openPosition({
    optionType: OptionType.LONG_PUT,
    amount: toBN('10'),
    strikeId: hre.f.strike.strikeId,
  });
  const longPutEvent = getEventArgs(await longPuttx.wait(), 'Trade');

  const [shortCallBasetx, shortCallBaseId] = await openPosition({
    optionType: OptionType.SHORT_CALL_BASE,
    amount: toBN('10'),
    setCollateralTo: toBN('10'),
    strikeId: hre.f.strike.strikeId,
  });
  const shortCallBaseEvent = getEventArgs(await shortCallBasetx.wait(), 'Trade');

  const [shortCallQuotetx, shortCallQuoteId] = await openPosition({
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('10'),
    setCollateralTo: toBN('15000'),
    strikeId: hre.f.strike.strikeId,
  });
  const shortCallQuoteEvent = getEventArgs(await shortCallQuotetx.wait(), 'Trade');

  const [shortPutQuotetx, shortPutQuoteId] = await openPosition({
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: toBN('10'),
    setCollateralTo: toBN('15000'),
    strikeId: hre.f.strike.strikeId,
  });
  const shortPutQuoteEvent = getEventArgs(await shortPutQuotetx.wait(), 'Trade');

  return [
    [longCallEvent, longPutEvent, shortCallBaseEvent, shortCallQuoteEvent, shortPutQuoteEvent],
    [longCallId, longPutId, shortCallBaseId, shortCallQuoteId, shortPutQuoteId],
  ];
}

export async function expectCorrectSettlement(positionIds: BigNumber[]) {
  // tuned for openAllTrades()

  // long call
  let oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[0]]);
  let change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('242.0727'), toBN('0.01'));

  // long put
  oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[1]]);
  change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('0'), toBN('0.01'));

  // short call base
  oldBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[2]]);
  change = (await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('0.3600'), toBN('0.01'));

  // short call quote
  oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[3]]);
  change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('757.98663'), toBN('0.01'));

  // short put quote
  oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[4]]);
  change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, DEFAULT_SHORT_PUT_QUOTE.setCollateralTo, toBN('0.01'));
}

export async function expectUSDCCorrectSettlement(positionIds: BigNumber[]) {
  // tuned for openAllTrades()

  // long call
  let oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[0]]);
  let change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('242.0727', 6), toBN('0.01'));

  // long put
  oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[1]]);
  change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('0', 6), toBN('0.01'));

  // short call base
  oldBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[2]]);
  change = (await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('0.3600'), toBN('0.01'));

  // short call quote
  oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[3]]);
  change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('757.98663', 6), toBN('0.01'));

  // short put quote
  oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  await hre.f.c.shortCollateral.settleOptions([positionIds[4]]);
  change = (await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).sub(oldBalance);
  assertCloseToPercentage(change, toBN('1000', 6), toBN('0.01'));
}

export async function estimateCallPayout(amount: string, strikeId: BigNumberish, isQuote: boolean) {
  const params = await hre.f.c.optionMarket.getSettlementParameters(strikeId);
  if (isQuote) {
    return params.priceAtExpiry > params.strikePrice
      ? params.priceAtExpiry.sub(params.strikePrice).mul(toBN(amount)).div(UNIT)
      : toBN('0');
  } else {
    return toBN(amount).mul(params.strikeToBaseReturned).div(UNIT);
  }
}

export async function estimatePutPayout(amount: string, strikeId: BigNumberish) {
  const spotPrice = await getSpotPrice();
  const strikePrice = (await hre.f.c.optionMarket.getStrike(strikeId)).strikePrice;

  return spotPrice.lt(strikePrice) ? strikePrice.sub(spotPrice).mul(toBN(amount)).div(UNIT) : toBN('0');
}

export async function duplicateOrders(
  orders: number,
  optionType?: OptionType,
  strikeId?: BigNumberish,
  amount?: BigNumber,
  setCollateralTo?: BigNumber,
  isOpen?: boolean,
  positionId?: BigNumber,
) {
  const cumulativeResults = { ...EMPTY_RESULT };

  let tx: ContractTransaction;
  let args: any;
  if (isOpen || isOpen == undefined) {
    // let args: TradeEvent['args'] = {} as any;
    for (let i = 0; i < orders; i++) {
      [tx] = await openPositionWithOverrides(hre.f.c, {
        optionType: optionType || OptionType.LONG_CALL,
        strikeId: strikeId || hre.f.strike.strikeId,
        amount: amount || toBN('1'),
        setCollateralTo: setCollateralTo || toBN('0'),
      });
      args = getEventArgs(await tx.wait(), 'Trade');
      cumulativeResults.premium = cumulativeResults.premium.add(args.tradeResults[0].premium);
      cumulativeResults.optionPriceFee = cumulativeResults.optionPriceFee.add(args.tradeResults[0].optionPriceFee);
      cumulativeResults.spotPriceFee = cumulativeResults.spotPriceFee.add(args.tradeResults[0].spotPriceFee);
      cumulativeResults.vegaUtilFee = cumulativeResults.vegaUtilFee.add(args.tradeResults[0].vegaUtilFee.vegaUtilFee);
      cumulativeResults.varianceFee = cumulativeResults.varianceFee.add(args.tradeResults[0].varianceFee.varianceFee);
    }
  } else {
    const currentCollat = (await hre.f.c.optionToken.getOptionPosition(positionId || 1)).collateral;
    let delta = toBN('0');
    for (let i = 0; i < orders; i++) {
      if (optionType != OptionType.LONG_CALL && optionType != OptionType.LONG_PUT && setCollateralTo != undefined) {
        delta = currentCollat.sub(setCollateralTo);
      }
      tx = await closePositionWithOverrides(hre.f.c, {
        positionId: positionId || 1,
        optionType: optionType || OptionType.LONG_CALL,
        strikeId: strikeId || hre.f.strike.strikeId,
        amount: amount || toBN('1'),
        setCollateralTo: currentCollat.sub(delta.div(orders).mul(i + 1)) || toBN('0'),
      });
      args = getEventArgs(await tx.wait(), 'Trade');
      cumulativeResults.premium = cumulativeResults.premium.add(args.tradeResults[0].premium);
      cumulativeResults.optionPriceFee = cumulativeResults.optionPriceFee.add(args.tradeResults[0].optionPriceFee);
      cumulativeResults.spotPriceFee = cumulativeResults.spotPriceFee.add(args.tradeResults[0].spotPriceFee);
      cumulativeResults.vegaUtilFee = cumulativeResults.vegaUtilFee.add(args.tradeResults[0].vegaUtilFee.vegaUtilFee);
      cumulativeResults.varianceFee = cumulativeResults.varianceFee.add(args.tradeResults[0].varianceFee.varianceFee);
    }
  }

  cumulativeResults.newBaseIv = args.tradeResults[0].newBaseIv;
  cumulativeResults.newSkew = args.tradeResults[0].newSkew;

  return cumulativeResults;
}

export async function orderWithCumulativeResults(
  iterations: number,
  optionType?: OptionType,
  strikeId?: BigNumberish,
  amount?: BigNumber,
  setCollateralTo?: BigNumber,
  isOpen?: boolean,
  positionId?: BigNumber,
) {
  const cumulativeResults = { ...EMPTY_RESULT };

  let tx: ContractTransaction;
  let args: any;
  if (isOpen || isOpen == undefined) {
    tx = (
      await openPositionWithOverrides(hre.f.c, {
        iterations: iterations || 1,
        optionType: optionType || OptionType.LONG_CALL,
        strikeId: strikeId || hre.f.strike.strikeId,
        amount: amount || toBN('1'),
        setCollateralTo: setCollateralTo || toBN('0'),
      })
    )[0];
    args = getEventArgs(await tx.wait(), 'Trade') as TradeEvent['args'];
  } else {
    tx = await closePositionWithOverrides(hre.f.c, {
      positionId: positionId || 1,
      iterations: iterations || 1,
      optionType: optionType || OptionType.LONG_CALL,
      strikeId: strikeId || hre.f.strike.strikeId,
      amount: amount || toBN('1'),
      setCollateralTo: setCollateralTo || toBN('0'),
    });
    args = getEventArgs(await tx.wait(), 'Trade') as TradeEvent['args'];
  }

  for (let i = 0; i < iterations; i++) {
    cumulativeResults.premium = cumulativeResults.premium.add(args.tradeResults[i].premium);
    cumulativeResults.optionPriceFee = cumulativeResults.optionPriceFee.add(args.tradeResults[i].optionPriceFee);
    cumulativeResults.spotPriceFee = cumulativeResults.spotPriceFee.add(args.tradeResults[i].spotPriceFee);
    cumulativeResults.vegaUtilFee = cumulativeResults.vegaUtilFee.add(args.tradeResults[i].vegaUtilFee.vegaUtilFee);
    cumulativeResults.varianceFee = cumulativeResults.varianceFee.add(args.tradeResults[i].varianceFee.varianceFee);

    cumulativeResults.newBaseIv = args.tradeResults[i].newBaseIv;
    cumulativeResults.newSkew = args.tradeResults[i].newSkew;
  }

  // cumulativeResults.newBaseIv = args.tradeResults[0].newBaseIv;
  // cumulativeResults.newSkew = args.tradeResults[0].newSkew;

  return cumulativeResults;
}

export function compareTradeResults(firstResult: CumulativeResults, secondResult: CumulativeResults) {
  // 0.001%
  assertCloseToPercentage(firstResult.premium, secondResult.premium, toBN('0.00001'));
  assertCloseToPercentage(firstResult.optionPriceFee, secondResult.optionPriceFee, toBN('0.00001'));

  // 0.5%
  assertCloseToPercentage(firstResult.vegaUtilFee, secondResult.vegaUtilFee, toBN('0.005'));

  // exact
  expect(firstResult.spotPriceFee).to.eq(secondResult.spotPriceFee);
  expect(firstResult.newBaseIv).to.eq(secondResult.newBaseIv);
  expect(firstResult.newSkew).to.eq(secondResult.newSkew);
}

export const emptyTradeObject: TradeParametersStruct = {
  amount: 0,
  spotPrice: 0,
  // exchangeParams: {
  //   spotPrice: 0,
  //   quoteKey: toBytes32(''),
  //   baseKey: toBytes32(''),
  //   quoteBaseFeeRate: 0,
  //   baseQuoteFeeRate: 0,
  // },
  expiry: 0,
  isBuy: false,
  isForceClose: false,
  liquidity: {
    freeLiquidity: 0,
    burnableLiquidity: 0,
    reservedCollatLiquidity: 0,
    pendingDeltaLiquidity: 0,
    usedDeltaLiquidity: 0,
    NAV: 0,
    longScaleFactor: 0,
  },
  optionType: 0,
  strikePrice: 0,
  tradeDirection: 0,
};

export type CumulativeResults = {
  premium: BigNumber;
  optionPriceFee: BigNumber;
  spotPriceFee: BigNumber;
  vegaUtilFee: BigNumber;
  varianceFee: BigNumber;
  newBaseIv: BigNumber;
  newSkew: BigNumber;
};

const EMPTY_RESULT = {
  premium: toBN('0'),
  optionPriceFee: toBN('0'),
  spotPriceFee: toBN('0'),
  vegaUtilFee: toBN('0'),
  varianceFee: toBN('0'),
  newBaseIv: toBN('0'),
  newSkew: toBN('0'),
};
