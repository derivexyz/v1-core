import { getEventArgs, MONTH_SEC, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import {
  fullyClosePosition,
  getSpotPrice,
  mockPrice,
  openDefaultLongCall,
  openDefaultLongPut,
  openPosition,
} from '../../utils/contractHelpers';
import { calculateReservedFee } from '../../utils/contractHelpers/fees';
import { DEFAULT_FEE_RATE_FOR_BASE, DEFAULT_OPTION_MARKET_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

// OptionMarket tests check for correct transfer/reserve amounts, so can do unit tests here

// unit tests
describe('Free Collateral', async () => {
  beforeEach(seedFixture);

  describe('Closing Longs', async () => {
    it('frees the correct amount of quote and sends premium', async () => {
      const positionId = await openDefaultLongPut();
      const oldAccruedFees = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
      const oldUsedCollat = (await hre.f.c.liquidityPool.lockedCollateral()).quote;
      const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const tx = await fullyClosePosition(positionId);
      const newAccruedFees = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
      const newUsedCollat = (await hre.f.c.liquidityPool.lockedCollateral()).quote;
      const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

      const closeEvent = getEventArgs(await tx.wait(), 'Trade');

      expect(oldUsedCollat).to.be.gt(newUsedCollat);
      expect(newUsedCollat).to.be.eq(toBN('0'));
      assertCloseTo(newBalance.sub(oldBalance), toBN('47.3055'), toBN('0.1'));
      assertCloseTo(newBalance.sub(oldBalance), closeEvent.trade.totalCost, toBN('0.1'));

      expect(newAccruedFees.sub(oldAccruedFees)).to.be.eq(closeEvent.trade.reservedFee);

      expect(calculateReservedFee(closeEvent, DEFAULT_OPTION_MARKET_PARAMS.feePortionReserved)).to.eq(
        closeEvent.trade.reservedFee,
      );
    });

    it('liquidates the correct amount of base and sends premium', async () => {
      const positionId = await openDefaultLongCall();

      const oldAccruedFees = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
      const oldUsedCollat = (await hre.f.c.liquidityPool.lockedCollateral()).base;
      const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const oldLPBaseBal = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address);
      const oldLPQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
      const tx = await fullyClosePosition(positionId);
      const newAccruedFees = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
      const newUsedCollat = (await hre.f.c.liquidityPool.lockedCollateral()).base;
      const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const newLPBaseBal = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address);
      const newLPQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      const closeEvent = getEventArgs(await tx.wait(), 'Trade');

      expect(oldLPBaseBal).to.be.eq(toBN('1'));
      expect(newLPBaseBal).to.be.eq(toBN('0'));

      expect(oldUsedCollat).to.be.eq(toBN('1'));
      expect(newUsedCollat).to.be.eq(toBN('0'));
      assertCloseTo(newBalance.sub(oldBalance), toBN('292.5838'), toBN('0.1'));
      assertCloseTo(newBalance.sub(oldBalance), closeEvent.trade.totalCost, toBN('0.1'));
      expect(newAccruedFees.sub(oldAccruedFees)).to.be.eq(closeEvent.trade.reservedFee);
      expect(calculateReservedFee(closeEvent, DEFAULT_OPTION_MARKET_PARAMS.feePortionReserved)).to.eq(
        closeEvent.trade.reservedFee,
      );

      assertCloseTo(
        newLPQuoteBal.sub(oldLPQuoteBal),
        (await getSpotPrice())
          .mul(UNIT.sub(DEFAULT_FEE_RATE_FOR_BASE))
          .div(UNIT)
          .sub(closeEvent.trade.totalCost)
          .sub(closeEvent.trade.reservedFee),
        toBN('0.01'),
      );
    });
  });

  describe('Board Settlement', async () => {
    beforeEach(async () => {
      // open long and short on board #1
      await openPosition({
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_CALL,
        amount: toBN('10'),
      });

      await openPosition({
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_PUT,
        amount: toBN('10'),
      });

      await openPosition({
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('10'),
        setCollateralTo: toBN('5'),
      });

      // create second board that does not settle
      await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: 2 * MONTH_SEC });
      await openPosition({
        strikeId: 6,
        optionType: OptionType.LONG_CALL,
        amount: toBN('20'),
      });
    });

    it('frees collateral, liquidates base, and reserves payouts', async () => {
      await fastForward(MONTH_SEC);

      const result = await getBalancesAndSettle();

      expect((await hre.f.c.liquidityPool.lockedCollateral()).base).to.be.eq(result.preSettleBase.sub(toBN('10')));
      expect((await hre.f.c.liquidityPool.lockedCollateral()).quote).to.be.eq(toBN('0'));

      const traderCallProfit = (await getSpotPrice()).sub(toBN('1500')).mul(10);
      const quoteFromLiqBase = (await getSpotPrice())
        .mul(UNIT.sub(DEFAULT_FEE_RATE_FOR_BASE))
        .div(UNIT)
        .mul(toBN('10').div(UNIT));
      expect(result.newLPBaseBal).to.eq(toBN('20'));

      // amm and trader call profit cancel out but quote stays in LP until position settled
      assertCloseTo(
        result.newLPQuoteBal.sub(result.oldLPQuoteBal),
        quoteFromLiqBase.add(traderCallProfit),
        toBN('0.01'),
      );
      expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(traderCallProfit);
    }); // just input amountQuoteFreed/Liquidiated and check lockedCollateral

    it('increments insolvent amount and does not liquidate base if lpBaseInsolvency', async () => {
      await fastForward(MONTH_SEC);

      await mockPrice('sETH', toBN('4000'));

      const result = await getBalancesAndSettle();
      const expectedInsolventAmount = await hre.f.c.liquidityPool.insolventSettlementAmount();

      expect((await hre.f.c.liquidityPool.lockedCollateral()).base).to.be.eq(result.preSettleBase.sub(toBN('10')));
      expect((await hre.f.c.liquidityPool.lockedCollateral()).quote).to.be.eq(toBN('0'));

      const traderCallProfit = (await getSpotPrice()).sub(toBN('1500')).mul(10);
      const ammRealizedProfit = traderCallProfit.sub(
        expectedInsolventAmount.mul(UNIT.sub(DEFAULT_FEE_RATE_FOR_BASE)).div(UNIT),
      );
      const quoteFromLiqBase = (await getSpotPrice()).mul(UNIT.sub(DEFAULT_FEE_RATE_FOR_BASE)).div(UNIT).mul(10);
      expect(result.newLPBaseBal).to.eq(toBN('20'));

      // amm and trader call profit cancel out but quote stays in LP until position settled
      assertCloseTo(
        result.newLPQuoteBal.sub(result.oldLPQuoteBal),
        quoteFromLiqBase.add(ammRealizedProfit),
        toBN('0.01'),
      );
      expect(await hre.f.c.liquidityPool.totalOutstandingSettlements()).to.eq(traderCallProfit);
    }); // base liquidated is smaller in case of base excess
  });
});

async function getBalancesAndSettle() {
  const preSettleBase = (await hre.f.c.liquidityPool.lockedCollateral()).base;
  const oldLPQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
  await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
  await hre.f.c.liquidityPool.exchangeBase();
  const newLPBaseBal = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address);
  const newLPQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

  return { preSettleBase, oldLPQuoteBal, newLPBaseBal, newLPQuoteBal };
}
