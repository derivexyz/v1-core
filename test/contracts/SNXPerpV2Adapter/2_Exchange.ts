import { MONTH_SEC, PositionState, toBN } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import { PricingType } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { hre, expect } from '../../utils/testSetup';
import {
  closePositionWithOverrides,
  DEFAULT_SHORT_CALL_QUOTE,
  forceClosePositionWithOverrides,
  openPosition,
  resetMinCollateralParameters,
} from '../../utils/contractHelpers';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { BigNumberish } from 'ethers';
import { MarketViewStruct } from '../../../typechain-types/OptionMarketViewer';

/**
 * @dev this test used mocked snx market (mocked price), and the real uniswap entity
 *
 */
describe('Quoting and exchange assets', async () => {
  before('Deploy Lyra, Uniswap and Adapter', async () => {
    await deployFixturePerpsAdapter();
  });

  // reset to $2000
  beforeEach('mock price for SNX market', async () => {
    await hre.f.pc.perpMarket.setAssetPrice(toBN('2000'), false); // $2000
  });

  /* --------------------------------- 
                Tests
    ------------------------------- */

  describe('getSpotPriceForMarket', async () => {
    it('should get mocked snx price', async () => {
      const refPrice = await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(
        hre.f.c.optionMarket.address,
        PricingType.REFERENCE,
      );
      expect(refPrice).eq(toBN('2000'));
      const maxPrice = await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(
        hre.f.c.optionMarket.address,
        PricingType.MAX_PRICE,
      );
      expect(maxPrice).eq(toBN('2000'));
      const minPrice = await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(
        hre.f.c.optionMarket.address,
        PricingType.MIN_PRICE,
      );
      expect(minPrice).eq(toBN('2000'));
    });
    it('should revert if price is marked as invalid', async () => {
      await hre.f.pc.perpMarket.setAssetPrice(toBN('2000'), true);
      await expect(
        hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, PricingType.REFERENCE),
      ).revertedWith('InvalidSNXPerpV2Price');
    });
    it('should revert when market suspended', async () => {
      await hre.f.pc.systemStatus.setFuturesMarketSuspended(true);
      await expect(
        hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, PricingType.MIN_PRICE),
      ).revertedWith('SNXPerpV2MarketSuspended');
      expect(
        await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, PricingType.REFERENCE),
      ).eq(toBN('2000'));
      await hre.f.pc.systemStatus.setFuturesMarketSuspended(false);
    });
  });

  describe('getSettlementPriceForMarket', async () => {
    it('should get mocked snx price', async () => {
      const price = await hre.f.c.synthetixPerpV2Adapter.getSettlementPriceForMarket(hre.f.c.optionMarket.address, 0);
      expect(price).eq(toBN('2000'));
    });
    it('should revert if price is marked as invalid', async () => {
      await hre.f.pc.perpMarket.setAssetPrice(toBN('2000'), true);
      await expect(
        hre.f.c.synthetixPerpV2Adapter.getSettlementPriceForMarket(hre.f.c.optionMarket.address, 0),
      ).revertedWith('InvalidSNXPerpV2Price');
    });
  });

  describe('estimateExchangeToExactQuote', async () => {
    const quoteAmount = toBN('20000'); // 20K USDC

    it('should apply fix slippage', async () => {
      const baseNeeded = await hre.f.c.synthetixPerpV2Adapter.estimateExchangeToExactQuote(
        hre.f.c.optionMarket.address,
        quoteAmount,
      );
      const expectedBaseNeeded = toBN('10.3'); // 10 ETH + 3% slippage
      assertCloseToPercentage(baseNeeded, expectedBaseNeeded, toBN('0.001'));
      // expect(baseNeeded.sub(expectedBaseNeeded).abs().div(toBN('1')).lt('1')).to.be.true
    });

    it('should apply fix slippage to snx price, if snx price is lower', async () => {
      await hre.f.pc.perpMarket.setAssetPrice(toBN('1900'), false);
      const baseNeeded = await hre.f.c.synthetixPerpV2Adapter.estimateExchangeToExactQuote(
        hre.f.c.optionMarket.address,
        quoteAmount,
      );
      const expectedBaseNeeded = toBN('10.842'); // // (20000 / 1900) * 1.03
      assertCloseToPercentage(baseNeeded, expectedBaseNeeded, toBN('0.001'));
    });
  });

  describe('estimateExchangeToExactBase', async () => {
    const baseAmount = toBN('10'); // 10 ETH

    it('should apply fix slippage', async () => {
      const quoteNeeded = await hre.f.c.synthetixPerpV2Adapter.estimateExchangeToExactBase(
        hre.f.c.optionMarket.address,
        baseAmount,
      );
      const expectedQuoteNeeded = toBN('20600'); // 20K USD + 3% slippage
      assertCloseToPercentage(quoteNeeded, expectedQuoteNeeded, toBN('0.001'));
    });

    it('should apply fix slippage to snx price, if snx price is higher', async () => {
      await hre.f.pc.perpMarket.setAssetPrice(toBN('2100'), false);
      const quoteNeeded = await hre.f.c.synthetixPerpV2Adapter.estimateExchangeToExactBase(
        hre.f.c.optionMarket.address,
        baseAmount,
      );
      const expectedQuoteNeeded = toBN('21630'); // // (2100) * 10 * 1.03
      assertCloseToPercentage(quoteNeeded, expectedQuoteNeeded, toBN('0.001')); // 0.1%
    });
  });

  describe('exchangeFromExactBase', async () => {
    // x * y = k
    // k = 100 * 200000 = 2e7
    it('should swap exact base to quote', async () => {
      // pool invariant: x * y = 2e7
      // x' = 101
      // y' = 2e7 / 101 = 198019
      // usdc out => (200000 - 198019) * 99.7% = 1975

      const baseAmount = toBN('1'); // 1 ETH

      const baseBefore = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
      const quoteBefore = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

      await hre.f.c.synthetixPerpV2Adapter.exchangeFromExactBase(hre.f.c.optionMarket.address, baseAmount);
      await fastForward(1);

      const baseAfter = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
      const quoteAfter = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

      // exact base spent
      expect(baseAfter.eq(baseBefore.sub(baseAmount))).to.be.true;
      //
      const quoteGet = quoteAfter.sub(quoteBefore);
      assertCloseToPercentage(quoteGet, toBN('1975'), toBN('0.001'));
    });
    it('should revert if deviate too much from SNX price', async () => {
      // snx says price is 2200,
      // adapter will set the min receive to 2200 * 0.97 = 2134, causing revert
      await hre.f.pc.perpMarket.setAssetPrice(toBN('2200'), false);

      const baseAmount = toBN('1'); // 1 ETH
      
      await expect(
        hre.f.c.synthetixPerpV2Adapter.exchangeFromExactBase(hre.f.c.optionMarket.address, baseAmount),
      ).revertedWith('Too little received');
      await fastForward(1);
    });
  });

  describe('exchangeToExactBaseWithLimit', async () => {
    it('should swap quote to base', async () => {
      // pool invariant: x * y = 2e7
      // x' = 100
      // y' = 2e7 / 100 = 200000
      // spent out => (200000 - 198019) * 100.3% = 1986

      const baseAmount = toBN('1');
      const quoteLimit = toBN('1990');

      const baseBefore = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
      const quoteBefore = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

      await hre.f.c.synthetixPerpV2Adapter.exchangeToExactBaseWithLimit(
        hre.f.c.optionMarket.address,
        baseAmount,
        quoteLimit,
      );
      await fastForward(1);

      const baseAfter = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
      const quoteAfter = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

      // exact base spent
      expect(baseBefore.eq(baseAfter.sub(baseAmount))).to.be.true;
      //
      const quoteSpent = quoteBefore.sub(quoteAfter);
      assertCloseToPercentage(quoteSpent, toBN('1947'), toBN('1'));
    });
    it('uniswap should revert if slippage is hit', async () => {
      // same numbers as above, quote limit should be 1986

      const baseAmount = toBN('1');
      const quoteLimit = toBN('1900'); // max paying 1900 usdc, which is going to revert

      await expect(
        hre.f.c.synthetixPerpV2Adapter.exchangeToExactBaseWithLimit(
          hre.f.c.optionMarket.address,
          baseAmount,
          quoteLimit,
        ),
      ).revertedWith('STF'); // failed with "safe transfer failed", not enough quote to be used
    });
  });

  describe('common flows when market suspended', async () => {
    let market: MarketViewStruct;
    let positionId: BigNumberish;
    let positionId2: BigNumberish;
    let strikeId: BigNumberish;
    before(async () => {
      await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });
      market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
      strikeId = market.liveBoards[0].strikes[2].strikeId;
      positionId = (
        await openPosition({
          ...DEFAULT_SHORT_CALL_QUOTE,
          strikeId: strikeId,
        })
      )[1];
      positionId2 = (
        await openPosition({
          ...DEFAULT_SHORT_CALL_QUOTE,
          strikeId: strikeId,
        })
      )[1];
      await hre.f.pc.systemStatus.setFuturesMarketSuspended(true);
    });

    it('blocks opening, closing and force closing', async () => {
      await expect(
        openPosition({
          ...DEFAULT_SHORT_CALL_QUOTE,
          strikeId,
        }),
      ).revertedWith('SNXPerpV2MarketSuspended');
      await expect(
        closePositionWithOverrides(hre.f.c, { ...DEFAULT_SHORT_CALL_QUOTE, strikeId, positionId }),
      ).revertedWith('SNXPerpV2MarketSuspended');
      await expect(
        forceClosePositionWithOverrides(hre.f.c, { ...DEFAULT_SHORT_CALL_QUOTE, strikeId, positionId }),
      ).revertedWith('SNXPerpV2MarketSuspended');
    });

    it('allows liquidations', async () => {
      await resetMinCollateralParameters({
        minStaticQuoteCollateral: DEFAULT_SHORT_CALL_QUOTE.setCollateralTo.add(toBN('0.01')),
      });
      await hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.alice.address);
      expect((await hre.f.c.optionToken.getOptionPosition(positionId)).state).eq(PositionState.LIQUIDATED);
    });

    it('allows settlement', async () => {
      await hre.f.pc.systemStatus.setFuturesMarketSuspended(true);
      await fastForward(2 * MONTH_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(market.liveBoards[0].boardId);
      await hre.f.c.shortCollateral.settleOptions([positionId2]);
      await hre.f.pc.systemStatus.setFuturesMarketSuspended(false);
    });
  });

  describe('check getting both uniswap and settlement prices', async () => {
    it('should be able to get both prices', async() => {
      const prices = await hre.f.c.synthetixPerpV2Adapter.getPrices(hre.f.c.optionMarket.address);
      const settlementPrice = await hre.f.c.synthetixPerpV2Adapter.getSettlementPriceForMarket(hre.f.c.optionMarket.address, 0);
      
      expect(prices).eq(settlementPrice);
    });

    it('should revert if the market is suspended', async () => {
      await hre.f.pc.systemStatus.setFuturesMarketSuspended(true);
      await expect(hre.f.c.synthetixPerpV2Adapter.getPrices(hre.f.c.optionMarket.address)).revertedWith('SNXPerpV2MarketSuspended');
    });
  })
});
