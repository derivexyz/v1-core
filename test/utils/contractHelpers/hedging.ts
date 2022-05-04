import { BigNumberish } from 'ethers';
import { openPosition } from '.';
import { OptionType, toBN } from '../../../scripts/util/web3utils';
import { hre } from '../testSetup';

export async function getRequiredHedge() {
  return (await hre.f.c.optionGreekCache.getGlobalNetDelta()).sub(
    await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address),
  );
}

export async function forceCloseShortAccount() {
  const shortAccountId = await hre.f.c.poolHedger.shortId();
  await hre.f.c.snx.collateralShort.testForceClose(shortAccountId);
}

export async function getShortAmount() {
  const params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
  const [shortAmount] = await hre.f.c.poolHedger.getShortPosition(params.short);
  return shortAmount;
}

export async function getShortCollateral() {
  const params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
  const [, collateral] = await hre.f.c.poolHedger.getShortPosition(params.short);
  return collateral;
}

export async function setPositiveExpectedHedge(amtOverride?: BigNumberish) {
  const result = await openPosition({
    strikeId: hre.f.strike.strikeId,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: amtOverride || toBN('10'),
    setCollateralTo: toBN('20000'),
    iterations: 1,
  });

  return result[1];
}

export async function setNegativeExpectedHedge(amtOverride?: BigNumberish) {
  const result = await openPosition({
    strikeId: hre.f.strike.strikeId,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: amtOverride || toBN('10'),
    setCollateralTo: toBN('10'),
    iterations: 1,
  });

  return result[1];
}
