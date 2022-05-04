import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { currentTime, MONTH_SEC, OptionType, toBN, toBytes32 } from '../../../scripts/util/web3utils';
import { OptionMarketAddressesStruct } from '../../../typechain-types/OptionMarketViewer';
import { assertCloseTo } from '../../utils/assert';
import { openPositionWithOverrides } from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE } from '../../utils/defaultParams';
import { addNewMarketSystem, deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { createDefaultBoardWithOverrides, seedNewMarketSystem } from '../../utils/seedTestSystem';
import { expect } from '../../utils/testSetup';

describe('optionMarketViewer tests', async () => {
  let alice: SignerWithAddress;
  let aliceAddr: string;

  let eth: TestSystemContractsType;
  let btc: TestSystemContractsType;
  let link: TestSystemContractsType; // different set of contracts
  let boardId: BigNumberish;

  let listings: BigNumberish[];
  let expiryTime: number;
  let snapshot: number;

  before(async () => {
    [alice] = await ethers.getSigners();
    aliceAddr = await alice.getAddress();

    // deploy all globals and eth market
    eth = await deployTestSystem(alice, true, false); //ETH
    await seedNewMarketSystem(alice, eth);

    // deploy btc
    btc = await addNewMarketSystem(alice, eth, 'sBTC', false, { marketId: '1' });
    await seedNewMarketSystem(alice, btc);

    // deploy link
    link = await addNewMarketSystem(alice, eth, 'sLINK', false, { marketId: '2' });
    await seedNewMarketSystem(alice, link);

    await eth.snx.exchangeRates.setRateAndInvalid(toBytes32('sETH'), DEFAULT_BASE_PRICE, false);

    // await seedTestBalances(alice, eth);
    // await seedTestBalances(alice, btc);
    // await seedTestBalances(alice, link);

    expiryTime = (await currentTime()) + MONTH_SEC;

    await createDefaultBoardWithOverrides(eth, {
      expiresIn: MONTH_SEC,
      baseIV: '1',
      strikePrices: ['1500', '2000', '2500'],
      skews: ['0.9', '1', '1.1'],
    });

    await createDefaultBoardWithOverrides(btc, {
      expiresIn: MONTH_SEC,
      baseIV: '1',
      strikePrices: ['2200', '2400', '2600'],
      skews: ['0.9', '1', '1.1'],
    });

    await createDefaultBoardWithOverrides(link, {
      expiresIn: MONTH_SEC,
      baseIV: '1',
      strikePrices: ['1500', '1600', '1700'],
      skews: ['0.9', '1', '1.1'],
    });
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });
  afterEach(async () => {
    await restoreSnapshot(snapshot);
  });

  describe('check Boards', async () => {
    it('can add multiple listings per board (eth)', async () => {
      const boardListings = await eth.optionMarket.getBoardStrikes((await eth.optionMarket.getLiveBoards())[0]);
      expect(boardListings.length).to.eq(3);
    });

    it('can add multiple listings per board (btc)', async () => {
      const boardListings = await btc.optionMarket.getBoardStrikes((await btc.optionMarket.getLiveBoards())[0]);
      expect(boardListings.length).to.eq(3);
    });

    it('can add multiple listings per board (link)', async () => {
      const boardListings = await link.optionMarket.getBoardStrikes((await link.optionMarket.getLiveBoards())[0]);
      expect(boardListings.length).to.eq(3);
    });
  });

  describe('getMarkets test', async () => {
    it('can get all markets', async () => {
      boardId = (await eth.optionMarket.getLiveBoards())[0];
      listings = await eth.optionMarket.getBoardStrikes(boardId);

      await openPositionWithOverrides(eth, {
        strikeId: listings[0],
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await openPositionWithOverrides(eth, {
        strikeId: listings[0],
        optionType: OptionType.LONG_PUT,
        amount: toBN('1'),
      });

      await openPositionWithOverrides(eth, {
        strikeId: listings[0],
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('1'),
        amount: toBN('1'),
      });

      const marketAddresses = await eth.optionMarketViewer.getMarketAddresses();
      const markets = await Promise.all(
        marketAddresses.map(marketAddress => eth.optionMarketViewer.getMarket(marketAddress.optionMarket)),
      );

      expect(markets[0].marketAddresses.optionMarket).to.eq(eth.optionMarket.address);
      expect(markets[0].isPaused).to.eq(false);
      expect(markets[0].exchangeParams.spotPrice).to.eq(toBN('1742.01337'));
      expect(markets[0].liveBoards[0].market).to.eq(eth.optionMarket.address);
      expect(markets[0].liveBoards[0].expiry).to.within(expiryTime - 10, expiryTime + 10);
      expect(markets[0].liveBoards[0].priceAtExpiry).to.eq(0);
      expect(markets[0].liveBoards[0].isPaused).to.eq(false);
      expect(markets[0].liveBoards[0].strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(markets[0].liveBoards[0].strikes[0].strikeId).to.eq(1);
      expect(markets[0].liveBoards[0].strikes[0].longCallOpenInterest).to.eq(toBN('1'));
      expect(markets[0].liveBoards[0].strikes[0].longPutOpenInterest).to.eq(toBN('1'));
      expect(markets[0].liveBoards[0].strikes[0].shortCallBaseOpenInterest).to.eq(toBN('1'));
      expect(markets[0].liveBoards[0].strikes[0].shortCallQuoteOpenInterest).to.eq(0);
      expect(markets[0].liveBoards[0].strikes[0].shortPutOpenInterest).to.eq(0);

      expect(markets[1].marketAddresses.optionMarket).to.eq(btc.optionMarket.address);
      expect(markets[2].marketAddresses.optionMarket).to.eq(link.optionMarket.address);
    });
  });

  describe('get open position ids', async () => {
    it('returns 3 if there are no positions', async () => {
      const allPositions = await eth.optionMarketViewer.getOwnerPositions(aliceAddr);
      expect(allPositions.length).to.eq(3);
    });

    it('get open position ids for eth market', async () => {
      boardId = (await eth.optionMarket.getLiveBoards())[0];
      listings = await eth.optionMarket.getBoardStrikes(boardId);
      await openPositionWithOverrides(eth, {
        strikeId: listings[1],
        optionType: OptionType.LONG_CALL,
        amount: toBN('0.01'),
      });
      await openPositionWithOverrides(eth, {
        strikeId: listings[1],
        optionType: OptionType.LONG_PUT,
        amount: toBN('0.02'),
      });
      await openPositionWithOverrides(eth, {
        strikeId: listings[1],
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.01'),
        amount: toBN('0.01'),
      });
      const allPositions = await eth.optionMarketViewer.getOwnerPositions(aliceAddr);
      expect(allPositions[0].market).to.eq(eth.optionMarket.address);
      expect(allPositions[0].positions.length).to.eq(3);
    });
  });

  describe('getBoards for markets', async () => {
    it('getBoards for eth market', async () => {
      const secondExpiry = (await currentTime()) + MONTH_SEC;
      await createDefaultBoardWithOverrides(eth, {
        expiresIn: MONTH_SEC,
        baseIV: '1',
        strikePrices: ['1111', '2222', '3333'],
        skews: ['0.9', '1', '1.1'],
      });

      boardId = (await eth.optionMarket.getLiveBoards())[0];
      listings = await eth.optionMarket.getBoardStrikes(boardId);

      await openPositionWithOverrides(eth, {
        strikeId: listings[1],
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });

      await openPositionWithOverrides(eth, {
        strikeId: listings[1],
        optionType: OptionType.LONG_PUT,
        amount: toBN('1'),
      });

      await openPositionWithOverrides(eth, {
        strikeId: listings[1],
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('1'),
        amount: toBN('1'),
      });

      // const strikes = await eth.optionMarketViewer.getStrikes()
      const boards = await eth.optionMarketViewer.getLiveBoards(eth.optionMarket.address);
      expect(boards[0].market).to.eq(eth.optionMarket.address);
      expect(boards[0].boardId).to.eq(1);
      expect(boards[0].expiry).to.eq(expiryTime);
      expect(boards[0].strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(boards[0].strikes[0].skew).to.eq(toBN('0.9'));
      assertCloseTo(boards[0].strikes[0].forceCloseSkew, toBN('0.9'));
      expect(boards[0].strikes[0].strikeId).to.eq(1);
      expect(boards[0].strikes[1].longCallOpenInterest).to.eq(toBN('1'));
      expect(boards[0].strikes[1].longPutOpenInterest).to.eq(toBN('1'));
      expect(boards[0].strikes[1].shortCallBaseOpenInterest).to.eq(toBN('1'));
      expect(boards[0].strikes[1].shortCallQuoteOpenInterest).to.eq(0);
      expect(boards[0].strikes[1].shortPutOpenInterest).to.eq(0);
      expect(boards[0].strikes[1].strikePrice).to.eq(toBN('2000'));
      expect(boards[0].strikes[2].strikePrice).to.eq(toBN('2500'));
      expect(boards[1].market).to.eq(eth.optionMarket.address);
      expect(boards[1].boardId).to.eq(2);
      expect(boards[1].expiry).to.within(secondExpiry - 10, secondExpiry + 10);
      expect(boards[1].strikes[0].strikePrice).to.eq(toBN('1111'));
      expect(boards[1].strikes[1].strikePrice).to.eq(toBN('2222'));
      expect(boards[1].strikes[2].strikePrice).to.eq(toBN('3333'));
    });

    it('getAllboards', async () => {
      const marketAddresses = await eth.optionMarketViewer.getMarketAddresses();
      const markets = await Promise.all(
        marketAddresses.map(marketAddress => eth.optionMarketViewer.getMarket(marketAddress.optionMarket)),
      );

      // eth
      expect(markets[0].liveBoards[0].market).to.eq(eth.optionMarket.address);
      expect(markets[0].liveBoards[0].boardId).to.eq(1);
      expect(markets[0].liveBoards[0].expiry).to.within(expiryTime - 10, expiryTime + 10);
      expect(markets[0].liveBoards[0].strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(markets[0].liveBoards[0].strikes[1].strikePrice).to.eq(toBN('2000'));
      expect(markets[0].liveBoards[0].strikes[2].strikePrice).to.eq(toBN('2500'));

      // btc
      expect(markets[1].liveBoards[0].market).to.eq(btc.optionMarket.address);
      expect(markets[1].liveBoards[0].boardId).to.eq(1);
      expect(markets[1].liveBoards[0].strikes[0].strikePrice).to.eq(toBN('2200'));
      expect(markets[1].liveBoards[0].strikes[1].strikePrice).to.eq(toBN('2400'));
      expect(markets[1].liveBoards[0].strikes[2].strikePrice).to.eq(toBN('2600'));

      // link
      expect(markets[2].liveBoards[0].market).to.eq(link.optionMarket.address);
      expect(markets[2].liveBoards[0].boardId).to.eq(1);
      expect(markets[2].liveBoards[0].strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(markets[2].liveBoards[0].strikes[1].strikePrice).to.eq(toBN('1600'));
      expect(markets[2].liveBoards[0].strikes[2].strikePrice).to.eq(toBN('1700'));
    });
  });
});
