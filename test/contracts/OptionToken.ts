import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { MONTH_SEC, toBN, toBytes32, TradeType, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import { deployTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
import { seedBalanceAndApprovalFor, seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('optionToken - unit', () => {
  let account: Signer;
  let account2: Signer;
  let accountAddr: string;
  let account2Addr: string;
  let c: TestSystemContractsType;

  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let snap: number;

  before(async () => {
    [account, account2] = await ethers.getSigners();
    [accountAddr, account2Addr] = await Promise.all([account.getAddress(), account2.getAddress()]);

    c = await deployTestSystem(account);
    boardId = await seedTestSystem(account, c);
    listingIds = await c.optionMarket.getBoardListings(boardId);

    await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
    await c.optionMarket.openPosition(listingIds[0], TradeType.LONG_PUT, toBN('2'));
    await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_CALL, toBN('3'));
    await c.optionMarket.openPosition(listingIds[0], TradeType.SHORT_PUT, toBN('4'));
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });
  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  it('Can only be initialized once', async () => {
    await expect(c.optionToken.init(ZERO_ADDRESS)).revertedWith('contract already initialized');
  });

  it('Allows closing options after transferring', async () => {
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.LONG_CALL),
      toBN('1'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.LONG_PUT),
      toBN('2'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.SHORT_CALL),
      toBN('3'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.SHORT_PUT),
      toBN('4'),
      toBytes32(''),
    );

    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_CALL))).eq(toBN('1'));
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_PUT))).eq(toBN('2'));
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_CALL))).eq(toBN('3'));
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_PUT))).eq(toBN('4'));

    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).eq(0);
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).eq(0);

    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_CALL, toBN('1'));
    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_PUT, toBN('2'));

    // Have to have balances to repay shorts only
    await seedBalanceAndApprovalFor(account2, c);

    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('3'));
    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('4'));

    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_PUT))).eq(0);
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_PUT))).eq(0);
  });

  it('Allows exercising options after transferring', async () => {
    // Transferring both before and after liquidation is allowed
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.LONG_CALL),
      toBN('1'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.LONG_PUT),
      toBN('2'),
      toBytes32(''),
    );

    await fastForward(MONTH_SEC);
    await c.mocked.exchangeRates.mockLatestPrice(toBN('2000'));
    await c.optionMarket.liquidateExpiredBoard(boardId);

    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.SHORT_CALL),
      toBN('3'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.SHORT_PUT),
      toBN('4'),
      toBytes32(''),
    );

    await c.optionMarket.connect(account2).settleOptions(listingIds[0], TradeType.LONG_CALL);
    await c.optionMarket.connect(account2).settleOptions(listingIds[0], TradeType.LONG_PUT);
    await c.optionMarket.connect(account2).settleOptions(listingIds[0], TradeType.SHORT_CALL);
    await c.optionMarket.connect(account2).settleOptions(listingIds[0], TradeType.SHORT_PUT);
  });

  it('Works for partial transfers too', async () => {
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.LONG_CALL),
      toBN('0.5'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.LONG_PUT),
      toBN('1.5'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.SHORT_CALL),
      toBN('2.5'),
      toBytes32(''),
    );
    await c.optionToken.safeTransferFrom(
      accountAddr,
      account2Addr,
      listingIds[0].add(TradeType.SHORT_PUT),
      toBN('3.5'),
      toBytes32(''),
    );

    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_CALL))).eq(toBN('0.5'));
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_PUT))).eq(toBN('1.5'));
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_CALL))).eq(toBN('2.5'));
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_PUT))).eq(toBN('3.5'));

    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_CALL))).eq(toBN('0.5'));
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).eq(toBN('0.5'));
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).eq(toBN('0.5'));
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).eq(toBN('0.5'));

    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_CALL, toBN('0.5'));
    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.LONG_PUT, toBN('1.5'));

    // Have to have balances to repay shorts only
    await seedBalanceAndApprovalFor(account2, c);

    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('2.5'));
    await c.optionMarket.connect(account2).closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('3.5'));

    await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_CALL, toBN('0.5'));
    await c.optionMarket.closePosition(listingIds[0], TradeType.LONG_PUT, toBN('0.5'));
    await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_CALL, toBN('0.5'));
    await c.optionMarket.closePosition(listingIds[0], TradeType.SHORT_PUT, toBN('0.5'));

    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.LONG_PUT))).eq(0);
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(accountAddr, listingIds[0].add(TradeType.SHORT_PUT))).eq(0);

    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.LONG_PUT))).eq(0);
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_CALL))).eq(0);
    expect(await c.optionToken.balanceOf(account2Addr, listingIds[0].add(TradeType.SHORT_PUT))).eq(0);
  });

  it('can only mint/burn if optionMarket is caller', async () => {
    await expect(c.optionToken.mint(accountAddr, 1, toBN('1'))).revertedWith('only OptionMarket');
    await expect(c.optionToken.burn(accountAddr, 1, toBN('1'))).revertedWith('only OptionMarket');
  });
});
