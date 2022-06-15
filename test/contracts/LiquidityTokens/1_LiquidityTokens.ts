import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { toBN } from '../../../scripts/util/web3utils';
import { BasicLiquidityCounter, LiquidityToken } from '../../../typechain-types';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';

describe('LiquidityToken', async () => {
  let snap: number;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let liquidityToken: LiquidityToken;
  let liquidityTracker: BasicLiquidityCounter;

  const expectTokenBalance = async (user: string, bal: BigNumberish) => {
    expect(await liquidityToken.balanceOf(user)).eq(bal);
  };

  const expectTrackedBalance = async (user: string, bal: BigNumberish) => {
    expect(await liquidityTracker.userLiquidity(user)).eq(bal);
  };

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();
    liquidityToken = await (await ethers.getContractFactory('LiquidityToken')).connect(deployer).deploy('LPT', 'LPT');
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
      await liquidityToken.init(ethers.constants.AddressZero);
      await expect(liquidityToken.init(ethers.constants.AddressZero)).revertedWith('AlreadyInitialised');
    });

    it('sets liquidityTracker', async () => {
      expect(await liquidityToken.liquidityTracker()).eq(ethers.constants.AddressZero);
      await liquidityToken.setLiquidityTracker(liquidityTracker.address);
      expect(await liquidityToken.liquidityTracker()).eq(liquidityTracker.address);
    });

    it('only callable by Owner', async () => {
      await expect(liquidityToken.connect(alice).setLiquidityTracker(ethers.constants.AddressZero)).to.be.revertedWith(
        'OnlyOwner',
      );
    });
  });

  describe('minting/burning', async () => {
    beforeEach(async () => {
      await liquidityToken.init(deployer.address);
    });
    it('mints and burns without liquidity tracker', async () => {
      await liquidityToken.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('10'));
      await liquidityToken.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('20'));
      await liquidityToken.connect(alice).transfer(bob.address, toBN('7'));
      await expectTokenBalance(alice.address, toBN('13'));
      await expect(liquidityToken.burn(alice.address, toBN('14'))).revertedWith('ERC20: burn amount exceeds balance');
      await liquidityToken.burn(alice.address, toBN('13'));
      await expectTokenBalance(alice.address, 0);
      await expectTokenBalance(bob.address, toBN('7'));
    });

    it('mints/transfers/burns with liquidity tracker', async () => {
      await liquidityToken.setLiquidityTracker(liquidityTracker.address);
      await liquidityTracker.setLiquidityToken(liquidityToken.address);

      await liquidityToken.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('10'));
      await expectTrackedBalance(alice.address, toBN('10'));
      await liquidityToken.mint(alice.address, toBN('10'));
      await expectTokenBalance(alice.address, toBN('20'));
      await expectTrackedBalance(alice.address, toBN('20'));
      await liquidityToken.connect(alice).transfer(bob.address, toBN('7'));
      await expectTokenBalance(alice.address, toBN('13'));
      await expectTrackedBalance(alice.address, toBN('13'));
      await expect(liquidityToken.burn(alice.address, toBN('14'))).revertedWith('ERC20: burn amount exceeds balance');
      await liquidityToken.burn(alice.address, toBN('13'));
      await expectTokenBalance(alice.address, 0);
      await expectTrackedBalance(alice.address, 0);
      await expectTokenBalance(bob.address, toBN('7'));
      await expectTrackedBalance(bob.address, toBN('7'));
    });

    it('can only be called by set liquidity pool', async () => {
      await expect(liquidityToken.connect(alice).mint(alice.address, toBN('10'))).revertedWith('OnlyLiquidityPool');
      await expect(liquidityToken.connect(alice).burn(alice.address, toBN('10'))).revertedWith('OnlyLiquidityPool');
    });
  });
});
