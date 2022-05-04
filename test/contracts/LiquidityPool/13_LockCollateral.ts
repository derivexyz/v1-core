import { toBN } from '../../../scripts/util/web3utils';
import {
  fillLiquidityWithLongCall,
  fillLiquidityWithLongPut,
  getLiquidity,
  openDefaultLongCall,
  openDefaultLongPut,
} from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// OptionMarket tests check for correct transfer amounts, so can do unit tests here

// unit tests
describe('Lock Collateral', async () => {
  beforeEach(seedFixture);
  describe('lock quote', async () => {
    it('locked quote is updated correctly given amount < freeVolLiq', async () => {
      await openDefaultLongPut();
      const lockedCollateral = await hre.f.c.liquidityPool.lockedCollateral();
      const strike = await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId);
      expect(lockedCollateral.quote).to.eq(strike.strikePrice);
      expect(lockedCollateral.base).to.eq(toBN('0'));
    });

    it('reverts if amount > freeVolLiq', async () => {
      await fillLiquidityWithLongCall();
      expect((await getLiquidity()).freeLiquidity).to.eq(toBN('0'));
      await expect(openDefaultLongPut()).to.revertedWith('LockingMoreQuoteThanIsFree');
    });
  });

  describe('lock base', async () => {
    it('Locks the correct amount of base', async () => {
      // await hre.f.c.snx.exchanger.setFeeRateForExchange(
      //   toBytes32("sUSD"), toBytes32("sETH"), toBN("0"))
      await openDefaultLongCall();
      const lockedCollateral = await hre.f.c.liquidityPool.lockedCollateral();
      expect(lockedCollateral.quote).to.eq(toBN('0'));
      expect(lockedCollateral.base).to.eq(toBN('1'));
    });

    it('Reverts if not enough freeLiq to exchange for base', async () => {
      await fillLiquidityWithLongPut();
      expect((await getLiquidity()).freeLiquidity).to.eq(toBN('0'));
      await expect(openDefaultLongCall()).to.revertedWith('QuoteBaseExchangeExceedsLimit');
    });
  });
});
