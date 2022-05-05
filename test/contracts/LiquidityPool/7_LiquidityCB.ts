import { expect } from 'chai';
import { currentTime, HOUR_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import {
  closePositionWithOverrides,
  fillLiquidityWithLongPut,
  getLiquidity,
  initiatePercentLPWithdrawal,
  openDefaultLongCall,
} from '../../utils/contractHelpers';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

describe('Liquidity Circuit Breaker', async () => {
  // integration tests
  beforeEach(seedFixture);

  // updating
  it('CBTimestamp increased: post trade', async () => {
    // initiate deposit and withdrawal
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateDeposit(hre.f.signers[0].address, toBN('10000'));
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateWithdraw(hre.f.signers[0].address, toBN('20000'));
    await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay));

    // trigger CB with long put
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    const [, liquidity] = await fillLiquidityWithLongPut();
    expect(liquidity.freeLiquidity).eq(0);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + await currentTime());

    // CB blocks deposits/withdrawals
    const quoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
    const lpBal = await hre.f.c.liquidityTokens.balanceOf(hre.f.signers[0].address);
    await hre.f.c.liquidityPool.processDepositQueue(2);
    await hre.f.c.liquidityPool.processWithdrawalQueue(2);
    expect(quoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address));
    expect(lpBal).to.eq(await hre.f.c.liquidityTokens.balanceOf(hre.f.signers[0].address));
  });
  it('CBTimestamp increased: post initiate withdrawal, <freeLiquidityPercent', async () => {
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    expect(liquidityCBThreshold).to.eq(toBN('0.01'));

    // Withdraw 99% liquidity & open long call to not bypass CB update
    await initiatePercentLPWithdrawal(hre.f.signers[0], toBN('0.995'));
    await openDefaultLongCall();

    // confirm freeLiquidity < 1% and CB triggered
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('271.479'), toBN('0.1'));
    expect(await hre.f.c.liquidityPool.CBTimestamp()).to.eq(liquidityCBTimeout + (await currentTime()));
  });

  it('CBTimestamp unchanged: post initiate withdrawal, >freeLiquidityPercent', async () => {
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    expect(liquidityCBThreshold).to.eq(toBN('0.01'));

    // Withdraw 98% liquidity & open long call to not bypass CB update
    await initiatePercentLPWithdrawal(hre.f.signers[0], toBN('0.98'));
    await openDefaultLongCall();

    // confirm freeLiquidity > 1% and CB not triggered
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('7771.639'), toBN('0.1'));
    expect(await hre.f.c.liquidityPool.CBTimestamp()).to.eq(0);
  });
  it('CBTimestamp keeps increasing if freeLiquidity not available', async () => {
    // Trigger CB with long put
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    const [, liquidity] = await fillLiquidityWithLongPut();
    const firstTimestamp = await currentTime();
    expect(liquidity.freeLiquidity).eq(0);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + firstTimestamp);

    // Close small amount which does not bring freeLiq > 1%
    await fastForward(HOUR_SEC);
    await closePositionWithOverrides(hre.f.c, {
      positionId: 1,
      strikeId: 2,
      optionType: OptionType.LONG_PUT,
      amount: toBN('1'),
    });

    // confirm freeLiquidity < 1% and CB contiuously triggered
    const secondTimestamp = await currentTime();
    expect((await getLiquidity()).freeLiquidity).eq(0);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).gt(liquidityCBTimeout + firstTimestamp);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + secondTimestamp);
  });

  it('CBTimestamp stops increasing once freeLiquidity available', async () => {
    // initiate deposit and withdrawal
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateDeposit(hre.f.signers[0].address, toBN('10000'));
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateWithdraw(hre.f.signers[0].address, toBN('20000'));
    await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay));

    // Trigger CB with long put
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    const [, liquidity] = await fillLiquidityWithLongPut();
    const firstTimestamp = await currentTime();
    expect(liquidity.freeLiquidity).eq(0);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + firstTimestamp);

    // Close small amount which does not bring freeLiq > 1%
    await fastForward(HOUR_SEC);
    await closePositionWithOverrides(hre.f.c, {
      positionId: 1,
      strikeId: 2,
      optionType: OptionType.LONG_PUT,
      amount: toBN('100'),
    });

    // confirm freeLiquidity > 1% and CB stops triggering
    const secondTimestamp = await currentTime();
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('106412.087'), toBN('0.5'));
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + firstTimestamp);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).lt(liquidityCBTimeout + secondTimestamp);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).gt(secondTimestamp);

    // still block withdrawal since CB not expired
    const quoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
    const lpBal = await hre.f.c.liquidityTokens.balanceOf(hre.f.signers[0].address);
    await hre.f.c.liquidityPool.processDepositQueue(2);
    await hre.f.c.liquidityPool.processWithdrawalQueue(2);
    expect(quoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address));
    expect(lpBal).to.eq(await hre.f.c.liquidityTokens.balanceOf(hre.f.signers[0].address));
  });
});

export const liquidityCBTimeout = Number(DEFAULT_LIQUIDITY_POOL_PARAMS.liquidityCBTimeout);
export const liquidityCBThreshold = DEFAULT_LIQUIDITY_POOL_PARAMS.liquidityCBThreshold;
