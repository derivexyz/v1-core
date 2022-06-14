import { ContractFactory } from 'ethers/lib/ethers';
import { ethers } from 'hardhat';
import { toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { LiquidityPool, OptionMarket } from '../../../typechain-types';
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

    it('update global contracts wrong ', async () => {
      await expect(
        hre.f.c.lyraRegistry.updateGlobalAddresses(
          [toBytes32('SNX_ADAPTER'), toBytes32('SNX_ADAPTER')],
          [hre.f.c.synthetixAdapter.address],
        ),
      ).to.be.revertedWith('length mismatch');
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

      let addresses = await hre.f.c.lyraRegistry.marketAddresses(hre.f.c.optionMarket.address);
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

      await hre.f.c.lyraRegistry.removeMarket(hre.f.c.optionMarket.address);
      addresses = await hre.f.c.lyraRegistry.marketAddresses(hre.f.c.optionMarket.address);
      expect(addresses.greekCache).eq(ZERO_ADDRESS);
      expect(addresses.liquidityPool).eq(ZERO_ADDRESS);
      expect(addresses.liquidityTokens).eq(ZERO_ADDRESS);
      expect(addresses.optionMarket).eq(ZERO_ADDRESS);
      expect(addresses.optionMarketPricer).eq(ZERO_ADDRESS);
      expect(addresses.optionToken).eq(ZERO_ADDRESS);
      expect(addresses.poolHedger).eq(ZERO_ADDRESS);
      expect(addresses.shortCollateral).eq(ZERO_ADDRESS);
      expect(addresses.baseAsset).eq(ZERO_ADDRESS);
      expect(addresses.quoteAsset).eq(ZERO_ADDRESS);
    });

    it('revert for invalid market', async () => {
      await expect(hre.f.c.lyraRegistry.removeMarket(hre.f.c.optionMarket.address)).to.be.revertedWith(
        'RemovingInvalidMarket',
      );
    });

    it('able to add another market', async () => {
      const optionMarket2 = (await ((await ethers.getContractFactory('OptionMarket')) as ContractFactory)
        .connect(hre.f.deployer)
        .deploy()) as OptionMarket;

      await hre.f.c.lyraRegistry.addMarket({
        greekCache: hre.f.c.optionGreekCache.address,
        liquidityPool: hre.f.c.liquidityPool.address,
        liquidityTokens: hre.f.c.liquidityTokens.address,
        optionMarket: optionMarket2.address,
        optionMarketPricer: hre.f.c.optionMarketPricer.address,
        optionToken: hre.f.c.optionToken.address,
        poolHedger: hre.f.c.poolHedger.address,
        shortCollateral: hre.f.c.shortCollateral.address,
        baseAsset: hre.f.c.snx.baseAsset.address,
        quoteAsset: hre.f.c.snx.quoteAsset.address,
      });

      const addresses = await hre.f.c.lyraRegistry.marketAddresses(optionMarket2.address);
      expect(addresses.optionMarket).eq(optionMarket2.address);
    });
    it('update only LP market address', async () => {
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

      let addresses = await hre.f.c.lyraRegistry.marketAddresses(hre.f.c.optionMarket.address);
      expect(addresses.liquidityPool).eq(hre.f.c.liquidityPool.address);

      // Just change the LP address in lyra registry
      const lp2 = (await ((await ethers.getContractFactory('LiquidityPool')) as ContractFactory)
        .connect(hre.f.deployer)
        .deploy()) as LiquidityPool;

      await hre.f.c.lyraRegistry.addMarket({
        greekCache: hre.f.c.optionGreekCache.address,
        liquidityPool: lp2.address,
        liquidityTokens: hre.f.c.liquidityTokens.address,
        optionMarket: hre.f.c.optionMarket.address,
        optionMarketPricer: hre.f.c.optionMarketPricer.address,
        optionToken: hre.f.c.optionToken.address,
        poolHedger: hre.f.c.poolHedger.address,
        shortCollateral: hre.f.c.shortCollateral.address,
        baseAsset: hre.f.c.snx.baseAsset.address,
        quoteAsset: hre.f.c.snx.quoteAsset.address,
      });

      addresses = await hre.f.c.lyraRegistry.marketAddresses(hre.f.c.optionMarket.address);
      expect(addresses.liquidityPool).eq(lp2.address);
    });
  });
});
