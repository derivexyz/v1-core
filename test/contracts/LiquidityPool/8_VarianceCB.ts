import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { currentTime, DAY_SEC, HOUR_SEC, MONTH_SEC, OptionType, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import { closePosition, openPosition } from '../../utils/contractHelpers';
import { DEFAULT_LIQUIDITY_POOL_PARAMS, DEFAULT_TRADE_LIMIT_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { hre } from '../../utils/testSetup';

const manualIvVarianceCBThreshold: BigNumber = toBN('0.01');
const manualSkewVarianceCBThreshold: BigNumber = toBN('0.05');
const manualIvVarianceCBTimeout = DAY_SEC;
const manualSkewVarianceCBTimeout = WEEK_SEC;

describe('Variance Circuit Breaker', async () => {
  // integration tests
  beforeEach(async () => {
    await seedFixture();
    // tighten variance params
    await hre.f.c.liquidityPool.setLiquidityPoolParameters({
      ...DEFAULT_LIQUIDITY_POOL_PARAMS,
      ivVarianceCBThreshold: manualIvVarianceCBThreshold,
      skewVarianceCBThreshold: manualSkewVarianceCBThreshold,
      ivVarianceCBTimeout: manualIvVarianceCBTimeout,
      skewVarianceCBTimeout: manualSkewVarianceCBTimeout,
      liquidityCBTimeout: MONTH_SEC, // set high to be obvious if accidentally triggered
    });

    await relaxTradeLimits(); // prevent delta/minIV/skew reverts
  });

  it('iv: increased if max exceeded', async () => {
    await initiateDepositAndWithdrawAndFastForward();

    await exceedOnlyIvVariance();
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualIvVarianceCBTimeout + (await currentTime()));

    await revertProcessDepositAndWithdraw();
  });

  it('skew: increased if max exceeded', async () => {
    await exceedIvAndSkewVariance();

    // expect delay by longest amount
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + (await currentTime()));
  });

  it('remains > threshold: updateCB increases timeout', async () => {
    await exceedIvAndSkewVariance();
    await fastForward(HOUR_SEC);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.updateCBs();

    // confirm variance > threshold
    expect((await getGlobalIvAndSkewVariance()).maxIvVariance).to.gt(manualIvVarianceCBThreshold);
    expect((await getGlobalIvAndSkewVariance()).maxSkewVariance).to.gt(manualSkewVarianceCBThreshold);

    // confirm timeout increased by longer amount
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + (await currentTime()));

    // repeat cycle
    await fastForward(HOUR_SEC);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.updateCBs();
    expect((await getGlobalIvAndSkewVariance()).maxIvVariance).to.gt(manualIvVarianceCBThreshold);
    expect((await getGlobalIvAndSkewVariance()).maxSkewVariance).to.gt(manualSkewVarianceCBThreshold);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + (await currentTime()));
  });

  it('returns to < threshold: stops increasing', async () => {
    await initiateDepositAndWithdrawAndFastForward(); // later used to test CB
    await exceedIvAndSkewVariance();
    const firstTimestamp = await currentTime();

    await fastForward(5 * DAY_SEC); // enough to reduce variance but not expire timeout
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.updateCBs();

    // confirm variance > threshold
    expect((await getGlobalIvAndSkewVariance()).maxIvVariance).to.lt(manualIvVarianceCBThreshold);
    expect((await getGlobalIvAndSkewVariance()).maxSkewVariance).to.lt(manualSkewVarianceCBThreshold);

    // confirm timeout not increased
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + firstTimestamp);

    // still blocks process
    expect(await currentTime()).to.lt(await hre.f.c.liquidityPool.CBTimestamp());
    await revertProcessDepositAndWithdraw();
  });

  it('board 1 < threshold & board 2 > threshold', async () => {
    await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: MONTH_SEC * 2 });

    const SHORT_CALL = {
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('10'),
      setCollateralTo: toBN('30000'),
    };

    // open on boath board 1 & 2
    const [, pos] = await openPosition({ ...SHORT_CALL, strikeId: 1 });
    expect((await getBoardIvAndSkewVariance(1)).maxIvVariance).to.gt(manualIvVarianceCBThreshold);
    await openPosition({ ...SHORT_CALL, strikeId: 4 });
    expect((await getBoardIvAndSkewVariance(2)).maxIvVariance).to.gt(manualIvVarianceCBThreshold);

    // drop iv variance on board 1
    await closePosition({ ...SHORT_CALL, strikeId: 1, positionId: pos, amount: toBN('10'), setCollateralTo: 0 });
    expect((await getBoardIvAndSkewVariance(1)).maxIvVariance).to.lt(manualIvVarianceCBThreshold);
    expect((await getBoardIvAndSkewVariance(2)).maxIvVariance).to.gt(manualIvVarianceCBThreshold);
    expect((await getBoardIvAndSkewVariance(2)).maxSkewVariance).to.lt(manualSkewVarianceCBThreshold);

    // confirm timeout still increased
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualIvVarianceCBTimeout + (await currentTime()));
  });
});

export async function relaxTradeLimits() {
  await hre.f.c.optionMarketPricer.setTradeLimitParams({
    ...DEFAULT_TRADE_LIMIT_PARAMS,
    minBaseIV: 0,
    maxBaseIV: toBN('5'),
    minSkew: 0,
    absMinSkew: 0,
    maxSkew: toBN('5'),
    absMaxSkew: toBN('5'),
    minVol: 0,
    maxVol: toBN('25'),
    minDelta: 0,
  });
}

export async function getGlobalIvAndSkewVariance() {
  const globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
  return { maxIvVariance: globalCache.maxIvVariance, maxSkewVariance: globalCache.maxSkewVariance };
}

export async function getBoardIvAndSkewVariance(boardId: number) {
  const boardCache = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId);
  return { maxIvVariance: boardCache.ivVariance, maxSkewVariance: boardCache.maxSkewVariance };
}
export async function exceedOnlyIvVariance() {
  // use shorts in order to not trigger liquidity CB
  await openPosition({
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('10'),
    setCollateralTo: toBN('30000'),
  });

  assertCloseTo((await getGlobalIvAndSkewVariance()).maxIvVariance, toBN('0.02'), toBN('0.00000000001'));
  expect((await getGlobalIvAndSkewVariance()).maxIvVariance).to.gt(manualIvVarianceCBThreshold);
  assertCloseTo((await getGlobalIvAndSkewVariance()).maxSkewVariance, toBN('0.015'), toBN('0.00000000001'));
  expect((await getGlobalIvAndSkewVariance()).maxSkewVariance).to.lt(manualSkewVarianceCBThreshold);
  return getGlobalIvAndSkewVariance();
}

export async function exceedIvAndSkewVariance() {
  // use shorts in order to not trigger liquidity CB
  await openPosition({
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('40'),
    setCollateralTo: toBN('60000'),
  });

  assertCloseTo((await getGlobalIvAndSkewVariance()).maxIvVariance, toBN('0.08'), toBN('0.00000000001'));
  expect((await getGlobalIvAndSkewVariance()).maxIvVariance).to.gt(manualIvVarianceCBThreshold);
  assertCloseTo((await getGlobalIvAndSkewVariance()).maxSkewVariance, toBN('0.06'), toBN('0.00000000001'));
  expect((await getGlobalIvAndSkewVariance()).maxSkewVariance).to.gt(manualSkewVarianceCBThreshold);
  return getGlobalIvAndSkewVariance();
}

export const liquidityCBThreshold = DEFAULT_LIQUIDITY_POOL_PARAMS.liquidityCBThreshold;

export function max(x: BigNumber, y: BigNumber) {
  if (x.gt(y)) {
    return x;
  } else {
    return y;
  }
}

export async function initiateDepositAndWithdrawAndFastForward(signer?: SignerWithAddress) {
  await hre.f.c.liquidityPool
    .connect(signer || hre.f.signers[0])
    .initiateDeposit((signer || hre.f.signers[0]).address, toBN('10000'));
  await hre.f.c.liquidityPool
    .connect(signer || hre.f.signers[0])
    .initiateWithdraw((signer || hre.f.signers[0]).address, toBN('20000'));
  await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay) + 1);
  await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
}

export async function revertProcessDepositAndWithdraw(
  balanceAccount?: SignerWithAddress,
  callerAccount?: SignerWithAddress,
  updateBoard?: boolean,
) {
  if (updateBoard == undefined || updateBoard) {
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
  }
  const quoteBal = await hre.f.c.snx.quoteAsset.balanceOf((balanceAccount || hre.f.signers[0]).address);
  const lpBal = await hre.f.c.liquidityToken.balanceOf((balanceAccount || hre.f.signers[0]).address);

  await hre.f.c.liquidityPool.connect(callerAccount || hre.f.signers[0]).processDepositQueue(2);
  await hre.f.c.liquidityPool.connect(callerAccount || hre.f.signers[0]).processWithdrawalQueue(2);

  expect(quoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf((balanceAccount || hre.f.signers[0]).address));
  expect(lpBal).to.eq(await hre.f.c.liquidityToken.balanceOf((balanceAccount || hre.f.signers[0]).address));
}
