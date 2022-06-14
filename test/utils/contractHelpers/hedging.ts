import { BigNumberish } from 'ethers';
import { openPosition } from '.';
import { OptionType, toBN } from '../../../scripts/util/web3utils';
import { hre } from '../testSetup';

export async function getRequiredHedge() {
  return (await hre.f.c.optionGreekCache.getGlobalNetDelta()).sub(
    // await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address),
    (await hre.f.c.liquidityPool.lockedCollateral()).base,
  );
}

export async function forceCloseShortAccount() {
  const shortAccountId = await hre.f.c.poolHedger.shortId();
  await hre.f.c.snx.collateralShort.testForceClose(shortAccountId);
}

export async function getShortAmount() {
  const [shortAmount] = await hre.f.c.poolHedger.getShortPosition();
  return shortAmount;
}

export async function getShortCollateral() {
  const [, collateral] = await hre.f.c.poolHedger.getShortPosition();
  return collateral;
}

export async function setPositiveExpectedHedge(amtOverride?: BigNumberish, collatOverride?: BigNumberish) {
  const result = await openPosition({
    strikeId: hre.f.strike.strikeId,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: amtOverride || toBN('10'),
    setCollateralTo: collatOverride || toBN('20000'),
    iterations: 1,
  });

  return result[1];
}

export async function setNegativeExpectedHedge(amtOverride?: BigNumberish, collatOverride?: BigNumberish) {
  const result = await openPosition({
    strikeId: hre.f.strike.strikeId,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: amtOverride || toBN('10'),
    setCollateralTo: collatOverride || toBN('10'),
    iterations: 1,
  });

  return result[1];
}
