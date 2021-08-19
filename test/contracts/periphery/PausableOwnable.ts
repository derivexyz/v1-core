import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { TestPausableOwnable } from '../../../typechain';
import { expect } from '../../utils/testSetup';

describe('Owned', () => {
  let pausableOwnable: TestPausableOwnable;
  let account1: Signer;
  let account2: Signer;

  before(async () => {
    [account1, account2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const ownedFactory = await ethers.getContractFactory('TestPausableOwnable');
    pausableOwnable = (await ownedFactory.connect(account1).deploy()) as any;
  });

  describe('constructor', async () => {
    it('should set owner', async () => {
      const owner = await pausableOwnable.connect(account1).owner();
      expect(owner).to.eq(await account1.getAddress());
    });
  });

  describe('nominating and accepting new owner', async () => {
    it('should transfer ownership when invoked by current contract owner', async () => {
      const nominatedOwner = await account2.getAddress();

      await pausableOwnable.connect(account1).transferOwnership(nominatedOwner);

      expect(await pausableOwnable.owner()).to.equal(nominatedOwner);
    });
  });

  describe('pausing the contract', async () => {
    it('owner should be able to pause the contract', async () => {
      await pausableOwnable.connect(account1).setPaused();

      expect(await pausableOwnable.paused()).to.equal(true);
    });

    it('once the contract is paused, the function should not be callable', async () => {
      await pausableOwnable.connect(account1).setPaused();
      await expect(pausableOwnable.connect(account1).setPaused()).revertedWith('Pausable: paused');
    });
  });
});
