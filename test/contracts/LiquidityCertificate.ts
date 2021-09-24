import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getEventArgs, toBN, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { LiquidityCertificate } from '../../typechain';
import { currentTime, restoreSnapshot, takeSnapshot } from '../utils';
import { expect } from '../utils/testSetup';

describe('LiquidityCertificate - unit tests', () => {
  let deployer: Signer;
  let deployerAddr: string;
  let account2: Signer;
  let account2Addr: string;
  let liquidityCertificate: LiquidityCertificate;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    account2 = signers[1];
    account2Addr = await account2.getAddress();

    liquidityCertificate = (await (await ethers.getContractFactory('LiquidityCertificate'))
      .connect(deployer)
      .deploy('USD/ETH Pool Certificate', 'UEP')) as LiquidityCertificate;
    await liquidityCertificate.init(deployerAddr);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('Can only be initialized once', async () => {
      await expect(liquidityCertificate.init(account2Addr)).revertedWith('already initialized');
    });

    it('Cannot be initialized with 0 address', async () => {
      const testCert = (await (await ethers.getContractFactory('LiquidityCertificate'))
        .connect(deployer)
        .deploy('USD/ETH Pool Certificate', 'UEP')) as LiquidityCertificate;
      await expect(testCert.init(ZERO_ADDRESS)).revertedWith('liquidityPool cannot be 0 address');
    });
  });

  describe('certificates', async () => {
    it('Returns no certificates if owner has none', async () => {
      const certificates = await liquidityCertificate.certificates(account2Addr);
      expect(certificates).has.length(0);
    });
    it('Returns a list of certificates for the owner', async () => {
      const tx1 = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      const tx2 = await liquidityCertificate.mint(account2Addr, toBN('20'), 0);
      const tx3 = await liquidityCertificate.mint(account2Addr, toBN('30'), 0);

      const certificateId1 = getEventArgs(await tx1.wait(), 'Transfer').tokenId;
      const certificateId2 = getEventArgs(await tx2.wait(), 'Transfer').tokenId;
      const certificateId3 = getEventArgs(await tx3.wait(), 'Transfer').tokenId;

      const certificates = await liquidityCertificate.certificates(account2Addr);
      expect(certificates).has.length(3);
      expect(certificates[0]).to.eq(certificateId1);
      expect(certificates[1]).to.eq(certificateId2);
      expect(certificates[2]).to.eq(certificateId3);
    });
  });

  describe('views', async () => {
    let certificateId1: BigNumber;
    beforeEach(async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      certificateId1 = getEventArgs(await tx.wait(), 'Transfer').tokenId;
    });
    it('can view certificate data', async () => {
      const certificate = await liquidityCertificate.certificateData(certificateId1);
      expect(await liquidityCertificate.liquidity(certificateId1)).to.equal(certificate.liquidity);
      expect(await liquidityCertificate.burnableAt(certificateId1)).to.equal(certificate.burnableAt);
      expect(await liquidityCertificate.enteredAt(certificateId1)).to.equal(certificate.enteredAt);
    });
  });

  describe('mint', async () => {
    it('only liquidityPool can mint', async () => {
      await expect(liquidityCertificate.connect(account2).mint(account2Addr, toBN('0'), toBN('1'))).to.revertedWith(
        'only LiquidityPool',
      );
    });
    it('mints correctly if liquidity > min liquidity', async () => {
      await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      expect(await liquidityCertificate.balanceOf(account2Addr)).to.equal(1);
    });
    it('mints correctly if liquidity == min liquidity', async () => {
      await liquidityCertificate.mint(account2Addr, toBN('1'), 0);
      expect(await liquidityCertificate.balanceOf(account2Addr)).to.equal(1);
    });
    it('reverts if liquidity < min liquidity', async () => {
      await expect(liquidityCertificate.mint(account2Addr, toBN('0.99'), 0)).to.revertedWith(
        'liquidity value of certificate must be >= 1',
      );
    });
    it("Adds minted token to owner's listed certificates", async () => {
      const certificatesBefore = await liquidityCertificate.certificates(account2Addr);
      expect(certificatesBefore).has.length(0);

      await liquidityCertificate.mint(account2Addr, toBN('10'), 0);

      const certificates = await liquidityCertificate.certificates(account2Addr);
      expect(certificates).has.length(1);
    });
  });

  describe('setBurnableAt', async () => {
    it('only liquidityPool can setBurnableAt', async () => {
      await expect(
        liquidityCertificate.connect(account2).setBurnableAt(account2Addr, toBN('0'), toBN('1')),
      ).to.revertedWith('only LiquidityPool');
    });
    it('cannot setBurnable at if the owner is mismatched', async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      const certId = getEventArgs(await tx.wait(), 'Transfer').tokenId;
      await expect(liquidityCertificate.setBurnableAt(deployerAddr, certId, 1234)).to.revertedWith(
        'certificate does not exist or not owner',
      );
    });
    it('correctly sets burnableAt', async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      const certId = getEventArgs(await tx.wait(), 'Transfer').tokenId;

      const blockTimestamp = await currentTime();
      await liquidityCertificate.setBurnableAt(account2Addr, certId, blockTimestamp);

      expect(await liquidityCertificate.burnableAt(certId)).to.equal(blockTimestamp);
    });
    it('can set burnableAt to 0', async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      const certId = getEventArgs(await tx.wait(), 'Transfer').tokenId;

      const blockTimestamp = 0;
      await liquidityCertificate.setBurnableAt(account2Addr, certId, blockTimestamp);

      expect(await liquidityCertificate.burnableAt(certId)).to.equal(blockTimestamp);
    });
    it('can set burnableAt to a time in the past', async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      const certId = getEventArgs(await tx.wait(), 'Transfer').tokenId;

      const currentBlockTimestamp = await currentTime();
      const pastBurnableAt = currentBlockTimestamp - 1;
      await liquidityCertificate.setBurnableAt(account2Addr, certId, pastBurnableAt);

      expect(await liquidityCertificate.burnableAt(certId)).to.equal(pastBurnableAt);
    });
  });

  describe('burn', async () => {
    it('only liquidity pool can burn', async () => {
      await expect(liquidityCertificate.connect(account2).burn(account2Addr, toBN('1'))).to.revertedWith(
        'only LiquidityPool',
      );
    });
    it('cannot burn if incorrect owner', async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      const certId = getEventArgs(await tx.wait(), 'Transfer').tokenId;
      await expect(liquidityCertificate.burn(deployerAddr, certId)).to.revertedWith(
        'attempted to burn nonexistent certificate, or not owner',
      );
    });
  });

  describe('split', async () => {
    let certificateId1: BigNumber;
    beforeEach(async () => {
      const tx = await liquidityCertificate.mint(account2Addr, toBN('10'), 0);
      certificateId1 = getEventArgs(await tx.wait(), 'Transfer').tokenId;
    });

    it('can split certificate evenly', async () => {
      const certificate = await liquidityCertificate.certificateData(certificateId1);
      await liquidityCertificate.connect(account2).split(certificateId1, toBN('0.5'));
      const certificateId2 = (await liquidityCertificate.certificates(account2Addr))[1];
      const splitCertificate1 = await liquidityCertificate.certificateData(certificateId1);
      const splitCertificate2 = await liquidityCertificate.certificateData(certificateId2);
      // burnable at and entered at should be the same as before the split
      expect(splitCertificate1.burnableAt).to.equal(certificate.burnableAt);
      expect(splitCertificate2.burnableAt).to.equal(certificate.burnableAt);
      expect(splitCertificate1.enteredAt).to.equal(certificate.enteredAt);
      expect(splitCertificate2.enteredAt).to.equal(certificate.enteredAt);
      // liquidity should be split at 50% each
      expect(splitCertificate1.liquidity).to.equal(certificate.liquidity.div('2'));
      expect(splitCertificate2.liquidity).to.equal(certificate.liquidity.div('2'));
    });

    it('cannot split if either portion will end up with liquidity < 1', async () => {
      await expect(liquidityCertificate.connect(account2).split(certificateId1, toBN('0.09'))).revertedWith(
        'liquidity value of both certificates must be >= 1',
      );
      await expect(liquidityCertificate.connect(account2).split(certificateId1, toBN('0.91'))).revertedWith(
        'liquidity value of both certificates must be >= 1',
      );
    });

    it('cannot split certificates that are not owned by caller, even if the caller is the LP', async () => {
      await expect(liquidityCertificate.connect(deployer).split(certificateId1, toBN('0.5'))).to.be.revertedWith(
        'only the owner can split their certificate',
      );
    });

    it('cannot split with more than 100%', async () => {
      await expect(liquidityCertificate.split(certificateId1, toBN('100'))).revertedWith(
        'split must be less than 100%',
      );
      await expect(liquidityCertificate.split(certificateId1, toBN('1'))).revertedWith('split must be less than 100%');
    });
  });
});
