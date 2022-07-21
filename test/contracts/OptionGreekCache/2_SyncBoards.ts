import { DAY_SEC, getEventArgs, MONTH_SEC, toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import { createBoard, setETHPrice } from '../../utils/contractHelpers';
import * as defaultParams from '../../utils/defaultParams';
import { DEFAULT_GREEK_CACHE_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionGreekCache - SyncBoards', () => {
  beforeEach(seedFixture);

  describe('addBoard', () => {
    it('OnlyOptionMarket can addBoard', async () => {
      await expect(
        hre.f.c.optionGreekCache.addBoard(
          {
            expiry: 1234,
            frozen: false,
            id: 1,
            iv: 1,
            strikeIds: [],
          },
          [],
        ),
      ).to.be.revertedWith('OnlyOptionMarket');
    });

    it('reverts for too many strikes', async () => {
      await expect(
        createDefaultBoardWithOverrides(hre.f.c, {
          skews: Array(31).fill('1'),
          strikePrices: Array(31).fill('1'),
        }),
      ).revertedWith('BoardStrikeLimitExceeded');
    });

    it('can add multiple strikes per board and initialise gwavs', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(hre.f.c);
      const boardView = await hre.f.c.optionMarketViewer.getBoard(hre.f.c.optionMarket.address, newBoardId);
      const cacheBoardView = await hre.f.c.optionGreekCache.getBoardGreeksView(newBoardId);

      assertCloseTo(boardView.forceCloseGwavIV, toBN(defaultParams.DEFAULT_BOARD_PARAMS.baseIV), toBN('0.000000001'));
      assertCloseTo(boardView.forceCloseGwavIV, cacheBoardView.ivGWAV, toBN('0.000000001'));

      for (let i = 0; i < boardView.strikes.length; i++) {
        const strike = boardView.strikes[i];
        assertCloseTo(strike.forceCloseSkew, toBN(defaultParams.DEFAULT_BOARD_PARAMS.skews[i]), toBN('0.0000000001'));

        assertCloseTo(strike.forceCloseSkew, cacheBoardView.skewGWAVs[i], toBN('0.0000000001'));

        expect(strike.cachedGreeks.callDelta).eq(cacheBoardView.strikeGreeks[i].callDelta);
        expect(strike.cachedGreeks.putDelta).eq(cacheBoardView.strikeGreeks[i].putDelta);
        expect(strike.cachedGreeks.stdVega).eq(cacheBoardView.strikeGreeks[i].stdVega);
        expect(strike.cachedGreeks.callPrice).eq(cacheBoardView.strikeGreeks[i].callPrice);
        expect(strike.cachedGreeks.putPrice).eq(cacheBoardView.strikeGreeks[i].putPrice);
      }
    });

    it('can add multiple boards', async () => {
      // updates globalCache updatedAtPrice with 0 values
      const preGlobalCache = await hre.f.c.optionGreekCache.getGlobalCache();
      expect(preGlobalCache.minUpdatedAtPrice).not.eq(0);
      expect(preGlobalCache.minUpdatedAt).not.eq(0);

      const boardIds = [];
      for (let i = 0; i++; i < 5) {
        boardIds.push(await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: MONTH_SEC / i }));
      }

      for (let i = 0; i++; i < 5) {
        const board = await hre.f.c.optionGreekCache.getOptionBoardCache(i);
        expect(board.expiry).eq(MONTH_SEC / i);
      }

      const newGlobalCache = await hre.f.c.optionGreekCache.getGlobalCache();
      expect(newGlobalCache.minUpdatedAtPrice).eq(preGlobalCache.minUpdatedAtPrice);
      expect(newGlobalCache.minUpdatedAt).eq(preGlobalCache.minUpdatedAt);
    });
  });

  describe('removeBoard', async () => {
    it('OnlyOptionMarket can remove board', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(hre.f.c);
      await expect(hre.f.c.optionGreekCache.removeBoard(newBoardId)).to.be.revertedWith('OnlyOptionMarket');
    });

    it('can remove a board successfully', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(hre.f.c, { strikePrices: ['1000'], skews: ['1'] });

      await fastForward(MONTH_SEC);
      await setETHPrice(toBN('1700'));

      const boardCacheBefore = await hre.f.c.optionGreekCache.getOptionBoardCache(newBoardId);
      const strikesBefore = await hre.f.c.optionMarket.getBoardStrikes(newBoardId);
      const strikesCacheBefore = await hre.f.c.optionGreekCache.getStrikeCache(strikesBefore[0]);
      expect(boardCacheBefore.id).to.equal(newBoardId);
      // TODO: readd when enough contract space
      //  expect(await hre.f.c.optionGreekCache.liveBoards(0)).to.equal(newBoardId);
      expect(strikesBefore).has.length(1);
      expect(strikesCacheBefore.id).to.equal(strikesBefore[0]);

      // Calls removeBoard
      await hre.f.c.optionMarket.settleExpiredBoard(newBoardId);

      expect((await hre.f.c.optionGreekCache.getOptionBoardCache(newBoardId)).id).to.equal(0);
      // TODO: readd when enough contract space
      //  await expect(c.optionGreekCache.liveBoards(0)).to.be.reverted;
      const strikesCacheAfter = await hre.f.c.optionGreekCache.getStrikeCache(strikesBefore[0]);
      expect(strikesCacheAfter.id).to.equal(0);
    });

    it('can remove a board with multiple strikes successfully', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(hre.f.c);

      await fastForward(MONTH_SEC);
      await setETHPrice(toBN('1700'));

      const strikesBefore = await hre.f.c.optionMarket.getBoardStrikes(newBoardId);
      expect(strikesBefore).has.length(3);

      for (const strike of strikesBefore) {
        const strikesCacheBefore = await hre.f.c.optionGreekCache.getStrikeCache(strike);
        expect(strikesCacheBefore.id).to.equal(strike);
      }

      await hre.f.c.optionMarket.settleExpiredBoard(newBoardId);

      for (const strike of strikesBefore) {
        const strikesCacheBefore = await hre.f.c.optionGreekCache.getStrikeCache(strike);
        expect(strikesCacheBefore.id).to.equal(0);
      }
    });

    it('removing a board updates the global cache correctly', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(hre.f.c);

      await fastForward(MONTH_SEC);
      await setETHPrice(toBN('1700'));

      const globalCacheBefore = await hre.f.c.optionGreekCache.getGlobalCache();
      const boardCache = await hre.f.c.optionGreekCache.getOptionBoardCache(newBoardId);

      await hre.f.c.optionMarket.settleExpiredBoard(newBoardId);

      const globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
      expect(globalCache.netGreeks.netDelta).to.eq(
        globalCacheBefore.netGreeks.netDelta.add(boardCache.netGreeks.netDelta),
      );
      expect(globalCache.netGreeks.netStdVega).to.eq(
        globalCacheBefore.netGreeks.netStdVega.add(boardCache.netGreeks.netStdVega),
      );
      const globalNetDelta = await hre.f.c.optionGreekCache.getGlobalNetDelta();
      expect(globalCache.netGreeks.netDelta).to.eq(globalNetDelta);
    });
  });

  describe('addStrikeToBoard', () => {
    it('OnlyOptionMarket can addStrikeToBoard', async () => {
      await expect(hre.f.c.optionGreekCache.addStrikeToBoard(hre.f.board.boardId, 1000, 0, 0)).to.be.revertedWith(
        'OnlyOptionMarket',
      );
    });

    it('can add multiple strikes to the strike cache successfully', async () => {
      const newStrikes = [];
      for (let i = 0; i++; i < 5) {
        const tx = await hre.f.c.optionMarket.addStrikeToBoard(hre.f.board.boardId, toBN('1500'), toBN('1'));
        newStrikes.push(getEventArgs(await tx.wait(), 'StrikeAdded').strikeId);
      }
      for (const strikeId of newStrikes) {
        const cachedStrike = await hre.f.c.optionGreekCache.getStrikeCache(strikeId);
        const actualStrike = await hre.f.c.optionMarket.getStrike(strikeId);
        expect(cachedStrike.id).eq(actualStrike.id);
        expect(cachedStrike.strikePrice).eq(actualStrike.strikePrice);
        expect(cachedStrike.skew).eq(actualStrike.skew);
        expect(cachedStrike.callExposure).eq(0);
        expect(cachedStrike.putExposure).eq(0);
      }
    });

    it('should revert when board has max number of strikes', async () => {
      const maxStrikes = parseInt(DEFAULT_GREEK_CACHE_PARAMS.maxStrikesPerBoard.toString());

      const boardId = await createDefaultBoardWithOverrides(hre.f.c, {
        strikePrices: Array(maxStrikes - 1).fill('1500'),
        skews: Array(maxStrikes - 1).fill('0.9'),
      });

      // One more is fine
      await hre.f.c.optionMarket.addStrikeToBoard(boardId, toBN('1500'), toBN('1'));

      // Revert the next one
      await expect(hre.f.c.optionMarket.addStrikeToBoard(boardId, toBN('1500'), toBN('1'))).revertedWith(
        'BoardStrikeLimitExceeded',
      );
    });
  });

  describe('setBoardIv', () => {
    it('updates iv and iv variance', async () => {
      const boardId = await createBoard({
        expiresIn: MONTH_SEC * 2,
        baseIV: '1.1',
        strikePrices: ['1000'],
        skews: ['1'],
      });
      await hre.f.c.optionMarket.setBoardFrozen(boardId, true);
      await hre.f.c.optionMarket.setBoardBaseIv(boardId, toBN('2'));
      assertCloseTo((await hre.f.c.optionGreekCache.getGlobalCache()).maxIvVariance, toBN('0.9'), toBN('0.0000000001'));
      assertCloseToPercentage(await hre.f.c.optionGreekCache.getIvGWAV(boardId, DAY_SEC), toBN('1.1'));
    });
  });

  describe('setStrikeSkew', () => {
    it('updates skew and skew variance', async () => {
      const boardId = await createBoard({
        expiresIn: MONTH_SEC * 2,
        baseIV: '1',
        strikePrices: ['1000', '1200'],
        skews: ['1', '1.1'],
      });
      const market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
      const strike = market.liveBoards[1].strikes[1];
      await hre.f.c.optionMarket.setBoardFrozen(boardId, true);
      await hre.f.c.optionMarket.setStrikeSkew(strike.strikeId, toBN('2'));
      assertCloseTo(
        (await hre.f.c.optionGreekCache.getGlobalCache()).maxSkewVariance,
        toBN('0.9'),
        toBN('0.0000000001'),
      );
      assertCloseToPercentage(await hre.f.c.optionGreekCache.getSkewGWAV(strike.strikeId, DAY_SEC), toBN('1.1'));
    });
  });
});
