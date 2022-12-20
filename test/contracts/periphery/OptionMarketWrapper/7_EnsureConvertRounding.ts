import { fromBN, OptionType, toBN } from '../../../../scripts/util/web3utils';
import {
  DEFAULT_SHORT_CALL_BASE,
  DEFAULT_SHORT_PUT_QUOTE,
  openPositionWithOverrides,
} from '../../../utils/contractHelpers';
import { checkContractFundsGMX, wrapperCloseShort, wrapperOpenShort } from '../../../utils/contractHelpers/wrapper';
import { allCurrenciesFixtureGMX } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

// Issue resolved - a user incrementing `position.collateral` by small amounts so that after converting to baseDecimals
//                  they are sending 0 base while still increasing a positions collateral.
describe('Ensure convert rounding attack test', () => {
  beforeEach(allCurrenciesFixtureGMX);

  afterEach(async () => {
    await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);
  });

  describe('Rounding base', async () => {
    it('SHORT CALL BASE collateral rounding', async () => {
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);
      // Open short call for premium
      console.log(`SC balance ${await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address)}`);
      const scStartBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);

      console.log(`Open short call for premium`);
      let positionId = await wrapperOpenShort(
        {
          optionType: OptionType.SHORT_CALL_BASE,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          collateral: 2, // 2 wBTC here
        },
        0,
        true,
      );

      let shortCollateralBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);
      console.log(`SC balance ${fromBN(await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address), 10)}`);
      let result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(shortCollateralBalance).to.eq(scStartBalance.add(2e8));
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Adds to the position increasing collateral
      // console.log(`Position.collat ${result1.collateral}`)
      console.log(`Adds to the position increasing collateral and 1e-8 dust`);

      await openPositionWithOverrides(hre.f.gc, {
        ...DEFAULT_SHORT_CALL_BASE,
        positionId: positionId,
        strikeId: hre.f.strike.strikeId,
        amount: 0,
        setCollateralTo: result1.collateral.add(toBN('0.100000000000123456')),
      });

      console.log(`SC balance ${fromBN(await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address), 8)}`);
      shortCollateralBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(2.10000001e8));
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      console.log(`Adds to the position increasing collateral and 1e-8 dust`);
      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      await openPositionWithOverrides(hre.f.gc, {
        ...DEFAULT_SHORT_CALL_BASE,
        positionId: positionId,
        strikeId: hre.f.strike.strikeId,
        amount: 0,
        setCollateralTo: result1.collateral.add(toBN('0.100000019999')),
      });

      shortCollateralBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(2.20000003e8)); // rounded to 2.20000002 but 1e-8 remains from previous
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      console.log(`Adds to the position increasing collateral without edge case conversion`);
      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      await openPositionWithOverrides(hre.f.gc, {
        ...DEFAULT_SHORT_CALL_BASE,
        positionId: positionId,
        strikeId: hre.f.strike.strikeId,
        amount: 0,
        setCollateralTo: result1.collateral.add(toBN('0.8999999999')),
      });

      shortCollateralBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(3.10000003e8));
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      console.log(`Adds to the position descreasing collateral`);

      await openPositionWithOverrides(hre.f.gc, {
        ...DEFAULT_SHORT_CALL_BASE,
        positionId: positionId,
        strikeId: hre.f.strike.strikeId,
        amount: 0,
        setCollateralTo: toBN('1'),
      });

      shortCollateralBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(1.00000002e8));
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      console.log(`Close position fully with 2e-8 dust from ensuring converts`);
      positionId = await wrapperCloseShort(
        {
          positionId,
          inputAmount: 400,
          maxCost: 380,
        },
        0,
        true,
      );
      shortCollateralBalance = await hre.f.gc.gmx.eth.balanceOf(hre.f.gc.shortCollateral.address);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(0.00000002e8));
    });
  });

  describe('Rounding long quote', async () => {
    it('LONG option cost rounding', async () => {
      let lpBeforeBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);

      console.log(`Open long call`);
      // Cost of this option is 344e-18 so cost should be rounded to 1 (quote asset decimals)
      let [, positionId] = await openPositionWithOverrides(hre.f.gc, {
        optionType: OptionType.LONG_CALL,
        strikeId: hre.f.strike.strikeId,
        amount: 1,
      });

      let lpAfterBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);
      let result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(1);
      expect(lpAfterBal.sub(lpBeforeBal)).to.eq(1);

      lpBeforeBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);

      console.log(`Adding to position with rounded cost to 1`);
      // increase position - should still cost 1
      await openPositionWithOverrides(hre.f.gc, {
        positionId: positionId,
        optionType: OptionType.LONG_CALL,
        strikeId: hre.f.strike.strikeId,
        amount: 100,
      });

      lpAfterBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);
      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(101);
      expect(lpAfterBal.sub(lpBeforeBal)).to.eq(1);

      lpBeforeBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);

      console.log(`Open long put`);
      // Cost of this option is 85e-18 so cost should be rounded to 1 (quote asset decimals)
      [, positionId] = await openPositionWithOverrides(hre.f.gc, {
        optionType: OptionType.LONG_PUT,
        strikeId: hre.f.strike.strikeId,
        amount: 1,
      });

      lpAfterBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);
      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(1);
      expect(lpAfterBal.sub(lpBeforeBal)).to.eq(1);

      console.log(`Adding to position with rounded cost to 1`);
      lpBeforeBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);
      [, positionId] = await openPositionWithOverrides(hre.f.gc, {
        positionId: positionId,
        optionType: OptionType.LONG_PUT,
        strikeId: hre.f.strike.strikeId,
        amount: 100,
      });

      lpAfterBal = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.liquidityPool.address);
      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(101);
      expect(lpAfterBal.sub(lpBeforeBal)).to.eq(1);
    });
  });

  describe('Rounding short quote', async () => {
    it('SHORT PUT QUOTE option cost rounding', async () => {
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Open short call for premium
      console.log(`SC balance ${fromBN(await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address), 6)}`);
      const scStartBalance = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address);
      console.log(`Open short call for premium`);

      let [, positionId] = await openPositionWithOverrides(hre.f.gc, {
        ...DEFAULT_SHORT_PUT_QUOTE,
        strikeId: hre.f.strike.strikeId,
        amount: 1,
        setCollateralTo: toBN('2.100000000000123456'),
      });

      let shortCollateralBalance = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address);
      console.log(`SC balance ${fromBN(await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address), 6)}`);
      let result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(1);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(2.100001e6));
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Adds to the position increasing collateral
      await openPositionWithOverrides(hre.f.gc, {
        ...DEFAULT_SHORT_PUT_QUOTE,
        positionId: positionId,
        strikeId: hre.f.strike.strikeId,
        amount: 0,
        setCollateralTo: toBN('3.450000000000456789'),
      });

      shortCollateralBalance = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address);
      // console.log(`SC balance ${await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address) / 1e6}`)
      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.amount).to.eq(1);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(3.450002e6));
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      console.log(`Close position fully with 2e-8 dust from ensuring converts`);
      positionId = await wrapperCloseShort(
        {
          positionId,
          inputAmount: 400,
          maxCost: 380,
        },
        0,
        true,
      );
      shortCollateralBalance = await hre.f.gc.gmx.USDC.balanceOf(hre.f.gc.shortCollateral.address);
      expect(shortCollateralBalance).to.eq(scStartBalance.add(0.000002e6));
    });
  });
});
