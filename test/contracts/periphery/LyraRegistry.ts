import { toBytes32 } from '../../../scripts/util/web3utils';
import { deployFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('LyraRegistry tests', () => {
  beforeEach(deployFixture);

  describe('LyraRegistry', () => {
    it('can register global contracts', async () => {
      await hre.f.c.lyraRegistry.updateGlobalAddresses([toBytes32('SNX_ADAPTER')], [hre.f.c.synthetixAdapter.address]);
      // can only be called by owner
      await expect(
        hre.f.c.lyraRegistry
          .connect(hre.f.alice)
          .updateGlobalAddresses([toBytes32('SNX_ADAPTER')], [hre.f.c.optionMarket.address]),
      ).revertedWith('OnlyOwner');
      expect(await hre.f.c.lyraRegistry.globalAddresses(toBytes32('SNX_ADAPTER'))).eq(hre.f.c.synthetixAdapter.address);
    });

    it('can add and remove an option market', async () => {
      await hre.f.c.lyraRegistry.addMarket({
        greekCache: hre.f.c.optionGreekCache.address,
        liquidityPool: hre.f.c.liquidityPool.address,
        liquidityTokens: hre.f.c.liquidityTokens.address,
        optionMarket: hre.f.c.optionMarket.address,
        optionMarketPricer: hre.f.c.optionMarketPricer.address,
        optionToken: hre.f.c.optionToken.address,
        poolHedger: hre.f.c.poolHedger.address,
        shortCollateral: hre.f.c.shortCollateral.address,
        baseAsset: hre.f.c.snx.baseAsset.address,
        quoteAsset: hre.f.c.snx.quoteAsset.address,
      });
      const addresses = await hre.f.c.lyraRegistry.marketAddresses(hre.f.c.optionMarket.address);
      expect(addresses.greekCache).eq(hre.f.c.optionGreekCache.address);
      expect(addresses.liquidityPool).eq(hre.f.c.liquidityPool.address);
      expect(addresses.liquidityTokens).eq(hre.f.c.liquidityTokens.address);
      expect(addresses.optionMarket).eq(hre.f.c.optionMarket.address);
      expect(addresses.optionMarketPricer).eq(hre.f.c.optionMarketPricer.address);
      expect(addresses.optionToken).eq(hre.f.c.optionToken.address);
      expect(addresses.poolHedger).eq(hre.f.c.poolHedger.address);
      expect(addresses.shortCollateral).eq(hre.f.c.shortCollateral.address);
      expect(addresses.baseAsset).eq(hre.f.c.snx.baseAsset.address);
      expect(addresses.quoteAsset).eq(hre.f.c.snx.quoteAsset.address);
    });
  });
});
