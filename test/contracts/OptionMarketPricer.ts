import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { toBN, TradeType, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { createDefaultBoardWithOverrides } from '../utils/contractHelpers';
import { deployTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
import { expect } from '../utils/testSetup';

describe('OptionMarketPricer - unit tests', async () => {
  let account: SignerWithAddress;
  let c: TestSystemContractsType;
  const pricingGlobals = {
    optionPriceFeeCoefficient: toBN('0.01'),
    spotPriceFeeCoefficient: toBN('0.01'),
    vegaFeeCoefficient: toBN('300'),
    vegaNormFactor: toBN('0.2'),
    standardSize: toBN('5'),
    skewAdjustmentFactor: toBN('0.75'),
    rateAndCarry: toBN('0.1'),
    minDelta: toBN('0.15'),
    volatilityCutoff: toBN('0.45'),
    spotPrice: toBN('100'),
  };
  const listing = {
    id: toBN('1'),
    strike: toBN('1000'),
    skew: toBN('1'),
    longCall: toBN('1000'),
    shortCall: toBN('1000'),
    longPut: toBN('1000'),
    shortPut: toBN('1000'),
    boardId: toBN('1'),
  };
  const trade = {
    isBuy: true,
    amount: toBN('100'),
    vol: toBN('100'),
    expiry: toBN('100'),
    liquidity: {
      freeCollatLiquidity: toBN('100'),
      usedCollatLiquidity: 0,
      freeDeltaLiquidity: toBN('50'),
      usedDeltaLiquidity: 0,
    },
  };

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    c = await deployTestSystem(account);
  });

  it('cant init twice', async () => {
    await expect(c.optionMarketPricer.init(ZERO_ADDRESS, ZERO_ADDRESS)).to.be.revertedWith(
      'contract already initialized',
    );
  });

  describe('ivImpactForTrade', async () => {
    const boardBaseIv = toBN('1000');

    it('skewAdjustment of 0 stops skew moving', async () => {
      const [, skew] = await c.optionMarketPricer.ivImpactForTrade(
        listing,
        trade,
        { ...pricingGlobals, skewAdjustmentFactor: 0 },
        boardBaseIv,
      );
      expect(skew).to.eq(listing.skew);
    });

    it('skewAdjustment > 1 moves skew more than iv', async () => {
      const [iv, skew] = await c.optionMarketPricer.ivImpactForTrade(
        listing,
        trade,
        { ...pricingGlobals, skewAdjustmentFactor: toBN('1.5') },
        boardBaseIv,
      );
      expect(skew.sub(listing.skew)).to.gt(iv.sub(boardBaseIv));
    });

    it('isBuy = true moves skew and iv up', async () => {
      const [iv, skew] = await c.optionMarketPricer.ivImpactForTrade(listing, trade, pricingGlobals, boardBaseIv);

      expect(skew).to.gt(listing.skew);
      expect(iv).to.gt(boardBaseIv);
    });

    it('isBuy = false moves skew and iv down', async () => {
      const [iv, skew] = await c.optionMarketPricer.ivImpactForTrade(
        listing,
        { ...trade, isBuy: false },
        pricingGlobals,
        boardBaseIv,
      );

      expect(skew).to.lt(listing.skew);
      expect(iv).to.lt(boardBaseIv);
    });

    it('skew reverts if trying to go below 0', async () => {
      await expect(
        c.optionMarketPricer.ivImpactForTrade(
          listing,
          { ...trade, isBuy: false },
          { ...pricingGlobals, skewAdjustmentFactor: toBN('6') },
          boardBaseIv,
        ),
      ).to.be.revertedWith('SafeMath: subtraction overflow');
    });

    it('iv reverts if trying to bo below 0', async () => {
      await expect(
        c.optionMarketPricer.ivImpactForTrade(listing, { ...trade, isBuy: false }, pricingGlobals, toBN('0.01')),
      ).to.be.revertedWith('SafeMath: subtraction overflow');
    });
  });

  describe('updateCacheAndGetTotalCost', async () => {
    let snap: number;
    beforeEach(async () => {
      snap = await takeSnapshot();
    });

    afterEach(async () => {
      await restoreSnapshot(snap);
    });

    it('can only be called by optionMarket', async () => {
      await expect(
        c.optionMarketPricer.updateCacheAndGetTotalCost(listing, trade, pricingGlobals, toBN('1')),
      ).revertedWith('only optionMarket');
    });

    it('prevents low call delta trades', async () => {
      await createDefaultBoardWithOverrides(c, { baseIV: '1', strikes: ['1000'], skews: ['1'] });
      await expect(c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.SHORT_CALL, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
    });
    it('prevents high call delta trades', async () => {
      await createDefaultBoardWithOverrides(c, { baseIV: '1', strikes: ['10000'], skews: ['1'] });
      await expect(c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.SHORT_CALL, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('1'))).revertedWith(
        'delta out of trading range',
      );
    });
    it('prevents low vol trades for both calls and puts', async () => {
      await createDefaultBoardWithOverrides(c, { baseIV: '0.5', strikes: ['1740'], skews: ['1'] });
      await expect(c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'))).revertedWith(
        'vol out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'))).revertedWith(
        'vol out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.SHORT_CALL, toBN('1'))).revertedWith(
        'vol out of trading range',
      );
      await expect(c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('1'))).revertedWith(
        'vol out of trading range',
      );
    });
  });

  describe('getPremium', async () => {
    const trade = {
      isBuy: true,
      amount: toBN('100'),
      vol: toBN('100'),
      expiry: toBN('100'),
      liquidity: {
        freeCollatLiquidity: toBN('100'),
        usedCollatLiquidity: 0,
        freeDeltaLiquidity: toBN('50'),
        usedDeltaLiquidity: 0,
      },
    };
    const pricing = {
      optionPrice: toBN('100'),
      vega: toBN('1'),
      preTradeAmmNetStdVega: toBN('1'),
      postTradeAmmNetStdVega: toBN('1'),
      callDelta: toBN('1'),
    };

    it('if amount == 0, return 0', async () => {
      const premium = await c.optionMarketPricer.getPremium({ ...trade, amount: 0 }, pricing, pricingGlobals);

      expect(premium).to.eq(0);
    });

    it('adds fee to premium if isBuy == true', async () => {
      const premium = await c.optionMarketPricer.getPremium(trade, pricing, pricingGlobals);

      expect(premium).to.gt(pricing.optionPrice.mul(trade.amount).div(toBN('1')));
    });

    it('subtracts fee from premium if isBuy == false', async () => {
      const premium = await c.optionMarketPricer.getPremium({ ...trade, isBuy: false }, pricing, pricingGlobals);

      expect(premium).to.lt(pricing.optionPrice.mul(trade.amount).div(toBN('1')));
    });

    it('if isBuy == false and fee > premium, return 0', async () => {
      const premium = await c.optionMarketPricer.getPremium({ ...trade, isBuy: false }, pricing, {
        ...pricingGlobals,
        optionPriceFeeCoefficient: toBN('2'),
      });

      expect(premium).to.eq(0);
    });
  });

  describe('getVegaUtil', async () => {
    const trade = {
      isBuy: true,
      isLong: true,
      isCall: true,
      amount: toBN('100'),
      vol: toBN('100'),
      expiry: toBN('100'),
      liquidity: {
        freeCollatLiquidity: toBN('10000'),
        usedCollatLiquidity: 0,
        freeDeltaLiquidity: toBN('5000'),
        usedDeltaLiquidity: 0,
      },
    };
    const pricing = {
      optionPrice: toBN('10'),
      vega: toBN('1'),
      preTradeAmmNetStdVega: toBN('1'),
      postTradeAmmNetStdVega: toBN('2'),
      callDelta: toBN('1'),
    };

    it('will error if preTradeCollatLiq < amount * price', async () => {
      await expect(
        c.optionMarketPricer.getVegaUtil(
          {
            ...trade,
            isBuy: false,
            liquidity: {
              freeCollatLiquidity: toBN('10'),
              usedCollatLiquidity: 0,
              freeDeltaLiquidity: toBN('5'),
              usedDeltaLiquidity: 0,
            },
          },
          pricing,
          pricingGlobals,
        ),
      ).to.be.revertedWith('SafeMath: subtraction overflow');
    });

    it('vegaNormFactor = 0', async () => {
      const result = await c.optionMarketPricer.getVegaUtil(trade, pricing, {
        ...pricingGlobals,
        vegaNormFactor: 0,
      });

      expect(result).to.eq(0);
    });

    it('trade.vol = 0', async () => {
      const result = await c.optionMarketPricer.getVegaUtil({ ...trade, vol: 0 }, pricing, pricingGlobals);

      expect(result).to.eq(0);
    });

    it('isBuy = true decreases fee', async () => {
      const resultNotBuy = await c.optionMarketPricer.getVegaUtil({ ...trade, isBuy: false }, pricing, pricingGlobals);
      const resultBuy = await c.optionMarketPricer.getVegaUtil({ ...trade, isBuy: true }, pricing, pricingGlobals);

      expect(resultBuy).to.lt(resultNotBuy);
    });

    it('isBuy = false increases fee', async () => {
      const resultNotBuy = await c.optionMarketPricer.getVegaUtil({ ...trade, isBuy: false }, pricing, pricingGlobals);
      const resultBuy = await c.optionMarketPricer.getVegaUtil({ ...trade, isBuy: true }, pricing, pricingGlobals);

      expect(resultNotBuy).to.gt(resultBuy);
    });
  });

  describe('getFee', async () => {
    it('if amount is 0, return 0 regardless of other parameters', async () => {
      const fee = await c.optionMarketPricer.getFee(pricingGlobals, toBN('0'), toBN('1000'), toBN('1'));

      expect(fee).to.eq(0);
    });

    it('adds a spot price fee if vegautil and optionPrice are both 0', async () => {
      const fee = await c.optionMarketPricer.getFee(pricingGlobals, toBN('100'), toBN('0'), toBN('0'));

      expect(fee).to.gt(0);
    });

    it('adds a vega util fee if spotPrice and optionPrice are both 0', async () => {
      const fee = await c.optionMarketPricer.getFee(
        { ...pricingGlobals, spotPrice: 0 },
        toBN('100'),
        toBN('0'),
        toBN('100'),
      );

      expect(fee).to.gt(0);
    });

    it('adds a optionPrice fee if spotPrice and vega util are both 0', async () => {
      const fee = await c.optionMarketPricer.getFee(
        { ...pricingGlobals, spotPrice: 0 },
        toBN('100'),
        toBN('100'),
        toBN('0'),
      );

      expect(fee).to.gt(0);
    });
  });
});
