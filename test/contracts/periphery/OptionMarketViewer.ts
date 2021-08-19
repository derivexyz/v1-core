import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getEventArgs, toBN, TradeType } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage, restoreSnapshot, takeSnapshot } from '../../utils';
import { deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { expect } from '../../utils/testSetup';

describe('OptionMarketViewer', () => {
  let account: Signer;
  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];

    c = await deployTestSystem(account);
    await seedTestSystem(account, c);

    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();

    boardId = (await c.optionMarket.getLiveBoards())[0];
    listingIds = await c.optionMarket.getBoardListings(boardId);
  });

  //Assumptions 1500, 2000, 2500, stock 1742, vol 100, skews 0.9/1/1.1,
  describe('get premium for trade', async () => {
    it('should work out the premium correctly for opening long call', async () => {
      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.LONG_CALL,
        true,
        toBN('100'),
      );
      const receipt = await (await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('100'))).wait();
      const event = getEventArgs(receipt, 'PositionOpened');
      // Use closeTo as the block.timestamp affects the result
      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('39704.56928'));
    });

    it('should work out the premium correctly for opening long put', async () => {
      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.LONG_PUT,
        true,
        toBN('100'),
      );
      const receipt = await (await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('100'))).wait();
      const event = getEventArgs(receipt, 'PositionOpened');

      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('14129.55419'));
    });

    it('should work out the premium correctly for opening short call', async () => {
      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.SHORT_CALL,
        false,
        toBN('100'),
      );
      const receipt = await (
        await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('100'))
      ).wait();
      const event = getEventArgs(receipt, 'PositionOpened');

      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('25650.18097'));
    });

    it('should work out the premium correctly for opening short put', async () => {
      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.SHORT_PUT,
        false,
        toBN('100'),
      );
      const receipt = await (await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('100'))).wait();
      const event = getEventArgs(receipt, 'PositionOpened');

      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('567.8496522'));
    });

    it('should work out the premium correctly for closing long call', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('100'));

      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.LONG_CALL,
        false,
        toBN('100'),
      );
      const receipt = await (
        await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('100'))
      ).wait();
      const event = getEventArgs(receipt, 'PositionClosed');

      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('29697.27118'));
    });

    it('should work out the premium correctly for closing long put', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('100'));

      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.LONG_PUT,
        false,
        toBN('100'),
      );
      const receipt = await (await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('100'))).wait();
      const event = getEventArgs(receipt, 'PositionClosed');

      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('4604.451396'));
    });

    it('should work out the premium correctly for closing short call', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('100'));

      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.SHORT_CALL,
        true,
        toBN('100'),
      );
      const receipt = await (
        await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('100'))
      ).wait();
      const event = getEventArgs(receipt, 'PositionClosed');

      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('33816.43498'));
    });

    it('should work out the premium correctly for closing short put', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('100'));

      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[0],
        TradeType.SHORT_PUT,
        true,
        toBN('100'),
      );
      const receipt = await (
        await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('100'))
      ).wait();
      const event = getEventArgs(receipt, 'PositionClosed');
      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('8216.689546'));
    });
    it('it should work for OTM options', async () => {
      const viewerResult = await c.optionMarketViewer.getPremiumForTrade(
        listingIds[2],
        TradeType.LONG_CALL,
        true,
        toBN('100'),
      );
      const receipt = await (await c.optionMarket.openPosition(listingIds[2], TradeType.LONG_CALL, toBN('100'))).wait();
      const event = getEventArgs(receipt, 'PositionOpened');
      // Use closeTo as the block.timestamp affects the result
      assertCloseTo(viewerResult.premium, event.totalCost);
      assertCloseToPercentage(event.totalCost, toBN('11617.84553'));
    });

    it('should work for two trades in the same direction', async () => {
      await c.optionMarket.openPosition(listingIds[2], TradeType.LONG_CALL, toBN('50'));
      const tx = await c.optionMarket.openPosition(listingIds[2], TradeType.LONG_CALL, toBN('50'));
      const event = getEventArgs(await tx.wait(), 'PositionOpened');
      assertCloseToPercentage(event.totalCost, toBN('5810.29207'));
    });

    it('should work for three trades in the same direction', async () => {
      await c.optionMarket.openPosition(listingIds[2], TradeType.LONG_CALL, toBN('50'));
      await c.optionMarket.openPosition(listingIds[2], TradeType.LONG_CALL, toBN('50'));
      const tx = await c.optionMarket.openPosition(listingIds[2], TradeType.LONG_CALL, toBN('50'));
      const event = getEventArgs(await tx.wait(), 'PositionOpened');
      assertCloseToPercentage(event.totalCost, toBN('7826.34999'));
    });
  });

  describe('getListingViewAndBalance', async () => {
    it('Returns the user balance for longs', async () => {
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('10'));
      await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('20'));
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('30'));
      await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('40'));

      const x = await c.optionMarketViewer.getListingViewAndBalance(listingIds[0], await account.getAddress());
      expect(x.longCallAmt).eq(toBN('10'));
      expect(x.longPutAmt).eq(toBN('20'));
      expect(x.shortCallAmt).eq(toBN('30'));
      expect(x.shortPutAmt).eq(toBN('40'));
    });
  });
});
