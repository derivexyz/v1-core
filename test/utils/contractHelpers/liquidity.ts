import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, BigNumberish } from 'ethers';
import { getSpotPrice, getTotalCost, openPosition } from '.';
import { currentTime, MONTH_SEC, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { LiquidityStructOutput } from '../../../typechain-types/LiquidityPool';
import { DEFAULT_POOL_DEPOSIT, DEFAULT_PRICING_PARAMS } from '../defaultParams';
import { hre } from '../testSetup';

export async function getLiquidity() {
  return await hre.f.c.liquidityPool.getLiquidity();
}

export async function setFreeLiquidityToZero() {
  // assumes deployer is the only depositor
  const LPtokens = await hre.f.c.liquidityToken.balanceOf(hre.f.signers[0].address);
  await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, LPtokens);
}

export async function fillLiquidityWithLongCall(): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  return await openLongCallAndGetLiquidity(toBN('250'));
}

export async function fillLiquidityWithLongPut(): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  return await openLongPutAndGetLiquidity(toBN('200'));
}

export async function fillLiquidityWithShortCallBase(): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  // set large SS to not trigger minSkew/Vol/Delta params
  await hre.f.c.optionMarketPricer.setPricingParams({
    ...DEFAULT_PRICING_PARAMS,
    standardSize: toBN('1000'),
    skewAdjustmentFactor: toBN('0.01'),
  });

  return await openShortCallBaseAndGetLiquidity(toBN('1500'), toBN('1500'));
}

export async function fillLiquidityWithShortPut(): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  // set large SS to not trigger minSkew/Vol/Delta params
  await hre.f.c.optionMarketPricer.setPricingParams({
    ...DEFAULT_PRICING_PARAMS,
    standardSize: toBN('1000'),
    skewAdjustmentFactor: toBN('0.01'),
  });

  const minCollat = await hre.f.c.optionGreekCache.getMinCollateral(
    OptionType.SHORT_PUT_QUOTE,
    toBN('2000'),
    (await currentTime()) + MONTH_SEC,
    await getSpotPrice(),
    toBN('1500'),
  );

  return await openShortPutAndGetLiquidity(toBN('1500'), minCollat.div(UNIT).mul(toBN('1.1'))); // add buffer to prevent <minCollat reverts
}

export async function partiallyFillLiquidityWithLongCall(): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  return await openLongCallAndGetLiquidity(toBN('200'));
}

export async function openLongCallAndGetLiquidity(
  amount: BigNumber,
): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  const [tx, positionId] = await openPosition({
    strikeId: 2,
    iterations: 5,
    optionType: OptionType.LONG_CALL,
    amount: amount,
  });
  const [totalCost, reservedFee] = await getTotalCost(tx);
  const liquidity = await getLiquidity();

  // const exchangeParams = await hre.f.c.exchangeAdapter.getExchangeParams(hre.f.c.optionMarket.address);
  // const toBaseFee = exchangeParams.quoteBaseFeeRate;
  // const snxFee = toBaseFee.mul(amount).mul(exchangeParams.spotPrice).div(UNIT).div(UNIT);

  const availableQuoteForHedge = DEFAULT_POOL_DEPOSIT.add(totalCost)
    .sub(reservedFee)
    .sub(liquidity.reservedCollatLiquidity);
  // .sub(snxFee);
  return [availableQuoteForHedge, liquidity, positionId];
}

export async function openLongPutAndGetLiquidity(
  amount: BigNumber,
  strikeId?: BigNumberish,
): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  const [tx, posId] = await openPosition({
    strikeId: strikeId || 2,
    iterations: 5,
    optionType: OptionType.LONG_PUT,
    amount: amount,
  });
  const [totalCost, reservedFee] = await getTotalCost(tx);
  const liquidity = await getLiquidity();

  const availableQuoteForHedge = DEFAULT_POOL_DEPOSIT.add(totalCost)
    .sub(reservedFee)
    .sub(liquidity.reservedCollatLiquidity);
  return [availableQuoteForHedge, liquidity, posId];
}

export async function openShortCallBaseAndGetLiquidity(
  amount: BigNumber,
  setCollateralTo: BigNumber,
): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  const result = await openPosition({
    strikeId: 2,
    iterations: 5,
    optionType: OptionType.SHORT_CALL_BASE,
    setCollateralTo: setCollateralTo,
    amount: amount,
  });
  const [totalCost, reservedFee] = await getTotalCost(result[0]);
  const liquidity = await getLiquidity();

  const availableQuoteForHedge = DEFAULT_POOL_DEPOSIT.sub(totalCost)
    .sub(reservedFee)
    .sub(liquidity.reservedCollatLiquidity);
  return [availableQuoteForHedge, liquidity, result[1]];
}

export async function openShortCallQuoteAndGetLiquidity(
  amount: BigNumber,
  setCollateralTo: BigNumber,
): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  const result = await openPosition({
    strikeId: 2,
    iterations: 5,
    optionType: OptionType.SHORT_CALL_QUOTE,
    setCollateralTo: setCollateralTo,
    amount: amount,
  });
  const [totalCost, reservedFee] = await getTotalCost(result[0]);
  const liquidity = await getLiquidity();

  const availableQuoteForHedge = DEFAULT_POOL_DEPOSIT.sub(totalCost)
    .sub(reservedFee)
    .sub(liquidity.reservedCollatLiquidity);
  return [availableQuoteForHedge, liquidity, result[1]];
}

export async function openShortPutAndGetLiquidity(
  amount: BigNumber,
  setCollateralTo: BigNumber,
): Promise<[BigNumber, LiquidityStructOutput, BigNumber]> {
  const result = await openPosition({
    strikeId: 2,
    iterations: 5,
    optionType: OptionType.SHORT_PUT_QUOTE,
    setCollateralTo: setCollateralTo,
    amount: amount,
  });
  const [totalCost, reservedFee] = await getTotalCost(result[0]);
  const liquidity = await getLiquidity();

  const availableQuoteForHedge = DEFAULT_POOL_DEPOSIT.sub(totalCost)
    .sub(reservedFee)
    .sub(liquidity.reservedCollatLiquidity);
  return [availableQuoteForHedge, liquidity, result[1]];
}

export async function initiateFullLPWithdrawal(signer: SignerWithAddress) {
  const balance = await hre.f.c.liquidityToken.balanceOf(signer.address);
  await hre.f.c.liquidityPool.connect(signer).initiateWithdraw(signer.address, balance);
}

export async function initiatePercentLPWithdrawal(signer: SignerWithAddress, percent: BigNumber) {
  const balance = await hre.f.c.liquidityToken.balanceOf(signer.address);
  const portion = balance.mul(percent).div(UNIT);
  return await hre.f.c.liquidityPool.connect(signer).initiateWithdraw(signer.address, portion);
}
