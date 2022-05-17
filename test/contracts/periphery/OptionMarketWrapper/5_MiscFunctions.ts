import { toBN } from '../../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../../utils/assert';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('OptionMarketWrapper viewer / misc function tests', () => {
  beforeEach(allCurrenciesFixture);

  describe('Viewer function tests', async () => {
    it('getMarketAndStableId', async () => {
      const [stables, markets] = await hre.f.c.optionMarketWrapper.getBalancesAndAllowances(hre.f.deployer.address);

      expect(stables[0].id).to.eq(0);
      expect(stables[0].token).to.eq(hre.f.c.snx.quoteAsset.address);
      expect(stables[1].id).to.eq(1);
      expect(stables[1].token).to.eq(hre.f.DAI.address);
      expect(stables[1].balance).to.eq(toBN('100000'));
      expect(stables[2].id).to.eq(2);
      expect(stables[2].token).to.eq(hre.f.USDC.address);
      expect(stables[2].balance).to.eq(100000 * 1e6);

      expect(markets[0].id).to.eq(0);
      expect(markets[0].market).to.eq(hre.f.c.optionMarket.address);
      expect(markets[0].token).to.eq(hre.f.c.snx.baseAsset.address);
    });
  });

  describe('Misc function tests', async () => {
    it('quoteCurveSwap', async () => {
      const DAI = await hre.f.DAI;
      const USDC = await hre.f.USDC;
      const sUSD = await hre.f.c.snx.quoteAsset;

      const DAITosUSD = await hre.f.c.optionMarketWrapper.quoteCurveSwap(DAI.address, sUSD.address, toBN('1000'));
      const sUSDToDAI = await hre.f.c.optionMarketWrapper.quoteCurveSwap(sUSD.address, DAI.address, toBN('1000'));
      assertCloseToPercentage(DAITosUSD.amountOut, toBN('989'));
      assertCloseToPercentage(sUSDToDAI.amountOut, toBN('1011'));

      const USDCTosUSD = await hre.f.c.optionMarketWrapper.quoteCurveSwap(USDC.address, sUSD.address, 1000);
      const sUSDToUSDC = await hre.f.c.optionMarketWrapper.quoteCurveSwap(sUSD.address, USDC.address, toBN('1000'));
      expect(USDCTosUSD.amountOut).to.eq(989108910891089);
      expect(sUSDToUSDC.amountOut).to.eq(1011011011);
    });

    it('unsupported token for swap', async () => {
      await expect(
        hre.f.c.optionMarketWrapper.quoteCurveSwap(hre.f.deployer.address, hre.f.c.snx.quoteAsset.address, 1000),
      ).revertedWith('UnsupportedToken');
    });
  });
});
