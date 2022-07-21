import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { currentTime, MONTH_SEC, OptionType, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import { openPositionWithOverrides } from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE } from '../../utils/defaultParams';
import { addNewMarketSystem, deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { fastForward, restoreSnapshot, takeSnapshot } from '../../utils/evm';
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

    it('get MarketViews', async () => {
      const markets = await eth.optionMarketViewer.getMarkets([eth.optionMarket.address, btc.optionMarket.address]);

      expect(markets.isPaused).to.eq(false);
      expect(markets.markets[0].marketAddresses.liquidityPool).to.eq(eth.liquidityPool.address);
      expect(markets.markets[0].marketAddresses.liquidityToken).to.eq(eth.liquidityToken.address);
      expect(markets.markets[0].marketAddresses.greekCache).to.eq(eth.optionGreekCache.address);
      expect(markets.markets[0].marketAddresses.optionMarket).to.eq(eth.optionMarket.address);
      expect(markets.markets[0].marketAddresses.optionMarketPricer).to.eq(eth.optionMarketPricer.address);
      expect(markets.markets[0].marketAddresses.optionToken).to.eq(eth.optionToken.address);
      expect(markets.markets[0].marketAddresses.shortCollateral).to.eq(eth.shortCollateral.address);

      expect(markets.markets[1].marketAddresses.liquidityPool).to.eq(btc.liquidityPool.address);
      expect(markets.markets[1].marketAddresses.liquidityToken).to.eq(btc.liquidityToken.address);
      expect(markets.markets[1].marketAddresses.greekCache).to.eq(btc.optionGreekCache.address);
      expect(markets.markets[1].marketAddresses.optionMarket).to.eq(btc.optionMarket.address);
      expect(markets.markets[1].marketAddresses.optionMarketPricer).to.eq(btc.optionMarketPricer.address);
      expect(markets.markets[1].marketAddresses.optionToken).to.eq(btc.optionToken.address);
      expect(markets.markets[1].marketAddresses.shortCollateral).to.eq(btc.shortCollateral.address);
    });
    it('get MarketViews paused', async () => {
      await eth.synthetixAdapter.setGlobalPaused(true);
      const markets = await eth.optionMarketViewer.getMarkets([eth.optionMarket.address, btc.optionMarket.address]);

      expect(markets.isPaused).to.eq(true);
      expect(markets.markets[0].marketAddresses.liquidityPool).to.eq(eth.liquidityPool.address);
      expect(markets.markets[0].marketAddresses.liquidityToken).to.eq(eth.liquidityToken.address);
      expect(markets.markets[0].marketAddresses.greekCache).to.eq(eth.optionGreekCache.address);
      expect(markets.markets[0].marketAddresses.optionMarket).to.eq(eth.optionMarket.address);
      expect(markets.markets[0].marketAddresses.optionMarketPricer).to.eq(eth.optionMarketPricer.address);
      expect(markets.markets[0].marketAddresses.optionToken).to.eq(eth.optionToken.address);
      expect(markets.markets[0].marketAddresses.shortCollateral).to.eq(eth.shortCollateral.address);

      expect(markets.markets[1].marketAddresses.liquidityPool).to.eq(btc.liquidityPool.address);
      expect(markets.markets[1].marketAddresses.liquidityToken).to.eq(btc.liquidityToken.address);
      expect(markets.markets[1].marketAddresses.greekCache).to.eq(btc.optionGreekCache.address);
      expect(markets.markets[1].marketAddresses.optionMarket).to.eq(btc.optionMarket.address);
      expect(markets.markets[1].marketAddresses.optionMarketPricer).to.eq(btc.optionMarketPricer.address);
      expect(markets.markets[1].marketAddresses.optionToken).to.eq(btc.optionToken.address);
      expect(markets.markets[1].marketAddresses.shortCollateral).to.eq(btc.shortCollateral.address);
    });

    it('get market with baseKey', async () => {
      const ethbasekey = await eth.synthetixAdapter.baseKey(eth.optionMarket.address);
      const market = await eth.optionMarketViewer.getMarketForBaseKey(ethbasekey);
      expect(market.marketAddresses.optionMarket).to.eq(eth.optionMarket.address);
      expect(market.isPaused).to.eq(false);
      expect(market.exchangeParams.spotPrice).to.eq(toBN('1742.01337'));
      expect(market.liveBoards[0].market).to.eq(eth.optionMarket.address);
      expect(market.liveBoards[0].expiry).to.within(expiryTime - 10, expiryTime + 10);
      expect(market.liveBoards[0].priceAtExpiry).to.eq(0);
      expect(market.liveBoards[0].isPaused).to.eq(false);
      expect(market.liveBoards[0].strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(market.liveBoards[0].strikes[0].strikeId).to.eq(1);
      expect(market.liveBoards[0].strikes[0].longCallOpenInterest).to.eq(0);
      expect(market.liveBoards[0].strikes[0].longPutOpenInterest).to.eq(0);
      expect(market.liveBoards[0].strikes[0].shortCallBaseOpenInterest).to.eq(0);
      expect(market.liveBoards[0].strikes[0].shortCallQuoteOpenInterest).to.eq(0);
      expect(market.liveBoards[0].strikes[0].shortPutOpenInterest).to.eq(0);
    });

    it('revert if no market with baseKey', async () => {
      const badBasekey = await eth.synthetixAdapter.baseKey(eth.liquidityPool.address);
      await expect(eth.optionMarketViewer.getMarketForBaseKey(badBasekey)).to.be.revertedWith('No market for base key');
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

    it('positions in range', async () => {
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
      const positions = await eth.optionMarketViewer.getOwnerPositionsInRange(
        eth.optionMarket.address,
        aliceAddr,
        0,
        2,
      );
      expect(positions[0].optionType).to.eq(OptionType.LONG_CALL);
      expect(positions[0].amount).to.eq(toBN('0.01'));
      expect(positions[1].optionType).to.eq(OptionType.LONG_PUT);
      expect(positions[1].amount).to.eq(toBN('0.02'));
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

    it('get board with boardId', async () => {
      let ethBoard = await eth.optionMarketViewer.getBoard(eth.optionMarket.address, 1);
      const btcBoard = await eth.optionMarketViewer.getBoard(btc.optionMarket.address, 1);
      expect(ethBoard.boardId).to.eq(1);
      expect(ethBoard.market).to.eq(eth.optionMarket.address);
      expect(btcBoard.boardId).to.eq(1);
      expect(btcBoard.market).to.eq(btc.optionMarket.address);

      await expect(eth.optionMarketViewer.getBoard(eth.optionMarket.address, 2)).to.be.revertedWith(
        'reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)',
      );
      await expect(eth.optionMarketViewer.getBoard(eth.liquidityPool.address, 2)).to.be.revertedWith(
        'Transaction reverted: function call to a non-contract account',
      );

      expect(ethBoard.forceCloseGwavIV).not.eq(0);
      await fastForward(MONTH_SEC);
      await eth.optionMarket.settleExpiredBoard(1);
      ethBoard = await eth.optionMarketViewer.getBoard(eth.optionMarket.address, 1);
      expect(ethBoard.forceCloseGwavIV).eq(0);
    });

    it('get board with baseKey', async () => {
      const ethbasekey = await eth.synthetixAdapter.baseKey(eth.optionMarket.address);
      const btcbasekey = await eth.synthetixAdapter.baseKey(btc.optionMarket.address);

      const ethBoard = await eth.optionMarketViewer.getBoardForBaseKey(ethbasekey, 1);
      const btcBoard = await eth.optionMarketViewer.getBoardForBaseKey(btcbasekey, 1);
      expect(ethBoard.boardId).to.eq(1);
      expect(ethBoard.market).to.eq(eth.optionMarket.address);
      expect(btcBoard.boardId).to.eq(1);
      expect(btcBoard.market).to.eq(btc.optionMarket.address);

      await expect(eth.optionMarketViewer.getBoardForBaseKey(ethbasekey, 2)).to.be.revertedWith(
        'reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)',
      );
    });

    it('get board with strikeId', async () => {
      const ethBoard = await eth.optionMarketViewer.getBoardForStrikeId(eth.optionMarket.address, 1);
      const btcBoard = await eth.optionMarketViewer.getBoardForStrikeId(btc.optionMarket.address, 1);
      expect(ethBoard.boardId).to.eq(1);
      expect(ethBoard.market).to.eq(eth.optionMarket.address);
      expect(btcBoard.boardId).to.eq(1);
      expect(btcBoard.market).to.eq(btc.optionMarket.address);

      await expect(eth.optionMarketViewer.getBoardForStrikeId(eth.optionMarket.address, 0)).to.be.revertedWith(
        'reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)',
      );
      await expect(eth.optionMarketViewer.getBoardForStrikeId(eth.liquidityPool.address, 0)).to.be.revertedWith(
        'Transaction reverted: function call to a non-contract account',
      );
    });
  });

  describe('balance and allowance', async () => {
    it('liquidity pool', async () => {
      const res = await eth.optionMarketViewer.getLiquidityBalancesAndAllowances(
        [eth.optionMarket.address, btc.optionMarket.address],
        aliceAddr,
      );
      expect(res[0].token).to.eq(eth.liquidityPool.address);
      expect(res[0].balance).to.eq(toBN('500000'));
      expect(res[0].allowance).to.eq(await eth.snx.quoteAsset.allowance(aliceAddr, eth.liquidityPool.address));
      expect(res[1].token).to.eq(btc.liquidityPool.address);
      expect(res[1].balance).to.eq(toBN('500000'));
      expect(res[1].allowance).to.eq(await btc.snx.quoteAsset.allowance(aliceAddr, btc.liquidityPool.address));
    });
  });

  describe('remove market', async () => {
    it('remove invalid', async () => {
      await expect(eth.optionMarketViewer.removeMarket(eth.liquidityPool.address)).revertedWith(
        'RemovingInvalidMarket',
      );
    });
    it('remove valid', async () => {
      expect((await eth.optionMarketViewer.marketAddresses(eth.optionMarket.address)).optionMarket).to.eq(
        eth.optionMarket.address,
      );
      await eth.optionMarketViewer.removeMarket(eth.optionMarket.address);
      expect((await eth.optionMarketViewer.marketAddresses(eth.optionMarket.address)).optionMarket).to.eq(ZERO_ADDRESS);
    });
  });

  describe('init', async () => {
    it('revert if already initialized', async () => {
      await expect(eth.optionMarketViewer.init(eth.synthetixAdapter.address)).to.be.revertedWith('already initialized');
    });
  });
});
