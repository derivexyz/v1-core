import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getEventArgs, toBN, TradeType, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { restoreSnapshot, takeSnapshot } from '../utils';
import { deployTestContracts, TestSystemContractsType } from '../utils/deployTestSystem';
import { expect } from '../utils/testSetup';

describe('ShortCollateral - unit tests', async () => {
  let deployer: Signer;
  let deployerAddr: string;
  let account: Signer;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    account = signers[1];
    // accountAddr = await account.getAddress();

    c = await deployTestContracts(deployer);
    await c.shortCollateral.init(
      deployerAddr,
      c.liquidityPool.address,
      c.test.quoteToken.address,
      c.test.baseToken.address,
    );
    await c.test.quoteToken.mint(c.shortCollateral.address, toBN('100'));
    await c.test.baseToken.mint(c.shortCollateral.address, toBN('1'));
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('should not allow init twice', async () => {
      await expect(c.shortCollateral.init(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)).revertedWith(
        'contract already initialized',
      );
    });
  });

  describe('sendQuoteCollateral', async () => {
    it('sends balance is amount > balance', async () => {
      const tx = await c.shortCollateral.sendQuoteCollateral(deployerAddr, toBN('110'));
      expect(getEventArgs(await tx.wait(), 'QuoteSent').amount).eq(toBN('100'));
    });
    it('reverts if transfer fails', async () => {
      await c.test.quoteToken.setForceFail(true);
      await expect(c.shortCollateral.sendQuoteCollateral(deployerAddr, toBN('100'))).revertedWith('transfer failed');
    });
  });

  describe('sendBaseCollateral', async () => {
    it('sends balance is amount > balance', async () => {
      const tx = await c.shortCollateral.sendBaseCollateral(deployerAddr, toBN('1.1'));
      expect(getEventArgs(await tx.wait(), 'BaseSent').amount).eq(toBN('1'));
    });
    it('reverts if transfer fails', async () => {
      await c.test.baseToken.setForceFail(true);
      await expect(c.shortCollateral.sendBaseCollateral(deployerAddr, toBN('1'))).revertedWith('transfer failed');
    });
  });

  describe('sendToLP', async () => {
    it('sends balance is amount > balance', async () => {
      const tx = await c.shortCollateral.sendToLP(toBN('1.1'), toBN('110'));
      expect(getEventArgs(await tx.wait(), 'BaseSent').amount).eq(toBN('1'));
      expect(getEventArgs(await tx.wait(), 'QuoteSent').amount).eq(toBN('100'));
    });
    it('reverts if quote transfer fails', async () => {
      await c.test.quoteToken.setForceFail(true);
      await expect(c.shortCollateral.sendToLP(toBN('1.1'), toBN('110'))).revertedWith('quote transfer failed');
    });
    it('reverts if base transfer fails', async () => {
      await c.test.baseToken.setForceFail(true);
      await expect(c.shortCollateral.sendToLP(toBN('1.1'), toBN('110'))).revertedWith('base transfer failed');
    });
  });

  describe('processSettle', async () => {
    it('can only be called by market', async () => {
      await expect(
        c.shortCollateral
          .connect(account)
          .processSettle(1, deployerAddr, 0, toBN('1'), toBN('1'), toBN('1'), toBN('1')),
      ).revertedWith('only OptionMarket');
    });
    it('cannot settle 0 amount', async () => {
      await expect(
        c.shortCollateral.processSettle(1, deployerAddr, 0, 0, toBN('1'), toBN('1'), toBN('1')),
      ).revertedWith('option position is 0');
    });

    it('reverts if base transfer fails for short call', async () => {
      await c.test.baseToken.setForceFail(true);
      await expect(
        c.shortCollateral.processSettle(
          1,
          deployerAddr,
          TradeType.SHORT_CALL,
          toBN('1'),
          toBN('1'),
          toBN('1'),
          toBN('1'),
        ),
      ).revertedWith('base transfer failed');
    });

    it('reverts if quote transfer fails for short put', async () => {
      await c.test.quoteToken.setForceFail(true);
      await expect(
        c.shortCollateral.processSettle(
          1,
          deployerAddr,
          TradeType.SHORT_PUT,
          toBN('1'),
          toBN('1'),
          toBN('1'),
          toBN('1'),
        ),
      ).revertedWith('quote transfer failed');
    });
  });
});
