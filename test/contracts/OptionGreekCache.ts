import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { currentTime, DAY_SEC, MONTH_SEC, toBN, TradeType, WEEK_SEC, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import { createDefaultBoardWithOverrides } from '../utils/contractHelpers';
import {
  deployTestContracts,
  deployTestSystem,
  initTestSystem,
  TestSystemContractsType,
} from '../utils/deployTestSystem';
import { seedTestBalances, seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('optionGreekCache', () => {
  let account: Signer;
  let c: TestSystemContractsType;
  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];

    c = await deployTestSystem(account);
    await seedTestSystem(account, c);

    boardId = (await c.optionMarket.getLiveBoards())[0];
    listingIds = await c.optionMarket.getBoardListings(boardId);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('caching', async () => {
    it('can recompute a stale cache', async () => {
      // When boards are added, greeks are computes so they are not stale at time of listing.
      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.false;

      await fastForward(WEEK_SEC);
      await c.mocked.exchangeRates.mockInvalid(true);
      // If the price isn't updated by chainlink, we can't check if the price slippage is too great.
      await expect(c.optionGreekCache.isGlobalCacheStale()).to.revertedWith('rate is invalid');
      // Nor can we compute the greeks/update the boards.
      await expect(c.optionGreekCache.updateAllStaleBoards()).to.revertedWith('rate is invalid');

      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      // Now that we know the price, since the boards have not been updated, the boards are stale.
      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.true;

      // We can then update them, and they are no longer stale.
      await c.optionGreekCache.updateAllStaleBoards();
      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.false;
    });
  });

  describe('purchasing updating the cache', async () => {
    it('will update cache values when an option is purchased', async () => {
      expect((await c.optionGreekCache.globalCache()).netStdVega).to.eq(0);
      expect((await c.optionGreekCache.globalCache()).netDelta).to.eq(0);
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
      expect((await c.optionGreekCache.globalCache()).netStdVega).to.not.eq(0);
      expect((await c.optionGreekCache.globalCache()).netDelta).to.not.eq(0);
      expect((await c.optionGreekCache.listingCaches(listingIds[0])).callExposure).to.eq(toBN('1'));
    });
  });

  describe('updateBoardCachedGreeks', async () => {
    it('can recompute a stale cache per board if price moves down', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.false;
      await fastForward(WEEK_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.true;
      await c.optionGreekCache.updateBoardCachedGreeks(boardId);
      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.false;
      // can update it as many times as we want, even if it doesn't change anything
      await c.optionGreekCache.updateBoardCachedGreeks(boardId);
      expect(await c.optionGreekCache.isGlobalCacheStale()).to.be.false;
    });
  });
});

describe('optionGreekCache', () => {
  let account: Signer;
  let c: TestSystemContractsType;
  let boardId1: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];

    c = await deployTestSystem(account);
    await seedTestSystem(account, c);

    await createDefaultBoardWithOverrides(c, { expiresIn: WEEK_SEC });

    [boardId1] = await c.optionMarket.getLiveBoards();
    listingIds = await c.optionMarket.getBoardListings(boardId1);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('checks all paths for priceMove', async () => {
    it('price moves up', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1750'));
      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.be.false;
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
    });

    it('price moves down', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1730'));
      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.be.false;
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
    });

    it('time moves', async () => {
      await fastForward(10);
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
      await fastForward(10);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.be.false;
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
    });

    it('no price scaling period', async () => {
      await c.optionGreekCache.setStaleCacheParameters(MONTH_SEC, 1, toBN('1'), toBN('1'));
      await fastForward(10);
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
      await fastForward(10);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.be.false;
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
    });
  });
});

describe('OptionGreekCache', () => {
  let deployer: Signer;
  let deployerAddr: string;
  let account2: Signer;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    account2 = signers[1];

    c = await deployTestContracts(deployer);
    await initTestSystem(c, {});
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('can only be initialized once', async () => {
      await expect(c.optionGreekCache.init(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)).revertedWith(
        'Contract already initialized',
      );
    });
  });

  describe('setStaleCacheParameters', async () => {
    let staleUpdateDuration: BigNumber;
    let priceScalingPeriod: BigNumber;
    let maxAcceptablePercent: BigNumber;
    let minAcceptablePercent: BigNumber;

    describe('revert conditions', async () => {
      beforeEach(async () => {
        staleUpdateDuration = await c.optionGreekCache.staleUpdateDuration();
        priceScalingPeriod = await c.optionGreekCache.priceScalingPeriod();
        maxAcceptablePercent = await c.optionGreekCache.maxAcceptablePercent();
        minAcceptablePercent = await c.optionGreekCache.minAcceptablePercent();
      });

      it('staleUpdateDuration must be >= 2 hours', async () => {
        await expect(
          c.optionGreekCache.setStaleCacheParameters(
            7199,
            priceScalingPeriod,
            maxAcceptablePercent,
            minAcceptablePercent,
          ),
        ).revertedWith('staleUpdateDuration too low');
      });

      it('maxAcceptablePercent must be >= min', async () => {
        await expect(
          c.optionGreekCache.setStaleCacheParameters(
            staleUpdateDuration,
            priceScalingPeriod,
            toBN('0'),
            minAcceptablePercent,
          ),
        ).revertedWith('maxAcceptablePercent must be >= min');
      });

      it('minAcceptablePercent too low', async () => {
        await expect(
          c.optionGreekCache.setStaleCacheParameters(
            staleUpdateDuration,
            priceScalingPeriod,
            maxAcceptablePercent,
            toBN('0'),
          ),
        ).revertedWith('minAcceptablePercent too low');
      });
    });

    describe('success', async () => {
      it('values are updated correctly', async () => {
        await c.optionGreekCache.setStaleCacheParameters(7200, toBN('0.01'), toBN('0.021'), toBN('0.01'));
        staleUpdateDuration = await c.optionGreekCache.staleUpdateDuration();
        priceScalingPeriod = await c.optionGreekCache.priceScalingPeriod();
        maxAcceptablePercent = await c.optionGreekCache.maxAcceptablePercent();
        minAcceptablePercent = await c.optionGreekCache.minAcceptablePercent();
        expect(staleUpdateDuration).eq(7200);
        expect(priceScalingPeriod).eq(toBN('0.01'));
        expect(maxAcceptablePercent).eq(toBN('0.021'));
        expect(minAcceptablePercent).eq(toBN('0.01'));
      });
    });
  });

  describe('addBoard', async () => {
    beforeEach(async () => {
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('1000000'));
    });

    it('only optionMarket can addBoard', async () => {
      await expect(c.optionGreekCache.addBoard(1)).to.be.revertedWith('Only optionMarket permitted');
    });

    it('reverts for too many listings', async () => {
      await expect(
        createDefaultBoardWithOverrides(c, {
          skews: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'],
          strikes: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'],
        }),
      ).revertedWith('too many listings for board');
    });

    it('can add multiple listings per board', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(c);
      const listingIds = await c.optionMarket.getBoardListings(newBoardId);
      for (const id of listingIds) {
        const cachedListing = await c.optionGreekCache.listingCaches(id);
        const actualListing = await c.optionMarket.optionListings(id);
        expect(cachedListing.id).eq(actualListing.id);
        expect(cachedListing.strike).eq(actualListing.strike);
        expect(cachedListing.skew).eq(actualListing.skew);
        expect(cachedListing.callExposure).eq(0);
        expect(cachedListing.putExposure).eq(0);
      }
    });

    it('can add multiple boards', async () => {
      const boardIds = [];
      for (let i = 0; i++; i < 5) {
        boardIds.push(await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / i }));
      }

      for (let i = 0; i++; i < 5) {
        const board = await c.optionGreekCache.boardCaches(i);
        expect(board.expiry).eq(MONTH_SEC / i);
      }
    });
  });

  describe('removeBoard', async () => {
    it('only optionMarket can remove board', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(c);
      await expect(c.optionGreekCache.removeBoard(newBoardId)).to.be.revertedWith('Only optionMarket permitted');
    });

    it('can remove a board successfully', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(c, { strikes: ['1000'], skews: ['1'] });

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      const boardCacheBefore = await c.optionGreekCache.boardCaches(newBoardId);
      const listingsBefore = await c.optionMarket.getBoardListings(newBoardId);
      const listingsCacheBefore = await c.optionGreekCache.listingCaches(listingsBefore[0]);
      expect(boardCacheBefore.id).to.equal(newBoardId);
      expect(await c.optionGreekCache.liveBoards(0)).to.equal(newBoardId);
      expect(listingsBefore).has.length(1);
      expect(listingsCacheBefore.id).to.equal(listingsBefore[0]);

      // Calls removeBoard
      await c.optionMarket.liquidateExpiredBoard(newBoardId);

      expect((await c.optionGreekCache.boardCaches(newBoardId)).id).to.equal(0);
      await expect(c.optionGreekCache.liveBoards(0)).to.be.reverted;
      const listingsCacheAfter = await c.optionGreekCache.listingCaches(listingsBefore[0]);
      expect(listingsCacheAfter.id).to.equal(0);
    });

    it('can remove a board with multiple listings successfully', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(c);

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      const listingsBefore = await c.optionMarket.getBoardListings(newBoardId);
      expect(listingsBefore).has.length(5);

      for (const listing of listingsBefore) {
        const listingsCacheBefore = await c.optionGreekCache.listingCaches(listing);
        expect(listingsCacheBefore.id).to.equal(listing);
      }

      await c.optionMarket.liquidateExpiredBoard(newBoardId);

      for (const listing of listingsBefore) {
        const listingsCacheBefore = await c.optionGreekCache.listingCaches(listing);
        expect(listingsCacheBefore.id).to.equal(0);
      }
    });

    it('removing a board updates the global cache correctly', async () => {
      const newBoardId = await createDefaultBoardWithOverrides(c);

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      const globalCacheBefore = await c.optionGreekCache.globalCache();
      const boardCache = await c.optionGreekCache.boardCaches(newBoardId);

      await c.optionMarket.liquidateExpiredBoard(newBoardId);

      const globalCache = await c.optionGreekCache.globalCache();
      expect(globalCache.netDelta).to.eq(globalCacheBefore.netDelta.add(boardCache.netDelta));
      expect(globalCache.netStdVega).to.eq(globalCacheBefore.netStdVega.add(boardCache.netStdVega));
      const globalNetDelta = await c.optionGreekCache.getGlobalNetDelta();
      expect(globalCache.netDelta).to.eq(globalNetDelta);
    });
  });

  describe('updateAllStaleBoards', async () => {
    it('updates only one stale board', async () => {
      const boardId1 = await createDefaultBoardWithOverrides(c);

      await fastForward(WEEK_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      const boardId2 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 2 });
      const boardId3 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC - 8 * DAY_SEC });

      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(true);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId2)).to.equal(false);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId3)).to.equal(false);

      // Only board 1 gets updated
      await c.optionGreekCache.updateAllStaleBoards();

      const updateTime = await currentTime();

      const boardCache1 = await c.optionGreekCache.boardCaches(boardId1);
      const boardCache2 = await c.optionGreekCache.boardCaches(boardId2);
      const boardCache3 = await c.optionGreekCache.boardCaches(boardId3);

      expect(boardCache1.minUpdatedAt).to.gte(updateTime);
      expect(boardCache2.minUpdatedAt).to.lt(updateTime);
      expect(boardCache3.minUpdatedAt).to.lt(updateTime);
    });

    it('updates multiple stale boards', async () => {
      const boardId1 = await createDefaultBoardWithOverrides(c);
      const boardId2 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 2 });
      const boardId3 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 1.05 });

      await fastForward(WEEK_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));

      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(true);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId2)).to.equal(true);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId3)).to.equal(true);

      // All boards gets updated
      await c.optionGreekCache.updateAllStaleBoards();

      const updateTime = await currentTime();

      const boardCache1 = await c.optionGreekCache.boardCaches(boardId1);
      const boardCache2 = await c.optionGreekCache.boardCaches(boardId2);
      const boardCache3 = await c.optionGreekCache.boardCaches(boardId3);

      expect(boardCache1.minUpdatedAt).to.gte(updateTime);
      expect(boardCache2.minUpdatedAt).to.gte(updateTime);
      expect(boardCache3.minUpdatedAt).to.gte(updateTime);
    });

    it('doesnt update anything if there are no stale board', async () => {
      const boardId1 = await createDefaultBoardWithOverrides(c);
      const boardId2 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 2 });
      const boardId3 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 1.05 });

      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(false);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId2)).to.equal(false);
      expect(await c.optionGreekCache.isBoardCacheStale(boardId3)).to.equal(false);

      // No board gets updated
      await c.optionGreekCache.updateAllStaleBoards();

      const updateTime = await currentTime();

      const boardCache1 = await c.optionGreekCache.boardCaches(boardId1);
      const boardCache2 = await c.optionGreekCache.boardCaches(boardId2);
      const boardCache3 = await c.optionGreekCache.boardCaches(boardId3);

      expect(boardCache1.minUpdatedAt).to.lt(updateTime);
      expect(boardCache2.minUpdatedAt).to.lt(updateTime);
      expect(boardCache3.minUpdatedAt).to.lt(updateTime);
    });

    it('cannot update invalid boardId', async () => {
      await expect(c.optionGreekCache.isBoardCacheStale(1234)).revertedWith('Board does not exist');
    });
  });

  describe('updateBoardCachedGreeks', async () => {
    it("updates board even if it isn't stale", async () => {
      const boardId1 = await createDefaultBoardWithOverrides(c);

      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(false);

      await c.optionGreekCache.updateBoardCachedGreeks(boardId1);

      const updateTime = await currentTime();

      const boardCache = await c.optionGreekCache.boardCaches(boardId1);
      expect(boardCache.minUpdatedAt).to.gte(updateTime);
    });

    it('board last updated at is correctly updated', async () => {
      const boardId1 = await createDefaultBoardWithOverrides(c);

      expect(await c.optionGreekCache.isBoardCacheStale(boardId1)).to.equal(false);

      const boardCacheBefore = await c.optionGreekCache.boardCaches(boardId1);

      await c.optionGreekCache.updateBoardCachedGreeks(boardId1);

      const updateTime = await currentTime();

      const boardCache = await c.optionGreekCache.boardCaches(boardId1);
      expect(boardCacheBefore.minUpdatedAt).to.lt(updateTime);
      expect(boardCache.minUpdatedAt).to.gte(updateTime);
    });
  });

  describe('updateListingCacheAndGetPrice', async () => {
    let c: TestSystemContractsType;
    let boardId: BigNumber;
    let listingIds: BigNumber[];

    const greekCacheGlobals = {
      rateAndCarry: toBN('0.01'),
      spotPrice: toBN('1742'),
    };

    beforeEach(async () => {
      c = await deployTestContracts(deployer);
      await initTestSystem(c, { optionMarketPricer: deployerAddr });
      await seedTestBalances(deployer, c);
      const id = await createDefaultBoardWithOverrides(c, { strikes: ['1000'], skews: ['1'] });
      await c.optionGreekCache.updateBoardCachedGreeks(id);

      boardId = (await c.optionMarket.getLiveBoards())[0];
      listingIds = await c.optionMarket.getBoardListings(boardId);
    });

    it('reverts if caller is not pricer contract', async () => {
      await expect(
        c.optionGreekCache
          .connect(account2)
          .updateListingCacheAndGetPrice(greekCacheGlobals, listingIds[0], toBN('1'), toBN('1'), toBN('1'), toBN('1')),
      ).revertedWith('Only optionPricer permitted');
    });

    it('reverts if global cache is stale', async () => {
      await fastForward(WEEK_SEC);

      await expect(
        c.optionGreekCache.updateListingCacheAndGetPrice(
          greekCacheGlobals,
          listingIds[0],
          toBN('1'),
          0,
          toBN('1'),
          toBN('1'),
        ),
      ).revertedWith('Global cache is stale');
    });

    it('reverts if listingId is invalid', async () => {
      await expect(
        c.optionGreekCache.updateListingCacheAndGetPrice(greekCacheGlobals, 25, 0, 0, toBN('1'), toBN('1')),
      ).revertedWith('SafeMath: division by zero');
    });

    it('returns a price if both callExposureDiff and putExposureDiff are 0', async () => {
      const currentListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);

      await c.optionGreekCache.updateListingCacheAndGetPrice(
        greekCacheGlobals,
        listingIds[0],
        currentListingCache.callExposure,
        currentListingCache.putExposure,
        toBN('1'),
        toBN('1'),
      );
    });

    it('reverts if both callExposure and putExposure are updated', async () => {
      await expect(
        c.optionGreekCache.updateListingCacheAndGetPrice(
          greekCacheGlobals,
          listingIds[0],
          toBN('1'),
          toBN('1'),
          toBN('1'),
          toBN('1'),
        ),
      ).revertedWith('both call and put exposure updated');
    });

    it('correctly updates the call exposure of the listing, board and global caches', async () => {
      const currentListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
      const currentBoardCache = await c.optionGreekCache.boardCaches(boardId);
      const currentGlobalCache = await c.optionGreekCache.globalCache();

      await c.optionGreekCache.updateListingCacheAndGetPrice(
        greekCacheGlobals,
        listingIds[0],
        toBN('1'),
        currentListingCache.putExposure,
        toBN('1'),
        toBN('1'),
      );

      const updatedListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
      const updatedBoardCache = await c.optionGreekCache.boardCaches(boardId);
      const updatedGlobalCache = await c.optionGreekCache.globalCache();

      expect(updatedListingCache.updatedAt).to.gt(currentListingCache.updatedAt);
      expect(updatedBoardCache.minUpdatedAt).to.gt(currentBoardCache.minUpdatedAt);
      expect(updatedGlobalCache.minUpdatedAt).to.gt(currentGlobalCache.minUpdatedAt);

      expect(updatedListingCache.callExposure).to.gt(currentListingCache.callExposure);
    });

    it('correctly updates the put exposure of the listing, board and global caches', async () => {
      const currentListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
      const currentBoardCache = await c.optionGreekCache.boardCaches(boardId);
      const currentGlobalCache = await c.optionGreekCache.globalCache();

      await c.optionGreekCache.updateListingCacheAndGetPrice(
        greekCacheGlobals,
        listingIds[0],
        currentListingCache.putExposure,
        toBN('1'),
        toBN('1'),
        toBN('1'),
      );

      const updatedListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
      const updatedBoardCache = await c.optionGreekCache.boardCaches(boardId);
      const updatedGlobalCache = await c.optionGreekCache.globalCache();

      expect(updatedListingCache.updatedAt).to.gt(currentListingCache.updatedAt);
      expect(updatedBoardCache.minUpdatedAt).to.gt(currentBoardCache.minUpdatedAt);
      expect(updatedGlobalCache.minUpdatedAt).to.gt(currentGlobalCache.minUpdatedAt);

      expect(updatedListingCache.putExposure).to.gt(currentListingCache.putExposure);
    });

    it('given two listings, board/global minUpdatedAt matches the untouched listing, and min/max prices are correct', async () => {
      const c = await deployTestContracts(deployer);
      await initTestSystem(c, { optionMarketPricer: deployerAddr });
      await seedTestSystem(deployer, c);

      const boardId = (await c.optionMarket.getLiveBoards())[0];
      const listingIds = await c.optionMarket.getBoardListings(boardId);

      const currentListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
      const currentBoardCache = await c.optionGreekCache.boardCaches(boardId);
      const currentGlobalCache = await c.optionGreekCache.globalCache();

      await c.optionGreekCache.updateListingCacheAndGetPrice(
        greekCacheGlobals,
        listingIds[0],
        currentListingCache.callExposure,
        currentListingCache.putExposure,
        toBN('1'),
        toBN('1'),
      );

      const updatedListingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
      const updatedBoardCache = await c.optionGreekCache.boardCaches(boardId);
      const updatedGlobalCache = await c.optionGreekCache.globalCache();

      expect(updatedListingCache.updatedAt).to.gt(currentListingCache.updatedAt);
      expect(updatedBoardCache.minUpdatedAt).to.eq(currentBoardCache.minUpdatedAt);
      expect(updatedGlobalCache.minUpdatedAt).to.eq(currentGlobalCache.minUpdatedAt);
    });
  });

  describe('addListingToBoard', async () => {
    let boardId: BigNumber;
    let now: number;
    beforeEach(async () => {
      now = await currentTime();
      await c.optionMarket.createOptionBoard(now + MONTH_SEC, toBN('1'), [toBN('1900')], [toBN('0.9')]);
      const boardIds = await c.optionMarket.getLiveBoards();
      boardId = boardIds[0];
    });

    it('only optionMarket can addListingToBoard', async () => {
      await expect(c.optionGreekCache.addListingToBoard(1, 5)).to.be.revertedWith('Only optionMarket permitted');
    });

    it('can add a listing to the listing cache successfully', async () => {
      await c.optionMarket.addListingToBoard(boardId, toBN('1500'), toBN('1'));
      const cachedListing = await c.optionGreekCache.listingCaches(5);
      const actualListing = await c.optionMarket.optionListings(5);
      expect(cachedListing.id).eq(actualListing.id);
      expect(cachedListing.strike).eq(actualListing.strike);
      expect(cachedListing.skew).eq(actualListing.skew);
      expect(cachedListing.callExposure).eq(0);
      expect(cachedListing.putExposure).eq(0);
    });

    it('can add multiple listings to the listing cache successfully', async () => {
      for (let i = 0; i++; i < 5) {
        await c.optionMarket.addListingToBoard(boardId, toBN('1500'), toBN('1'));
      }
      for (let i = 0; i++; i < 5) {
        const cachedListing = await c.optionGreekCache.listingCaches(5 + 4 * i);
        const actualListing = await c.optionMarket.optionListings(5 + 4 * i);
        expect(cachedListing.id).eq(actualListing.id);
        expect(cachedListing.strike).eq(actualListing.strike);
        expect(cachedListing.skew).eq(actualListing.skew);
        expect(cachedListing.callExposure).eq(0);
        expect(cachedListing.putExposure).eq(0);
      }
    });

    it('should revert when board has max number of listings', async () => {
      // Create a board with 9 listings
      await c.optionMarket.createOptionBoard(
        now + MONTH_SEC,
        toBN('1'),
        [
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
          toBN('1500'),
        ],
        [
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
          toBN('0.9'),
        ],
      );
      const boardIds = await c.optionMarket.getLiveBoards();
      await c.optionMarket.addListingToBoard(boardIds[1], toBN('1500'), toBN('1'));
      await expect(c.optionMarket.addListingToBoard(boardIds[1], toBN('1500'), toBN('1'))).revertedWith(
        'too many listings for board',
      );
    });
  });
});
