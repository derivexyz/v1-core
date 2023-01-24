import { expect } from 'chai';
import { currentTime, HOUR_SEC, OptionType, toBN, WEEK_SEC } from '../../../../scripts/util/web3utils';
import { assertCloseTo } from '../../../utils/assert';
import {
  closePositionWithOverrides,
  fillLiquidityWithLongPut,
  getLiquidity,
  initiatePercentLPWithdrawal,
  openDefaultLongCall,
} from '../../../utils/contractHelpers';
import { DEFAULT_CB_PARAMS, DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../../utils/defaultParams';
import { fastForward } from '../../../utils/evm';
import { seedFixtureUSDC } from '../../../utils/fixture';
import { hre } from '../../../utils/testSetup';

describe('USDC_quote - Liquidity Circuit Breaker', async () => {
  // integration tests
  beforeEach(async () => {
    await seedFixtureUSDC({ noHedger: true, useUSDC: true });
  });

  // updating
  it('CBTimestamp increased: post trade', async () => {
    // initiate deposit and withdrawal
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateDeposit(hre.f.signers[0].address, 10000e6);
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateWithdraw(hre.f.signers[0].address, toBN('20000'));
    await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay));

    // trigger CB with long put
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    const [, liquidity] = await fillLiquidityWithLongPut();
    expect(liquidity.freeLiquidity).eq(0);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + (await currentTime()));

    // CB blocks deposits/withdrawals
    const quoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
    const lpBal = await hre.f.c.liquidityToken.balanceOf(hre.f.signers[0].address);
    await hre.f.c.liquidityPool.processDepositQueue(2);
    await hre.f.c.liquidityPool.processWithdrawalQueue(2);
    expect(quoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address));
    expect(lpBal).to.eq(await hre.f.c.liquidityToken.balanceOf(hre.f.signers[0].address));
  });
  it('CBTimestamp increased: post initiate withdrawal, <freeLiquidityPercent', async () => {
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    expect(liquidityCBThreshold).to.eq(toBN('0.01'));

    // Withdraw 99% liquidity & open long call to not bypass CB update
    await initiatePercentLPWithdrawal(hre.f.signers[0], toBN('0.99'));
    await openDefaultLongCall();

    // confirm freeLiquidity < 1% and CB triggered
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('2229.8'), toBN('0.1'));
    expect(await hre.f.c.liquidityPool.CBTimestamp()).to.eq(liquidityCBTimeout + (await currentTime()));
  });

  it('CBTimestamp unchanged: post initiate withdrawal, >freeLiquidityPercent', async () => {
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    expect(liquidityCBThreshold).to.eq(toBN('0.01'));

    // Withdraw 98% liquidity & open long call to not bypass CB update
    await initiatePercentLPWithdrawal(hre.f.signers[0], toBN('0.98'));
    await openDefaultLongCall();

    // confirm freeLiquidity > 1% and CB not triggered
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('7230.00'), toBN('0.1'));
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
    await hre.f.c.liquidityPool.connect(hre.f.signers[0]).initiateDeposit(hre.f.signers[0].address, 10000e6);
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
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('106404.02'), toBN('4'));
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(liquidityCBTimeout + firstTimestamp);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).lt(liquidityCBTimeout + secondTimestamp);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).gt(secondTimestamp);

    // still block withdrawal since CB not expired
    const quoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
    const lpBal = await hre.f.c.liquidityToken.balanceOf(hre.f.signers[0].address);
    await hre.f.c.liquidityPool.processDepositQueue(2);
    await hre.f.c.liquidityPool.processWithdrawalQueue(2);
    expect(quoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address));
    expect(lpBal).to.eq(await hre.f.c.liquidityToken.balanceOf(hre.f.signers[0].address));
  });

  it('CBTimestamp increased: due to withdrawals', async () => {
    // Open long call to not bypass CB update
    await openDefaultLongCall();
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
    expect(liquidityCBThreshold).to.eq(toBN('0.01'));

    // Withdraw 99% liquidity
    await initiatePercentLPWithdrawal(hre.f.signers[0], toBN('0.99'));

    // confirm freeLiquidity < 1% and CB triggered
    assertCloseTo((await getLiquidity()).freeLiquidity, toBN('2229.81'), toBN('0.1'));

    // process withdraw to trigger CB
    await fastForward(WEEK_SEC);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);
    expect(await hre.f.c.liquidityPool.CBTimestamp()).to.eq(liquidityCBTimeout + (await currentTime()));
  });
});

export const liquidityCBTimeout = Number(DEFAULT_CB_PARAMS.liquidityCBTimeout);
export const liquidityCBThreshold = DEFAULT_CB_PARAMS.liquidityCBThreshold;
