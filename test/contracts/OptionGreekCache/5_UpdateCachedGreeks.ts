import { currentTime, DAY_SEC, MONTH_SEC, OptionType, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import { createBoard, openPositionWithOverrides, setETHPrice } from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionGreekCache - Update Cache', () => {
  beforeEach(seedFixture);

  describe('updateBoardCachedGreeks', () => {
    it('updates max variance and updatedAt time', async () => {
      const boardId = await createBoard({
        expiresIn: MONTH_SEC * 2,
        baseIV: '1.1',
        strikePrices: ['1000', '1200'],
        skews: ['1', '1.1'],
      });
      const market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
      const strike = market.liveBoards[1].strikes[1];
      await hre.f.c.optionMarket.setBoardFrozen(boardId, true);
      await hre.f.c.optionMarket.setStrikeSkew(strike.strikeId, toBN('2'));
      await hre.f.c.optionMarket.setBoardBaseIv(boardId, toBN('2'));

      await setETHPrice(toBN('1200'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId);

      assertCloseToPercentage((await hre.f.c.optionGreekCache.getGlobalCache()).maxSkewVariance, toBN('0.9'));
      assertCloseToPercentage((await hre.f.c.optionGreekCache.getGlobalCache()).maxIvVariance, toBN('0.9'));
      expect((await hre.f.c.optionGreekCache.getGlobalCache()).minUpdatedAtPrice).eq(toBN('1200'));
      expect((await hre.f.c.optionGreekCache.getGlobalCache()).maxUpdatedAtPrice).eq(DEFAULT_BASE_PRICE);

      await setETHPrice(toBN('2000'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId);
      expect((await hre.f.c.optionGreekCache.getGlobalCache()).minUpdatedAtPrice).eq(DEFAULT_BASE_PRICE);
      expect((await hre.f.c.optionGreekCache.getGlobalCache()).maxUpdatedAtPrice).eq(toBN('2000'));
    });

    it('updates only one stale board', async () => {
      const boardId1 = await createDefaultBoardWithOverrides(hre.f.c);

      await fastForward(WEEK_SEC);
      await setETHPrice(toBN('1700'));

      const boardId2 = await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: MONTH_SEC / 2 });
      const boardId3 = await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: MONTH_SEC - 8 * DAY_SEC });

      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(true);
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boardId2)).to.equal(false);
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boardId3)).to.equal(false);

      // Only board 1 gets updated
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId1);

      const updateTime = await currentTime();

      const boardCache1 = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId1);
      const boardCache2 = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId2);
      const boardCache3 = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId3);

      expect(boardCache1.updatedAt).to.gte(updateTime);
      expect(boardCache2.updatedAt).to.lt(updateTime);
      expect(boardCache3.updatedAt).to.lt(updateTime);
    });

    it('cannot update invalid boardId', async () => {
      await expect(hre.f.c.optionGreekCache.isBoardCacheStale(1234)).revertedWith('InvalidBoardId');
    });

    it("updates board even if it isn't stale", async () => {
      const boardId1 = await createDefaultBoardWithOverrides(hre.f.c);

      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(false);

      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId1);

      const updateTime = await currentTime();

      const boardCache = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId1);
      expect(boardCache.updatedAt).to.gte(updateTime);
    });

    it('board last updated at is correctly updated', async () => {
      const boardId1 = await createDefaultBoardWithOverrides(hre.f.c);

      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(false);

      const boardCacheBefore = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId1);

      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId1);

      const updateTime = await currentTime();

      const boardCache = await hre.f.c.optionGreekCache.getOptionBoardCache(boardId1);
      expect(boardCacheBefore.updatedAt).to.lt(updateTime);
      expect(boardCache.updatedAt).to.gte(updateTime);
    });
  });

  it('will update cache values when an option is purchased', async () => {
    expect((await hre.f.c.optionGreekCache.getGlobalCache()).netGreeks.netStdVega).to.eq(0);
    expect((await hre.f.c.optionGreekCache.getGlobalCache()).netGreeks.netDelta).to.eq(0);
    await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.LONG_CALL,
      amount: toBN('1'),
    });
    expect((await hre.f.c.optionGreekCache.getGlobalCache()).netGreeks.netStdVega).to.not.eq(0);
    expect((await hre.f.c.optionGreekCache.getGlobalCache()).netGreeks.netDelta).to.not.eq(0);
    expect((await hre.f.c.optionGreekCache.getStrikeCache(hre.f.strike.strikeId)).callExposure).to.eq(toBN('1'));
  });
});
