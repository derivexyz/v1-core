import { MONTH_SEC, OptionType, toBN, UNIT, WEEK_SEC } from '../../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../../utils/assert';
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
  openShortCallBaseAndGetLiquidity,
  setETHPrice,
} from '../../../utils/contractHelpers';
import {
  DEFAULT_BOARD_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_PRICING_PARAMS,
  DEFAULT_SHORT_BUFFER,
} from '../../../utils/defaultParams';
import { fastForward } from '../../../utils/evm';
import { deployFixture, seedFixtureUSDC } from '../../../utils/fixture';
import { createDefaultBoardWithOverrides, seedBalanceAndApprovalFor } from '../../../utils/seedTestSystem';
import { expect, hre } from '../../../utils/testSetup';

// Do full integration tests here (e.g. open trades/make deposits/hedge delta)
describe('Liquidity Accounting', async () => {
  beforeEach(async () => {
    await seedFixtureUSDC({ noHedger: true, useUSDC: true });
  });
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
      assertCloseTo(liquidity.reservedCollatLiquidity, spotPrice.div(UNIT).mul(DEFAULT_LONG_CALL.amount), toBN('0.1'));

      await closeLongCall(positionId);

      await fastForward(WEEK_SEC);
      liquidity = await getLiquidity();
      assertCloseTo(liquidity.reservedCollatLiquidity, toBN('0'), toBN('0.1'));
    });

    it('updates when quote collateral locked/freed', async () => {
      const positionId = await openDefaultLongPut();
      let liquidity = await getLiquidity();
      const strikeAndExpiry = await hre.f.c.optionMarket.getStrikeAndExpiry(hre.f.strike.strikeId);
      assertCloseTo(
        liquidity.reservedCollatLiquidity,
        strikeAndExpiry.strikePrice.div(UNIT).mul(DEFAULT_LONG_PUT.amount),
        toBN('0.1'),
      );

      await closeLongPut(positionId);

      await fastForward(WEEK_SEC);
      liquidity = await getLiquidity();
      assertCloseTo(liquidity.reservedCollatLiquidity, toBN('0'), toBN('0.1'));
    });

    it('updates pending delta when long call open', async () => {
      await openDefaultLongCall();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInLongDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('1341.999'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('497249.03'), toBN('0.01'));
    });

    it('uses collateral for pendingDelta if large long call open', async () => {
      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithLongCall();
      const expectedPendingDelta = await estimatePendingDeltaInLongDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.eq(expectedPendingDelta);
      expect(liquidity.reservedCollatLiquidity).to.lt((await getSpotPrice()).mul(toBN('250'))); // pending delta using collateral to hedge
      expect(liquidity.freeLiquidity).to.eq(0);
    });

    it('updates pending delta when long put open', async () => {
      await openDefaultLongPut();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('800.027'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('497783.03'), toBN('0.01'));
    });
    it('uses collateral for pendingDelta if large long put open', async () => {
      const [availableQuoteForHedge, liquidity] = await fillLiquidityWithLongPut();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseToPercentage(liquidity.pendingDeltaLiquidity, availableQuoteForHedge, toBN('0.0001'));
      expect(liquidity.pendingDeltaLiquidity).to.eq(preLiquidityExpectedPendingDelta);
      expect(liquidity.reservedCollatLiquidity).to.lt(toBN('2000').mul(toBN('200'))); // pending delta using collateral to hedge
      expect(liquidity.freeLiquidity).to.eq(0);
    });

    it('updates pending delta when short call open', async () => {
      await openDefaultShortCallBase();
      const liquidity = await getLiquidity();
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection();
      assertCloseTo(liquidity.pendingDeltaLiquidity, preLiquidityExpectedPendingDelta, toBN('0.01'));
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('2683.999'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('497021.78'), toBN('0.01'));
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
      assertCloseTo(liquidity.pendingDeltaLiquidity, toBN('400.01'), toBN('0.01'));
      assertCloseTo(liquidity.freeLiquidity, toBN('499551.30'), toBN('0.01'));
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
      assertCloseTo(postNAV.sub(preNAV), toBN('21890.99'), toBN('1'));
    });
  });

  describe('SettleLiquidity', async () => {
    it('updates when position closed', async () => {
      const [, oldLiquidity, position] = await openLongCallAndGetLiquidity(toBN('10'));
      await fullyClosePosition(position);
      const newLiquidity = await getLiquidity();

      expect(newLiquidity.freeLiquidity).to.be.gt(oldLiquidity.freeLiquidity);
      expect(oldLiquidity.reservedCollatLiquidity).to.be.gt(toBN('0'));
      expect(newLiquidity.reservedCollatLiquidity).to.be.eq(toBN('0'));
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
    // TestCollateralShort deposit in 18dp
    it.skip('updates liquidity when hedge occurs', async () => {
      const [, oldLiquidity] = await openLongPutAndGetLiquidity(toBN('100'));

      await hre.f.c.poolHedger.hedgeDelta();
      const newLiquidity = await getLiquidity();

      const changeInFreeLiq = newLiquidity.freeLiquidity.sub(oldLiquidity.freeLiquidity);
      const quoteToHedgeDiscrepancy = oldLiquidity.pendingDeltaLiquidity.sub(newLiquidity.usedDeltaLiquidity);

      // when fully hedged, pending delta should = 0
      assertCloseTo(
        await hre.f.c.poolHedger.getCurrentHedgedNetDelta(),
        await hre.f.c.poolHedger.getCappedExpectedHedge(),
        toBN('0.0000000000001'),
      );
      assertCloseTo(newLiquidity.pendingDeltaLiquidity, toBN('0'), toBN('0.0000000000001'));

      // leave some room for snx exchange fees
      assertCloseToPercentage(changeInFreeLiq, quoteToHedgeDiscrepancy, toBN('0.01'));
    });
    it.skip('transfers less when not enough available', async () => {
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        interactionDelay: 0, // set interaction delay to 0 sec
      });
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('240'),
      });

      await openShortCallBaseAndGetLiquidity(toBN('200'), toBN('200'));

      // spot Down to increase shorting amount
      await setETHPrice(toBN('4000'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      const preLiquidityExpectedPendingDelta = await estimatePendingDeltaInShortDirection(); // $48k?
      const preHedgeLiquidity = await getLiquidity();
      expect(preHedgeLiquidity.freeLiquidity).to.eq(0);

      // when freeLiq fully clogged with pendingDelta, need to call multiple times
      // as shorting returns more quote which enables further hedging
      await hre.f.c.poolHedger.hedgeDelta();
      const postHedgeLiquidity = await getLiquidity();
      expect(preLiquidityExpectedPendingDelta).to.be.gt(postHedgeLiquidity.usedDeltaLiquidity);
      expect(postHedgeLiquidity.freeLiquidity).to.eq(0);
      assertCloseToPercentage(
        preHedgeLiquidity.pendingDeltaLiquidity.div(DEFAULT_SHORT_BUFFER).mul(UNIT),
        postHedgeLiquidity.pendingDeltaLiquidity,
        toBN('0.01'),
      ); // leave some for exchange/shorting fees

      // do one more subsequent hedge
      await hre.f.c.poolHedger.hedgeDelta();
      const finalHedgeLiquidity = await getLiquidity();
      expect(preLiquidityExpectedPendingDelta).to.be.gt(postHedgeLiquidity.usedDeltaLiquidity);
      expect(finalHedgeLiquidity.freeLiquidity).to.eq(0);
      assertCloseToPercentage(
        postHedgeLiquidity.pendingDeltaLiquidity.div(DEFAULT_SHORT_BUFFER).mul(UNIT),
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
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.deployer.address, 100000e6);
      await fastForward(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay as number);

      const newLiquidity = await getLiquidity();
      expect(oldLiquidity.NAV).to.eq(newLiquidity.NAV);
      expect(oldLiquidity.freeLiquidity).to.eq(newLiquidity.freeLiquidity);
      expect(oldLiquidity.burnableLiquidity).to.eq(newLiquidity.burnableLiquidity);
    });
    it('updates when deposit processed', async () => {
      const oldLiquidity = await getLiquidity();
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.deployer.address, 100000e6);
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
  return netDelta
    .mul(await getSpotPrice())
    .mul(DEFAULT_SHORT_BUFFER)
    .div(UNIT)
    .div(UNIT);
}

export async function estimatePendingDeltaInLongDirection() {
  const netDelta = await getRequiredHedge();
  return netDelta.mul(await getSpotPrice()).div(UNIT);
}
