import { MAX_UINT, OptionType, toBN, toBytes32, WEEK_SEC } from '../../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../../utils/assert';
import {
  closeLongCall,
  closePositionWithOverrides,
  fillLiquidityWithLongCall,
  getLiquidity,
  openDefaultLongCall,
  openPosition,
  openPositionWithOverrides,
} from '../../../utils/contractHelpers';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../../utils/defaultParams';
import { fastForward } from '../../../utils/evm';
import { seedFixtureUSDC } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('ExchangeBase', async () => {
  // integration tests
  beforeEach(async () => {
    await seedFixtureUSDC({ useUSDC: true });
  });

  it('it will allow longs to open if fee rate is too high, without exchanging', async () => {
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), toBN('0.02'));
    await openDefaultLongCall();
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).eq(0);
  });
  it('it will allow longs to close if fee rate is too high, without exchanging', async () => {
    const position = await openDefaultLongCall();
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sETH'), toBytes32('sUSD'), toBN('0.02'));
    await closeLongCall(position);
    // no base is held
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).eq(0);
  });
  it.skip('wont allow longs to open if new locked base * price is > freeLiquidity (if fee rate too high)', async () => {
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), toBN('0.02'));
    await fillLiquidityWithLongCall();
    const liquidity = await getLiquidity();

    assertCloseToPercentage(liquidity.freeLiquidity, toBN('0'));
    assertCloseToPercentage(liquidity.burnableLiquidity, toBN('0'));
    assertCloseToPercentage(liquidity.reservedCollatLiquidity, toBN('348402.67'));
    assertCloseToPercentage(liquidity.pendingDeltaLiquidity, toBN('193826.62'));

    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).eq(0);

    await expect(
      openPosition({
        amount: toBN('20'),
        optionType: OptionType.LONG_CALL,
      }),
    ).revertedWith('InsufficientFreeLiquidityForBaseExchange');
  });

  it.skip('it will not use reserved quote when large difference present', async () => {
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), toBN('0.03')); // 3% fee

    // open large long position and do not exchange base
    await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.LONG_CALL,
      amount: toBN('200'),
    });
    let liquidity = await getLiquidity();
    assertCloseToPercentage(liquidity.freeLiquidity, toBN('83177.6'), toBN('0.01'));
    assertCloseToPercentage(liquidity.reservedCollatLiquidity, toBN('348402.7'), toBN('0.01'));
    assertCloseToPercentage(
      await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address),
      toBN('0'),
      toBN('0.01'),
    );

    // withdraw up to freeLiq
    await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, toBN('40000'));
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);
    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).to.eq(2);
    liquidity = await getLiquidity();
    // await hre.f.c.poolHedger.hedgeDelta();
    assertCloseToPercentage(liquidity.freeLiquidity, toBN('6842.68'), toBN('0.01'));
    assertCloseToPercentage(liquidity.reservedCollatLiquidity, toBN('348402.7'), toBN('0.01'));

    // set maxFee to MAX_UINT and close only 2 of 200 long calls
    // TODO max fee paid no longer needed
    await hre.f.c.liquidityPool.setLiquidityPoolParameters({
      ...DEFAULT_LIQUIDITY_POOL_PARAMS,
      // maxFeePaid: MAX_UINT,
    });
    await closePositionWithOverrides(hre.f.c, {
      positionId: 1,
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.LONG_CALL,
      amount: toBN('2'),
    });
    liquidity = await getLiquidity();
    assertCloseToPercentage(liquidity.freeLiquidity, toBN('860.06'), toBN('0.01'));
    assertCloseToPercentage(liquidity.reservedCollatLiquidity, toBN('344918.6'), toBN('0.01'));
    assertCloseToPercentage(
      await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address),
      toBN('198'),
      toBN('0.01'),
    );
  });
});
