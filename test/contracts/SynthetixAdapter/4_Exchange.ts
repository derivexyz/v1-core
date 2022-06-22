import { BigNumber } from 'ethers';
import { toBN, toBytes32, UNIT } from '../../../scripts/util/web3utils';
import { ExchangeParamsStructOutput } from '../../../typechain-types/SynthetixAdapter';
import { setETHExchangerInvalid } from '../../utils/contractHelpers';
import { expectBalance, expectBalanceCloseTo, setETHFeeRate, setETHPrice } from '../../utils/contractHelpers/synthetix';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// Unit tests
describe('Exchange', async () => {
  let oldBaseBalance: BigNumber;
  let oldQuoteBalance: BigNumber;
  let params: ExchangeParamsStructOutput;

  beforeEach(async () => {
    await seedFixture();
    await hre.f.c.snx.delegateApprovals.approveExchangeOnBehalf(hre.f.c.synthetixAdapter.address);
    oldBaseBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.signers[0].address);
    oldQuoteBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);

    await setETHPrice(toBN('2000'));
    await setETHFeeRate('sUSD', 'sETH', toBN('0.003'), toBN('0.006'));
    params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
  });

  describe('zero return', async () => {
    it('return zero if base is zero', async () => {
      await hre.f.c.synthetixAdapter.exchangeFromExactBase(hre.f.c.optionMarket.address, 0);
      await hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, 0);
      await expectBalance(hre.f.c.snx.quoteAsset, oldQuoteBalance);
      await expectBalance(hre.f.c.snx.baseAsset, oldBaseBalance);
    });
    it('quote > 1e10: reverts if base received is zero', async () => {
      await hre.f.c.snx.synthetix.setReturnZero(true);
      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      await expect(
        hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, toBN('1')),
      ).to.revertedWith('ReceivedZeroFromExchange');
      await expect(
        hre.f.c.synthetixAdapter.exchangeFromExactBase(hre.f.c.optionMarket.address, toBN('1')),
      ).to.revertedWith('ReceivedZeroFromExchange');
    });
    it('0 < base < 1e10: does not revert if quote received is zero', async () => {
      await hre.f.c.snx.synthetix.setReturnZero(true);
      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      await hre.f.c.synthetixAdapter.exchangeFromExactBase(hre.f.c.optionMarket.address, 1e5);
      await hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, 1e9 / 2000);
      await expectBalance(hre.f.c.snx.quoteAsset, oldQuoteBalance);
      await expectBalance(hre.f.c.snx.baseAsset, oldBaseBalance);
    });
  });

  describe('exchangeFromExactBase', async () => {
    it('reverts if not enough base', async () => {
      await expect(
        hre.f.c.synthetixAdapter.exchangeFromExactBase(hre.f.c.optionMarket.address, oldBaseBalance.add(toBN('1'))),
      ).revertedWith('ERC20: burn amount exceeds balance');
    });
    it('reverts if invalid base or quote key', async () => {
      await setETHExchangerInvalid();
      await expect(
        hre.f.c.synthetixAdapter.exchangeFromExactBase(hre.f.c.optionMarket.address, toBN('1')),
      ).to.revertedWith('RateIsInvalid');
    });
    it('exchanges correct amount', async () => {
      await hre.f.c.synthetixAdapter.exchangeFromExactBase(hre.f.c.optionMarket.address, toBN('10'));
      await expectBalance(hre.f.c.snx.quoteAsset, toBN('1019880.000000000000000000'));
      await expectBalance(hre.f.c.snx.baseAsset, oldBaseBalance.sub(toBN('10')));
    });
  });

  describe('exchangeToExactBase', async () => {
    it('reverts if not enough quote', async () => {
      await expect(
        hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, oldQuoteBalance.div(1000)),
      ).revertedWith('ERC20: burn amount exceeds balance');
    });
    it('reverts if invalid base or quote key', async () => {
      await setETHExchangerInvalid();
      await expect(
        hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, toBN('1')),
      ).to.revertedWith('RateIsInvalid');
    });
    it('exchanges correct amount', async () => {
      await hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, toBN('10'));
      await expectBalance(hre.f.c.snx.quoteAsset, toBN('979939.819458375125376000'));
      await expectBalance(hre.f.c.snx.baseAsset, oldBaseBalance.add(toBN('10')));
    });
  });

  describe('exchangeToExactBaseWithLimit', async () => {
    it('reverts if quote needed > quote limit', async () => {
      await expect(
        hre.f.c.synthetixAdapter.exchangeToExactBaseWithLimit(
          params,
          hre.f.c.optionMarket.address,
          toBN('1'),
          toBN('2000'),
        ),
      ).revertedWith('QuoteBaseExchangeExceedsLimit');
    });
    it('exchanges if quote needed  = quote limit', async () => {
      await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sETH'), 0);
      const params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      await hre.f.c.synthetixAdapter.exchangeToExactBaseWithLimit(
        params,
        hre.f.c.optionMarket.address,
        toBN('1'),
        toBN('2000'),
      );

      await expectBalance(hre.f.c.snx.baseAsset, oldBaseBalance.add(toBN('1')));
      await expectBalance(hre.f.c.snx.quoteAsset, oldQuoteBalance.sub(toBN('2000')));
    });
  });

  describe('Estimate', async () => {
    it('spot: $2000, baseFee: 0.3%, quoteFee: 0.6%', async () => {
      await setMockParams(toBN('2000'), toBN('0.003'), toBN('0.006'));
      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactBase(params, toBN('10'))).to.eq(
        toBN('20060.180541624874624000'),
      );
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactQuote(params, toBN('10000'))).to.eq(
        toBN('5.030181086519114688'),
      );
    });
    it('spot: $1500, baseFee: 0.3%, quoteFee: 0.6%', async () => {
      await setMockParams(toBN('1500'), toBN('0.003'), toBN('0.006'));
      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactBase(params, toBN('10'))).to.eq(
        toBN('15045.135406218655968000'),
      );
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactQuote(params, toBN('10000'))).to.eq(
        toBN('6.706908115358819584'),
      );
    });
    it('spot: $1500, baseFee: 1.2%, quoteFee: 2.0%', async () => {
      await setMockParams(toBN('1500'), toBN('0.012'), toBN('0.020'));
      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactBase(params, toBN('10'))).to.eq(
        toBN('15182.186234817813765000'),
      );
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactQuote(params, toBN('10000'))).to.eq(
        toBN('6.802721088435374150'),
      );
    });
    it('spot: $2500, baseFee: 0.1%, quoteFee: 0.2%, alternate amounts', async () => {
      await setMockParams(toBN('2500'), toBN('0.001'), toBN('0.002'));
      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactBase(params, toBN('1'))).to.eq(
        toBN('2502.502502502502502500'),
      );
      expect(await hre.f.c.synthetixAdapter.estimateExchangeToExactQuote(params, toBN('1000'))).to.eq(
        toBN('0.400801603206412826'),
      );
    });
  });

  describe('exchangeToExactQuote', async () => {
    let initialQuoteBal: BigNumber;
    beforeEach(async () => {
      await hre.f.c.synthetixAdapter.exchangeToExactBase(params, hre.f.c.optionMarket.address, toBN('10'));
      initialQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
    });
    it('reverts if not enough base', async () => {
      await expect(
        hre.f.c.synthetixAdapter.exchangeToExactQuote(
          params,
          hre.f.c.optionMarket.address,
          oldBaseBalance.mul(toBN('2001')).div(UNIT),
        ),
      ).revertedWith('ERC20: burn amount exceeds balance');
      await expect(
        hre.f.c.synthetixAdapter.exchangeToExactQuoteWithLimit(
          params,
          hre.f.c.optionMarket.address,
          toBN('9').mul(toBN('2000')).div(UNIT),
          toBN('8.5'),
        ),
      ).revertedWith('BaseQuoteExchangeExceedsLimit');
    });
    it('exchanges correct amount', async () => {
      await hre.f.c.synthetixAdapter.exchangeToExactQuote(params, hre.f.c.optionMarket.address, toBN('1000'));
      await expectBalanceCloseTo(hre.f.c.snx.quoteAsset, initialQuoteBal.add(toBN('1000')));
    });
  });
});

export async function setMockParams(spot: BigNumber, baseFee: BigNumber, quoteFee: BigNumber) {
  await setETHPrice(spot);
  await setETHFeeRate('sUSD', 'sETH', baseFee, quoteFee);
}
