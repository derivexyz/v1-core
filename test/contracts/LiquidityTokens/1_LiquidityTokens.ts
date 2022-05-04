import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { toBN } from '../../../scripts/util/web3utils';
import { BasicLiquidityCounter, LiquidityTokens } from '../../../typechain-types';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';

describe('LiquidityTokens', async () => {
  let snap: number;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let liquidityTokens: LiquidityTokens;
  let liquidityTracker: BasicLiquidityCounter;

  const expectTokenBalance = async (user: string, bal: BigNumberish) => {
    expect(await liquidityTokens.balanceOf(user)).eq(bal);
  };

  const expectTrackedBalance = async (user: string, bal: BigNumberish) => {
    expect(await liquidityTracker.userLiquidity(user)).eq(bal);
  };

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();
    liquidityTokens = await (await ethers.getContractFactory('LiquidityTokens')).connect(deployer).deploy('LPT', 'LPT');
    liquidityTracker = await (await ethers.getContractFactory('BasicLiquidityCounter')).connect(deployer).deploy();
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });
  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('Initialization', async () => {
    it('cannot init twice', async () => {
      await liquidityTokens.init(ethers.constants.AddressZero);
      await expect(liquidityTokens.init(ethers.constants.AddressZero)).revertedWith('AlreadyInitialised');
    });

    it('sets liquidityTracker', async () => {
      expect(await liquidityTokens.liquidityTracker()).eq(ethers.constants.AddressZero);
      await liquidityTokens.setLiquidityTracker(liquidityTracker.address);
      expect(await liquidityTokens.liquidityTracker()).eq(liquidityTracker.address);
    });

    it('only callable by Owner', async () => {
      await expect(liquidityTokens.connect(alice).setLiquidityTracker(ethers.constants.AddressZero)).to.be.revertedWith(
        'OnlyOwner',
      );
    });
  });

  describe('minting/burning', async () => {
    beforeEach(async () => {
      await liquidityTokens.init(deployer.address);
    });
    it('mints and burns without liquidity tracker', async () => {
      await liquidityTokens.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('10'));
      await liquidityTokens.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('20'));
      await liquidityTokens.connect(alice).transfer(bob.address, toBN('7'));
      await expectTokenBalance(alice.address, toBN('13'));
      await expect(liquidityTokens.burn(alice.address, toBN('14'))).revertedWith('ERC20: burn amount exceeds balance');
      await liquidityTokens.burn(alice.address, toBN('13'));
      await expectTokenBalance(alice.address, 0);
      await expectTokenBalance(bob.address, toBN('7'));
    });

    it('mints/transfers/burns with liquidity tracker', async () => {
      await liquidityTokens.setLiquidityTracker(liquidityTracker.address);
      await liquidityTracker.setLiquidityToken(liquidityTokens.address);

      await liquidityTokens.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('10'));
      await expectTrackedBalance(alice.address, toBN('10'));
      await liquidityTokens.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('20'));
      await expectTrackedBalance(alice.address, toBN('20'));
      await liquidityTokens.connect(alice).transfer(bob.address, toBN('7'));
      await expectTokenBalance(alice.address, toBN('13'));
      await expectTrackedBalance(alice.address, toBN('13'));
      await expect(liquidityTokens.burn(alice.address, toBN('14'))).revertedWith('ERC20: burn amount exceeds balance');
      await liquidityTokens.burn(alice.address, toBN('13'));
      await expectTokenBalance(alice.address, 0);
      await expectTrackedBalance(alice.address, 0);
      await expectTokenBalance(bob.address, toBN('7'));
      await expectTrackedBalance(bob.address, toBN('7'));
    });

    it('can only be called by set liquidity pool', async () => {
      await expect(liquidityTokens.connect(alice).mint(alice.address, toBN('10'))).revertedWith('OnlyLiquidityPool');
      await expect(liquidityTokens.connect(alice).burn(alice.address, toBN('10'))).revertedWith('OnlyLiquidityPool');
    });
  });
});
