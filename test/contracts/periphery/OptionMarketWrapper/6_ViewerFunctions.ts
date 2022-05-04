import { toBN } from '../../../../scripts/util/web3utils';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('OptionMarketWrapper viewer function tests', () => {
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
});
