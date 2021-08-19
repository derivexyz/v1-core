import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { restoreSnapshot, takeSnapshot } from '../../utils';
import { deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { expect } from '../../utils/testSetup';

describe('LyraMarketsRegistry - unit tests', async () => {
  let deployer: Signer;
  let account2: Signer;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    [deployer, account2] = await ethers.getSigners();

    c = await deployTestSystem(deployer);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('addMarket', () => {
    it('should store the addresses and emit an event', async () => {
      const tx = await c.registry.addMarket(
        c.optionMarket.address,
        c.liquidityPool.address,
        c.liquidityCertificate.address,
        c.optionGreekCache.address,
        c.optionMarketPricer.address,
        c.poolHedger.address,
        c.shortCollateral.address,
        c.test.quoteToken.address,
        c.test.baseToken.address,
        c.optionToken.address,
      );

      expect((await c.registry.getOptionMarkets())[0]).equal(c.optionMarket.address);
      expect(await c.registry.optionMarketsAddresses(c.optionMarket.address)).deep.equal([
        c.liquidityPool.address,
        c.liquidityCertificate.address,
        c.optionGreekCache.address,
        c.optionMarketPricer.address,
        c.poolHedger.address,
        c.shortCollateral.address,
        c.test.quoteToken.address,
        c.test.baseToken.address,
        c.optionToken.address,
      ]);

      await expect(tx)
        .to.emit(c.registry, 'MarketAdded')
        .withArgs(
          c.optionMarket.address,
          c.liquidityPool.address,
          c.liquidityCertificate.address,
          c.optionGreekCache.address,
          c.optionMarketPricer.address,
          c.poolHedger.address,
          c.shortCollateral.address,
          c.test.quoteToken.address,
          c.test.baseToken.address,
          c.optionToken.address,
        );
    });

    it('should revert if not owner', async () => {
      await expect(
        c.registry
          .connect(account2)
          .addMarket(
            c.optionMarket.address,
            c.liquidityPool.address,
            c.liquidityCertificate.address,
            c.optionGreekCache.address,
            c.optionMarketPricer.address,
            c.poolHedger.address,
            c.shortCollateral.address,
            c.test.quoteToken.address,
            c.test.baseToken.address,
            c.optionToken.address,
          ),
      ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('should revert if already exists', async () => {
      await c.registry.addMarket(
        c.optionMarket.address,
        c.liquidityPool.address,
        c.liquidityCertificate.address,
        c.optionGreekCache.address,
        c.optionMarketPricer.address,
        c.poolHedger.address,
        c.shortCollateral.address,
        c.test.quoteToken.address,
        c.test.baseToken.address,
        c.optionToken.address,
      );

      await expect(
        c.registry.addMarket(
          c.optionMarket.address,
          c.liquidityPool.address,
          c.liquidityCertificate.address,
          c.optionGreekCache.address,
          c.optionMarketPricer.address,
          c.poolHedger.address,
          c.shortCollateral.address,
          c.test.quoteToken.address,
          c.test.baseToken.address,
          c.optionToken.address,
        ),
      ).to.revertedWith('market already present');
    });
  });

  describe('on created markets', () => {
    let account1: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let account4: SignerWithAddress;
    let account5: SignerWithAddress;
    let account6: SignerWithAddress;
    let account7: SignerWithAddress;
    let account8: SignerWithAddress;
    let account9: SignerWithAddress;
    let account10: SignerWithAddress;

    before(async () => {
      await c.registry.addMarket(
        c.optionMarket.address,
        c.liquidityPool.address,
        c.liquidityCertificate.address,
        c.optionGreekCache.address,
        c.optionMarketPricer.address,
        c.poolHedger.address,
        c.shortCollateral.address,
        c.test.quoteToken.address,
        c.test.baseToken.address,
        c.optionToken.address,
      );

      [
        account1,
        account2,
        account3,
        account4,
        account5,
        account6,
        account7,
        account8,
        account9,
        account10,
      ] = await ethers.getSigners();

      await c.registry.addMarket(
        account1.address,
        account2.address,
        account3.address,
        account4.address,
        account5.address,
        account6.address,
        account7.address,
        account8.address,
        account9.address,
        account10.address,
      );
    });

    describe('getOptionMarkets', () => {
      it('should return the list of option markets addresses', async () => {
        const result = await c.registry.getOptionMarkets();

        expect(result.length).equal(2);
        expect(result[0]).equal(c.optionMarket.address);
        expect(result[1]).equal(account1.address);
      });
    });

    describe('getOptionMarketsAddresses', () => {
      it('should return the addresses associated to the option markets', async () => {
        const result = await c.registry.getOptionMarketsAddresses([c.optionMarket.address, account1.address]);

        expect(result.length).equal(2);
        expect(result[0]).deep.equal([
          c.liquidityPool.address,
          c.liquidityCertificate.address,
          c.optionGreekCache.address,
          c.optionMarketPricer.address,
          c.poolHedger.address,
          c.shortCollateral.address,
          c.test.quoteToken.address,
          c.test.baseToken.address,
          c.optionToken.address,
        ]);
        expect(result[1]).deep.equal([
          account2.address,
          account3.address,
          account4.address,
          account5.address,
          account6.address,
          account7.address,
          account8.address,
          account9.address,
          account10.address,
        ]);
      });
    });

    describe('removeMarket', () => {
      it('should remove a market', async () => {
        const tx = await c.registry.removeMarket(c.optionMarket.address);

        await expect(tx).to.emit(c.registry, 'MarketRemoved').withArgs(c.optionMarket.address);

        const markets = await c.registry.getOptionMarkets();

        expect(markets.length).equal(1);
        expect(markets[0]).equal(account1.address);

        const marketsAddresses = await c.registry.getOptionMarketsAddresses([c.optionMarket.address]);

        expect(marketsAddresses[0]).deep.equal([
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
        ]);
      });
      it('should revert if not owner', async () => {
        await expect(c.registry.connect(account2).removeMarket(c.optionMarket.address)).to.revertedWith(
          'Ownable: caller is not the owner',
        );
      });
      it('should revert if market not exists', async () => {
        await expect(c.registry.removeMarket(c.liquidityPool.address)).to.revertedWith('market not present');
      });
    });
  });
});
