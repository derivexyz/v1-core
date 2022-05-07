import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  DAY_SEC,
  getTxTimestamp,
  HOUR_SEC,
  MONTH_SEC,
  OptionType,
  toBN,
  UNIT,
  WEEK_SEC,
} from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  expectBalance,
  expectCorrectSettlement,
  fillLiquidityWithLongCall,
  getLiquidity,
  initiateFullLPWithdrawal,
  openAllTrades,
  openPositionWithOverrides,
  partiallyFillLiquidityWithLongCall,
} from '../../utils/contractHelpers';
import {
  DEFAULT_GREEK_CACHE_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_PRICING_PARAMS,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides, mockPrice, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { validateWithdrawalRecord } from './4_InitiateWithdrawal';

// integration tests
describe('Process withdrawal', async () => {
  beforeEach(async () => {
    await seedFixture(); /// seed is probably overriding

    // console.log("exited seed...")
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, toBN('100000'));
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, toBN('100000'));
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('10000'));
    await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processDepositQueue(1);
    expect(await hre.f.c.liquidityTokens.balanceOf(hre.f.alice.address)).eq(toBN('10000'));
  });

  describe('state tracking', async () => {
    it('tracks withdrawal head, totalQueuedWithdrawal and withdrawal ticket after multiple processes', async () => {
      const firstTx = await hre.f.c.liquidityPool
        .connect(hre.f.alice)
        .initiateWithdraw(hre.f.alice.address, toBN('5000'));
      const secondTx = await hre.f.c.liquidityPool
        .connect(hre.f.alice)
        .initiateWithdraw(hre.f.alice.address, toBN('5000'));
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // test process number limit
      await hre.f.c.liquidityPool.processWithdrawalQueue(0);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);

      // withdraw 1st withdraw
      let oldBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      let newBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(1);
      expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('5000'));
      await validateWithdrawalRecord(
        0,
        hre.f.alice.address,
        toBN('0'),
        newBal.sub(oldBal),
        await getTxTimestamp(firstTx),
      );

      // withdraw 2nd withdraw
      // <0.01% deviation as alice's remaining funds earn a portion of fees from her earlier withdrawals
      oldBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      newBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(2);
      expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('0'));
      await validateWithdrawalRecord(
        1,
        hre.f.alice.address,
        toBN('0'),
        newBal.sub(oldBal),
        await getTxTimestamp(secondTx),
      );

      // confirm received quote
      const totalWithdrawalFee = toBN('10000').mul(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalFee).div(UNIT);
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address),
        toBN('100000').sub(totalWithdrawalFee),
        toBN('0.0001'),
      );
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address),
        toBN('500000').add(totalWithdrawalFee),
        toBN('0.0001'),
      );
    });

    it('tracks withdrawal head and totalQueuedWithdrawal after multiple processes', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateWithdraw(hre.f.alice.address, toBN('1000'));
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateWithdraw(hre.f.alice.address, toBN('3000'));
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateWithdraw(hre.f.alice.address, toBN('6000'));
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processWithdrawalQueue(5);

      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(3);
      expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('0'));

      // <0.01% deviations as alice's remaining funds earn a portion of fees from her earlier withdrawals
      const totalWithdrawalFee = toBN('10000').mul(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalFee).div(UNIT);
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address),
        toBN('100000').sub(totalWithdrawalFee),
        toBN('0.0001'),
      );
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address),
        toBN('500000').add(totalWithdrawalFee),
        toBN('0.0001'),
      );
    });
  });

  // CBs
  describe('process failures', async () => {
    it('returns if minimumDelay not expired', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateWithdraw(hre.f.alice.address, toBN('10000'));
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) - DAY_SEC);

      // attempt process
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);

      // ensure process failed
      expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('10000'));
      await expectBalance(hre.f.c.snx.quoteAsset, toBN('510000'), hre.f.c.liquidityPool.address);
    });

    it('reverts if board is stale', async () => {
      // work on this one
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateWithdraw(hre.f.alice.address, toBN('10000'));
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1); // ensure withdrawal delay is expired

      // make board stale
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await fastForward(Number(DEFAULT_GREEK_CACHE_PARAMS.staleUpdateDuration) + 1);

      // attempt withdrawal
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);

      // ensure process failed
      expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('10000'));
      await expectBalance(hre.f.c.snx.quoteAsset, toBN('510000'), hre.f.c.liquidityPool.address);
    });

    it('reverts if CB fired (freeLiquidity == 0)', async () => {
      // other CB scenarios tested in CircuitBreaker
      await openAllTrades();

      // fill pool 100% with options and withdrawals => freeLiquidity == 0
      await initiateFullLPWithdrawal(hre.f.signers[0]); // 100% deployer withdrawal
      await initiateFullLPWithdrawal(hre.f.alice); // 100% alice withdrawal
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // fails to process both deployer and alice withdrawals
      await hre.f.c.liquidityPool.processWithdrawalQueue(2);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(0);

      // confirm CB is blocking withdrawal
      const blockNumber = await ethers.provider.getBlockNumber();
      const currentTimestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
      expect(await hre.f.c.liquidityPool.CBTimestamp()).to.eq(currentTimestamp + DAY_SEC * 3);
    });

    it('bypasses liquidityCB with guardian delay, but does not process withdrawal when burnable = 0', async () => {
      // set burnable -> 0
      const [, liquidity] = await fillLiquidityWithLongCall();
      const oldQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
      expect(liquidity.burnableLiquidity).to.eq(0); // ensure full fill is correct
      // initiate withdraw and set guardian
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, toBN('1000'));
      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        guardianMultisig: hre.f.signers[3].address,
        guardianDelay: DAY_SEC,
      });
      await fastForward(DAY_SEC + 1); // wait for guardian to expire

      // process withdraw
      expect(await hre.f.c.liquidityPool.connect(hre.f.signers[3]).processWithdrawalQueue(1));
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).to.eq(0);
      expect(await hre.f.c.liquidityPool.totalQueuedWithdrawals()).to.eq(toBN('1000'));
      const newQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.signers[0].address);
      expect(newQuote.sub(oldQuote)).to.eq(toBN('0')); // no withdrawal
    });
  });

  describe('partial withdrawals', async () => {
    // check that all withdrawal tickets have updated info, head does not move
    it('partially withdraws if not enough burnable tokens until fully processed', async () => {
      const [, liquidity] = await partiallyFillLiquidityWithLongCall();
      const oldQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      expect(liquidity.burnableLiquidity).to.lt(toBN('200000')); // ensure partial fill is correct

      const firstTx = await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, toBN('200000'));
      // prevent withdrawal from triggerring CBTimeout
      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        liquidityCBThreshold: toBN('0'),
      });

      // first partial process
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.withdrawalDelay) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      const newQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      // assertCloseTo(await hre.f.c.liquidityPool.totalQueuedWithdrawals(), toBN('75488.496'), toBN('1'));

      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).to.eq(0);
      assertCloseTo(newQuote.sub(oldQuote), toBN('123787.16386'), toBN('2'));
      await validateWithdrawalRecord(
        0,
        hre.f.deployer.address,
        toBN('75556.3265'),
        newQuote.sub(oldQuote),
        await getTxTimestamp(firstTx),
      );

      // top off pool
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.deployer.address, toBN('150000'));
      await fastForward(Number(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay) + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processDepositQueue(1);

      // final partial process
      const postDepositQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      const postFinalWithdrawQuote = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const totalWithdrawnQuote = postFinalWithdrawQuote.sub(postDepositQuote).add(newQuote).sub(oldQuote);
      assertCloseTo(await hre.f.c.liquidityPool.totalQueuedWithdrawals(), toBN('0'), toBN('1'));
      // confirmQuoteSentReceipt(0, totalWithdrawnQuote);
      await validateWithdrawalRecord(
        0,
        hre.f.deployer.address,
        toBN('0'),
        totalWithdrawnQuote,
        await getTxTimestamp(firstTx),
      );
    });
  });

  describe('edge cases', async () => {
    beforeEach(seedFixture);
    it('processess withdrawal after value of pool drops 90%', async () => {
      // remove hedging & reducing slippage
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        hedgeCap: toBN('0'),
      });

      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('5000'),
      });

      // initiate deposit and withdrawal
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, toBN('100000000'));
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.alice.address, toBN('100'));
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.alice.address, toBN('100'));
      expect(await hre.f.c.liquidityPool.getTokenPrice()).to.eq(toBN('1'));

      await openAllTrades(); // just to mix it up a bit
      await openPositionWithOverrides(hre.f.c, {
        strikeId: 2,
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('6000'),
        setCollateralTo: toBN('100000000'),
      });

      // ensure optionValue dumps & most NAV is in optionValue
      assertCloseToPercentage(await hre.f.c.optionGreekCache.getGlobalOptionValue(), toBN('-625000'), toBN('0.05'));
      assertCloseToPercentage(await hre.f.c.liquidityPool.getTokenPrice(), toBN('1.25'), toBN('0.1'));
      expect((await getLiquidity()).freeLiquidity).to.lt(toBN('50000'));

      // dump price to make all calls OTM
      await mockPrice(hre.f.c, toBN('1250'), 'sETH');
      await fastForward(WEEK_SEC); // let GWAV catch up
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      assertCloseToPercentage(await hre.f.c.optionGreekCache.getGlobalOptionValue(), toBN('-19000'), toBN('0.05'));
      assertCloseToPercentage(await hre.f.c.liquidityPool.getTokenPrice(), toBN('0.065'), toBN('0.1'));

      // process withdrawals
      await hre.f.c.liquidityPool.processDepositQueue(2);
      assertCloseToPercentage(
        await hre.f.c.liquidityTokens.balanceOf(hre.f.alice.address),
        toBN('1592.6'),
        toBN('0.1'),
      );

      await hre.f.c.liquidityPool.processWithdrawalQueue(2);
      assertCloseToPercentage(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address), toBN('6.5'), toBN('0.1'));
    });

    it('liveBoards != 0, open options == 0, can withdraw 100%', async () => {
      // opening second board to test 100% withdrawal where liveBoards > 0
      const boardId2 = await createDefaultBoardWithOverrides(hre.f.c, {
        expiresIn: MONTH_SEC * 2,
        baseIV: '1',
        skews: ['0.9', '1', '1.1'],
        strikePrices: ['1500', '2000', '2500'],
      });

      // open options on board 1
      const positionIds: BigNumber[] = await openAllTrades();

      // Initiate withdrawal
      const tokenBalance = await hre.f.c.liquidityTokens.balanceOf(hre.f.deployer.address);
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, tokenBalance);

      // settle board, 100% liquidity should be able to be withdrawn even with liveBoards > 0
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.liquidityPool.exchangeBase();
      await expect(hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId)).revertedWith(
        'InvalidBoardId',
      );

      // skip settle CB timeout & process withdrawal
      await fastForward(HOUR_SEC * 6 + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(boardId2);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(1);

      // confirm 100% withdrawn, except pool fees and settlement values
      const globals = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      const liquidity = await hre.f.c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address),
        toBN('5242.0727'),
        toBN('0.01'),
      );
      assertCloseToPercentage(liquidity.freeLiquidity, toBN('5000'), toBN('0.01'));
      assertCloseToPercentage(
        await hre.f.c.liquidityPool.totalOutstandingSettlements(),
        toBN('242.0727'),
        toBN('0.01'),
      );

      // confirm settling is fully functional even with 100% withdrawal
      await hre.f.c.shortCollateral.settleOptions(positionIds);
      // await hre.f.c.poolHedger.hedgeDelta();
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address),
        toBN('5000'),
        toBN('0.01'),
      );
    });

    it('allows for settlement after 100% withdrawal', async () => {
      // open various options & initiate withdraw
      const positionIds: BigNumber[] = await openAllTrades();
      const tokenBalance = await hre.f.c.liquidityTokens.balanceOf(hre.f.deployer.address);
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, tokenBalance);

      // settle board and process 100% withdrawal
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.liquidityPool.exchangeBase();
      await fastForward(HOUR_SEC * 6 + 1);
      await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      expect(await hre.f.c.liquidityPool.queuedWithdrawalHead()).eq(1);

      // confirm settling is fully functional even with 100% withdrawal
      await expectCorrectSettlement(positionIds);
    });
  });
});
