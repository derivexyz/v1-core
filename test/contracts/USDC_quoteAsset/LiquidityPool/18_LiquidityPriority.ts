import { OptionType, toBN } from '../../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../../utils/assert';
import {
  forceClosePosition,
  mockPrice,
  openLongCallAndGetLiquidity,
  openLongPutAndGetLiquidity,
  setETHPrice,
} from '../../../utils/contractHelpers';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../../utils/defaultParams';
import { seedFixtureUSDC } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

const initialBalance = toBN('100000');

describe('Liquidity Priority Testing', async () => {
  beforeEach(async () => {
    await seedFixtureUSDC({ useUSDC: true });
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, initialBalance);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, initialBalance);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.optionMarket.address, initialBalance);
  });

  describe('Liquidity Priority', async () => {
    it.skip('NAV & LSF remains stable after all insolvent longs close: LSF = 0', async () => {
      const ethOpenPrice = toBN('1500');

      // Set cash collateral 10%
      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        adjustmentNetScalingFactor: toBN('0.9'),
        callCollatScalingFactor: toBN('0.1'),
        putCollatScalingFactor: toBN('0.1'),
      });

      await mockPrice('sETH', ethOpenPrice);
      // const strikeData = await hre.f.c.optionMarket.getStrike(1);
      // console.log(`StrikeData ${strikeData.strikePrice}`)
      // console.log(`StrikeData ${hre.f.strike.strikeId}`)

      let liquidity;
      const [, liquidityReturn, posId] = await openLongPutAndGetLiquidity(toBN('200'), 1);
      liquidity = liquidityReturn;
      // console.log("POST TRADE", await hre.f.c.liquidityPool.getLiquidity());
      const lp = hre.f.c.liquidityPool.address;
      const amountToBurn = (await hre.f.c.snx.quoteAsset.balanceOf(lp)).sub(
        liquidity.reservedCollatLiquidity.div(1e12),
      );
      console.log('AMOUNT TO BURN', amountToBurn);
      await hre.f.c.snx.quoteAsset.burn(lp, amountToBurn);
      // console.log("POST BURN", await hre.f.c.liquidityPool.getLiquidity()); // NAV: $17k
      await setETHPrice(toBN('100'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      // console.log("SPOT DOWN", await hre.f.c.optionGreekCache.getGlobalOptionValue());
      // console.log("SPOT DOWN", await hre.f.c.liquidityPool.getLiquidity());
      // console.log("BALANCE", await hre.f.c.snx.quoteAsset.balanceOf(lp));

      // close 20 positions
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('20') });
      console.log('Closed 20 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity); // NAV: $2.7k, LSF: 0.10759
      assertCloseToPercentage(liquidity.NAV, toBN('30000'), toBN('0.01')); // within 1% since fees paid to OptionMarket
      expect(liquidity.longScaleFactor).to.eq(0); // when TAV < (NAV * ammNetScalingFactor)

      // close 80 positions
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('80') });
      console.log('Closed 80 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity); // NAV: $1.7k, LSF: 0.10765
      assertCloseToPercentage(liquidity.NAV, toBN('30000'), toBN('0.01')); // within 1% since fees paid to OptionMarket
      expect(liquidity.longScaleFactor).to.eq(0);

      // close 99 positions
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('99') });
      console.log('Closed 99 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity); // LSF: 0.115
      assertCloseToPercentage(liquidity.NAV, toBN('30000'), toBN('0.01')); // within 1% since fees paid to OptionMarket
      expect(liquidity.longScaleFactor).to.eq(0);
    });

    it('NAV stable & LSF rises as all insolvent longs close: LSF < 1', async () => {
      // NOTE: LSF keeps rising since skew drops as options close,
      // but since greekCache isn't updated, optionValue stays the same

      const ethOpenPrice = toBN('1500');

      // Set cash collateral 10%
      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        adjustmentNetScalingFactor: toBN('0.9'),
        callCollatScalingFactor: toBN('0.1'),
        putCollatScalingFactor: toBN('0.1'),
      });

      await mockPrice('sETH', ethOpenPrice);
      let liquidity;
      const [, liquidityReturn, posId] = await openLongPutAndGetLiquidity(toBN('200'), 1);
      liquidity = liquidityReturn;
      // console.log("POST TRADE", await hre.f.c.liquidityPool.getLiquidity());
      const lp = hre.f.c.liquidityPool.address;
      const amountToBurn = toBN('250000').div(1e12);

      // console.log("AMOUNT TO BURN", amountToBurn)
      await hre.f.c.snx.quoteAsset.burn(lp, amountToBurn);
      // console.log("POST BURN", await hre.f.c.liquidityPool.getLiquidity());
      await setETHPrice(toBN('100'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      // console.log("post spot down VALUE", await hre.f.c.optionGreekCache.getGlobalOptionValue()); // Value: $1485 per option
      // console.log("SPOT DOWN", await hre.f.c.liquidityPool.getLiquidity());
      // console.log("BALANCE", await hre.f.c.snx.quoteAsset.balanceOf(lp));
      // console.log("post spot down CALL", await hre.f.c.optionGreekCache.getStrikeCache(1)); // Value: $1485 per option

      // close 20 positions -> $1223 per option paid, but skew keeps dropping while globalDebt is unaware
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('20') });
      console.log('Closed 20 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity);
      assertCloseToPercentage(liquidity.NAV, toBN('50000'), toBN('0.01'));
      assertCloseToPercentage(liquidity.longScaleFactor, toBN('0.887'), toBN('0.01'));
      // console.log("post 20 VALUE", await hre.f.c.optionGreekCache.getGlobalOptionValue());
      // console.log("post 20 CALL", await hre.f.c.optionGreekCache.getStrikeCache(1));

      // close 80 positions -> $1224 per option paid, but skew keeps dropping while globalDebt is unaware
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('80') });
      console.log('Closed 80 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity);
      assertCloseToPercentage(liquidity.NAV, toBN('50000'), toBN('0.01'));
      assertCloseToPercentage(liquidity.longScaleFactor, toBN('0.887'), toBN('0.01'));
      // console.log("post 80 VALUE", await hre.f.c.optionGreekCache.getGlobalOptionValue());
      // console.log("post 80 CALL", await hre.f.c.optionGreekCache.getStrikeCache(1));

      // close 80 positions -> $1224 per option paid, but skew keeps dropping while globalDebt is unaware
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('50') });
      console.log('Closed 50 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity);
      assertCloseToPercentage(liquidity.NAV, toBN('50000'), toBN('0.01'));
      assertCloseToPercentage(liquidity.longScaleFactor, toBN('0.902'), toBN('0.01'));
      // console.log("post 80 VALUE", await hre.f.c.optionGreekCache.getGlobalOptionValue());
      // console.log("post 80 CALL", await hre.f.c.optionGreekCache.getStrikeCache(1));

      // close 99 positions -> $1233 per option paid, but skew keeps dropping while globalDebt is unaware
      await forceClosePosition({ positionId: posId, optionType: OptionType.LONG_PUT, amount: toBN('40') });
      console.log('Closed 40 successfully');
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(liquidity);
      assertCloseToPercentage(liquidity.NAV, toBN('50000'), toBN('0.01'));
      assertCloseToPercentage(liquidity.longScaleFactor, toBN('0.936'), toBN('0.01')); // LSF foes up
      // console.log("post 90 VALUE", await hre.f.c.optionGreekCache.getGlobalOptionValue()); // Value: $
      // console.log("post 90 CALL", await hre.f.c.optionGreekCache.getStrikeCache(1));
    });

    it('pendingDelta > reservedCollatLiquidity priority', async () => {
      const ethOpenPrice = toBN('3000');
      const openSize = toBN('199');
      // const strikePrice = (await hre.f.c.optionMarket.getStrike(3)).strikePrice;
      // console.log(`strikePrice ${strikePrice}`)

      await mockPrice('sETH', ethOpenPrice);
      const liquidity = await hre.f.c.liquidityPool.getLiquidity();
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long puts and calculate cost of options
      const [, afterOpenLiquidity] = await openLongPutAndGetLiquidity(openSize, 3);

      // const pendingD = await hre.f.c.poolHedger.getHedgingLiquidity(ethOpenPrice);
      // console.log(`pending delta is ${pendingD}`)
      // In this scenario everything is reserved for delta liquidity...
      // available quote > pending delta
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(
        afterOpenLiquidity.pendingDeltaLiquidity.div(1e12),
      );

      // console.log(`get hedging liquidity ${afterOpenLiquidity}`)
      // console.log(`get hedging liquidity ${availableQuoteForHedge}`)
      // console.log(`get hedging liquidity ${await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)}`)
      // console.log(`get hedging liquidity ${await hre.f.c.liquidityPool.getLiquidity()}`)

      // assertCloseTo(afterOpenLiquidity.pendingDeltaLiquidity, availableQuoteForHedge);
      expect(afterOpenLiquidity.reservedCollatLiquidity).to.eq(0);
      expect(afterOpenLiquidity.freeLiquidity).to.eq(0);
      expect(afterOpenLiquidity.burnableLiquidity).to.eq(0);
    });

    it('reservedCollatLiquidity > freeLiquidity priority ', async () => {
      const ethOpenPrice = toBN('2000');
      const ethClosePrice = toBN('4000');
      const openSize = toBN('249');

      await mockPrice('sETH', ethOpenPrice);
      const liquidity = await hre.f.c.liquidityPool.getLiquidity();
      // console.log(`Liquidity ${liquidity}`)
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long calls and calculate cost of options
      await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const [, afterOpenLiquidity] = await openLongCallAndGetLiquidity(openSize);

      // In this scenario everything is reserved for delta liquidity...
      // console.log(afterOpenLiquidity)
      expect(afterOpenLiquidity.reservedCollatLiquidity).to.gt(0);
      expect(afterOpenLiquidity.freeLiquidity).to.eq(0);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(
        afterOpenLiquidity.pendingDeltaLiquidity.add(afterOpenLiquidity.reservedCollatLiquidity).div(1e12),
      );

      // assertCloseTo(afterOpenLiquidity.pendingDeltaLiquidity, availableQuoteForHedge);
      expect(afterOpenLiquidity.freeLiquidity).to.eq(0);
      expect(afterOpenLiquidity.burnableLiquidity).to.eq(0);

      await mockPrice('sETH', ethClosePrice);
    });
  });
});

// freeLiquidity can be used for opening new positions (reserving funds for longs + paying shorters)
// freeLiquidity + reservedCollatLiquidity can be used for closing existing positions (long payouts)
// freeLiquidity + reservedCollatLiquidity + pendingDeltaLiquidity is all available for the hedger to use for hedging delta risk.
