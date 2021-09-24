import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  DAY_SEC,
  getEventArgs,
  HOUR_SEC,
  MONTH_SEC,
  toBN,
  toBytes32,
  TradeType,
  UNIT,
  WEEK_SEC,
  ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import { currentTime, fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import { createDefaultBoardWithOverrides } from '../utils/contractHelpers';
import { deployTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
import { seedBalanceAndApprovalFor, seedTestBalances, seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('OptionMarket - Exercising', () => {
  let account: Signer;
  let account2: Signer;
  let accountAddr: string;
  let account2Addr: string;
  let c: TestSystemContractsType;

  let boardIds: BigNumber[];
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    [account, account2] = await ethers.getSigners();
    [accountAddr, account2Addr] = await Promise.all([account.getAddress(), account2.getAddress()]);

    c = await deployTestSystem(account);

    await seedTestSystem(account, c);

    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    snap = await takeSnapshot();

    boardIds = await c.optionMarket.getLiveBoards();
    listingIds = await c.optionMarket.getBoardListings(boardIds[0]);
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('settling the options', async () => {
    it('will pay out long calls', async () => {
      // One long call
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(toBN('500'));

      const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
      await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_CALL);
      const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
      expect(postBalance.sub(preBalance)).to.eq(toBN('500'));
    });

    it('will pay out long puts', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1200'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(toBN('300'));

      const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
      await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_PUT);
      const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
      expect(postBalance.sub(preBalance)).to.eq(toBN('300'));
    });

    it('will return short put collateral if out of the money', async () => {
      const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
      // The amount the user was paid to sell the puts to the market, plus the amount of collateral locked
      const optionValue = (await c.test.quoteToken.balanceOf(accountAddr)).sub(preBalance).add(toBN('1500'));
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
      await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_PUT);
      const postBalance = await c.test.quoteToken.balanceOf(accountAddr);

      expect(postBalance.sub(preBalance)).to.eq(optionValue);
    });

    it('will return short call collateral if out of the money', async () => {
      const preBalance = await c.test.baseToken.balanceOf(accountAddr);
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
      // The amount the user was paid to sell the call to the market, plus the amount of collateral locked
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
      await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_CALL);
      const postBalance = await c.test.baseToken.balanceOf(accountAddr);

      expect(postBalance).to.eq(preBalance);
    });
  });

  describe('settling the options when new listing added', async () => {
    let newListingId: BigNumber;

    beforeEach(async () => {
      await c.optionMarket.addListingToBoard(boardIds[0], toBN('1500'), toBN('1'));
      listingIds = await c.optionMarket.getBoardListings(boardIds[0]);
      // the new listing is appended to the end of the listingIds[] of the board
      newListingId = listingIds[listingIds.length - 1];
    });

    it('should allow the user to buy both long and short calls', async () => {
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_CALL, toBN('1'));
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_CALL, toBN('1'));

      expect(await c.optionToken.balanceOf(accountAddr, newListingId.toNumber() + TradeType.LONG_CALL)).to.eq(
        toBN('1'),
      );
      expect(await c.optionToken.balanceOf(accountAddr, newListingId.toNumber() + TradeType.SHORT_CALL)).to.eq(
        toBN('1'),
      );
    });

    it('should allow long and short puts', async () => {
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_PUT, toBN('1'));
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_PUT, toBN('1'));

      expect(await c.optionToken.balanceOf(accountAddr, newListingId.toNumber() + TradeType.SHORT_PUT)).to.eq(
        toBN('1'),
      );
      expect(await c.optionToken.balanceOf(accountAddr, newListingId.toNumber() + TradeType.LONG_PUT)).to.eq(toBN('1'));
    });

    it('increases cache listing/board/global exposure/netDelta/netStdVega', async () => {
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_CALL, toBN('5'));

      const listingCache = await c.optionGreekCache.listingCaches(newListingId);
      const boardCache = await c.optionGreekCache.boardCaches(boardIds[0]);
      const globalCache = await c.optionGreekCache.globalCache();

      await c.optionMarket.closePosition(newListingId, TradeType.SHORT_CALL, toBN('1'));

      const listingCacheAfter = await c.optionGreekCache.listingCaches(newListingId);
      const boardCacheAfter = await c.optionGreekCache.boardCaches(boardIds[0]);
      const globalCacheAfter = await c.optionGreekCache.globalCache();

      expect(listingCacheAfter.callExposure).to.gt(listingCache.callExposure);
      // FIXME - The callDelta decreses, is this right?
      // expect(listingCacheAfter.callDelta).to.gt(listingCache.callDelta)
      expect(listingCacheAfter.stdVega).to.gt(listingCache.stdVega);

      expect(boardCacheAfter.netDelta).to.gt(boardCache.netDelta);
      expect(boardCacheAfter.netStdVega).to.gt(boardCache.netStdVega);

      expect(globalCacheAfter.netDelta).to.gt(globalCache.netDelta);
      expect(globalCacheAfter.netStdVega).to.gt(globalCache.netStdVega);
    });

    it('Allows closing options after transferring', async () => {
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_CALL, toBN('1'));
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_PUT, toBN('2'));
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_CALL, toBN('3'));
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_PUT, toBN('4'));

      await c.optionToken.safeTransferFrom(
        accountAddr,
        account2Addr,
        newListingId.add(TradeType.LONG_CALL),
        toBN('1'),
        toBytes32(''),
      );
      await c.optionToken.safeTransferFrom(
        accountAddr,
        account2Addr,
        newListingId.add(TradeType.LONG_PUT),
        toBN('2'),
        toBytes32(''),
      );
      await c.optionToken.safeTransferFrom(
        accountAddr,
        account2Addr,
        newListingId.add(TradeType.SHORT_CALL),
        toBN('3'),
        toBytes32(''),
      );
      await c.optionToken.safeTransferFrom(
        accountAddr,
        account2Addr,
        newListingId.add(TradeType.SHORT_PUT),
        toBN('4'),
        toBytes32(''),
      );

      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.LONG_CALL))).eq(toBN('1'));
      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.LONG_PUT))).eq(toBN('2'));
      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.SHORT_CALL))).eq(toBN('3'));
      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.SHORT_PUT))).eq(toBN('4'));

      expect(await c.optionToken.balanceOf(accountAddr, newListingId.add(TradeType.LONG_CALL))).eq(0);
      expect(await c.optionToken.balanceOf(accountAddr, newListingId.add(TradeType.LONG_PUT))).eq(0);
      expect(await c.optionToken.balanceOf(accountAddr, newListingId.add(TradeType.SHORT_CALL))).eq(0);
      expect(await c.optionToken.balanceOf(accountAddr, newListingId.add(TradeType.SHORT_PUT))).eq(0);

      await c.optionMarket.connect(account2).closePosition(newListingId, TradeType.LONG_CALL, toBN('1'));
      await c.optionMarket.connect(account2).closePosition(newListingId, TradeType.LONG_PUT, toBN('2'));

      // Have to have balances to repay shorts only
      await seedBalanceAndApprovalFor(account2, c);

      await c.optionMarket.connect(account2).closePosition(newListingId, TradeType.SHORT_CALL, toBN('3'));
      await c.optionMarket.connect(account2).closePosition(newListingId, TradeType.SHORT_PUT, toBN('4'));

      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.LONG_CALL))).eq(0);
      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.LONG_PUT))).eq(0);
      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.SHORT_CALL))).eq(0);
      expect(await c.optionToken.balanceOf(account2Addr, newListingId.add(TradeType.SHORT_PUT))).eq(0);
    });

    it('will pay out long calls', async () => {
      // One long call
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_CALL, toBN('1'));

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(toBN('500'));

      const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
      await c.optionMarket.settleOptions(newListingId, TradeType.LONG_CALL);
      const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
      expect(postBalance.sub(preBalance)).to.eq(toBN('500'));
    });

    it('will pay out long puts', async () => {
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_PUT, toBN('1'));

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1200'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(toBN('300'));

      const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
      await c.optionMarket.settleOptions(newListingId, TradeType.LONG_PUT);
      const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
      expect(postBalance.sub(preBalance)).to.eq(toBN('300'));
    });

    it('will return short put collateral if out of the money', async () => {
      const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_PUT, toBN('1'));
      // The amount the user was paid to sell the puts to the market, plus the amount of collateral locked
      const optionValue = (await c.test.quoteToken.balanceOf(accountAddr)).sub(preBalance).add(toBN('1500'));
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
      await c.optionMarket.settleOptions(newListingId, TradeType.SHORT_PUT);
      const postBalance = await c.test.quoteToken.balanceOf(accountAddr);

      expect(postBalance.sub(preBalance)).to.eq(optionValue);
    });

    it('will return short call collateral if out of the money', async () => {
      const preBalance = await c.test.baseToken.balanceOf(accountAddr);
      await c.optionMarket.openPosition(newListingId, TradeType.SHORT_CALL, toBN('1'));
      // The amount the user was paid to sell the call to the market, plus the amount of collateral locked
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));

      await c.optionMarket.liquidateExpiredBoard(boardIds[0]);

      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
      await c.optionMarket.settleOptions(newListingId, TradeType.SHORT_CALL);
      const postBalance = await c.test.baseToken.balanceOf(accountAddr);

      expect(postBalance).to.eq(preBalance);
    });

    it('netDelta should change when the greeks are updated some time after option bought on new listing', async () => {
      await c.optionMarket.openPosition(newListingId, TradeType.LONG_CALL, toBN('1'));
      const boardCache = await c.optionGreekCache.boardCaches(boardIds[0]);
      const globalCache = await c.optionGreekCache.globalCache();

      await fastForward(WEEK_SEC);

      await c.optionGreekCache.updateBoardCachedGreeks(boardIds[0]);
      const boardCacheAfter = await c.optionGreekCache.boardCaches(boardIds[0]);
      const globalCacheAfter = await c.optionGreekCache.globalCache();

      expect(boardCacheAfter.netDelta).to.not.eq(boardCache.netDelta);
      expect(globalCacheAfter.netDelta).to.not.eq(globalCache.netDelta);
    });
  });
});

describe('OptionMarket - Option Listings', () => {
  let account: Signer;
  let c: TestSystemContractsType;
  let snap: number;
  let now: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    c = await deployTestSystem(account);
    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
    now = await currentTime();
  });

  describe('create listing', async () => {
    it('should add many listings', async () => {
      await c.optionMarket.createOptionBoard(
        now + MONTH_SEC,
        toBN('10'),
        [toBN('1000'), toBN('1500'), toBN('2000'), toBN('2500'), toBN('3000')],
        [toBN('0.8'), toBN('0.9'), toBN('1'), toBN('1.1'), toBN('1.2')],
      );
      await c.optionMarket.createOptionBoard(
        now + MONTH_SEC / 2,
        toBN('10'),
        [toBN('1000'), toBN('1500'), toBN('2000'), toBN('2500'), toBN('3000')],
        [toBN('0.8'), toBN('0.9'), toBN('1'), toBN('1.1'), toBN('1.2')],
      );
    });
  });

  describe('get listings', async () => {
    it("should get no listings if they don't exist", async () => {
      expect(await c.optionMarketViewer.getListingsForBoard(0)).to.be.empty;
    });

    it('should get listings if they are present', async () => {
      await c.optionMarket.createOptionBoard(now + MONTH_SEC, toBN('1'), [toBN('1900')], [toBN('1')]);
      const boardIds = await c.optionMarket.getLiveBoards();
      const listings = await c.optionMarketViewer.getListingsForBoard(boardIds[0]);

      expect(listings[0].listingId).to.eq(1);
      expect(listings[0].strike).to.eq(toBN('1900'));
    });

    it('should get many listings if they are present', async () => {
      await c.optionMarket.createOptionBoard(
        now + MONTH_SEC,
        toBN('1'),
        [toBN('1500'), toBN('2000'), toBN('2500')],
        [toBN('0.9'), toBN('1'), toBN('1.1')],
      );
      await c.optionMarket.createOptionBoard(
        now + MONTH_SEC / 2,
        toBN('1'),
        [toBN('1500'), toBN('2000'), toBN('2500')],
        [toBN('0.9'), toBN('1'), toBN('1.1')],
      );

      const boardIds = await c.optionMarket.getLiveBoards();
      expect(boardIds).to.have.lengthOf(2);
      const listings = await c.optionMarketViewer.getListingsForBoard(boardIds[0]);

      expect(listings).to.have.lengthOf(3);

      expect(listings[0].listingId).to.eq(1);
      expect(listings[0].strike).to.eq(toBN('1500'));
    });
  });

  describe('add listing to board', async () => {
    it('should not add a listing if board not exist', async () => {
      await expect(c.optionMarket.addListingToBoard(toBN('1'), toBN('1500'), toBN('1'))).revertedWith('InvalidBoardId');
    });

    it('should add the listings if it is added to a existing board', async () => {
      await c.optionMarket.createOptionBoard(now + MONTH_SEC, toBN('1'), [toBN('1900')], [toBN('0.9')]);
      const boardIds = await c.optionMarket.getLiveBoards();

      await c.optionMarket.addListingToBoard(boardIds[0], toBN('1500'), toBN('1'));
      const listings = await c.optionMarketViewer.getListingsForBoard(boardIds[0]);

      expect(listings[1].listingId).to.eq(5);
      expect(listings[1].strike).to.eq(toBN('1500'));
    });

    it('should add multiple listings to existing board', async () => {
      await c.optionMarket.createOptionBoard(now + MONTH_SEC, toBN('1'), [toBN('1900')], [toBN('0.9')]);
      await c.optionMarket.createOptionBoard(now + MONTH_SEC / 2, toBN('1'), [toBN('1500')], [toBN('1.1')]);

      const boardIds = await c.optionMarket.getLiveBoards();
      await c.optionMarket.addListingToBoard(boardIds[0], toBN('1600'), toBN('1'));
      await c.optionMarket.addListingToBoard(boardIds[0], toBN('1700'), toBN('1'));
      await c.optionMarket.addListingToBoard(boardIds[1], toBN('1800'), toBN('1'));

      const listingsOfBoard0 = await c.optionMarketViewer.getListingsForBoard(boardIds[0]);
      expect(listingsOfBoard0).to.have.lengthOf(3);
      const listingsOfBoard1 = await c.optionMarketViewer.getListingsForBoard(boardIds[1]);
      expect(listingsOfBoard1).to.have.lengthOf(2);
    });
  });
});

describe('OptionMarket - Scenarios', () => {
  let account1: Signer;
  let account2: Signer;
  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account1 = signers[0];
    account2 = signers[1];

    c = await deployTestSystem(account1);
    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
  });

  describe('init', async () => {
    it('should not allow init twice', async () => {
      await expect(
        c.optionMarket.init(
          c.lyraGlobals.address,
          c.liquidityPool.address,
          c.optionMarketPricer.address,
          c.optionGreekCache.address,
          c.shortCollateral.address,
          c.optionToken.address,
          c.test.quoteToken.address,
          c.test.baseToken.address,
          [],
        ),
      ).to.be.revertedWith('already initialized');
    });
  });

  describe('should handle edge cases as we expect with respect to d1 using default seed', async () => {
    beforeEach(async () => {
      await seedTestSystem(account1, c);
      boardId = (await c.optionMarket.getLiveBoards())[0];
      listingIds = await c.optionMarket.getBoardListings(boardId);
    });

    it('should not work with out of the money options', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
    });
  });

  describe('transfer ownership', async () => {
    it('forbids the transfer of ownership from non owner', async () => {
      await expect(c.optionMarket.connect(account2).transferOwnership(await account2.getAddress())).to.be.revertedWith(
        'OnlyOwner',
      );
    });

    it('forbids the transfer of ownership to zero address', async () => {
      await expect(c.optionMarket.transferOwnership(ZERO_ADDRESS)).to.be.revertedWith('TransferOwnerToZero');
    });

    it('emits transfer of ownership event on successful transfer', async () => {
      const event = await c.optionMarket.transferOwnership(await account2.getAddress());
      const { previousOwner, newOwner } = getEventArgs(await event.wait(), 'OwnershipTransferred');
      expect(previousOwner).to.be.equal(await account1.getAddress());
      expect(newOwner).to.be.equal(await account2.getAddress());
    });
  });

  describe('should handle edge cases as we expect with respect to d1 with custom boards', async () => {
    it('forbids the creation of a board with a greater expiration date than the max expiry', async () => {
      await createDefaultBoardWithOverrides(c);
      await expect(createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC * 2 })).to.be.revertedWith(
        'CannotStartNewRoundWhenBoardsExist',
      );
    });

    it('forbids the creation of a board with mismatch in strikes and skews lengths', async () => {
      await expect(createDefaultBoardWithOverrides(c, { strikes: [] })).to.revertedWith('StrikeSkewLengthMismatch');
      await expect(createDefaultBoardWithOverrides(c, { skews: [] })).to.revertedWith('StrikeSkewLengthMismatch');
    });

    it('forbids the creation of a board with expiration more than 10 weeks out', async () => {
      await expect(createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC * 4 })).to.revertedWith(
        'BoardMaxExpiryReached',
      );
    });
  });
});

describe('OptionMarket - Trading', () => {
  let account: Signer;
  let account2: Signer;
  let accountAddr: string;
  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    accountAddr = await account.getAddress();
    account2 = signers[1];

    c = await deployTestSystem(account);

    await seedTestSystem(account, c);

    await c.test.quoteToken.mint(await account2.getAddress(), toBN('1000000'));
    await c.test.quoteToken.connect(account2).approve(c.optionMarket.address, toBN('1000000'));

    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();

    boardId = (await c.optionMarket.getLiveBoards())[0];
    listingIds = await c.optionMarket.getBoardListings(boardId);
  });

  describe('opening positions', async () => {
    describe('revert conditions', async () => {
      it('should revert if the listing id is invalid', async () => {
        await expect(c.optionMarket.openPosition(10000, TradeType.SHORT_PUT, toBN('1'))).to.be.revertedWith(
          'BoardFrozenOrTradingCutoffReached',
        );
      });

      it('should revert if the listing is close to expiry', async () => {
        // Fast forward to an hour before expiry
        await fastForward(MONTH_SEC - HOUR_SEC);
        await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'))).to.be.revertedWith(
          'BoardFrozenOrTradingCutoffReached',
        );
      });
    });

    describe('long calls', async () => {
      it('should update the user balance and net exposure', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL);
        expect(balance).to.eq(toBN('1'));
      });

      it('should allow the user to buy both long and short calls', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));
      });

      it('should buy the base asset and send it to the LP', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        await c.liquidityPool.exchangeBase();
        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(toBN('1'));
      });
    });

    describe('short calls', async () => {
      it('should update the user balance and net exposure', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL);
        expect(balance).to.eq(toBN('1'));
      });

      it('should allow open if the user is long calls', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_CALL)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL)).to.eq(toBN('1'));
      });
    });

    describe('long puts', async () => {
      it('should allow open if the user is short puts', async () => {
        await c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('1'));
        await c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));
      });

      it('should update the user balance and net exposure', async () => {
        await c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'));
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT);
        expect(balance).to.eq(toBN('1'));
      });

      it('should lock strike * amount in the LP', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));
        expect(
          (await c.liquidityPool.getLiquidity(toBN('1742.01337'), c.test.collateralShort.address)).usedCollatLiquidity,
        ).to.eq(toBN('1500'));
      });
    });

    describe('short puts', async () => {
      it('should allow open if the user is long puts', async () => {
        await c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'));
        await c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_PUT)).to.eq(toBN('1'));
        expect(await c.optionToken.balanceOf(accountAddr, 1 + TradeType.LONG_PUT)).to.eq(toBN('1'));
      });

      it('should update the user balance and net exposure', async () => {
        await c.optionMarket.openPosition(1, TradeType.SHORT_CALL, toBN('1'));
        const balance = await c.optionToken.balanceOf(accountAddr, 1 + TradeType.SHORT_CALL);
        expect(balance).to.eq(toBN('1'));
      });

      it('should revert if the fee is greater than the premium', async () => {
        await c.lyraGlobals.setMinDelta(c.optionMarket.address, toBN('0.05'));
        // One long call, one short put
        const boardId = await createDefaultBoardWithOverrides(c, {
          expiresIn: MONTH_SEC / 2,
          baseIV: '1',
          strikes: ['1430'],
          skews: ['0.9'],
        });
        listingIds = await c.optionMarket.getBoardListings(boardId);
        const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('10'));
        const cost = getEventArgs(await tx.wait(), 'PositionOpened').totalCost;
        expect(cost).to.eq(0);
      });
    });
  });

  describe('iv impact', async () => {
    it('should modify iv impact if a position is opened', async () => {
      const preListings = await c.optionMarketViewer.getListingsForBoard(boardId);
      const preVol = preListings[0].iv.mul(preListings[0].skew).div(UNIT);

      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

      const postListings = await c.optionMarketViewer.getListingsForBoard(boardId);
      const postVol = postListings[0].iv.mul(preListings[0].skew).div(UNIT);

      expect(postListings[0].listingId).to.eq(preListings[0].listingId);

      expect(preVol).to.not.equal(postVol);
    });
  });
});

describe('OptionMarket - unit', () => {
  let account: Signer;
  let account2: Signer;
  let accountAddr: string;
  let account2Addr: string;
  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    [account, account2] = await ethers.getSigners();
    [accountAddr, account2Addr] = await Promise.all([account.getAddress(), account2.getAddress()]);

    c = await deployTestSystem(account);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });
  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('can only be initialized once', async () => {
      await seedTestSystem(account, c);

      await expect(
        c.optionMarket.init(
          c.lyraGlobals.address,
          c.liquidityPool.address,
          c.optionMarketPricer.address,
          c.optionGreekCache.address,
          c.shortCollateral.address,
          c.optionToken.address,
          c.test.quoteToken.address,
          c.test.baseToken.address,
          [],
        ),
      ).to.revertedWith('already initialized');
    });
  });

  describe('createOptionBoard', async () => {
    it('reverts for invalid board - no listings', async () => {
      await expect(
        c.optionMarket.createOptionBoard((await currentTime()) + MONTH_SEC, toBN('1'), [], []),
      ).to.revertedWith('StrikeSkewLengthMismatch');
    });

    it('reverts for invalid board - strike.length != skew.length', async () => {
      await expect(
        c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC,
          toBN('1'),
          ['1000', '1500', '2000', '2500', '3000'].map(toBN),
          ['1', '1', '1', '1'].map(toBN),
        ),
      ).to.revertedWith('StrikeSkewLengthMismatch');
    });

    it('reverts for invalid board - expiry is gt 10 weeks', async () => {
      await expect(
        c.optionMarket.createOptionBoard(
          (await currentTime()) + WEEK_SEC * 10 + 1,
          toBN('1'),
          ['1000', '1500', '2000', '2500', '3000'].map(toBN),
          ['1', '1', '1', '1', '1'].map(toBN),
        ),
      ).to.revertedWith('BoardMaxExpiryReached');
    });

    it('reverts for invalid board - expiry is gt current maxExpiryTimestamp but boards not liquidated yet', async () => {
      await seedTestSystem(account, c);

      await expect(
        c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC + WEEK_SEC,
          toBN('1'),
          ['1000', '1500', '2000', '2500', '3000'].map(toBN),
          ['1', '1', '1', '1', '1'].map(toBN),
        ),
      ).to.revertedWith('CannotStartNewRoundWhenBoardsExist');
    });
    it('can add multiple listings per board', async () => {
      await c.optionMarket.createOptionBoard(
        (await currentTime()) + MONTH_SEC,
        toBN('1'),
        ['1000', '1500', '2000', '2500', '3000'].map(toBN),
        ['1', '1', '1', '1', '1'].map(toBN),
      );

      const boartdListings = await c.optionMarket.getBoardListings((await c.optionMarket.getLiveBoards())[0]);

      expect(boartdListings.length).to.eq(5);
    });
    it('board and listings are updated and greek values are added', async () => {
      const expiry = (await currentTime()) + MONTH_SEC;
      const baseIv = toBN('1');
      const strikes = ['1000', '1500', '2000', '2500', '3000'].map(toBN);
      const skews = ['1', '1', '1', '1', '1'].map(toBN);
      await c.optionMarket.createOptionBoard(expiry, baseIv, strikes, skews);

      const boardData = await c.optionMarket.optionBoards((await c.optionMarket.getLiveBoards())[0]);

      expect(boardData.id).to.eq(1);
      expect(boardData.expiry).to.eq(expiry);
      expect(boardData.iv).to.eq(baseIv);

      const listingsData = await Promise.all(
        (await c.optionMarket.getBoardListings(1)).map(l => c.optionMarket.optionListings(l)),
      );
      for (let i = 0; i < listingsData.length; i++) {
        expect(listingsData[i].id).to.eq(1 + i * 4);
        expect(listingsData[i].strike).to.eq(strikes[i]);
        expect(listingsData[i].skew).to.eq(skews[i]);
      }

      const boardCache = await c.optionGreekCache.boardCaches(1);
      expect(boardCache.expiry).to.eq(expiry);
      const listingsCache = await Promise.all(listingsData.map(l => c.optionGreekCache.listingCaches(l.id)));
      for (let i = 0; i < listingsData.length; i++) {
        expect(listingsCache[i].id).to.eq(1 + i * 4);
        expect(listingsCache[i].strike).to.eq(strikes[i]);
        expect(listingsCache[i].skew).to.eq(skews[i]);
      }
    });
    it('can add multiple boards', async () => {
      const expiry = (await currentTime()) + MONTH_SEC;
      const baseIv = toBN('1');
      const strikes = ['1000', '1500', '2000', '2500', '3000'].map(toBN);
      const skews = ['1', '1', '1', '1', '1'].map(toBN);
      await c.optionMarket.createOptionBoard(expiry, baseIv, strikes, skews);

      await c.optionMarket.createOptionBoard(expiry - WEEK_SEC, baseIv, strikes, skews);

      const liveBoards = await c.optionMarket.getLiveBoards();
      expect(liveBoards.length).to.eq(2);
    });
  });

  describe('open - close - liquidate - settle', async () => {
    before(async () => {
      boardId = await seedTestSystem(account, c);
      listingIds = await c.optionMarket.getBoardListings(boardId);

      await seedBalanceAndApprovalFor(account2, c);
    });

    describe('openPosition', async () => {
      // Note: this should only check state is updated where it should be
      //  it doesn't care about the correctness of fees/premium etc.

      it('cannot open a trade too close to expiry', async () => {
        await fastForward(MONTH_SEC - DAY_SEC / 2 + 1);
        await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'))).revertedWith(
          'BoardFrozenOrTradingCutoffReached',
        );
      });

      it('cannot open a trade of 0 amount', async () => {
        await fastForward(MONTH_SEC - DAY_SEC / 2 + 1);
        await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, 0)).revertedWith(
          'ZeroAmountOrInvalidTradeType',
        );
      });

      describe('opening long call', async () => {
        it('updates user and listing positions', async () => {
          const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0]);
          const { longCall } = await c.optionMarket.optionListings(listingIds[0]);
          const lpBaseBalance = await c.test.baseToken.balanceOf(c.liquidityPool.address);

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
          await c.liquidityPool.exchangeBase();

          expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(bal.add(toBN('1')));
          expect((await c.optionMarket.optionListings(listingIds[0])).longCall).to.eq(longCall.add(toBN('1')));
          expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(lpBaseBalance.add(toBN('1')));
        });
        it('increases board iv and listing skew', async () => {
          const { iv } = await c.optionMarket.optionBoards(boardId);
          const { skew } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

          expect((await c.optionMarket.optionBoards(boardId)).iv).to.gt(iv);
          expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.gt(skew);
        });
        it('increases cache listing/board/global exposure/netDelta/netStdVega', async () => {
          const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCache = await c.optionGreekCache.boardCaches(boardId);
          const globalCache = await c.optionGreekCache.globalCache();

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

          const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
          const globalCacheAfter = await c.optionGreekCache.globalCache();

          expect(listingCacheAfter.callExposure).to.gt(listingCache.callExposure);
          // FIXME - The callDelta decreases, is this right?
          // expect(listingCacheAfter.callDelta).to.gt(listingCache.callDelta)
          expect(listingCacheAfter.stdVega).to.gt(listingCache.stdVega);

          expect(boardCacheAfter.netDelta).to.gt(boardCache.netDelta);
          expect(boardCacheAfter.netStdVega).to.gt(boardCache.netStdVega);

          expect(globalCacheAfter.netDelta).to.gt(globalCache.netDelta);
          expect(globalCacheAfter.netStdVega).to.gt(globalCache.netStdVega);
        });
        it('updates available collateral/locked base as expected', async () => {
          const lockedCollateral = await c.liquidityPool.lockedCollateral();
          const lpBaseBalance = await c.test.baseToken.balanceOf(c.liquidityPool.address);
          const userQuoteBalance = await c.test.quoteToken.balanceOf(accountAddr);

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
          await c.liquidityPool.exchangeBase();

          const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();
          const lpBaseBalanceAfter = await c.test.baseToken.balanceOf(c.liquidityPool.address);
          const userQuoteBalanceAfter = await c.test.quoteToken.balanceOf(accountAddr);

          expect(lockedCollateralAfter.base).to.gt(lockedCollateral.base);
          expect(lpBaseBalanceAfter).to.gt(lpBaseBalance);
          expect(userQuoteBalanceAfter).to.lt(userQuoteBalance);
        });
        it('sends quote to the LP', async () => {
          const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
          const receipt = await tx.wait();
          const positionOpenedEvent = getEventArgs(receipt, 'PositionOpened');

          await expect(tx)
            .to.emit(c.test.quoteToken, 'Transfer')
            .withArgs(accountAddr, c.liquidityPool.address, positionOpenedEvent.totalCost);
        });
        it("reverts if the user doesn't have enough quote", async () => {
          // the totalCost is 338.671507522434281870
          const userQuoteBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.test.quoteToken.transfer(account2Addr, userQuoteBalance.sub(toBN('337')));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance',
          );
        });
        it("reverts if the user doesn't have enough quote approval", async () => {
          await c.test.quoteToken.approve(c.optionMarket.address, toBN('337'));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
          );
        });
        it('reverts if there is not enough collat liquidity to buy base', async () => {
          await expect(
            c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('191.3')),
          ).to.be.revertedWith('LockingMoreBaseThanCanBeExchanged');
        });
      });

      describe('opening short call', async () => {
        it('updates user and listing positions', async () => {
          const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL));
          const { shortCall } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

          expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).to.eq(
            bal.add(toBN('1')),
          );
          expect((await c.optionMarket.optionListings(listingIds[0])).shortCall).to.eq(shortCall.add(toBN('1')));
        });
        it('decreases board iv and listing skew', async () => {
          const { iv } = await c.optionMarket.optionBoards(boardId);
          const { skew } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

          expect((await c.optionMarket.optionBoards(boardId)).iv).to.lt(iv);
          expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.lt(skew);
        });
        it('decreases cache listing/board/global exposure/netDelta/netStdVega', async () => {
          const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCache = await c.optionGreekCache.boardCaches(boardId);
          const globalCache = await c.optionGreekCache.globalCache();

          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

          const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
          const globalCacheAfter = await c.optionGreekCache.globalCache();

          expect(listingCacheAfter.callExposure).to.lt(listingCache.callExposure);
          // FIXME - The callDelta increases, is this right?
          // expect(listingCacheAfter.callDelta).to.lt(listingCache.callDelta)
          expect(listingCacheAfter.stdVega).to.lt(listingCache.stdVega);

          expect(boardCacheAfter.netDelta).to.lt(boardCache.netDelta);
          expect(boardCacheAfter.netStdVega).to.lt(boardCache.netStdVega);

          expect(globalCacheAfter.netDelta).to.lt(globalCache.netDelta);
          expect(globalCacheAfter.netStdVega).to.lt(globalCache.netStdVega);
        });
        it('takes quote from the LP', async () => {
          const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
          const receipt = await tx.wait();
          const positionOpenedEvent = getEventArgs(receipt, 'PositionOpened');

          await expect(tx)
            .to.emit(c.test.quoteToken, 'Transfer')
            .withArgs(c.liquidityPool.address, accountAddr, positionOpenedEvent.totalCost);
        });
        it('takes base from the user into ShortCollateral', async () => {
          const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

          await expect(tx)
            .to.emit(c.test.baseToken, 'Transfer')
            .withArgs(accountAddr, c.shortCollateral.address, toBN('1'));
        });
        it("reverts if the user doesn't have enough base", async () => {
          const userBaseBalance = await c.test.baseToken.balanceOf(accountAddr);
          await c.test.baseToken.transfer(account2Addr, userBaseBalance.sub(toBN('0.9')));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance',
          );
        });
        it("reverts if the user doesn't have enough base approval", async () => {
          await c.test.baseToken.approve(c.optionMarket.address, toBN('0.9'));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
          );
        });

        it('reverts if there is not enough collat liquidity to pay premium', async () => {
          await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('0'));
          // buy enough calls that we run out of free liquidity
          await c.optionMarket.connect(account2).openPosition(listingIds[0], TradeType.LONG_CALL, toBN('180'));
          await expect(
            c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('300')),
          ).to.be.revertedWith('vol out of trading range');
        });
      });

      describe('opening long put', async () => {
        it('updates user and listing positions', async () => {
          const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT));
          const { longPut } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

          expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).to.eq(
            bal.add(toBN('1')),
          );
          expect((await c.optionMarket.optionListings(listingIds[0])).longPut).to.eq(longPut.add(toBN('1')));
          expect(
            (await c.liquidityPool.getLiquidity(toBN('1742.01337'), c.test.collateralShort.address))
              .usedCollatLiquidity,
          ).to.eq(toBN('1500'));
        });
        it('increases board iv and listing skew', async () => {
          const { iv } = await c.optionMarket.optionBoards(boardId);
          const { skew } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

          expect((await c.optionMarket.optionBoards(boardId)).iv).to.gt(iv);
          expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.gt(skew);
        });
        it('increases cache listing/board/global exposure/netDelta/netStdVega', async () => {
          const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCache = await c.optionGreekCache.boardCaches(boardId);
          const globalCache = await c.optionGreekCache.globalCache();

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

          const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
          const globalCacheAfter = await c.optionGreekCache.globalCache();

          expect(listingCacheAfter.putExposure).to.gt(listingCache.putExposure);
          // FIXME - The putDelta decreases, is this right?
          // expect(listingCacheAfter.putDelta).to.gt(listingCache.putDelta)
          expect(listingCacheAfter.stdVega).to.gt(listingCache.stdVega);

          // FIXME - netDelta goes from 0 to -0.225582688330500000
          // expect(boardCacheAfter.netDelta).to.gt(boardCache.netDelta)
          expect(boardCacheAfter.netStdVega).to.gt(boardCache.netStdVega);

          // FIXME - netDelta goes from 0 to -0.225582688330500000
          // expect(globalCacheAfter.netDelta).to.gt(globalCache.netDelta)
          expect(globalCacheAfter.netStdVega).to.gt(globalCache.netStdVega);
        });
        it('updates available collateral/locked base as expected', async () => {
          const lockedCollateral = await c.liquidityPool.lockedCollateral();
          const userQuoteBalance = await c.test.quoteToken.balanceOf(accountAddr);

          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

          const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();
          const userQuoteBalanceAfter = await c.test.quoteToken.balanceOf(accountAddr);

          expect(lockedCollateralAfter.quote).to.gt(lockedCollateral.quote);
          expect(userQuoteBalanceAfter).to.lt(userQuoteBalance);
        });
        it('sends quote to the LP', async () => {
          const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));
          const receipt = await tx.wait();
          const positionOpenedEvent = getEventArgs(receipt, 'PositionOpened');

          await expect(tx)
            .to.emit(c.test.quoteToken, 'Transfer')
            .withArgs(accountAddr, c.liquidityPool.address, positionOpenedEvent.totalCost);
        });
        it("reverts if the user doesn't have enough quote", async () => {
          // the totalCost is 82.660344493951043151
          const userQuoteBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.test.quoteToken.transfer(account2Addr, userQuoteBalance.sub(toBN('81')));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance',
          );
        });
        it("reverts if the user doesn't have enough quote approval", async () => {
          await c.test.quoteToken.approve(c.optionMarket.address, toBN('81'));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
          );
        });
        it('reverts if there is not enough collat liquidity', async () => {
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('223'))).to.be.revertedWith(
            'LockingMoreQuoteThanIsFree',
          );
        });
      });

      describe('opening short put', async () => {
        it('updates user and listing positions', async () => {
          const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT));
          const { shortPut } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

          expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).to.eq(
            bal.add(toBN('1')),
          );
          expect((await c.optionMarket.optionListings(listingIds[0])).shortPut).to.eq(shortPut.add(toBN('1')));
        });
        it('decreases board iv and listing skew', async () => {
          const { iv } = await c.optionMarket.optionBoards(boardId);
          const { skew } = await c.optionMarket.optionListings(listingIds[0]);

          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

          expect((await c.optionMarket.optionBoards(boardId)).iv).to.lt(iv);
          expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.lt(skew);
        });
        it('decreases cache listing/board/global exposure/netDelta/netStdVega', async () => {
          const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCache = await c.optionGreekCache.boardCaches(boardId);
          const globalCache = await c.optionGreekCache.globalCache();

          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

          const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
          const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
          const globalCacheAfter = await c.optionGreekCache.globalCache();

          expect(listingCacheAfter.putExposure).to.lt(listingCache.putExposure);
          // FIXME - The putDelta increases, is this right?
          // expect(listingCacheAfter.putDelta).to.lt(listingCache.putDelta)
          expect(listingCacheAfter.stdVega).to.lt(listingCache.stdVega);

          // FIXME - netDelta goes from 0 to 0.224469236331150000
          // expect(boardCacheAfter.netDelta).to.lt(boardCache.netDelta)
          expect(boardCacheAfter.netStdVega).to.lt(boardCache.netStdVega);

          // FIXME - netDelta goes from 0 to 0.224469236331150000
          // expect(globalCacheAfter.netDelta).to.lt(globalCache.netDelta)
          expect(globalCacheAfter.netStdVega).to.lt(globalCache.netStdVega);
        });

        it('takes quote from the LP', async () => {
          const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
          const receipt = await tx.wait();
          const positionOpenedEvent = getEventArgs(receipt, 'PositionOpened');

          await expect(tx)
            .to.emit(c.test.quoteToken, 'Transfer')
            .withArgs(c.liquidityPool.address, accountAddr, positionOpenedEvent.totalCost);
        });
        it('takes quote from the user into shortCollateral', async () => {
          const optionListings = await c.optionMarket.optionListings(listingIds[0]);
          const tx = await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

          await expect(tx)
            .to.emit(c.test.quoteToken, 'Transfer')
            .withArgs(accountAddr, c.shortCollateral.address, optionListings.strike);
        });
        it("reverts if the user doesn't have enough quote", async () => {
          const optionListings = await c.optionMarket.optionListings(listingIds[0]);
          const userBaseBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.test.quoteToken.transfer(account2Addr, userBaseBalance.sub(optionListings.strike.sub(1)));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance',
          );
        });
        it("reverts if the user doesn't have enough base approval", async () => {
          const optionListings = await c.optionMarket.optionListings(listingIds[0]);
          await c.test.quoteToken.approve(c.optionMarket.address, optionListings.strike.sub(1));
          await expect(c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'))).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
          );
        });
      });
    });

    describe('closePosition', async () => {
      // Note: this should only check state is updated where it should be
      //  it doesn't care about the correctness of fees/premium etc.

      it('wont close if amount is 0', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('5'));
        await expect(c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, 0)).revertedWith(
          'ZeroAmountOrInvalidTradeType',
        );
      });

      describe('closing long call - partially', async () => {
        let baseIv: BigNumber;
        let baseSkew: BigNumber;
        let initLockedCollateral: [BigNumber, BigNumber] & { quote: BigNumber; base: BigNumber };
        let initLpBaseBalance: BigNumber;
        before(async () => {
          baseIv = (await c.optionMarket.optionBoards(boardId)).iv;
          baseSkew = (await c.optionMarket.optionListings(listingIds[0])).skew;

          initLockedCollateral = await c.liquidityPool.lockedCollateral();
          initLpBaseBalance = await c.test.baseToken.balanceOf(c.liquidityPool.address);
        });
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('5'));
          await c.liquidityPool.exchangeBase();
        });
        describe('partial close', async () => {
          it('updates user and listing positions', async () => {
            const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0]);
            const { longCall } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(bal.sub(toBN('1')));
            expect((await c.optionMarket.optionListings(listingIds[0])).longCall).to.eq(longCall.sub(toBN('1')));
          });
          it('decreases board iv and listing skew', async () => {
            const { iv } = await c.optionMarket.optionBoards(boardId);
            const { skew } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.lt(iv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.lt(skew);
          });
          it('decreases cache listing/board/global exposure/netDelta/netStdVega', async () => {
            const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCache = await c.optionGreekCache.boardCaches(boardId);
            const globalCache = await c.optionGreekCache.globalCache();

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));

            const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
            const globalCacheAfter = await c.optionGreekCache.globalCache();

            expect(listingCacheAfter.callExposure).to.lt(listingCache.callExposure);
            // FIXME - The callDelta increases, is this right?
            // expect(listingCacheAfter.callDelta).to.lt(listingCache.callDelta)
            expect(listingCacheAfter.stdVega).to.lt(listingCache.stdVega);

            expect(boardCacheAfter.netDelta).to.lt(boardCache.netDelta);
            expect(boardCacheAfter.netStdVega).to.lt(boardCache.netStdVega);

            expect(globalCacheAfter.netDelta).to.lt(globalCache.netDelta);
            expect(globalCacheAfter.netStdVega).to.lt(globalCache.netStdVega);
          });
          it('updates available collateral/locked base as expected', async () => {
            const lockedCollateral = await c.liquidityPool.lockedCollateral();
            const lpBaseBalance = await c.test.baseToken.balanceOf(c.liquidityPool.address);

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
            await c.liquidityPool.exchangeBase();

            const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();
            const lpBaseBalanceAfter = await c.test.baseToken.balanceOf(c.liquidityPool.address);

            expect(lockedCollateralAfter.base).to.lt(lockedCollateral.base);
            expect(lpBaseBalanceAfter).to.lt(lpBaseBalance);
          });
          it('LP sells base and sends quote to user', async () => {
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(c.liquidityPool.address, accountAddr, positionClosedEvent.totalCost);
          });
        });
        describe('full close', async () => {
          let bal: BigNumber;
          beforeEach(async () => {
            bal = await c.optionToken.balanceOf(accountAddr, listingIds[0]);
          });
          it('sets user and listing positions to 0', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, bal);

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0])).to.eq(0);
            expect((await c.optionMarket.optionListings(listingIds[0])).longCall).to.eq(0);
          });
          it('sets board iv and listing skew to base level', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, bal);

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.eq(baseIv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.eq(baseSkew);
          });
          it('decreases cache listing/board/global exposure/netDelta/netStdVega to 0', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, bal);

            const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
            const globalCacheAfter = await c.optionGreekCache.globalCache();

            expect(listingCacheAfter.callExposure).to.eq(0);
            // FIXME - The callDelta in not 0, is this right?
            // expect(listingCacheAfter.callDelta).to.eq(0)
            // FIXME - The vega in not 0, is this right?
            // expect(listingCacheAfter.vega).to.eq(0);

            expect(boardCacheAfter.netDelta).to.eq(0);
            expect(boardCacheAfter.netStdVega).to.eq(0);

            expect(globalCacheAfter.netDelta).to.eq(0);
            expect(globalCacheAfter.netStdVega).to.eq(0);
          });
          it('updates available collateral/locked base as expected', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, bal);
            await c.liquidityPool.exchangeBase();

            const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();
            const lpBaseBalanceAfter = await c.test.baseToken.balanceOf(c.liquidityPool.address);

            expect(lockedCollateralAfter.base).to.eq(initLockedCollateral.base);
            expect(lpBaseBalanceAfter).to.eq(initLpBaseBalance);
          });
          it('LP sells base and sends quote to user', async () => {
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, bal);
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(c.liquidityPool.address, accountAddr, positionClosedEvent.totalCost);
          });
        });
        it('cannot close a larger position than held by user', async () => {
          await c.optionMarket.connect(account2).openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_CALL, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close from a 0 position', async () => {
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_CALL, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close a position in a board too close to expiry', async () => {
          await fastForward(MONTH_SEC - DAY_SEC / 4);
          await expect(c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'))).revertedWith(
            'BoardFrozenOrTradingCutoffReached',
          );
        });
      });

      describe('closing long put - partially', async () => {
        let baseIv: BigNumber;
        let baseSkew: BigNumber;
        let initLockedCollateral: [BigNumber, BigNumber] & { quote: BigNumber; base: BigNumber };
        before(async () => {
          baseIv = (await c.optionMarket.optionBoards(boardId)).iv;
          baseSkew = (await c.optionMarket.optionListings(listingIds[0])).skew;

          initLockedCollateral = await c.liquidityPool.lockedCollateral();
        });
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('5'));
        });
        describe('partial close', async () => {
          it('updates user and listing positions', async () => {
            const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT));
            const { longPut } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).to.eq(
              bal.sub(toBN('1')),
            );
            expect((await c.optionMarket.optionListings(listingIds[0])).longPut).to.eq(longPut.sub(toBN('1')));
          });
          it('decreases board iv and listing skew', async () => {
            const { iv } = await c.optionMarket.optionBoards(boardId);
            const { skew } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.lt(iv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.lt(skew);
          });
          it('decreases cache listing/board/global exposure/netDelta/netStdVega', async () => {
            const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCache = await c.optionGreekCache.boardCaches(boardId);
            const globalCache = await c.optionGreekCache.globalCache();

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

            const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
            const globalCacheAfter = await c.optionGreekCache.globalCache();

            expect(listingCacheAfter.putExposure).to.lt(listingCache.putExposure);
            // FIXME - The putDelta increases, is this right?
            // expect(listingCacheAfter.putDelta).to.lt(listingCache.putDelta)
            expect(listingCacheAfter.stdVega).to.lt(listingCache.stdVega);

            // FIXME - The netDelta increases, is this right?
            // expect(boardCacheAfter.netDelta).to.lt(boardCache.netDelta);
            expect(boardCacheAfter.netStdVega).to.lt(boardCache.netStdVega);

            // FIXME - The netDelta increases, is this right?
            // expect(globalCacheAfter.netDelta).to.lt(globalCache.netDelta);
            expect(globalCacheAfter.netStdVega).to.lt(globalCache.netStdVega);
          });
          it('updates available collateral/locked quote as expected', async () => {
            const lockedCollateral = await c.liquidityPool.lockedCollateral();

            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));

            const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();

            expect(lockedCollateralAfter.quote).to.lt(lockedCollateral.quote);
          });
          it('LP unlocks quote and sends quote to user', async () => {
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(c.liquidityPool.address, accountAddr, positionClosedEvent.totalCost);
          });
        });
        describe('full close', async () => {
          let bal: BigNumber;
          beforeEach(async () => {
            bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT));
          });
          it('sets user and listing positions to 0', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, bal);

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).to.eq(0);
            expect((await c.optionMarket.optionListings(listingIds[0])).longPut).to.eq(0);
          });
          it('sets board iv and listing skew to base level', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, bal);

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.eq(baseIv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.eq(baseSkew);
          });
          it('decreases cache listing/board/global exposure/netDelta/netStdVega to 0', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, bal);

            const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
            const globalCacheAfter = await c.optionGreekCache.globalCache();

            expect(listingCacheAfter.putExposure).to.eq(0);
            // FIXME - The putDelta not 0, is this right?
            // expect(listingCacheAfter.putDelta).to.eq(0)
            // FIXME - The vega not 0, is this right?
            // expect(listingCacheAfter.vega).to.eq(0);

            expect(boardCacheAfter.netDelta).to.eq(0);
            expect(boardCacheAfter.netStdVega).to.eq(0);

            expect(globalCacheAfter.netDelta).to.eq(0);
            expect(globalCacheAfter.netStdVega).to.eq(0);
          });
          it('updates available collateral/locked base as expected', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, bal);

            const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();

            expect(lockedCollateralAfter.quote).to.eq(initLockedCollateral.quote);
          });
          it('LP unlocks quote and sends quote to user', async () => {
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, bal);
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(c.liquidityPool.address, accountAddr, positionClosedEvent.totalCost);
          });
        });
        it('cannot close a larger position than held by user', async () => {
          await c.optionMarket.connect(account2).openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_PUT, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close from a 0 position', async () => {
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_PUT, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close a position in a board too close to expiry', async () => {
          await fastForward(MONTH_SEC - DAY_SEC / 4);
          await expect(c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1'))).revertedWith(
            'BoardFrozenOrTradingCutoffReached',
          );
        });
      });

      describe('closing short call - partially', async () => {
        let baseIv: BigNumber;
        let baseSkew: BigNumber;
        before(async () => {
          baseIv = (await c.optionMarket.optionBoards(boardId)).iv;
          baseSkew = (await c.optionMarket.optionListings(listingIds[0])).skew;
        });
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('5'));
        });
        describe('partial close', async () => {
          it('updates user and listing positions', async () => {
            const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL));
            const { shortCall } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).to.eq(
              bal.sub(toBN('1')),
            );
            expect((await c.optionMarket.optionListings(listingIds[0])).shortCall).to.eq(shortCall.sub(toBN('1')));
          });
          it('increases board iv and listing skew ', async () => {
            const { iv } = await c.optionMarket.optionBoards(boardId);
            const { skew } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.gt(iv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.gt(skew);
          });
          it('increases cache listing/board/global exposure/netDelta/netStdVega', async () => {
            const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCache = await c.optionGreekCache.boardCaches(boardId);
            const globalCache = await c.optionGreekCache.globalCache();

            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));

            const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
            const globalCacheAfter = await c.optionGreekCache.globalCache();

            expect(listingCacheAfter.callExposure).to.gt(listingCache.callExposure);
            // FIXME - The callDelta decreses, is this right?
            // expect(listingCacheAfter.callDelta).to.gt(listingCache.callDelta)
            expect(listingCacheAfter.stdVega).to.gt(listingCache.stdVega);

            expect(boardCacheAfter.netDelta).to.gt(boardCache.netDelta);
            expect(boardCacheAfter.netStdVega).to.gt(boardCache.netStdVega);

            expect(globalCacheAfter.netDelta).to.gt(globalCache.netDelta);
            expect(globalCacheAfter.netStdVega).to.gt(globalCache.netStdVega);
          });

          it('takes quote from user and partially returns base to the user', async () => {
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(accountAddr, c.liquidityPool.address, positionClosedEvent.totalCost);

            await expect(tx)
              .to.emit(c.test.baseToken, 'Transfer')
              .withArgs(c.shortCollateral.address, accountAddr, toBN('1'));
          });

          it('takes quote from user and partially returns base to the user', async () => {
            await c.test.quoteToken.setForceFail(true);
            await expect(c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'))).revertedWith(
              'QuoteTransferFailed',
            );
          });
        });
        describe('full close', async () => {
          let bal: BigNumber;
          beforeEach(async () => {
            bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL));
          });
          it('sets user and listing positions to 0', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, bal);

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).to.eq(0);
            expect((await c.optionMarket.optionListings(listingIds[0])).shortCall).to.eq(0);
          });
          it('sets board iv and listing skew to base level', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, bal);

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.eq(baseIv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.eq(baseSkew);
          });
          it('takes quote from user and returns all base to the user', async () => {
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, bal);
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(accountAddr, c.liquidityPool.address, positionClosedEvent.totalCost);

            await expect(tx)
              .to.emit(c.test.baseToken, 'Transfer')
              .withArgs(c.shortCollateral.address, accountAddr, bal);
          });
        });
        it('cannot close a larger position than held by user', async () => {
          await c.optionMarket.connect(account2).openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close from a 0 position', async () => {
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close a position in a board too close to expiry', async () => {
          await fastForward(MONTH_SEC - DAY_SEC / 4);
          await expect(c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'))).revertedWith(
            'BoardFrozenOrTradingCutoffReached',
          );
        });
      });

      describe('closing short put - partially', async () => {
        let baseIv: BigNumber;
        let baseSkew: BigNumber;
        before(async () => {
          baseIv = (await c.optionMarket.optionBoards(boardId)).iv;
          baseSkew = (await c.optionMarket.optionListings(listingIds[0])).skew;
        });
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('5'));
        });
        describe('partial close', async () => {
          it('updates user and listing positions', async () => {
            const bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT));
            const { shortPut } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).to.eq(
              bal.sub(toBN('1')),
            );
            expect((await c.optionMarket.optionListings(listingIds[0])).shortPut).to.eq(shortPut.sub(toBN('1')));
          });
          it('increases board iv and listing skew ', async () => {
            const { iv } = await c.optionMarket.optionBoards(boardId);
            const { skew } = await c.optionMarket.optionListings(listingIds[0]);

            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.gt(iv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.gt(skew);
          });
          it('increases cache listing/board/global exposure/netDelta/netStdVega', async () => {
            const listingCache = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCache = await c.optionGreekCache.boardCaches(boardId);
            const globalCache = await c.optionGreekCache.globalCache();

            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));

            const listingCacheAfter = await c.optionGreekCache.listingCaches(listingIds[0]);
            const boardCacheAfter = await c.optionGreekCache.boardCaches(boardId);
            const globalCacheAfter = await c.optionGreekCache.globalCache();

            expect(listingCacheAfter.putExposure).to.gt(listingCache.putExposure);
            // FIXME - The putDelta decreses, is this right?
            // expect(listingCacheAfter.putDelta).to.gt(listingCache.putDelta)
            expect(listingCacheAfter.stdVega).to.gt(listingCache.stdVega);

            // FIXME - The netDelta decreses, is this right?
            // expect(boardCacheAfter.netDelta).to.gt(boardCache.netDelta);
            expect(boardCacheAfter.netStdVega).to.gt(boardCache.netStdVega);

            // FIXME - The netDelta decreses, is this right?
            // expect(globalCacheAfter.netDelta).to.gt(globalCache.netDelta);
            expect(globalCacheAfter.netStdVega).to.gt(globalCache.netStdVega);
          });
          it('returns partial quote to the user', async () => {
            const listing = await c.optionMarket.optionListings(listingIds[0]);
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(c.shortCollateral.address, c.liquidityPool.address, positionClosedEvent.totalCost);

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(
                c.shortCollateral.address,
                accountAddr,
                toBN('1').mul(listing.strike).div(toBN('1')).sub(positionClosedEvent.totalCost),
              );
          });
        });
        describe('full close', async () => {
          let bal: BigNumber;
          beforeEach(async () => {
            bal = await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT));
          });
          it('sets user and listing positions to 0', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, bal);

            expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).to.eq(0);
            expect((await c.optionMarket.optionListings(listingIds[0])).shortPut).to.eq(0);
          });
          it('sets board iv and listing skew to base level', async () => {
            await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, bal);

            expect((await c.optionMarket.optionBoards(boardId)).iv).to.eq(baseIv);
            expect((await c.optionMarket.optionListings(listingIds[0])).skew).to.eq(baseSkew);
          });
          it('takes quote from user and returns all quote to the user', async () => {
            const listing = await c.optionMarket.optionListings(listingIds[0]);
            const tx = await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, bal);
            const receipt = await tx.wait();
            const positionClosedEvent = getEventArgs(receipt, 'PositionClosed');

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(c.shortCollateral.address, c.liquidityPool.address, positionClosedEvent.totalCost);

            await expect(tx)
              .to.emit(c.test.quoteToken, 'Transfer')
              .withArgs(
                c.shortCollateral.address,
                accountAddr,
                bal.mul(listing.strike).div(toBN('1')).sub(positionClosedEvent.totalCost),
              );
          });
        });
        it('cannot close a larger position than held by user', async () => {
          await c.optionMarket.connect(account2).openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close from a 0 position', async () => {
          await expect(
            c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('5')),
          ).revertedWith('ERC1155: burn amount exceeds balance');
        });
        it('cannot close a position in a board too close to expiry', async () => {
          await fastForward(MONTH_SEC - DAY_SEC / 4);
          await expect(c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'))).revertedWith(
            'BoardFrozenOrTradingCutoffReached',
          );
        });
        it('cannot close a position in a board too close to expiry', async () => {
          await c.test.quoteToken.setForceFail(true);
          await expect(c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'))).revertedWith(
            'transfer failed',
          );
        });
      });
    });

    describe('liquidateExpiredBoard', async () => {
      it("reverts if trying to liquidate a board that hasn't expired", async () => {
        await expect(c.optionMarket.liquidateExpiredBoard(boardId)).to.revertedWith('BoardNotExpired');
      });
      it('reverts if trying to liquidate a board that has already been liquidated', async () => {
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await expect(c.optionMarket.liquidateExpiredBoard(boardId)).to.revertedWith('BoardAlreadyLiquidated');
      });
      it('reverts if the rate is invalid', async () => {
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockInvalid(true);
        await expect(c.optionMarket.liquidateExpiredBoard(boardId)).revertedWith('rate is invalid');
      });
      it('reverts if the same board is liquidated twice', async () => {
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await expect(c.optionMarket.liquidateExpiredBoard(boardId)).revertedWith('BoardAlreadyLiquidated');
      });

      describe('updates live boards correctly', async () => {
        it('is empty if there is only 1 board', async () => {
          await fastForward(MONTH_SEC);
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          expect(await c.optionMarket.getLiveBoards()).is.empty;
        });

        it('contains the other board if there are 2', async () => {
          const newBoardId = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 2 });
          await fastForward(MONTH_SEC);
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const newLiveBoards = await c.optionMarket.getLiveBoards();
          expect(newLiveBoards).has.length(1);
          expect(newLiveBoards[0]).to.eq(newBoardId);
        });

        describe('rearranges the liveBoards as expected', async () => {
          let board2: BigNumber;
          let board3: BigNumber;
          let board4: BigNumber;

          beforeEach(async () => {
            board2 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 4 });
            board3 = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 2 });
            board4 = await createDefaultBoardWithOverrides(c, { expiresIn: (MONTH_SEC / 4) * 3 });
            await fastForward(MONTH_SEC);
            await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
          });

          it('swaps last with first, removing first', async () => {
            await c.optionMarket.liquidateExpiredBoard(boardId);
            const newLiveBoards = await c.optionMarket.getLiveBoards();
            expect(newLiveBoards).has.length(3);
            expect(newLiveBoards[0]).to.eq(board4);
            expect(newLiveBoards[1]).to.eq(board2);
            expect(newLiveBoards[2]).to.eq(board3);
          });
          it('swaps last with second, removing second', async () => {
            await c.optionMarket.liquidateExpiredBoard(board2);
            const newLiveBoards = await c.optionMarket.getLiveBoards();
            expect(newLiveBoards).has.length(3);
            expect(newLiveBoards[0]).to.eq(boardId);
            expect(newLiveBoards[1]).to.eq(board4);
            expect(newLiveBoards[2]).to.eq(board3);
          });
          it('swaps last with third, removing third', async () => {
            await c.optionMarket.liquidateExpiredBoard(board3);
            const newLiveBoards = await c.optionMarket.getLiveBoards();
            expect(newLiveBoards).has.length(3);
            expect(newLiveBoards[0]).to.eq(boardId);
            expect(newLiveBoards[1]).to.eq(board2);
            expect(newLiveBoards[2]).to.eq(board4);
          });
          it('removes the last', async () => {
            await c.optionMarket.liquidateExpiredBoard(board4);
            const newLiveBoards = await c.optionMarket.getLiveBoards();
            expect(newLiveBoards).has.length(3);
            expect(newLiveBoards[0]).to.eq(boardId);
            expect(newLiveBoards[1]).to.eq(board2);
            expect(newLiveBoards[2]).to.eq(board3);
          });
        });
      });

      it('LP collateral is untouched if the board has no exposure', async () => {
        const newBoardId = await createDefaultBoardWithOverrides(c, { expiresIn: MONTH_SEC / 2 });
        const newListingIds = await c.optionMarket.getBoardListings(newBoardId);
        await c.optionMarket.openPosition(newListingIds[1], TradeType.LONG_CALL, toBN('1'));
        await c.liquidityPool.exchangeBase();
        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(toBN('1'));
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        // Liquidate the board with no exposure
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await c.liquidityPool.exchangeBase();
        // The pool should still hold 1 eth of collateral
        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(toBN('1'));
        // Liquidate the board with exposure
        await c.optionMarket.liquidateExpiredBoard(newBoardId);
        await c.liquidityPool.exchangeBase();
        // Balance is now 0
        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(0);
      });

      it('sells base collateral when liquidating both long and short call correctly', async () => {
        await c.optionMarket.openPosition(listingIds[1], TradeType.LONG_CALL, toBN('1'));
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
        await c.liquidityPool.exchangeBase();

        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(toBN('1'));
        expect(await c.test.baseToken.balanceOf(c.shortCollateral.address)).to.eq(toBN('1'));

        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await c.liquidityPool.exchangeBase();

        expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).to.eq(0);
        expect(await c.test.baseToken.balanceOf(c.shortCollateral.address))
          .to.lt(toBN('1'))
          .to.gt(0);
      });

      describe('long call exposure', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
          await fastForward(MONTH_SEC);
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.base).to.eq(toBN('1'));
          expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
        });

        it('does nothing if listing was OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          // base is liquidated back to usd, but none is reserved
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.base).to.eq(toBN('0'));
          expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
        });
        it('reserves quote profit for user correctly if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          // base is liquidated back to usd, but none is reserved
          // user gets back exactly 500, fee is charged to the pool
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.base).to.eq(toBN('0'));
          expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(toBN('500'));
        });
      });

      describe('long put exposure', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));
          await fastForward(MONTH_SEC);
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.quote).to.eq(toBN('1500'));
          expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
        });

        it('does nothing if listing was OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          // base is liquidated back to usd, but none is reserved
          // user gets back exactly 500, fee is charged to the pool
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.quote).to.eq(0);
          expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(0);
        });

        it('reserves quote in LP correctly if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          // base is liquidated back to usd, but none is reserved
          // user gets back exactly 500, fee is charged to the pool
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.quote).to.eq(0);
          expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).to.eq(toBN('500'));
        });
      });

      describe('short call exposure', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('10'));
          await fastForward(MONTH_SEC);
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.base).to.eq(0);
          expect(await c.test.baseToken.balanceOf(c.shortCollateral.address)).to.eq(toBN('10'));
        });

        it('sets eth return ratio to 1 if listing was OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);

          // eth is kept for the user
          expect(await c.test.baseToken.balanceOf(c.shortCollateral.address)).to.eq(toBN('10'));
        });

        it('sends collateral to LP and sells into quote correctly if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);

          // eth is kept for the user
          const baseBal = await c.test.baseToken.balanceOf(c.shortCollateral.address);
          // is 3/4 of the  balance, minus fee
          expect(baseBal).to.eq(toBN('7.48110831234256927'));
          expect(await c.optionMarket.listingToBaseReturnedRatio(listingIds[0])).to.eq(toBN('0.748110831234256927'));
        });
      });

      describe('short put exposure', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
          await fastForward(MONTH_SEC);
          const collateral = await c.liquidityPool.lockedCollateral();
          expect(collateral.quote).to.eq(0);
          expect(await c.test.quoteToken.balanceOf(c.shortCollateral.address)).to.eq(toBN('1500'));
        });

        it('does nothing if listing was OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          expect(await c.test.quoteToken.balanceOf(c.shortCollateral.address)).to.eq(toBN('1500'));
        });
        it('sends quote to pool correctly if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          // 1000 because 500 sent to LP
          expect(await c.test.quoteToken.balanceOf(c.shortCollateral.address)).to.eq(toBN('1000'));
        });
      });
    });

    describe('settle options', async () => {
      it("reverts if listing hasn't expired", async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        await expect(c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_CALL)).to.revertedWith(
          'board must be liquidated',
        );
      });

      it("reverts if board hasn't been liquidated", async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
        await expect(c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_CALL)).to.revertedWith(
          'board must be liquidated',
        );
      });

      it('resets balances to 0 after exercising', async () => {
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('1'));
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('1'));
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('1'));
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_CALL);
        await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_PUT);
        await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_CALL);
        await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_PUT);

        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_CALL))).to.eq(0);
        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).to.eq(0);
        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).to.eq(0);
        expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).to.eq(0);

        expect((await c.optionMarket.optionListings(listingIds[0])).longCall).to.eq(toBN('1'));
        expect((await c.optionMarket.optionListings(listingIds[0])).longPut).to.eq(toBN('1'));
        expect((await c.optionMarket.optionListings(listingIds[0])).shortCall).to.eq(toBN('1'));
        expect((await c.optionMarket.optionListings(listingIds[0])).shortPut).to.eq(toBN('1'));
      });

      describe('long call', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('10'));
          await fastForward(MONTH_SEC);
        });

        it('pays out nothing if OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_CALL);
          const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
          expect(preBalance).to.eq(postBalance);
        });
        it('pays out value if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_CALL);
          const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
          expect(preBalance.add(toBN('5000'))).to.eq(postBalance);
        });
      });

      describe('long put', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('10'));
          await fastForward(MONTH_SEC);
        });

        it('pays out nothing if OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_PUT);
          const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
          expect(preBalance).to.eq(postBalance);
        });
        it('pays out value if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_PUT);
          const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
          expect(preBalance.add(toBN('5000'))).to.eq(postBalance);
        });
      });

      describe('short call', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('10'));
          await fastForward(MONTH_SEC);
        });

        it('returns collateral fully if OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.baseToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_CALL);
          const postBalance = await c.test.baseToken.balanceOf(accountAddr);
          expect(preBalance.add(toBN('10'))).to.eq(postBalance);
        });
        it('returns collateral minus value if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.baseToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_CALL);
          const postBalance = await c.test.baseToken.balanceOf(accountAddr);
          // returns 3/4 - conversion fees
          expect(preBalance.add(toBN('7.48110831234256927'))).to.eq(postBalance);
        });
        it('returns 0 collateral in the case where fee + amount owed is greater than the value of the base', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.baseToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_CALL);
          const postBalance = await c.test.baseToken.balanceOf(accountAddr);
          expect(preBalance).to.eq(postBalance);
        });
      });

      describe('short put', async () => {
        beforeEach(async () => {
          await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('10'));
          await fastForward(MONTH_SEC);
        });

        it('returns collateral fully if OTM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_PUT);
          const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
          expect(preBalance.add(toBN('15000'))).to.eq(postBalance);
        });
        it('returns collateral minus value if ITM', async () => {
          await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
          await c.optionMarket.liquidateExpiredBoard(boardId);
          const preBalance = await c.test.quoteToken.balanceOf(accountAddr);
          await c.optionMarket.settleOptions(listingIds[0], TradeType.SHORT_PUT);
          const postBalance = await c.test.quoteToken.balanceOf(accountAddr);
          // Gets back collateral that wasn't owed to the market
          expect(preBalance.add(toBN('10000'))).to.eq(postBalance);
        });
      });
    });

    describe('setBoardFrozen', async () => {
      it('freezes a board from trading', async () => {
        await expect(c.optionMarket.setBoardFrozen(1234, true)).revertedWith('InvalidBoardId');
        await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('10'));
        await c.optionMarket.setBoardFrozen(boardId, true);
        await expect(c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('10'))).to.revertedWith(
          'BoardFrozenOrTradingCutoffReached',
        );
        await expect(c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('10'))).to.revertedWith(
          'BoardFrozenOrTradingCutoffReached',
        );
        await c.optionMarket.setBoardFrozen(boardId, false);
        await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('10'));
      });
    });

    describe('set iv/skew', async () => {
      it('can only be set when frozen', async () => {
        await expect(c.optionMarket.setBoardBaseIv(boardId, toBN('10'))).revertedWith('InvalidBoardIdOrNotFrozen');
        await expect(c.optionMarket.setListingSkew(listingIds[0], toBN('10'))).revertedWith(
          'InvalidListingIdOrNotFrozen',
        );
        await c.optionMarket.setBoardFrozen(boardId, true);
        await c.optionMarket.setBoardBaseIv(boardId, toBN('3'));
        await c.optionMarket.setListingSkew(listingIds[0], toBN('4'));
        const listingView = await c.optionMarketViewer.getListingView(listingIds[0]);
        expect((await c.optionMarket.optionBoards(boardId)).iv).eq(toBN('3'));
        expect((await c.optionMarket.optionListings(listingIds[0])).skew).eq(toBN('4'));
        expect(listingView.iv.mul(listingView.skew).div(UNIT)).eq(toBN('12'));
        expect((await c.optionGreekCache.boardCaches(boardId)).iv).eq(toBN('3'));
        expect((await c.optionGreekCache.listingCaches(listingIds[0])).skew).eq(toBN('4'));
      });
    });
  });
});

describe('OptionMarket settle dust scenario', async () => {
  let account: Signer;
  let account2: Signer;
  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    account2 = signers[1];

    c = await deployTestSystem(account);
    await seedTestBalances(account, c);

    await c.test.quoteToken.mint(await account2.getAddress(), toBN('100000'));
    await c.test.quoteToken.connect(account2).approve(c.optionMarket.address, toBN('100000'));

    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
  });

  it('Should not fail on rounding errors', async () => {
    // These numbers were randomly generated to cause an error
    const strike = '1100.087268553352';
    const spot = '1000.4281010720159';
    const r1 = toBN('0.5850672638225187');
    const r2 = toBN('0.0962663744474681');

    await c.mocked.exchangeRates.mockLatestPrice(toBN(spot));
    boardId = await createDefaultBoardWithOverrides(c, {
      strikes: [strike],
      skews: ['1'],
    });
    listingIds = await c.optionMarket.getBoardListings(boardId);

    await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, r1);
    await c.optionMarket.connect(account2).openPosition(listingIds[0], TradeType.LONG_PUT, r2);

    let collateral = await c.liquidityPool.lockedCollateral();
    await fastForward(MONTH_SEC);
    await c.mocked.exchangeRates.mockLatestPrice(toBN(spot));
    await c.optionMarket.liquidateExpiredBoard(boardId);
    collateral = await c.liquidityPool.lockedCollateral();
    expect(collateral.quote).to.eq(0);
    await c.optionMarket.settleOptions(listingIds[0], TradeType.LONG_PUT);
    await c.optionMarket.connect(account2).settleOptions(listingIds[0], TradeType.LONG_PUT);
  });
});
