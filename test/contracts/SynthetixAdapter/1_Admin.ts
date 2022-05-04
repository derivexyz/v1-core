import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, upgrades } from 'hardhat';
import { toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { setETHPrice } from '../../utils/contractHelpers';
import { DEFAULT_SECURITY_MODULE } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('Admin', async () => {
  const adapterV2Factory = async (signer?: SignerWithAddress) => {
    return (await ethers.getContractFactory('TestSynthetixAdapterV2')).connect(signer || hre.f.signers[0]);
  };

  beforeEach(seedFixture);

  describe('Initialization', async () => {
    it('reverts if initialized twice', async () => {
      await expect(hre.f.c.synthetixAdapter.initialize()).revertedWith(
        'Initializable: contract is already initialized',
      );
    });
    it('reverts resolver and globals setting if not owner', async () => {
      await expect(hre.f.c.synthetixAdapter.connect(hre.f.alice).setAddressResolver(ZERO_ADDRESS)).revertedWith(
        'OnlyOwner',
      );
      await expect(
        hre.f.c.synthetixAdapter
          .connect(hre.f.alice)
          .setGlobalsForContract(
            ZERO_ADDRESS,
            toBytes32('null'),
            toBytes32('null'),
            DEFAULT_SECURITY_MODULE,
            toBytes32('null'),
          ),
      ).revertedWith('OnlyOwner');
      await expect(
        hre.f.c.synthetixAdapter.setGlobalsForContract(
          ZERO_ADDRESS,
          toBytes32('null'),
          toBytes32('null'),
          ZERO_ADDRESS,
          toBytes32('null'),
        ),
      ).revertedWith('InvalidRewardAddress');
    });
    it('sets address resolver and synthetix addresses', async () => {
      expect(await hre.f.c.synthetixAdapter.synthetix()).to.eq(hre.f.c.snx.synthetix.address);
      expect(await hre.f.c.synthetixAdapter.exchanger()).to.eq(hre.f.c.snx.exchanger.address);
      expect(await hre.f.c.synthetixAdapter.exchangeRates()).to.eq(hre.f.c.snx.exchangeRates.address);
      expect(await hre.f.c.synthetixAdapter.collateralShort()).to.eq(hre.f.c.snx.collateralShort.address);
      expect(await hre.f.c.synthetixAdapter.delegateApprovals()).to.eq(hre.f.c.snx.delegateApprovals.address);
    });
    it('sets globals for market', async () => {
      await hre.f.c.synthetixAdapter.setGlobalsForContract(
        ZERO_ADDRESS,
        toBytes32('sQuote'),
        toBytes32('sBase'),
        hre.f.alice.address,
        toBytes32('testCode'),
      );
      expect(await hre.f.c.synthetixAdapter.quoteKey(ZERO_ADDRESS)).to.eq(toBytes32('sQuote'));
      expect(await hre.f.c.synthetixAdapter.baseKey(ZERO_ADDRESS)).to.eq(toBytes32('sBase'));
      expect(await hre.f.c.synthetixAdapter.rewardAddress(ZERO_ADDRESS)).to.eq(hre.f.alice.address);
      expect(await hre.f.c.synthetixAdapter.trackingCode(ZERO_ADDRESS)).to.eq(toBytes32('testCode'));
    });
  });

  describe('Proxy', async () => {
    it('reverts if upgraded by non proxy owner', async () => {
      await expect(
        upgrades.upgradeProxy(hre.f.c.synthetixAdapter.address, await adapterV2Factory(hre.f.alice)),
      ).revertedWith('Ownable: caller is not the owner');
    });
    it('can upgrade if ownership is transferred', async () => {
      await upgrades.admin.transferProxyAdminOwnership(hre.f.alice.address);
      await upgrades.upgradeProxy(hre.f.c.synthetixAdapter.address, await adapterV2Factory(hre.f.alice));
    });
    it('logic changes when implementation upgraded', async () => {
      await setETHPrice(toBN('1700'));
      await upgrades.upgradeProxy(hre.f.c.synthetixAdapter.address, await adapterV2Factory(hre.f.signers[0]));
      // TestSynthetixAdapterV2 multiplies spot price by 10 in V2 implementation
      expect((await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address)).spotPrice).to.eq(
        toBN('17000'),
      );
    });
  });

  describe('ChangeOwner', () => {
    it('can change owner', async () => {
      await hre.f.c.synthetixAdapter.nominateNewOwner(hre.f.alice.address);
      await hre.f.c.synthetixAdapter.connect(hre.f.alice).acceptOwnership();
      await expect(
        hre.f.c.synthetixAdapter.setGlobalsForContract(
          ZERO_ADDRESS,
          toBytes32('sQuote'),
          toBytes32('sBase'),
          DEFAULT_SECURITY_MODULE,
          toBytes32('testCode'),
        ),
      ).revertedWith('OnlyOwner');

      await hre.f.c.synthetixAdapter
        .connect(hre.f.alice)
        .setGlobalsForContract(
          ZERO_ADDRESS,
          toBytes32('sQuote'),
          toBytes32('sBase'),
          DEFAULT_SECURITY_MODULE,
          toBytes32('testCode'),
        );
    });
  });
});
