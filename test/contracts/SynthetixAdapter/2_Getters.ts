import { BigNumber } from 'ethers';
import { toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { ExchangeParamsStructOutput } from '../../../typechain-types/SynthetixAdapter';
import { defaultBTCExchange, setETHExchangerInvalid, setETHFeeRate, setETHPrice } from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('Getters', async () => {
  beforeEach(seedFixture);

  // unit test: getSpotPrice, getSpotPriceForMarket
  describe('spot price', async () => {
    it('gets spot price from key', async () => {
      await setETHPrice(toBN('1000'));
      expect(await hre.f.c.synthetixAdapter.getSpotPrice(toBytes32('sETH'))).to.eq(toBN('1000'));
      expect(await hre.f.c.synthetixAdapter.getSpotPriceForMarket(hre.f.c.optionMarket.address)).to.eq(toBN('1000'));

      await setETHPrice(toBN('2000'));
      expect(await hre.f.c.synthetixAdapter.getSpotPrice(toBytes32('sETH'))).to.eq(toBN('2000'));
      expect(await hre.f.c.synthetixAdapter.getSpotPriceForMarket(hre.f.c.optionMarket.address)).to.eq(toBN('2000'));
    });
    it('reverts if snx returns invalid flag or rate = 0', async () => {
      await setETHExchangerInvalid();
      await expect(hre.f.c.synthetixAdapter.getSpotPrice(toBytes32('sETH'))).to.revertedWith('RateIsInvalid');
      await setETHPrice(0);
      await expect(hre.f.c.synthetixAdapter.getSpotPrice(toBytes32('sETH'))).to.revertedWith('RateIsInvalid');
    });
  });

  // unit test: getExchangeParams (pausing tested in Pause.ts)
  describe('exchange params', async () => {
    let params: ExchangeParamsStructOutput;

    it('gets exchange params', async () => {
      await setETHPrice(toBN('2000'));
      await setETHFeeRate('sUSD', 'sETH', toBN('0.01'), toBN('0.05'));

      params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      await verifyExchangeParams(
        params,
        toBN('2000'),
        'sUSD',
        'sETH',
        await hre.f.c.synthetixAdapter.collateralShort(),
        toBN('0.01'),
        toBN('0.05'),
      );
    });
    it('gets correct values after globals changed', async () => {
      await defaultBTCExchange();

      params = await hre.f.c.synthetixAdapter.getExchangeParams(ZERO_ADDRESS);
      await verifyExchangeParams(
        params,
        toBN('20000'),
        'sUSD',
        'sBTC',
        await hre.f.c.synthetixAdapter.collateralShort(),
        toBN('0.005'),
        toBN('0.001'),
      );
    });
    it('reverts if invalid base or quote key', async () => {
      await setETHExchangerInvalid();
      await expect(hre.f.c.synthetixAdapter.getExchangeParams(ZERO_ADDRESS)).to.revertedWith('RateIsInvalid');
    });
  });
});

export async function verifyExchangeParams(
  exchangeParams: ExchangeParamsStructOutput,
  spot: BigNumber,
  quoteKey: string,
  baseKey: string,
  short: string,
  quoteFee: BigNumber,
  baseFee: BigNumber,
) {
  expect(exchangeParams.spotPrice).to.eq(spot);
  expect(exchangeParams.quoteKey).to.eq(toBytes32(quoteKey));
  expect(exchangeParams.baseKey).to.eq(toBytes32(baseKey));
  expect(exchangeParams.short).to.eq(short);
  expect(exchangeParams.quoteBaseFeeRate).to.eq(quoteFee);
  expect(exchangeParams.baseQuoteFeeRate).to.eq(baseFee);
}
