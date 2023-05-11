import { currentTime, getEventArgs, MAX_UINT, MONTH_SEC, toBN, toBN18, WEEK_SEC } from '../../../scripts/util/web3utils';
import { closeLongCall, openDefaultLongCall } from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionMarket - Admin', () => {
  beforeEach(seedFixture);

  describe('init', async () => {
    it('can only be initialized once', async () => {
      await expect(
        hre.f.c.optionMarket.init(
          hre.f.c.synthetixAdapter.address,
          hre.f.c.liquidityPool.address,
          hre.f.c.optionMarketPricer.address,
          hre.f.c.optionGreekCache.address,
          hre.f.c.shortCollateral.address,
          hre.f.c.optionToken.address,
          hre.f.c.snx.quoteAsset.address,
          hre.f.c.snx.baseAsset.address,
        ),
      ).to.revertedWith('AlreadyInitialised');
    });

    it('does not update board base IV/skew if board does not exist or not frozen', async () => {
      await expect(hre.f.c.optionMarket.setBoardBaseIv(100, toBN('1'))).to.revertedWith('InvalidBoardId');
      await expect(hre.f.c.optionMarket.setStrikeSkew(100, toBN('1'))).to.revertedWith('InvalidStrikeId');

      await expect(hre.f.c.optionMarket.setBoardBaseIv(1, toBN('1'))).to.revertedWith('BoardNotFrozen');
      await expect(hre.f.c.optionMarket.setStrikeSkew(1, toBN('1'))).to.revertedWith('BoardNotFrozen');
    });
    it('update board base IV/skew', async () => {
      await hre.f.c.optionMarket.setBoardFrozen(1, true);
      const oldIv = (await hre.f.c.optionGreekCache.getOptionBoardCache(1)).iv;
      const oldSkew = (await hre.f.c.optionGreekCache.getStrikeCache(1)).skew;

      await hre.f.c.optionMarket.setBoardBaseIv(1, toBN('1.5'));
      await hre.f.c.optionMarket.setStrikeSkew(1, toBN('1.2'));

      const newIv = (await hre.f.c.optionGreekCache.getOptionBoardCache(1)).iv;
      const newSkew = (await hre.f.c.optionGreekCache.getStrikeCache(1)).skew;

      expect(oldIv).to.not.eq(newIv);
      expect(oldSkew).to.not.eq(newSkew);
      expect(newIv).to.eq(toBN('1.5'));
      expect(newSkew).to.eq(toBN('1.2'));
    });
  });

  describe('Boards', async () => {
    it('reverts for various reasons', async () => {
      // no strikes
      await expect(
        hre.f.c.optionMarket.createOptionBoard((await currentTime()) + MONTH_SEC, toBN('1'), [], [], false),
      ).to.revertedWith('StrikeSkewLengthMismatch');

      // strikePrice.length != skew.length
      await expect(
        hre.f.c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC,
          toBN('1'),
          ['1000', '1500', '2000', '2500', '3000'].map(toBN18),
          ['1', '1', '1', '1'].map(toBN18),
          false,
        ),
      ).to.revertedWith('StrikeSkewLengthMismatch');

      // A skew is 0
      await expect(
        hre.f.c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC,
          toBN('1'),
          ['1000'].map(toBN18),
          ['0'].map(toBN18),
          false,
        ),
      ).to.revertedWith('ExpectedNonZeroValue');

      // A strikePrice is 0
      await expect(
        hre.f.c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC,
          toBN('1'),
          ['0'].map(toBN18),
          ['1'].map(toBN18),
          false,
        ),
      ).to.revertedWith('ExpectedNonZeroValue');
    });

    it('can add multiple strikes per board', async () => {
      await hre.f.c.optionMarket.createOptionBoard(
        (await currentTime()) + MONTH_SEC,
        toBN('1'),
        ['1000', '1500', '2000', '2500', '3000'].map(toBN18),
        ['1', '1', '1', '1', '1'].map(toBN18),
        false,
      );

      const boardStrikes = await hre.f.c.optionMarket.getBoardStrikes((await hre.f.c.optionMarket.getLiveBoards())[1]);

      expect(boardStrikes.length).to.eq(5);
    });

    it('board and strikes are updated and greek values are added', async () => {
      const expiry = (await currentTime()) + MONTH_SEC;
      const baseIv = toBN('1');
      const strikePrices = ['1000', '1500', '2000', '2500', '3000'].map(toBN18);
      const skews = ['1', '1', '1', '1', '1'].map(toBN18);
      await hre.f.c.optionMarket.createOptionBoard(expiry, baseIv, strikePrices, skews, false);

      const boardData = await hre.f.c.optionMarket.getOptionBoard((await hre.f.c.optionMarket.getLiveBoards())[1]);

      expect(boardData.id).to.eq(2);
      expect(boardData.expiry).to.eq(expiry);
      expect(boardData.iv).to.eq(baseIv);

      const strikesData = await Promise.all(
        (await hre.f.c.optionMarket.getBoardStrikes(boardData.id)).map(l => hre.f.c.optionMarket.getStrike(l)),
      );
      for (let i = 0; i < strikesData.length; i++) {
        expect(strikesData[i].id).to.eq(hre.f.board.strikes.length + 1 + i);
        expect(strikesData[i].strikePrice).to.eq(strikePrices[i]);
        expect(strikesData[i].skew).to.eq(skews[i]);
      }

      const boardCache = await hre.f.c.optionGreekCache.getOptionBoardCache(boardData.id);
      expect(boardCache.expiry).to.eq(expiry);
      const strikesCache = await Promise.all(strikesData.map(l => hre.f.c.optionGreekCache.getStrikeCache(l.id)));
      for (let i = 0; i < strikesData.length; i++) {
        expect(strikesCache[i].id).to.eq(hre.f.board.strikes.length + 1 + i);
        expect(strikesCache[i].strikePrice).to.eq(strikePrices[i]);
        expect(strikesCache[i].skew).to.eq(skews[i]);
      }

      await expect(hre.f.c.optionMarket.addStrikeToBoard(1234, toBN('3500'), toBN('1.1'))).to.be.revertedWith(
        'InvalidBoardId',
      );

      await hre.f.c.optionMarket.addStrikeToBoard(boardData.id, toBN('3500'), toBN('1.1'));

      const updatedStrikesData = await Promise.all(
        (await hre.f.c.optionMarket.getBoardStrikes(boardData.id)).map(l => hre.f.c.optionMarket.getStrike(l)),
      );
      expect(strikesData.length).to.eq(updatedStrikesData.length - 1);
      expect(updatedStrikesData[updatedStrikesData.length - 1].strikePrice).to.eq(toBN('3500'));
      expect(updatedStrikesData[updatedStrikesData.length - 1].skew).to.eq(toBN('1.1'));
    });

    it('can add multiple boards', async () => {
      const expiry = (await currentTime()) + MONTH_SEC;
      const baseIv = toBN('1');
      const strikePrices = ['1000', '1500', '2000', '2500', '3000'].map(toBN18);
      const skews = ['1', '1', '1', '1', '1'].map(toBN18);
      await hre.f.c.optionMarket.createOptionBoard(expiry, baseIv, strikePrices, skews, false);

      await hre.f.c.optionMarket.createOptionBoard(expiry - WEEK_SEC, baseIv, strikePrices, skews, false);

      const liveBoards = await hre.f.c.optionMarket.getLiveBoards();
      expect(liveBoards.length).to.eq(3);
    });

    it('reverts for invalid boards', async () => {
      await expect(hre.f.c.optionMarket.createOptionBoard((await currentTime()) - 1, 0, [0], [0], false)).revertedWith(
        'InvalidExpiryTimestamp',
      );

      await expect(
        hre.f.c.optionMarket.createOptionBoard((await currentTime()) + 100, 0, [0], [1], false),
      ).revertedWith('ExpectedNonZeroValue');

      await expect(
        hre.f.c.optionMarket.createOptionBoard((await currentTime()) + 100, 0, [1], [0], false),
      ).revertedWith('ExpectedNonZeroValue');
    });

    it('gets correct live boardIds', async () => {
      expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(1);
      await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: 2 * MONTH_SEC });
      await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: 2 * MONTH_SEC });
      await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: 2 * MONTH_SEC });
      expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(4);

      await fastForward(MONTH_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(1);
      expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(3);
    });
  });

  describe('Strikes', async () => {
    it('should not add strike if board does not exist', async () => {
      await expect(hre.f.c.optionMarket.addStrikeToBoard(100, toBN('1000'), toBN('1'))).to.revertedWith(
        'InvalidBoardId',
      );
    });

    it('should add strikes if added to an existing board', async () => {
      await hre.f.c.optionMarket.addStrikeToBoard(1, toBN('5000'), toBN('1.5'));
      const strikeCache = await hre.f.c.optionMarket.getStrike(4);
      expect(strikeCache.strikePrice).to.eq(toBN('5000'));
      expect(strikeCache.skew).to.eq(toBN('1.5'));
    });

    // should we throw an error here?
    it('should get zero values if strike does not exist', async () => {
      const strikeCache = await hre.f.c.optionMarket.getStrike(100);
      expect(strikeCache.strikePrice).to.eq(toBN('0'));
      expect(strikeCache.skew).to.eq(toBN('0'));
    });
  });

  describe('Board Freezing', async () => {
    it('freezes a board from trading', async () => {
      await expect(hre.f.c.optionMarket.setBoardFrozen(1234, true)).revertedWith('InvalidBoardId');
      const positionId = await openDefaultLongCall();

      await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, true);
      await expect(openDefaultLongCall()).to.revertedWith('BoardIsFrozen');

      await expect(closeLongCall(positionId)).to.revertedWith('BoardIsFrozen');

      await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, false);
      await closeLongCall(positionId);
    });

    it('can only set iv/skew when frozen', async () => {
      await expect(hre.f.c.optionMarket.setBoardBaseIv(777, toBN('10'))).revertedWith('InvalidBoardId');

      await expect(hre.f.c.optionMarket.setBoardBaseIv(hre.f.board.boardId, 0)).revertedWith('ExpectedNonZeroValue');

      await expect(hre.f.c.optionMarket.setStrikeSkew(777, toBN('10'))).revertedWith('InvalidStrikeId');

      await expect(hre.f.c.optionMarket.setStrikeSkew(hre.f.strike.strikeId, 0)).revertedWith('ExpectedNonZeroValue');

      await expect(hre.f.c.optionMarket.setBoardBaseIv(hre.f.board.boardId, toBN('10'))).revertedWith('BoardNotFrozen');
      await expect(hre.f.c.optionMarket.setStrikeSkew(hre.f.strike.strikeId, toBN('10'))).revertedWith(
        'BoardNotFrozen',
      );
      await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, true);
      await hre.f.c.optionMarket.setBoardBaseIv(hre.f.board.boardId, toBN('3'));
      await hre.f.c.optionMarket.setStrikeSkew(hre.f.strike.strikeId, toBN('4'));
      expect((await hre.f.c.optionMarket.getOptionBoard(hre.f.board.boardId)).iv).eq(toBN('3'));
      expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).skew).eq(toBN('4'));
      expect((await hre.f.c.optionGreekCache.getOptionBoardCache(hre.f.board.boardId)).iv).eq(toBN('3'));
      expect((await hre.f.c.optionGreekCache.getStrikeCache(hre.f.strike.strikeId)).skew).eq(toBN('4'));
    });
  });

  describe('smClaim', () => {
    it('can only be called by the security module', async () => {
      await expect(hre.f.c.optionMarket.smClaim()).revertedWith('OnlySecurityModule');
      await expect(
        hre.f.c.optionMarket.setOptionMarketParams({
          securityModule: hre.f.deployer.address,
          feePortionReserved: toBN('1.01'),
          maxBoardExpiry: MONTH_SEC * 12,
          staticBaseSettlementFee: toBN('0.1'),
        }),
      ).revertedWith('InvalidOptionMarketParams');
      await hre.f.c.optionMarket.setOptionMarketParams({
        securityModule: hre.f.deployer.address,
        feePortionReserved: toBN('1'),
        maxBoardExpiry: MONTH_SEC * 12,
        staticBaseSettlementFee: toBN('0.1'),
      });

      await openDefaultLongCall();
      // Collects fees in the option market
      const marketBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
      expect(marketBal).gt(0);

      await hre.f.c.snx.baseAsset.mint(hre.f.c.optionMarket.address, toBN('1'));

      const tx = await hre.f.c.optionMarket.smClaim();

      // base isn't taken via smClaim
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.optionMarket.address)).eq(toBN('1'));
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).eq(0);

      const args = getEventArgs(await tx.wait(), 'SMClaimed');
      expect(args.securityModule).eq(hre.f.deployer.address);
      expect(args.quoteAmount).eq(marketBal);

      // Can call it even if empty
      await hre.f.c.optionMarket.smClaim();
    });
  });

  describe('forceSettleBoard', () => {
    it('settles the board even if before expiry', async () => {
      await expect(hre.f.c.optionMarket.forceSettleBoard(777)).revertedWith('InvalidBoardId');
      await expect(hre.f.c.optionMarket.forceSettleBoard(hre.f.board.boardId)).revertedWith('BoardNotFrozen');
      await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, true);
      // Has been settled even though expiry hasn't crossed
      await hre.f.c.optionMarket.forceSettleBoard(hre.f.board.boardId);
      await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, false);
      await expect(openDefaultLongCall()).revertedWith('BoardAlreadySettled');

      await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, true);

      await expect(hre.f.c.optionMarket.forceSettleBoard(hre.f.board.boardId)).revertedWith('BoardAlreadySettled');
      await fastForward(MONTH_SEC);
      await expect(hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId)).revertedWith('BoardAlreadySettled');
    });
  });

  describe('recoverFunds', () => {
    it('cannot recover quote', async () => {
      await hre.f.c.snx.quoteAsset.mint(hre.f.c.optionMarket.address, toBN('1'));
      await expect(
        hre.f.c.optionMarket.recoverFunds(hre.f.c.snx.quoteAsset.address, hre.f.deployer.address),
      ).revertedWith('CannotRecoverQuote');
    });
    it('can recover another token from the contract', async () => {
      await hre.f.c.snx.baseAsset.mint(hre.f.c.optionMarket.address, toBN('1'));
      await expect(hre.f.c.optionMarket.recoverFunds(hre.f.c.snx.baseAsset.address, hre.f.deployer.address));
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.optionMarket.address)).eq(0);
    });
  });
});
