import { BigNumberish } from '@ethersproject/bignumber';
import { DAY_SEC, OptionType, toBN, toBytes32, UNIT, WEEK_SEC } from '../../../scripts/util/web3utils';
import {
  getSpotPrice,
  openPositionWithOverrides,
  setETHExchangerInvalid,
  setETHPrice,
} from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_GREEK_CACHE_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides, mockPrice } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionGreekCache - Stale Cache Checks', () => {
  beforeEach(seedFixture);

  describe('getVolVariance', () => {
    it.skip('returns maxIvVariance/maxSkewVariance');
  });

  describe('isGlobalCacheStale', () => {
    const boards = [] as BigNumberish[];
    beforeEach(async () => {
      boards[0] = hre.f.board.boardId;
      boards[1] = await createDefaultBoardWithOverrides(hre.f.c);
      boards[2] = await createDefaultBoardWithOverrides(hre.f.c);

      await openPositionWithOverrides(hre.f.c, {
        strikeId: 3,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await openPositionWithOverrides(hre.f.c, {
        strikeId: 6,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await openPositionWithOverrides(hre.f.c, {
        strikeId: 9,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(await getSpotPrice())).to.be.false;
    });

    it('remains stale if not all boards updated minUpdatedAt', async () => {
      await fastForward(Number(DEFAULT_GREEK_CACHE_PARAMS.staleUpdateDuration) + 1);
      await progressivelyUpdateBoards(boards);
    });
    it('remains stale if not all boards within max updated price', async () => {
      await mockPrice(hre.f.c, toBN('3000'), 'sETH');
      await progressivelyUpdateBoards(boards);
    });
    it('remains stale if not all boards within min updated price', async () => {
      await mockPrice(hre.f.c, toBN('1000'), 'sETH');
      await progressivelyUpdateBoards(boards);
    });
    it('ignores iv/skew variance changes', async () => {
      let ivVariance;
      let skewVariance;
      for (let i = 0; i < 3; i++) {
        await hre.f.c.liquidityPool.setLiquidityPoolParameters({
          ...DEFAULT_LIQUIDITY_POOL_PARAMS,
          skewVarianceCBThreshold: toBN('0.001'),
          ivVarianceCBThreshold: toBN('0.001'),
        });

        await openPositionWithOverrides(hre.f.c, {
          strikeId: 3 * (i + 1),
          optionType: OptionType.LONG_CALL,
          amount: toBN('25'),
        });

        // board iv outside of variance check
        ivVariance = (await hre.f.c.optionGreekCache.getOptionBoardCache(boards[i])).iv.sub(
          await hre.f.c.optionGreekCache.getIvGWAV(boards[i], DEFAULT_GREEK_CACHE_PARAMS.optionValueIvGWAVPeriod),
        );
        skewVariance = (await hre.f.c.optionGreekCache.getStrikeCache(boards[i])).skew.sub(
          await hre.f.c.optionGreekCache.getSkewGWAV(3 * (i + 1), DEFAULT_GREEK_CACHE_PARAMS.optionValueSkewGWAVPeriod),
        );

        expect(ivVariance.abs()).to.gt(toBN('0.001'));
        expect(skewVariance.abs()).to.gt(toBN('0.001'));
      }
      expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(await getSpotPrice())).to.be.false;
    });
  });

  describe('isBoardCacheStale', () => {
    it('returns false on time/price moves up and down (in range)', async () => {
      await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      // slight variations don't cause cache to become stale
      await setETHPrice(DEFAULT_BASE_PRICE.add(UNIT));
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.false;
      await setETHPrice(DEFAULT_BASE_PRICE.sub(UNIT));
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.false;
      // Time moving doesn't affect this either
      await fastForward(10);
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.false;

      // But if the price is stale in the up direction, returns true;
      await setETHPrice(DEFAULT_BASE_PRICE.add(UNIT.mul(200)));
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.true;
      // Will reset if the price recovers
      await setETHPrice(DEFAULT_BASE_PRICE);
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.false;

      // Or if the price is stale in the down direction, returns true;
      await setETHPrice(DEFAULT_BASE_PRICE.sub(UNIT.mul(200)));
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.true;

      await setETHPrice(DEFAULT_BASE_PRICE);
      await fastForward(DAY_SEC);
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.true;
    });
  });

  it('can recompute a stale cache', async () => {
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    // When boards are added, greeks are computes so they are not stale at time of strike.
    expect((await hre.f.c.optionGreekCache.getGlobalCache()).netGreeks.netOptionValue).to.eq(0);

    await fastForward(WEEK_SEC);
    await setETHExchangerInvalid();
    // If the price isn't updated by chainlink, we can't compute the greeks/update the boards.
    await expect(hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId)).to.revertedWith(
      'RateIsInvalid',
    );

    await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32('sETH'), toBN('1700'), false);

    // Now that we know the price, since the boards have not been updated, the boards are stale.
    expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(DEFAULT_BASE_PRICE)).to.be.true;

    // We can then update them, and they are no longer stale.
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(DEFAULT_BASE_PRICE)).to.be.false;
  });
});

async function progressivelyUpdateBoards(boards: any) {
  for (let i = 0; i < 3; i++) {
    expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boards[i])).to.be.true;
  }
  expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(await getSpotPrice())).to.be.true;

  // updated some boards
  for (let i = 0; i < 2; i++) {
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boards[i]);
    expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boards[i])).to.be.false;
  }
  expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(await getSpotPrice())).to.be.true;

  // updated final board
  await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boards[2]);
  expect(await hre.f.c.optionGreekCache.isGlobalCacheStale(await getSpotPrice())).to.be.false;
}
