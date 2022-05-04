import { MONTH_SEC, OptionType, toBN, UNIT, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  closeLongCall,
  closeLongPut,
  DEFAULT_LONG_CALL,
  DEFAULT_LONG_PUT,
  DEFAULT_SHORT_PUT_QUOTE,
  fillLiquidityWithLongCall,
  fillLiquidityWithLongPut,
  fillLiquidityWithShortCallBase,
  fillLiquidityWithShortPut,
  fullyClosePosition,
  getLiquidity,
  getRequiredHedge,
  getSpotPrice,
  mockPrice,
  openDefaultLongCall,
  openDefaultLongPut,
  openDefaultShortCallBase,
  openDefaultShortPutQuote,
  openLongCallAndGetLiquidity,
  openLongPutAndGetLiquidity,
  openPositionWithOverrides,
} from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_BOARD_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { deployFixture, seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

// Do full integration tests here (e.g. open trades/make deposits/hedge delta)
describe('Liquidity Accounting', async () => {
  beforeEach(seedFixture);
  // check for each "it":
  //      - expect("each liquidity param to be correct");
  //      - expect("process/revert trade");
  //      - expect("process/revert deposit/withdraw");
  //      - expect("process/revert impact CBTimeout");

  describe('TradingLiquidity', async () => {
    it('updates when base collateral locked/freed', async () => {
      const positionId = await openDefaultLongCall();
      let liquidity = await getLiquidity();
      const spotPrice = await getSpotPrice();
      assertCloseTo(liquidity.usedCollatLiquidity, spotPrice.div(UNIT).mul(DEFAULT_LONG_CALL.amount), toBN('0.1'));

      await closeLongCall(positionId);

      await fastForward(WEEK_SEC);
      liquidity = await getLiquidity();
      assertCloseTo(liquidity.usedCollatLiquidity, toBN('0'), toBN('0.1'));
    });

    it('updates when quote collateral locked/freed', async () => {
      const positionId = await openDefaultLongPut();
      let liquidity = await getLiquidity();
      const strikeAndExpiry = await hre.f.c.optionMarket.getStrikeAndExpiry(hre.f.strike.strikeId);
      assertCloseTo(
        liquidity.usedCollatLiquidity,
        strikeAndExpiry.strikePrice.div(UNIT).mul(DEFAULT_LONG_PUT.amount),
        toBN('0.1'),
      );

      await closeLongPut(positionId);

      await fastForward(WEEK_SEC);
      liquidity = await getLiquidity();
      assertCloseTo(liquidity.usedCollatLiquidity, toBN('0'), toBN('0.1'));
    });

    it('updates pending delta when long call open', async () => {
      await openDefaultLongCall();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('800.175754'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('497810.51'), toBN('0.01'));
    });

    it('uses whole pool for pendingDelta if large long call open', async () => {
      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithLongCall();
      const expectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.lt(expectedPendingDelta);
      expect(liquidity.freeLiquidity).to.eq(0);
    });

    it('updates pending delta when long put open', async () => {
      await openDefaultLongPut();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('800.175754'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('497811.29'), toBN('0.01'));
    });
    it('uses whole pool for pendingDelta if large long put open', async () => {
      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithLongPut();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.lt(preLiquidityExpectedPendingDelta);
      expect(liquidity.freeLiquidity).to.eq(0);
    });

    it('updates pending delta when short call open', async () => {
      await openDefaultShortCallBase();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('2683.85'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('497050.51'), toBN('0.01'));
    });
    it('uses whole pool for pendingDelta if large short call open', async () => {
      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithShortCallBase();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.lt(preLiquidityExpectedPendingDelta);
      expect(liquidity.freeLiquidity).to.eq(0);
    });

    it('updates pending delta when short put open', async () => {
      await openDefaultShortPutQuote();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInLongDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('400.0878'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('499579.80'), toBN('0.01'));
    });
    it('uses whole pool for pendingDelta if large short put open', async () => {
      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithShortPut();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInLongDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.lt(preLiquidityExpectedPendingDelta);
      expect(liquidity.freeLiquidity).to.eq(0);
    });

    it('updates NAV when optionValue changes', async () => {
      // more NAV and PoolValue testing in 11_PoolValue and 11_TokenPriceAndSupply
      const preNAV = (await getLiquidity()).NAV;
      await fillLiquidityWithLongPut();
      await mockPrice('sETH', (await getSpotPrice()).add(toBN('1000')));
      const postNAV = (await getLiquidity()).NAV;

      expect(postNAV).to.be.gt(preNAV);
      assertCloseTo(postNAV.sub(preNAV), toBN('33642.97'), toBN('1'));
    });
  });

  describe('SettleLiquidity', async () => {
    it('updates when board settled', async () => {
      const [, oldLiquidity] = await openLongCallAndGetLiquidity(toBN('10'));
      expect(oldLiquidity.usedCollatLiquidity).eq(DEFAULT_BASE_PRICE.mul(10));

      await fastForward(MONTH_SEC + 1);

      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      // longs settle ITM, so the pool owes value to the trader.
      // however, until exchangeBase happens the used will remain

      const preExchangeLiquidity = await getLiquidity();
      expect(preExchangeLiquidity.usedCollatLiquidity).eq(DEFAULT_BASE_PRICE.mul(10));
      // less because quote reserved, but excess base is
      expect(preExchangeLiquidity.freeLiquidity).to.be.lt(oldLiquidity.freeLiquidity);
      expect(preExchangeLiquidity.NAV).to.be.gt(oldLiquidity.NAV); // fees greater than payout

      await hre.f.c.liquidityPool.exchangeBase();
      const newLiquidity = await getLiquidity();

      expect(newLiquidity.freeLiquidity).to.be.gt(oldLiquidity.freeLiquidity);
      expect(newLiquidity.usedCollatLiquidity).to.be.eq(toBN('0'));
      expect(newLiquidity.NAV).to.be.gt(oldLiquidity.NAV); //expired OTM
    });

    it('updates when position closed', async () => {
      const [, oldLiquidity, position] = await openLongCallAndGetLiquidity(toBN('10'));
      await fullyClosePosition(position);
      const newLiquidity = await getLiquidity();

      expect(newLiquidity.freeLiquidity).to.be.gt(oldLiquidity.freeLiquidity);
      expect(oldLiquidity.usedCollatLiquidity).to.be.gt(toBN('0'));
      expect(newLiquidity.usedCollatLiquidity).to.be.eq(toBN('0'));
    });

    it('updates when insolvency reimbursed', async () => {
      await createDefaultBoardWithOverrides(hre.f.c, {
        ...DEFAULT_BOARD_PARAMS,
        expiresIn: 2 * MONTH_SEC,
      });

      // board 1 order
      await openPositionWithOverrides(hre.f.c, {
        ...DEFAULT_SHORT_PUT_QUOTE,
        strikeId: 2, // $2000
        amount: toBN('10'),
        setCollateralTo: toBN('10000'),
      });

      // board 2 order
      await openPositionWithOverrides(hre.f.c, {
        ...DEFAULT_SHORT_PUT_QUOTE,
        strikeId: 5, // $2000
        amount: toBN('5'),
        setCollateralTo: toBN('5000'),
      });

      // board 1 order is $1500 in the money & $5,000 insolvent
      await mockPrice('sETH', toBN('500'));
      await fastForward(MONTH_SEC + 1);

      // liquidity pool overdrafts from board 2 collateral
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      const oldLiquidity = await getLiquidity();
      await hre.f.c.shortCollateral.settleOptions([1]);
      const newLiquidity = await getLiquidity();
      expect(oldLiquidity.NAV.sub(newLiquidity.NAV)).to.eq(toBN('5000'));
    });

    // todo: any edge cases?
  });

  describe('HedgingLiquidity', async () => {
    it('updates liquidity when hedge occurs', async () => {
      const [, oldLiquidity] = await openLongPutAndGetLiquidity(toBN('100'));

      console.log('expectedHedge_old', await hre.f.c.poolHedger.getCappedExpectedHedge());
      console.log('currentHedge_old', await hre.f.c.poolHedger.getCurrentHedgedNetDelta());
      console.log(oldLiquidity);

      await hre.f.c.poolHedger.hedgeDelta();
      const newLiquidity = await getLiquidity();

      console.log('expectedHedge_old', await hre.f.c.poolHedger.getCappedExpectedHedge());
      console.log('currentHedge_new', await hre.f.c.poolHedger.getCurrentHedgedNetDelta());
      console.log(newLiquidity);
      const changeInFreeLiq = newLiquidity.freeLiquidity.sub(oldLiquidity.freeLiquidity);
      const quoteToHedgeDiscrepancy = oldLiquidity.pendingDeltaLiquidity.sub(newLiquidity.usedDeltaLiquidity);

      // when fully hedged, pending delta should = 0
      expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).to.eq(
        await hre.f.c.poolHedger.getCappedExpectedHedge(),
      );
      expect(newLiquidity.pendingDeltaLiquidity).to.eq(0);

      // leave some room for snx exchange fees
      assertCloseToPercentage(changeInFreeLiq, quoteToHedgeDiscrepancy, toBN('0.01'));
    });
    it('transfers less when not enough available', async () => {
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        interactionDelay: 0, // set interaction delay to 0 sec
      });
      const [, preHedgeLiquidity] = await fillLiquidityWithLongPut();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      expect(preHedgeLiquidity.freeLiquidity).to.eq(0);

      // when freeLiq fully clogged with pendingDelta, need to call multiple times
      // as shorting returns more quote which enables further hedging
      await hre.f.c.poolHedger.hedgeDelta();
      const postHedgeLiquidity = await getLiquidity();
      expect(preLiquidityExpectedPendingDelta).to.be.gt(postHedgeLiquidity.usedDeltaLiquidity);
      expect(postHedgeLiquidity.freeLiquidity).to.eq(0);
      assertCloseToPercentage(
        preHedgeLiquidity.pendingDeltaLiquidity.div(DEFAULT_POOL_HEDGER_PARAMS.shortBuffer).mul(UNIT),
        postHedgeLiquidity.pendingDeltaLiquidity,
        toBN('0.01'),
      ); // leave some for exchange/shorting fees

      // do one more subsequent hedge
      await hre.f.c.poolHedger.hedgeDelta();
      const finalHedgeLiquidity = await getLiquidity();
      expect(preLiquidityExpectedPendingDelta).to.be.gt(postHedgeLiquidity.usedDeltaLiquidity);
      expect(finalHedgeLiquidity.freeLiquidity).to.eq(0);
      assertCloseToPercentage(
        postHedgeLiquidity.pendingDeltaLiquidity.div(DEFAULT_POOL_HEDGER_PARAMS.shortBuffer).mul(UNIT),
        finalHedgeLiquidity.pendingDeltaLiquidity,
        toBN('0.01'),
      ); // leave some for exchange/shorting fees
    });

    it('Used delta unchanged when no freeLiq & deltaLiq = 0', async () => {
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        interactionDelay: 0, // set interaction delay to 0 sec
      });

      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithShortPut();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInLongDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.lt(preLiquidityExpectedPendingDelta);
      expect(liquidity.freeLiquidity).to.eq(0);

      await hre.f.c.poolHedger.hedgeDelta();
      const firstHedgeLiquidity = await getLiquidity();
      const firstCurrentHedge = await hre.f.c.poolHedger.getCurrentHedgedNetDelta();

      await hre.f.c.poolHedger.hedgeDelta();
      const secondHedgeLiquidity = await getLiquidity();
      const secondCurrentHedge = await hre.f.c.poolHedger.getCurrentHedgedNetDelta();

      // hedge and used delta remain unchanged
      expect(firstHedgeLiquidity.usedDeltaLiquidity).to.eq(secondHedgeLiquidity.usedDeltaLiquidity);
      expect(firstCurrentHedge).to.eq(secondCurrentHedge);
    });
    // todo: any edge cases?
  });

  describe('DepositAndWithdrawLiquidity', async () => {
    it('revert trades when no initial LP funds', async () => {
      await deployFixture(); // create 0 liquidity scenario
      await createDefaultBoardWithOverrides(hre.f.c);
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, toBN('1000'), toBN('1'), 'sETH');
      expect((await getLiquidity()).freeLiquidity).to.eq(toBN('0'));

      await expect(
        openPositionWithOverrides(hre.f.c, {
          strikeId: 1,
          optionType: OptionType.LONG_CALL,
          amount: toBN('1'),
        }),
      ).to.revertedWith('reverted with panic code 0x12 (Division or modulo division by zero)');
    });

    it('does not update when deposit initiated', async () => {
      const oldLiquidity = await getLiquidity();
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.deployer.address, toBN('100000'));
      await fastForward(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay as number);

      const newLiquidity = await getLiquidity();
      expect(oldLiquidity.NAV).to.eq(newLiquidity.NAV);
      expect(oldLiquidity.freeLiquidity).to.eq(newLiquidity.freeLiquidity);
      expect(oldLiquidity.burnableLiquidity).to.eq(newLiquidity.burnableLiquidity);
    });
    it('updates when deposit processed', async () => {
      const oldLiquidity = await getLiquidity();
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.deployer.address, toBN('100000'));
      await fastForward((DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay as number) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processDepositQueue(2);

      const newLiquidity = await getLiquidity();
      expect(oldLiquidity.NAV).to.lt(newLiquidity.NAV);
      expect(oldLiquidity.freeLiquidity).to.lt(newLiquidity.freeLiquidity);
      expect(oldLiquidity.burnableLiquidity).to.lt(newLiquidity.burnableLiquidity);
    });

    it('updates freeLiq when withdrawal initiated', async () => {
      const oldLiquidity = await getLiquidity();
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, toBN('100000'));
      await fastForward((DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay as number) + 1);

      const newLiquidity = await getLiquidity();
      expect(oldLiquidity.NAV).to.eq(newLiquidity.NAV);
      expect(oldLiquidity.freeLiquidity).to.gt(newLiquidity.freeLiquidity);
      expect(oldLiquidity.burnableLiquidity).to.eq(newLiquidity.burnableLiquidity);
    });
    it('updates all when withdrawal processed', async () => {
      const oldLiquidity = await getLiquidity();
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, toBN('100000'));
      await fastForward((DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay as number) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processWithdrawalQueue(2);

      const newLiquidity = await getLiquidity();
      expect(oldLiquidity.NAV).to.gt(newLiquidity.NAV);
      expect(oldLiquidity.freeLiquidity).to.gt(newLiquidity.freeLiquidity);
      expect(oldLiquidity.burnableLiquidity).to.gt(newLiquidity.burnableLiquidity);
    });
    // todo: any edge cases?
  });
});

export async function estimatePendingDeltaInShortDirection() {
  const netDelta = toBN('0').sub(await getRequiredHedge());
  const shortBuffer = DEFAULT_POOL_HEDGER_PARAMS.shortBuffer;
  return netDelta
    .mul(await getSpotPrice())
    .mul(shortBuffer)
    .div(UNIT)
    .div(UNIT);
}

export async function estimatePendingDeltaInLongDirection() {
  const netDelta = await getRequiredHedge();
  return netDelta.mul(await getSpotPrice()).div(UNIT);
}
