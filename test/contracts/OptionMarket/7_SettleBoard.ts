import { BigNumber, BigNumberish } from 'ethers';
import { MONTH_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import {
  createBoard,
  openDefaultShortCallBase,
  openDefaultShortCallQuote,
  openDefaultShortPutQuote,
  openPosition,
  setETHExchangerInvalid,
  setETHExchangerValid,
  setETHPrice,
  settleBoardAtPrice,
} from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

async function settleBoard(boardId?: BigNumberish) {
  return await hre.f.c.optionMarket.settleExpiredBoard(boardId || hre.f.board.boardId);
}

async function getLiveBoards() {
  return await hre.f.c.optionMarket.getLiveBoards();
}

async function exchangeBase() {
  return await hre.f.c.liquidityPool.exchangeBase();
}

async function getBaseBalance(addr: string) {
  return await hre.f.c.snx.baseAsset.balanceOf(addr);
}

async function getQuoteBalance(addr: string) {
  return await hre.f.c.snx.quoteAsset.balanceOf(addr);
}

describe('OptionMarket - SettleBoard', () => {
  beforeEach(seedFixture);

  describe('Invalid board settling', async () => {
    it('reverts for various reasons', async () => {
      await expect(settleBoard()).to.revertedWith('BoardNotExpired');
      await fastForward(MONTH_SEC);
      await setETHExchangerInvalid();
      await expect(settleBoard()).revertedWith('RateIsInvalid');
      await setETHExchangerValid();
      await settleBoard();
      await expect(settleBoard()).to.revertedWith('BoardAlreadySettled');
      await expect(settleBoard(777)).revertedWith('InvalidBoardId');
    });
  });

  describe('Live board updates', async () => {
    it('is empty if there is only 1 board', async () => {
      await fastForward(MONTH_SEC);
      await settleBoard();
      expect(await getLiveBoards()).is.empty;
    });

    it('contains the other board if there are 2', async () => {
      const newBoardId = await createBoard({ expiresIn: MONTH_SEC / 2 });
      await fastForward(MONTH_SEC);
      await settleBoard();
      const newLiveBoards = await getLiveBoards();
      expect(newLiveBoards).has.length(1);
      expect(newLiveBoards[0]).to.eq(newBoardId);
    });
  });

  describe('Live board rearrangements', async () => {
    let board2: BigNumber;
    let board3: BigNumber;
    let board4: BigNumber;

    beforeEach(async () => {
      board2 = await createBoard({ expiresIn: MONTH_SEC / 4 });
      board3 = await createBoard({ expiresIn: MONTH_SEC / 2 });
      board4 = await createBoard({ expiresIn: (MONTH_SEC / 4) * 3 });
      await fastForward(MONTH_SEC);
    });

    it('swaps last with first, removing first', async () => {
      await settleBoard();
      const newLiveBoards = await getLiveBoards();
      expect(newLiveBoards).has.length(3);
      expect(newLiveBoards[0]).to.eq(board4);
      expect(newLiveBoards[1]).to.eq(board2);
      expect(newLiveBoards[2]).to.eq(board3);
    });
    it('swaps last with second, removing second', async () => {
      await hre.f.c.optionMarket.settleExpiredBoard(board2);
      const newLiveBoards = await getLiveBoards();
      expect(newLiveBoards).has.length(3);
      expect(newLiveBoards[0]).to.eq(hre.f.board.boardId);
      expect(newLiveBoards[1]).to.eq(board4);
      expect(newLiveBoards[2]).to.eq(board3);
    });
    it('swaps last with third, removing third', async () => {
      await hre.f.c.optionMarket.settleExpiredBoard(board3);
      const newLiveBoards = await getLiveBoards();
      expect(newLiveBoards).has.length(3);
      expect(newLiveBoards[0]).to.eq(hre.f.board.boardId);
      expect(newLiveBoards[1]).to.eq(board2);
      expect(newLiveBoards[2]).to.eq(board4);
    });
    it('removes the last', async () => {
      await hre.f.c.optionMarket.settleExpiredBoard(board4);
      const newLiveBoards = await getLiveBoards();
      expect(newLiveBoards).has.length(3);
      expect(newLiveBoards[0]).to.eq(hre.f.board.boardId);
      expect(newLiveBoards[1]).to.eq(board2);
      expect(newLiveBoards[2]).to.eq(board3);
    });
  });

  describe('Base conversions', async () => {
    // consider other quote collateral situations

    it('sells base collateral when settling both long and short call correctly', async () => {
      await openPosition({
        strikeId: hre.f.board.strikes[1].strikeId,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await openPosition({
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('1'),
        setCollateralTo: toBN('1'),
      });

      expect(await getBaseBalance(hre.f.c.liquidityPool.address)).to.eq(toBN('1'));
      expect(await getBaseBalance(hre.f.c.shortCollateral.address)).to.eq(toBN('1'));

      await fastForward(MONTH_SEC);
      await settleBoard();

      // collects premiums in base from short call base
      expect(await getBaseBalance(hre.f.c.liquidityPool.address))
        .gt(toBN('1'))
        .lt(toBN('1.2'));

      await exchangeBase();

      expect(await getBaseBalance(hre.f.c.liquidityPool.address)).to.eq(0);
      expect(await getBaseBalance(hre.f.c.shortCollateral.address))
        .lt(toBN('1'))
        .gt(toBN('0.8'));
    });
  });

  describe('Payouts & Reservations', async () => {
    afterEach(async () => {
      // Check that postExpiryInsolvency is never incremented
      expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    });

    it('No exposure', async () => {
      const newBoardId = await createBoard({ expiresIn: MONTH_SEC / 2 });
      const newStrikeIds = await hre.f.c.optionMarket.getBoardStrikes(newBoardId);
      await openPosition({
        strikeId: newStrikeIds[1],
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      expect(await getBaseBalance(hre.f.c.liquidityPool.address)).to.eq(toBN('1'));
      await fastForward(MONTH_SEC);
      // Liquidate the board with no exposure
      await settleBoard();
      await exchangeBase();
      // The pool should still hold 1 eth of collateral
      expect(await getBaseBalance(hre.f.c.liquidityPool.address)).to.eq(toBN('1'));
      // Liquidate the board with exposure
      await hre.f.c.optionMarket.settleExpiredBoard(newBoardId);
      // Base balance is now 0
      expect(await getBaseBalance(hre.f.c.liquidityPool.address)).to.eq(toBN('1'));
      await exchangeBase();
      expect(await getBaseBalance(hre.f.c.liquidityPool.address)).to.eq(0);
    });

    describe('long call exposure', async () => {
      beforeEach(async () => {
        await openPosition({
          optionType: OptionType.LONG_CALL,
          amount: toBN('1'),
        });
        await fastForward(MONTH_SEC);
        const collateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(collateral.base).to.eq(toBN('1'));
        expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(0);
      });

      it('does nothing if strike was OTM', async () => {
        await setETHPrice(toBN('1000'));
        await settleBoard();
        // base is liquidated back to usd, but none is reserved
        const collateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(collateral.base).to.eq(0);
        expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(0);
      });
      it('reserves quote profit for user correctly if ITM', async () => {
        await setETHPrice(toBN('2000'));
        await settleBoard();
        // base is liquidated back to usd, but none is reserved
        // user gets back exactly 500, fee is charged to the pool
        const collateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(collateral.base).to.eq(0);
        expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(toBN('500'));
      });
    });

    describe('long put exposure', async () => {
      beforeEach(async () => {
        await openPosition({
          optionType: OptionType.LONG_PUT,
          amount: toBN('1'),
        });

        await fastForward(MONTH_SEC);
        const collateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(collateral.quote).to.eq(toBN('1500'));
        expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(0);
      });

      it('does nothing if strike was OTM', async () => {
        await setETHPrice(toBN('2000'));
        await settleBoard();
        // base is liquidated back to usd, but none is reserved
        // user gets back exactly 500, fee is charged to the pool
        const collateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(collateral.quote).to.eq(0);
        expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(0);
      });

      it('reserves quote in LP correctly if ITM', async () => {
        await setETHPrice(toBN('1000'));
        await settleBoard();
        // base is liquidated back to usd, but none is reserved
        // user gets back exactly 500, fee is charged to the pool
        const collateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(collateral.quote).to.eq(0);
        expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(toBN('500'));
      });
    });

    describe('short call base exposure', async () => {
      const partialBaseCollat = toBN('5');

      beforeEach(async () => {
        await openPosition({
          optionType: OptionType.SHORT_CALL_BASE,
          amount: toBN('10'),
          setCollateralTo: partialBaseCollat,
        });
        await fastForward(MONTH_SEC);
        assertCloseTo(await getQuoteBalance(hre.f.deployer.address), toBN('1002878.515'));
        expect(await getBaseBalance(hre.f.c.shortCollateral.address)).to.eq(partialBaseCollat);
      });

      it('sets eth return ratio to 1 if strike was OTM', async () => {
        await setETHPrice(toBN('1000'));
        await settleBoard();

        // eth is kept for the user
        expect(await getBaseBalance(hre.f.c.shortCollateral.address)).to.eq(partialBaseCollat);
      });

      it('sends collateral to LP and sells into quote correctly if ITM', async () => {
        await setETHPrice(toBN('2000'));
        await settleBoard();
        await exchangeBase();

        // eth is kept for the user
        const scBaseBal = await getBaseBalance(hre.f.c.shortCollateral.address);
        const lpQuoteBal = await getQuoteBalance(hre.f.c.liquidityPool.address);

        // TODO: double check values with mech
        assertCloseTo(scBaseBal, toBN('2.48111'), toBN('0.001'));
        assertCloseTo(lpQuoteBal, toBN('502100.473'), toBN('0.1'));
      });
    });

    describe('short call quote exposure', async () => {
      const partialQuoteCollat = toBN('10000');

      beforeEach(async () => {
        await openPosition({
          optionType: OptionType.SHORT_CALL_QUOTE,
          amount: toBN('10'),
          setCollateralTo: partialQuoteCollat, // partial collateral
        });

        await fastForward(MONTH_SEC);
        expect((await hre.f.c.liquidityPool.lockedCollateral()).quote).to.eq(0);
        assertCloseTo(await getQuoteBalance(hre.f.deployer.address), toBN('992878.515'));
        expect(await getQuoteBalance(hre.f.c.shortCollateral.address)).to.eq(partialQuoteCollat);
      });

      it('sets eth return ratio to 1 if strike was OTM', async () => {
        await setETHPrice(toBN('1000'));
        await settleBoard();

        // eth is kept for the user
        expect(await getQuoteBalance(hre.f.c.shortCollateral.address)).to.eq(partialQuoteCollat);
      });

      it('sends collateral to LP if ITM', async () => {
        await setETHPrice(toBN('2000'));
        await settleBoard();

        // quote is kept for the user
        const scBaseBal = await getQuoteBalance(hre.f.c.shortCollateral.address);
        const lpQuoteBal = await getQuoteBalance(hre.f.c.liquidityPool.address);

        // TODO: double check values with mech
        expect(scBaseBal).to.eq(toBN('5000'));
        assertCloseTo(lpQuoteBal, toBN('502100.473'), toBN('0.1'));
      });
    });

    describe('short put quote exposure', async () => {
      const partialQuoteCollat = toBN('10000');

      beforeEach(async () => {
        await openPosition({
          optionType: OptionType.SHORT_PUT_QUOTE,
          amount: toBN('10'),
          setCollateralTo: partialQuoteCollat, // partial collateral
        });

        await fastForward(MONTH_SEC);
        expect((await hre.f.c.liquidityPool.lockedCollateral()).quote).to.eq(0);
        assertCloseTo(await getQuoteBalance(hre.f.deployer.address), toBN('990425.7347'));
        expect(await getQuoteBalance(hre.f.c.shortCollateral.address)).to.eq(partialQuoteCollat);
      });

      it('does nothing if strike was OTM', async () => {
        await setETHPrice(toBN('2000'));
        await settleBoard();
        expect(await getQuoteBalance(hre.f.c.shortCollateral.address)).to.eq(partialQuoteCollat);
      });

      it('sends quote to pool correctly if ITM', async () => {
        await setETHPrice(toBN('1000'));
        await settleBoard();

        // quote is kept for the user
        const scBaseBal = await getQuoteBalance(hre.f.c.shortCollateral.address);
        const lpQuoteBal = await getQuoteBalance(hre.f.c.liquidityPool.address);

        // TODO: double check values with mech
        expect(scBaseBal).to.eq(toBN('5000'));
        assertCloseTo(lpQuoteBal, toBN('504555.7323'), toBN('0.1'));
      });
    });
  });

  // Trader insolvency but not large enough to cause LP excess insolvency
  describe('Post-Expiry Insolvency: should send total LP profit despite insolvency', async () => {
    // let lpInitialBalance: BigNumber;
    beforeEach(async () => {
      await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c);
    });

    it('short call base', async () => {
      const settlePrice = toBN('3500');
      await openPosition({
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('1'),
        setCollateralTo: toBN('0.5'), // partial collateral
      });
      await openPosition(
        {
          optionType: OptionType.SHORT_CALL_BASE,
          amount: toBN('1'),
          setCollateralTo: toBN('2'), // partial collateral
        },
        hre.f.alice,
      );

      // Settle Board
      await setETHPrice(settlePrice);
      await fastForward(MONTH_SEC);
      await settleBoard();
      await exchangeBase();

      // original quote - premium paid + AMM profit
      // TODO: double check values with mech
      assertCloseTo(await getQuoteBalance(hre.f.c.liquidityPool.address), toBN('503412.0666'));
      expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(0);
      expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    });

    it('short call quote + short put quote', async () => {
      await setETHPrice(toBN('2000'));
      await openPosition({
        strikeId: 2,
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('10'),
        setCollateralTo: toBN('20000'), // partial collateral
      });
      await openPosition(
        {
          strikeId: 2,
          optionType: OptionType.SHORT_PUT_QUOTE,
          amount: toBN('5'),
          setCollateralTo: toBN('5000'), // partial collateral
        },
        hre.f.alice,
      );

      // Settle Board
      await setETHPrice(toBN('500'));
      await fastForward(MONTH_SEC);
      await settleBoard();

      // AMM profit = (2,000 - 500) * 5 = 7,500
      // original quote - premium paid + AMM profit
      assertCloseTo(await getQuoteBalance(hre.f.c.liquidityPool.address), toBN('504622.94856'));
      expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(0);
      expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    });

    it.skip('should send full LP profit if unexpired collateral present');
  });

  // Trader insolvency larger than solvent collateral in SC
  describe('Post-Expiry ShortCollateral Depletion: sends less than total LP profit', async () => {
    // let lpInitialBalance: BigNumber;

    it('short call base', async () => {
      const positions = [];
      for (let i = 0; i < 3; i++) {
        positions.push(await openDefaultShortCallBase());
      }
      // Settle Board
      await settleBoardAtPrice(toBN('6000'));
      await exchangeBase();

      const insolventAmount = toBN('0.255667506297229219');
      expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(insolventAmount.mul(3));

      // original quote - premium paid + AMM profit - insolvency
      // TODO: double check values with mech

      // When the position is settled, the excess is cleared
      await hre.f.c.shortCollateral.settleOptions([positions[0]]);
      expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(insolventAmount.mul(2));
      await hre.f.c.shortCollateral.settleOptions(positions.slice(1));
      expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
    });

    it('short call quote', async () => {
      const positions = [];
      for (let i = 0; i < 3; i++) {
        positions.push(await openDefaultShortCallQuote());
      }
      // Settle Board
      await settleBoardAtPrice(toBN('5000'));

      const insolventAmount = toBN('2500');
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(insolventAmount.mul(3));

      // original quote - premium paid + AMM profit - insolvency
      // TODO: double check values with mech

      // When the position is settled, the excess is cleared
      await hre.f.c.shortCollateral.settleOptions([positions[0]]);
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(insolventAmount.mul(2));
      await hre.f.c.shortCollateral.settleOptions(positions.slice(1));
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    });

    it('short put quote', async () => {
      const positions = [];
      for (let i = 0; i < 3; i++) {
        positions.push(await openDefaultShortPutQuote());
      }

      // const premium = getEventArgs(await result[0].wait(), 'Trade').totalCost;
      // Settle Board
      await settleBoardAtPrice(toBN('200'));

      const insolventAmount = toBN('300');
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(insolventAmount.mul(3));

      // original quote - premium paid + AMM profit - insolvency
      // TODO: double check values with mech

      // When the position is settled, the excess is cleared
      await hre.f.c.shortCollateral.settleOptions([positions[0]]);
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(insolventAmount.mul(2));
      await hre.f.c.shortCollateral.settleOptions(positions.slice(1));
      expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    });
  });
});
