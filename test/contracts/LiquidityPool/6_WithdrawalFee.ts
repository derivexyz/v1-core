import { BigNumber } from 'ethers';
import { HOUR_SEC, MONTH_SEC, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  DEFAULT_LONG_PUT,
  expectBalance,
  getTotalCost,
  initiateFullLPWithdrawal,
  openAllTrades,
  openPosition,
} from '../../utils/contractHelpers';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

// integration tests
describe('Withdrawal Fees', async () => {
  beforeEach(async () => {
    await seedFixture(); /// seed is probably overriding
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, toBN('100000'));
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, toBN('100000'));
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('10000'));
    await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processDepositQueue(1);
    expect(await hre.f.c.liquidityTokens.balanceOf(hre.f.alice.address)).eq(toBN('10000'));
  });

  // charging fees
  it('charges withdrawal fee, processed when liveBoards != 0', async () => {
    // opening second board to test 100% withdrawal where liveBoards > 0
    const boardId2 = await createDefaultBoardWithOverrides(hre.f.c, {
      expiresIn: MONTH_SEC * 2,
      skews: ['0.9', '1', '1.1'],
      strikePrices: ['1500', '2000', '2500'],
    });

    // open options on board 1
    const positionIds: BigNumber[] = await openAllTrades();

    // Initiate withdrawal
    await initiateFullLPWithdrawal(hre.f.signers[0]); // 100% deployer withdrawal
    await initiateFullLPWithdrawal(hre.f.alice); // 100% alice withdrawal

    // settle board
    await fastForward(MONTH_SEC + 1);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    await hre.f.c.liquidityPool.exchangeBase();
    await expect(hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId)).revertedWith('InvalidBoardId');

    // skip settle CB timeout & process withdrawal
    await fastForward(HOUR_SEC * 6 + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId2);
    await hre.f.c.liquidityPool.processWithdrawalQueue(2);
    expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(3);

    // settle fees
    await hre.f.c.shortCollateral.settleOptions(positionIds);
    assertCloseToPercentage(
      await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address),
      toBN('150'),
      toBN('0.01'),
    );
  });

  it('final withdrawal takes all accrued fees when liveBoards == 0', async () => {
    // remove largest deposit and charge fee
    await hre.f.c.liquidityPool.initiateWithdraw(
      hre.f.deployer.address,
      await hre.f.c.liquidityTokens.balanceOf(hre.f.deployer.address),
    );

    await fastForward(WEEK_SEC * 2);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);
    await fastForward(WEEK_SEC * 2);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(0);
    expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('15000'));
    expect(await hre.f.c.liquidityPool.getTokenPrice()).to.eq(toBN('1.5'));

    // final withdrawal acrrues all fees
    await hre.f.c.liquidityPool
      .connect(hre.f.signers[1])
      .initiateWithdraw(hre.f.signers[1].address, await hre.f.c.liquidityTokens.balanceOf(hre.f.signers[1].address));

    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[1].address)).to.eq(toBN('105000'));
    expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('0'));
  });

  it('does not charge withdrawal fee when liveBoards == 0, all trades open', async () => {
    // open and settle various options
    const positionIds: BigNumber[] = await openAllTrades();
    await fastForward(MONTH_SEC + 1);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    await hre.f.c.liquidityPool.exchangeBase();
    await fastForward(HOUR_SEC * 6 + 1);

    // initiate and process withdrawals
    await initiateFullLPWithdrawal(hre.f.signers[0]); // 100% deployer withdrawal
    await initiateFullLPWithdrawal(hre.f.alice); // 100% alice withdrawal

    // settle options and ensure no fee taken
    await hre.f.c.shortCollateral.settleOptions(positionIds);
    assertCloseTo(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address), toBN('0'), toBN('0.01'));
  });

  it('does not charge withdrawal fee when liveBoards == 0, only long put', async () => {
    // open long put
    const [tx] = await openPosition({ ...DEFAULT_LONG_PUT, amount: toBN('10') });
    const [premium] = await getTotalCost(tx);
    const oldQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);

    // initiate withdrawal and settle board
    await initiateFullLPWithdrawal(hre.f.signers[0]);
    await fastForward(MONTH_SEC + 1);

    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    await fastForward(BigNumber.from(DEFAULT_LIQUIDITY_POOL_PARAMS.boardSettlementCBTimeout).add(1).toNumber());

    // process withdrawal now that liveBoards == 0
    expect(await hre.f.c.optionMarket.getNumLiveBoards()).to.eq(0);
    await hre.f.c.liquidityPool.processWithdrawalQueue(1);

    // ensure 100% withdrawal complete
    const newQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
    await expectBalance(hre.f.c.liquidityTokens, toBN('0'));
    assertCloseToPercentage(newQuote.sub(oldQuote), toBN('500000').add(premium)); //snx fees
  });
});
