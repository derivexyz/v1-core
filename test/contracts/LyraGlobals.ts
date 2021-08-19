import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { DAY_SEC, HOUR_SEC, toBN, toBytes32 } from '../../scripts/util/web3utils';
import { LyraGlobals } from '../../typechain';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { deployTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
import { expect } from '../utils/testSetup';

describe('LyraGlobals - unit tests', async () => {
  let deployer: Signer;
  let account2: Signer;

  let c: TestSystemContractsType;
  let snap: number;
  let lyraGlobalsAccount2: LyraGlobals;

  before(async () => {
    [deployer, account2] = await ethers.getSigners();

    c = await deployTestSystem(deployer);
    snap = await takeSnapshot();

    lyraGlobalsAccount2 = c.lyraGlobals.connect(account2);
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
  });

  describe('setGlobals', async () => {
    it('reverts if not called by owner', async () => {
      await expect(
        lyraGlobalsAccount2.setGlobals(
          c.test.synthetix.address,
          c.mocked.exchanger.contract.address,
          c.mocked.exchangeRates.contract.address,
          c.test.collateralShort.address,
        ),
      ).to.revertedWith('Ownable: caller is not the owner');
    });
    it('sets contracts and stale price period correctly', async () => {
      await c.lyraGlobals.setGlobals(
        c.test.synthetix.address,
        c.mocked.exchanger.contract.address,
        c.mocked.exchangeRates.contract.address,
        c.test.collateralShort.address,
      );

      expect(await c.lyraGlobals.synthetix()).to.eq(c.test.synthetix.address);
      expect(await c.lyraGlobals.exchanger()).to.eq(c.mocked.exchanger.contract.address);
      expect(await c.lyraGlobals.exchangeRates()).to.eq(c.mocked.exchangeRates.contract.address);
      expect(await c.lyraGlobals.collateralShort()).to.eq(c.test.collateralShort.address);
    });
  });

  describe('setGlobalsForContract', async () => {
    let contractAddress: string;
    const tradingCutoff = DAY_SEC / 2;
    const pricingGlobals = {
      optionPriceFeeCoefficient: toBN('0.01'),
      spotPriceFeeCoefficient: toBN('0.01'),
      vegaFeeCoefficient: toBN('300'),
      vegaNormFactor: toBN('0.2'),
      standardSize: toBN('5'),
      skewAdjustmentFactor: toBN('0.75'),
      rateAndCarry: toBN('0.1'),
      minDelta: toBN('0.15'),
      volatilityCutoff: toBN('0.55'),
      spotPrice: toBN('4100'),
    };
    const quoteKey = toBytes32('sUSD');
    const baseKey = toBytes32('sETH');

    before(() => {
      contractAddress = c.optionMarket.address;
    });
    it('reverts if not called by owner', async () => {
      await expect(
        lyraGlobalsAccount2.setGlobalsForContract(contractAddress, tradingCutoff, pricingGlobals, quoteKey, baseKey),
      ).to.revertedWith('Ownable: caller is not the owner');
    });
    it('sets all values as expected', async () => {
      await c.lyraGlobals.setGlobalsForContract(contractAddress, tradingCutoff, pricingGlobals, quoteKey, baseKey);

      expect(await c.lyraGlobals.tradingCutoff(contractAddress)).to.eq(tradingCutoff);
      expect(await c.lyraGlobals.optionPriceFeeCoefficient(contractAddress)).to.eq(
        pricingGlobals.optionPriceFeeCoefficient,
      );
      expect(await c.lyraGlobals.spotPriceFeeCoefficient(contractAddress)).to.eq(
        pricingGlobals.spotPriceFeeCoefficient,
      );
      expect(await c.lyraGlobals.vegaFeeCoefficient(contractAddress)).to.eq(pricingGlobals.vegaFeeCoefficient);
      expect(await c.lyraGlobals.vegaNormFactor(contractAddress)).to.eq(pricingGlobals.vegaNormFactor);
      expect(await c.lyraGlobals.standardSize(contractAddress)).to.eq(pricingGlobals.standardSize);
      expect(await c.lyraGlobals.skewAdjustmentFactor(contractAddress)).to.eq(pricingGlobals.skewAdjustmentFactor);
      expect(await c.lyraGlobals.rateAndCarry(contractAddress)).to.eq(pricingGlobals.rateAndCarry);
      expect(await c.lyraGlobals.minDelta(contractAddress)).to.eq(pricingGlobals.minDelta);
      expect(await c.lyraGlobals.quoteKey(contractAddress)).to.eq(quoteKey);
      expect(await c.lyraGlobals.baseKey(contractAddress)).to.eq(baseKey);

      snap = await takeSnapshot();
    });
  });

  describe('isPaused', async () => {
    it('sets value correctly', async () => {
      await c.lyraGlobals.setPaused(true);
      expect(await c.lyraGlobals.isPaused()).to.eq(true);
    });
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setPaused(true)).to.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('setTradingCutoff', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setTradingCutoff(c.optionMarket.address, HOUR_SEC * 6 + 1)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('reverts for values out of range', async () => {
      await expect(c.lyraGlobals.setTradingCutoff(c.optionMarket.address, HOUR_SEC * 6 - 1)).to.revertedWith(
        'tradingCutoff value out of range',
      );
      await expect(c.lyraGlobals.setTradingCutoff(c.optionMarket.address, DAY_SEC * 14 + 1)).to.revertedWith(
        'tradingCutoff value out of range',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setTradingCutoff(c.optionMarket.address, HOUR_SEC * 6 + 1);
      expect(await c.lyraGlobals.tradingCutoff(c.optionMarket.address)).to.eq(HOUR_SEC * 6 + 1);
    });
    it('sets min value correctly', async () => {
      await c.lyraGlobals.setTradingCutoff(c.optionMarket.address, HOUR_SEC * 6);
      expect(await c.lyraGlobals.tradingCutoff(c.optionMarket.address)).to.eq(HOUR_SEC * 6);
    });
    it('sets max value correctly', async () => {
      await c.lyraGlobals.setTradingCutoff(c.optionMarket.address, HOUR_SEC * 14);
      expect(await c.lyraGlobals.tradingCutoff(c.optionMarket.address)).to.eq(HOUR_SEC * 14);
    });
  });

  describe('setOptionPriceFeeCoefficient', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setOptionPriceFeeCoefficient(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setOptionPriceFeeCoefficient(c.optionMarket.address, toBN('0.02'));
      expect(await c.lyraGlobals.optionPriceFeeCoefficient(c.optionMarket.address)).to.eq(toBN('0.02'));
    });
  });
  describe('setSpotPriceFeeCoefficient', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setSpotPriceFeeCoefficient(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setSpotPriceFeeCoefficient(c.optionMarket.address, toBN('0.02'));
      expect(await c.lyraGlobals.spotPriceFeeCoefficient(c.optionMarket.address)).to.eq(toBN('0.02'));
    });
  });
  describe('setVegaFeeCoefficient', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setVegaFeeCoefficient(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setVegaFeeCoefficient(c.optionMarket.address, toBN('301'));
      expect(await c.lyraGlobals.vegaFeeCoefficient(c.optionMarket.address)).to.eq(toBN('301'));
    });
  });
  describe('setVegaNormFactor', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setVegaNormFactor(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setVegaNormFactor(c.optionMarket.address, toBN('0.03'));
      expect(await c.lyraGlobals.vegaNormFactor(c.optionMarket.address)).to.eq(toBN('0.03'));
    });
  });
  describe('setStandardSize', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setStandardSize(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setStandardSize(c.optionMarket.address, toBN('6'));
      expect(await c.lyraGlobals.standardSize(c.optionMarket.address)).to.eq(toBN('6'));
    });
  });
  describe('setSkewAdjustmentFactor', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setSkewAdjustmentFactor(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('reverts for values out of range', async () => {
      await expect(c.lyraGlobals.setSkewAdjustmentFactor(c.optionMarket.address, toBN('10').add(1))).to.revertedWith(
        'skewAdjustmentFactor value out of range',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setSkewAdjustmentFactor(c.optionMarket.address, toBN('1'));
      expect(await c.lyraGlobals.skewAdjustmentFactor(c.optionMarket.address)).to.eq(toBN('1'));
    });
    it('sets max value correctly', async () => {
      await c.lyraGlobals.setSkewAdjustmentFactor(c.optionMarket.address, toBN('10'));
      expect(await c.lyraGlobals.skewAdjustmentFactor(c.optionMarket.address)).to.eq(toBN('10'));
    });
  });
  describe('setRateAndCarry', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setRateAndCarry(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('reverts for values out of range', async () => {
      await expect(c.lyraGlobals.setRateAndCarry(c.optionMarket.address, toBN('-3').sub(1))).to.revertedWith(
        'rateAndCarry value out of range',
      );
      await expect(c.lyraGlobals.setRateAndCarry(c.optionMarket.address, toBN('3').add(1))).to.revertedWith(
        'rateAndCarry value out of range',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setRateAndCarry(c.optionMarket.address, toBN('0.2'));
      expect(await c.lyraGlobals.rateAndCarry(c.optionMarket.address)).to.eq(toBN('0.2'));
    });
    it('sets min value correctly', async () => {
      await c.lyraGlobals.setRateAndCarry(c.optionMarket.address, toBN('-3'));
      expect(await c.lyraGlobals.rateAndCarry(c.optionMarket.address)).to.eq(toBN('-3'));
    });
    it('sets max value correctly', async () => {
      await c.lyraGlobals.setRateAndCarry(c.optionMarket.address, toBN('3'));
      expect(await c.lyraGlobals.rateAndCarry(c.optionMarket.address)).to.eq(toBN('3'));
    });
  });
  describe('setMinDelta', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setMinDelta(c.optionMarket.address, 0)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('reverts for values out of range', async () => {
      await expect(c.lyraGlobals.setMinDelta(c.optionMarket.address, -1)).to.revertedWith(
        'minDelta value out of range',
      );
      await expect(c.lyraGlobals.setMinDelta(c.optionMarket.address, toBN('0.3'))).to.revertedWith(
        'minDelta value out of range',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setMinDelta(c.optionMarket.address, toBN('0.1'));
      expect(await c.lyraGlobals.minDelta(c.optionMarket.address)).to.eq(toBN('0.1'));
    });
    it('sets min value correctly', async () => {
      await c.lyraGlobals.setMinDelta(c.optionMarket.address, toBN('0'));
      expect(await c.lyraGlobals.minDelta(c.optionMarket.address)).to.eq(toBN('0'));
    });
    it('sets max value correctly', async () => {
      await c.lyraGlobals.setMinDelta(c.optionMarket.address, toBN('0.2'));
      expect(await c.lyraGlobals.minDelta(c.optionMarket.address)).to.eq(toBN('0.2'));
    });
  });
  describe('setQuoteKey', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setQuoteKey(c.optionMarket.address, toBytes32('test'))).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setQuoteKey(c.optionMarket.address, toBytes32('sUSD2'));
      expect(await c.lyraGlobals.quoteKey(c.optionMarket.address)).to.eq(toBytes32('sUSD2'));
    });
  });
  describe('setBaseKey', async () => {
    it('can only be set by owner', async () => {
      await expect(lyraGlobalsAccount2.setBaseKey(c.optionMarket.address, toBytes32('test'))).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('sets value correctly', async () => {
      await c.lyraGlobals.setQuoteKey(c.optionMarket.address, toBytes32('sETH2'));
      expect(await c.lyraGlobals.quoteKey(c.optionMarket.address)).to.eq(toBytes32('sETH2'));
    });
  });

  describe('getSpotPrice', async () => {
    it('will get the spot price correctly', async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      expect(await c.lyraGlobals.getSpotPrice(toBytes32('sETH'))).to.eq(toBN('4100'));
    });
    it('will revert if the price is invalid', async () => {
      await c.mocked.exchangeRates.mockInvalid(true);
      await expect(lyraGlobalsAccount2.getSpotPrice(toBytes32('sETH'))).to.revertedWith('rate is invalid');
    });
  });

  describe('getPricingGlobals', async () => {
    it('will revert if contracts are paused', async () => {
      await c.lyraGlobals.setPaused(true);
      await expect(c.lyraGlobals.getPricingGlobals(c.optionMarket.address)).to.revertedWith('contracts are paused');
    });
    it('will get all the relevant values', async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      const {
        optionPriceFeeCoefficient,
        spotPriceFeeCoefficient,
        vegaFeeCoefficient,
        vegaNormFactor,
        standardSize,
        skewAdjustmentFactor,
        rateAndCarry,
        minDelta,
        volatilityCutoff,
        spotPrice,
      } = await c.lyraGlobals.getPricingGlobals(c.optionMarket.address);

      expect(optionPriceFeeCoefficient).to.eq(toBN('0.01'));
      expect(spotPriceFeeCoefficient).to.eq(toBN('0.01'));
      expect(vegaFeeCoefficient).to.eq(toBN('300'));
      expect(vegaNormFactor).to.eq(toBN('0.2'));
      expect(standardSize).to.eq(toBN('5'));
      expect(skewAdjustmentFactor).to.eq(toBN('0.75'));
      expect(rateAndCarry).to.eq(toBN('0.1'));
      expect(minDelta).to.eq(toBN('0.15'));
      expect(volatilityCutoff).to.eq(toBN('0.55'));
      expect(spotPrice).to.eq(toBN('4100'));
    });
  });

  describe('getGreekCacheGlobals', async () => {
    it('will revert if contracts are paused', async () => {
      await c.lyraGlobals.setPaused(true);
      await expect(c.lyraGlobals.getGreekCacheGlobals(c.optionMarket.address)).to.revertedWith('contracts are paused');
    });
    it('will get all the relevant values', async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      const { rateAndCarry, spotPrice } = await c.lyraGlobals.getGreekCacheGlobals(c.optionMarket.address);
      expect(rateAndCarry).to.eq(toBN('0.1'));
      expect(spotPrice).to.eq(toBN('4100'));
    });
  });

  describe('getExchangeGlobals', async () => {
    beforeEach(async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('1'));
      await c.mocked.exchanger.mockFeeFor('sETH', 'sUSD', toBN('2'));
    });
    it('will revert if contracts are paused', async () => {
      await c.lyraGlobals.setPaused(true);
      await expect(c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, 1)).to.revertedWith('contracts are paused');
    });
    it('will get all the relevant values for exchangeType.BASE_QUOTE', async () => {
      const {
        spotPrice,
        quoteKey,
        baseKey,
        synthetix,
        short,
        quoteBaseFeeRate,
        baseQuoteFeeRate,
      } = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, 0);

      expect(spotPrice).to.eq(toBN('4100'));
      expect(quoteKey).to.eq(toBytes32('sUSD'));
      expect(baseKey).to.eq(toBytes32('sETH'));
      expect(synthetix).to.eq(c.test.synthetix.address);
      expect(short).to.eq(c.test.collateralShort.address);
      expect(quoteBaseFeeRate).to.eq(toBN('0'));
      expect(baseQuoteFeeRate).to.eq(toBN('2'));
    });
    it('will get all the relevant values for exchangeType.QUOTE_BASE', async () => {
      const {
        spotPrice,
        quoteKey,
        baseKey,
        synthetix,
        short,
        quoteBaseFeeRate,
        baseQuoteFeeRate,
      } = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, 1);

      expect(spotPrice).to.eq(toBN('4100'));
      expect(quoteKey).to.eq(toBytes32('sUSD'));
      expect(baseKey).to.eq(toBytes32('sETH'));
      expect(synthetix).to.eq(c.test.synthetix.address);
      expect(short).to.eq(c.test.collateralShort.address);
      expect(quoteBaseFeeRate).to.eq(toBN('1'));
      expect(baseQuoteFeeRate).to.eq(toBN('0'));
    });
    it('will get all the relevant values for exchangeType.ALL', async () => {
      const {
        spotPrice,
        quoteKey,
        baseKey,
        synthetix,
        short,
        quoteBaseFeeRate,
        baseQuoteFeeRate,
      } = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, 2);

      expect(spotPrice).to.eq(toBN('4100'));
      expect(quoteKey).to.eq(toBytes32('sUSD'));
      expect(baseKey).to.eq(toBytes32('sETH'));
      expect(synthetix).to.eq(c.test.synthetix.address);
      expect(short).to.eq(c.test.collateralShort.address);
      expect(quoteBaseFeeRate).to.eq(toBN('1'));
      expect(baseQuoteFeeRate).to.eq(toBN('2'));
    });
  });

  describe('getGlobalsForOptionTrade', async () => {
    beforeEach(async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('1'));
      await c.mocked.exchanger.mockFeeFor('sETH', 'sUSD', toBN('2'));
    });

    it('will revert if contracts are paused', async () => {
      await c.lyraGlobals.setPaused(true);
      await expect(c.lyraGlobals.getGlobalsForOptionTrade(c.optionMarket.address, true)).to.revertedWith(
        'contracts are paused',
      );
    });
    it('will get all the relevant values for isBuy = true', async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      const { exchangeGlobals, pricingGlobals, tradeCutoff } = await c.lyraGlobals.getGlobalsForOptionTrade(
        c.optionMarket.address,
        true,
      );

      expect(exchangeGlobals.spotPrice).to.eq(toBN('4100'));
      expect(exchangeGlobals.quoteKey).to.eq(toBytes32('sUSD'));
      expect(exchangeGlobals.baseKey).to.eq(toBytes32('sETH'));
      expect(exchangeGlobals.synthetix).to.eq(c.test.synthetix.address);
      expect(exchangeGlobals.short).to.eq(c.test.collateralShort.address);
      expect(exchangeGlobals.quoteBaseFeeRate).to.eq(toBN('1'));
      expect(exchangeGlobals.baseQuoteFeeRate).to.eq(toBN('0'));

      expect(pricingGlobals.optionPriceFeeCoefficient).to.eq(toBN('0.01'));
      expect(pricingGlobals.spotPriceFeeCoefficient).to.eq(toBN('0.01'));
      expect(pricingGlobals.vegaFeeCoefficient).to.eq(toBN('300'));
      expect(pricingGlobals.vegaNormFactor).to.eq(toBN('0.2'));
      expect(pricingGlobals.standardSize).to.eq(toBN('5'));
      expect(pricingGlobals.skewAdjustmentFactor).to.eq(toBN('0.75'));
      expect(pricingGlobals.rateAndCarry).to.eq(toBN('0.1'));
      expect(pricingGlobals.minDelta).to.eq(toBN('0.15'));
      expect(pricingGlobals.volatilityCutoff).to.eq(toBN('0.55'));
      expect(pricingGlobals.spotPrice).to.eq(toBN('4100'));

      expect(tradeCutoff).to.eq(DAY_SEC / 2);
    });
    it('will get all the relevant values for isBuy = false', async () => {
      await c.mocked.exchangeRates.mockLatestPrice(toBN('4100'));
      const { exchangeGlobals, pricingGlobals, tradeCutoff } = await c.lyraGlobals.getGlobalsForOptionTrade(
        c.optionMarket.address,
        false,
      );

      expect(exchangeGlobals.spotPrice).to.eq(toBN('4100'));
      expect(exchangeGlobals.quoteKey).to.eq(toBytes32('sUSD'));
      expect(exchangeGlobals.baseKey).to.eq(toBytes32('sETH'));
      expect(exchangeGlobals.synthetix).to.eq(c.test.synthetix.address);
      expect(exchangeGlobals.short).to.eq(c.test.collateralShort.address);
      expect(exchangeGlobals.quoteBaseFeeRate).to.eq(toBN('0'));
      expect(exchangeGlobals.baseQuoteFeeRate).to.eq(toBN('2'));

      expect(pricingGlobals.optionPriceFeeCoefficient).to.eq(toBN('0.01'));
      expect(pricingGlobals.spotPriceFeeCoefficient).to.eq(toBN('0.01'));
      expect(pricingGlobals.vegaFeeCoefficient).to.eq(toBN('300'));
      expect(pricingGlobals.vegaNormFactor).to.eq(toBN('0.2'));
      expect(pricingGlobals.standardSize).to.eq(toBN('5'));
      expect(pricingGlobals.skewAdjustmentFactor).to.eq(toBN('0.75'));
      expect(pricingGlobals.rateAndCarry).to.eq(toBN('0.1'));
      expect(pricingGlobals.minDelta).to.eq(toBN('0.15'));
      expect(pricingGlobals.volatilityCutoff).to.eq(toBN('0.55'));
      expect(pricingGlobals.spotPrice).to.eq(toBN('4100'));

      expect(tradeCutoff).to.eq(DAY_SEC / 2);
    });
  });
});
