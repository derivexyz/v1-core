import { deployFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { HOUR_SEC, MAX_UINT, MONTH_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import { createDefaultBoardWithOverrides, mockPrice } from '../../utils/seedTestSystem';
import { openPosition } from '../../utils/contractHelpers';
import { DEFAULT_CB_PARAMS, DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { fastForward, restoreSnapshot, takeSnapshot } from '../../utils/evm';

// Do full integration tests here (e.g. open trades/make deposits/hedge delta)
describe('Liquidity Accounting', async () => {
  beforeEach(deployFixture);

  it('tests edge case', async () => {
    await mockPrice(hre.f.c, toBN('1000'), 'sETH');
    await hre.f.c.liquidityPool.setLiquidityPoolParameters({
      ...DEFAULT_LIQUIDITY_POOL_PARAMS,
      // NOTE: setting this to reserve 90% of the liquidity instead of just 10% to make the edge case more easily hittable
      adjustmentNetScalingFactor: toBN('0.1'),
      callCollatScalingFactor: toBN('0.7'),
      // NOTE: also withdrawal fee set to 0 for this example, which also mitigates the edge case being tested
      withdrawalFee: 0,
    });
    const bob = hre.f.signers[2];
    await hre.f.c.snx.quoteAsset.mint(hre.f.deployer.address, toBN('1000000'));
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, toBN('1000'));
    await hre.f.c.snx.quoteAsset.mint(bob.address, toBN('100000'));

    await hre.f.c.snx.quoteAsset.connect(hre.f.deployer).approve(hre.f.c.liquidityPool.address, MAX_UINT);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, MAX_UINT);
    await hre.f.c.snx.quoteAsset.connect(bob).approve(hre.f.c.optionMarket.address, MAX_UINT);

    await hre.f.c.liquidityPool.initiateDeposit(hre.f.deployer.address, toBN('1000000'));
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('1000'));

    expect((await hre.f.c.liquidityPool.getLiquidity()).freeLiquidity).eq(toBN('1001000'));

    const board1 = await createDefaultBoardWithOverrides(hre.f.c, {
      expiresIn: MONTH_SEC,
      strikePrices: ['1000'],
      skews: ['1'],
    });
    await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: MONTH_SEC * 2, strikePrices: ['1000'], skews: ['1'] });
    const boardStrikes = await hre.f.c.optionMarketViewer.getBoard(hre.f.c.optionMarket.address, board1);

    await openPosition(
      {
        amount: toBN('0.85'),
        optionType: OptionType.LONG_CALL,
        strikeId: boardStrikes.strikes[0].strikeId,
      },
      bob,
      hre.f.c,
    );

    await hre.f.c.liquidityPool.connect(hre.f.deployer).initiateWithdraw(hre.f.deployer.address, toBN('1000000'));

    // console.log(await hre.f.c.liquidityPool.getLiquidity());

    // With default parameters:
    // As free liquidity is < 1% of total NAV, circuit breaker is fired and withdrawal can't go through
    {
      const snapshot = await takeSnapshot();
      await hre.f.c.liquidityPool.updateCBs();
      expect(await hre.f.c.liquidityPool.CBTimestamp()).gt(0);
      await restoreSnapshot(snapshot);
    }

    // So let's ignore that protection for now, to test the edge case
    await hre.f.c.liquidityPool.setCircuitBreakerParameters({
      ...DEFAULT_CB_PARAMS,
      liquidityCBThreshold: 0,
    });
    await hre.f.c.liquidityPool.updateCBs();
    expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);

    await fastForward(MONTH_SEC - HOUR_SEC);

    await hre.f.c.keeperHelper.updateAllBoardCachedGreeks();

    await mockPrice(hre.f.c, toBN('1500'), 'sETH');
    {
      const snapshot = await takeSnapshot();

      // CASE 1, cache is updated with price
      await hre.f.c.keeperHelper.updateAllBoardCachedGreeks();
      const tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      console.log((await tx.wait()).events);

      await fastForward(HOUR_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(board1);

      // withdrawal head wasn't fully withdrawn (only partial)
      console.log(await hre.f.c.liquidityPool.queuedWithdrawals(await hre.f.c.liquidityPool.queuedWithdrawalHead()));

      await restoreSnapshot(snapshot);
    }

    {
      const snapshot = await takeSnapshot();

      // CASE 2, cache isn't updated first
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);

      await hre.f.c.keeperHelper.updateAllBoardCachedGreeks();
      await fastForward(HOUR_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(board1);

      // withdrawal head was fully withdrawn
      console.log(await hre.f.c.liquidityPool.queuedWithdrawals(await hre.f.c.liquidityPool.queuedWithdrawalHead()));
      console.log(await hre.f.c.optionMarket.getSettlementParameters(boardStrikes.strikes[0].strikeId));

      await restoreSnapshot(snapshot);
    }
  });
});
