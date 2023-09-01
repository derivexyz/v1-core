import { ethers } from 'hardhat';
import { toBN, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { hre, expect } from '../../utils/testSetup';

describe('Admin Settings', async () => {
  let optionMarket: string;
  let random: string;

  before('Deploy snx networks & Seed', async () => {
    // get random address
    random = await (await ethers.getSigners())[0].getAddress();

    await deployFixturePerpsAdapter();
    optionMarket = hre.f.c.optionMarket.address;
  });
  describe('Checking view functions', async () => {
    it('getting adapter state', async () => {
      const state = await hre.f.c.synthetixPerpV2Adapter.getAdapterState(hre.f.c.optionMarket.address);
      expect(state.snxPrice).to.be.equal(await hre.f.c.synthetixPerpV2Adapter.getSettlementPriceForMarket(optionMarket, 0));
      expect(state.riskFreeRate).to.be.equal(await hre.f.c.synthetixPerpV2Adapter.rateAndCarry(hre.f.c.optionMarket.address));
      expect(state.config).to.deep.equal(await hre.f.c.synthetixPerpV2Adapter.marketConfigurations(hre.f.c.optionMarket.address));
    });
  });
  describe('setRiskFreeRate', async () => {
    it('reverts if not owner', async () => {
      await expect(hre.f.c.synthetixPerpV2Adapter.connect(hre.f.alice).setRiskFreeRate(ZERO_ADDRESS, 0)).revertedWith(
        'OnlyOwner',
      );
    });
    it('reverts if invalid rate is set', async () => {
      await expect(
        hre.f.c.synthetixPerpV2Adapter.connect(hre.f.deployer).setRiskFreeRate(ZERO_ADDRESS, toBN('50.1')),
      ).revertedWith('InvalidRiskFreeRate');

      await expect(
        hre.f.c.synthetixPerpV2Adapter.connect(hre.f.deployer).setRiskFreeRate(ZERO_ADDRESS, toBN('-50.1')),
      ).revertedWith('InvalidRiskFreeRate');
    });
    it('owner can set risk free rate', async () => {
      await hre.f.c.synthetixPerpV2Adapter
        .connect(hre.f.deployer)
        .setRiskFreeRate(hre.f.c.optionMarket.address, toBN('50'));
      expect((await hre.f.c.synthetixPerpV2Adapter.rateAndCarry(optionMarket)).eq(toBN('50'))).to.be.true;
    });
  });
  describe('setMarketAdapterConfiguration', async () => {
    it('reverts if not owner', async () => {
      await expect(
        hre.f.c.synthetixPerpV2Adapter
          .connect(hre.f.alice)
          .setMarketAdapterConfiguration(ZERO_ADDRESS, 0, ZERO_ADDRESS, ZERO_ADDRESS, 0),
      ).revertedWith('OnlyOwner');
    });
    it('owner can set adapter configurations', async () => {
      await hre.f.c.synthetixPerpV2Adapter.connect(hre.f.deployer).setMarketAdapterConfiguration(
        optionMarket, // _optionMarket
        toBN('0.05'), // _staticEstimationDiscount: 5%
        hre.f.c.snx.addressResolver.address, // _snxPerpV2MarketAddress // todo: update
        random, //_uniswapPool // todo: update
        3000, // _uniswapFeeTier: 0.3%
      );

      const config = await hre.f.c.synthetixPerpV2Adapter.marketConfigurations(optionMarket);
      expect(config.staticEstimationDiscount.eq(toBN('0.05'))).to.be.true;
      expect(config.snxPerpV2MarketAddress).to.be.equal(hre.f.c.snx.addressResolver.address);
      expect(config.uniswapInfo.pool).to.be.equal(random);
      expect(config.uniswapInfo.feeTier).to.be.equal(3000);
    });
    it('cannot set invalid configuration', async () => {
      await expect(
        hre.f.c.synthetixPerpV2Adapter.connect(hre.f.deployer).setMarketAdapterConfiguration(
          optionMarket,
          toBN('0.3'), // _staticEstimationDiscount: 30% -> invalid
          hre.f.c.snx.addressResolver.address, // _snxPerpV2MarketAddress // todo: update
          random, //_uniswapPool // todo: update
          3000
        ),
      ).revertedWith('InvalidStaticEstimationDiscount');
    });
  });
});
