import { OptionType, toBN, toBytes32 } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  closeLongCall,
  DEFAULT_LONG_CALL,
  fillLiquidityWithLongCall,
  getLiquidity,
  openDefaultLongCall,
  openPosition,
} from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('ExchangeBase', async () => {
  // integration tests
  beforeEach(seedFixture);

  it('it will allow longs to open if fee rate is too high, without exchanging', async () => {
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), toBN('0.02'));
    await openDefaultLongCall();
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).eq(0);
  });
  it('it will allow longs to close if fee rate is too high, without exchanging', async () => {
    const position = await openDefaultLongCall();
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sETH'), toBytes32('sUSD'), toBN('0.02'));
    await closeLongCall(position);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).eq(DEFAULT_LONG_CALL.amount);
  });
  it('wont allow longs to open if new locked base * price is > freeLiquidity (if fee rate too high)', async () => {
    await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), toBN('0.02'));
    await fillLiquidityWithLongCall();
    const liquidity = await getLiquidity();

    assertCloseToPercentage(liquidity.freeLiquidity, toBN('78558'));
    assertCloseToPercentage(liquidity.burnableLiquidity, toBN('426961'));
    assertCloseToPercentage(liquidity.usedCollatLiquidity, toBN('348402'));
    assertCloseToPercentage(liquidity.pendingDeltaLiquidity, toBN('127026'));

    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).eq(0);

    await expect(
      openPosition({
        amount: toBN('20'),
        optionType: OptionType.LONG_CALL,
      }),
    ).revertedWith('InsufficientFreeLiquidityForBaseExchange');
  });
});
