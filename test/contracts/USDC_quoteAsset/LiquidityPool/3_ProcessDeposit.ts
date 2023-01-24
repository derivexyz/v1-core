import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { DAY_SEC, getTxTimestamp, HOUR_SEC, toBN, WEEK_SEC } from '../../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../../utils/assert';
import {
  DEFAULT_LONG_CALL,
  DEFAULT_SHORT_PUT_QUOTE,
  openDefaultLongCall,
  openPosition,
  setETHPrice,
} from '../../../utils/contractHelpers';
import { DEFAULT_CB_PARAMS } from '../../../utils/defaultParams';
import { fastForward } from '../../../utils/evm';
import { seedFixtureUSDC } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';
import { validateDepositRecord } from './2_InitiateDeposit';
// const initialBalance = toBN('100000');
const initialBalance = 100000e6;

// integration tests
describe('USDC_quote - Process Deposit', async () => {
  // for each "it"
  //      expect(correct liquidityToken.balanceOf)
  //      expect(correct quote balance of depositor/withdrawer)
  //      expect(correct quote balance of LP)
  //      expect(correct totalQueuedWithdrawal incrementation)

  beforeEach(async () => {
    await seedFixtureUSDC({ useUSDC: true }); /// seed is probably overriding
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, initialBalance);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, initialBalance);
  });

  // state tracking
  it('tracks deposit head and totalQueuedDeposits after single process', async () => {
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 600e6);
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

    // process
    await hre.f.c.liquidityPool.processDepositQueue(1);
    await expectProcessDeposit(2, toBN('0'), toBN('600'), hre.f.alice);
  });

  it('tracks deposit receipt mintTokens for multiple deposits', async () => {
    const firstTx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 600e6);
    const secondTx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 400e6);

    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

    // start with mintTokens = 0
    await validateDepositRecord(1, hre.f.alice.address, toBN('600'), toBN('0'), await getTxTimestamp(firstTx));
    await validateDepositRecord(2, hre.f.alice.address, toBN('400'), toBN('0'), await getTxTimestamp(secondTx));

    // process first deposit
    await hre.f.c.liquidityPool.processDepositQueue(1);
    await expectProcessDeposit(2, toBN('400'), toBN('600'), hre.f.alice);
    await validateDepositRecord(1, hre.f.alice.address, toBN('0'), toBN('600'), await getTxTimestamp(firstTx));
    await validateDepositRecord(2, hre.f.alice.address, toBN('400'), toBN('0'), await getTxTimestamp(secondTx));

    // process second deposit
    await hre.f.c.liquidityPool.processDepositQueue(1);
    await expectProcessDeposit(3, toBN('0'), toBN('1000'), hre.f.alice);
    await validateDepositRecord(1, hre.f.alice.address, toBN('0'), toBN('600'), await getTxTimestamp(firstTx));
    await validateDepositRecord(2, hre.f.alice.address, toBN('0'), toBN('400'), await getTxTimestamp(secondTx));
  });

  it('tracks deposit head and totalQueuedDeposits after multiple processes (process only queued amount)', async () => {
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 100e6);
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 200e6);
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 300e6);
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

    // process
    await hre.f.c.liquidityPool.processDepositQueue(5);
    await expectProcessDeposit(4, toBN('0'), toBN('600'), hre.f.alice);
  });

  it('takes quote from operator but mints to beneficiary', async () => {
    // deposit called by signer_1 to signer_2
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.signers[2].address, 1000e6);

    // deposit initiated
    expect(await hre.f.c.liquidityPool.nextQueuedDepositId()).eq(2);
    expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('1000'));

    // tokens transferred and minted
    // expect(initialBalance.sub(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address))).to.eq(toBN('1000'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(501000e6);

    // process withdrawal
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
    await hre.f.c.liquidityPool.processDepositQueue(1);
    await expectProcessDeposit(2, toBN('0'), toBN('0'), hre.f.alice);
    await expectProcessDeposit(2, toBN('0'), toBN('1000'), hre.f.signers[2]);
  });

  // canProcess
  describe('canProcess', async () => {
    it('blocks if minimumDelay not expired', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 100e6);
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 200e6);
      await fastForward(DAY_SEC);
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 300e6);
      await fastForward(WEEK_SEC - DAY_SEC + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // process up to second deposit
      await hre.f.c.liquidityPool.processDepositQueue(5);
      await expectProcessDeposit(3, toBN('300'), toBN('300'), hre.f.alice);
    });

    it('blocks if board is stale', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 100e6);
      await fastForward(WEEK_SEC + 1);

      // return due to stale board
      await hre.f.c.liquidityPool.processDepositQueue(1);
      await expectProcessDeposit(1, toBN('100'), toBN('0'), hre.f.alice);
    });

    it('reverts if CB fired', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 100e6);
      await fastForward(WEEK_SEC + 1);

      // trigger CB
      await hre.f.c.liquidityPool.setCircuitBreakerParameters({
        ...DEFAULT_CB_PARAMS,
        skewVarianceCBThreshold: toBN('0.0001'),
        skewVarianceCBTimeout: HOUR_SEC,
      });

      await openDefaultLongCall();
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // return due to triggeredCB
      await hre.f.c.liquidityPool.processDepositQueue(1);
      await expectProcessDeposit(1, toBN('100'), toBN('0'), hre.f.alice);

      // pass once CB expired & skew is less sensitive
      await fastForward(HOUR_SEC + 1);
      await hre.f.c.liquidityPool.setCircuitBreakerParameters({
        ...DEFAULT_CB_PARAMS,
        skewVarianceCBThreshold: toBN('0.1'),
      });

      await hre.f.c.liquidityPool.processDepositQueue(1);
      await expectProcessDeposit(2, toBN('0'), toBN('100'), hre.f.alice);
      // await expectProcessDeposit(1, toBN('0'), toBN('100'), hre.f.alice);
    });

    it('process once CB stops firing and expires', async () => {
      // tested in "reverts if CB fired"
    });
    it('process all deposits if limit > num of deposits', async () => {
      // tested in "blocks if minimumDelay not expired"
    });
    it('blocks process if no queued deposits', async () => {
      await hre.f.c.liquidityPool.processDepositQueue(10);
      await expectProcessDeposit(1, toBN('0'), toBN('0'), hre.f.alice);
    });
  });

  // More detailed NAV scenarios in PoolValue
  describe.skip('NAV accounting', async () => {
    beforeEach(async () => {
      // initiate second depositor
      await hre.f.c.snx.quoteAsset.mint(hre.f.signers[2].address, 100e6);
      await hre.f.c.snx.quoteAsset.connect(hre.f.signers[2]).approve(hre.f.c.liquidityPool.address, 100e6);

      // allow skews and variances to fluctuate alot
      await hre.f.c.liquidityPool.setCircuitBreakerParameters({
        ...DEFAULT_CB_PARAMS,
        skewVarianceCBThreshold: toBN('0.1'),
        skewVarianceCBTimeout: HOUR_SEC,
      });

      // initiate and open position
      await setETHPrice(toBN('2000')); // for easier accounting
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, 100e6);
      await hre.f.c.liquidityPool.connect(hre.f.signers[2]).initiateDeposit(hre.f.signers[2].address, 100e6);
      await openPosition({ ...DEFAULT_LONG_CALL, strikeId: 2, amount: toBN('100'), iterations: 5 });

      // hedge delta for one of two positions
      // await hre.f.c.poolHedger.hedgeDelta();
      // await openPosition({
      //   ...DEFAULT_SHORT_PUT_QUOTE,
      //   strikeId: 2,
      //   amount: toBN('50'),
      //   setCollateralTo: toBN('50000'),
      //   iterations: 5,
      // });
    });

    it('mints correct token amount when spotPrice up', async () => {
      // 100% increase & short put undercollateralized
      await setETHPrice(toBN('4000'));
      await fastForward(WEEK_SEC * 2 + 1);

      // NAV unaware of undercollateralized short put
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      let poolValue = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      assertCloseToPercentage(poolValue, toBN('387656.92'), toBN('0.0001'));

      // process first deposit before settlement
      await hre.f.c.liquidityPool.processDepositQueue(1);
      expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(2);
      expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('100'));
      assertCloseToPercentage(
        await hre.f.c.liquidityToken.balanceOf(hre.f.alice.address),
        toBN('128.98'),
        toBN('0.001'),
      );

      // settle board
      await fastForward(WEEK_SEC * 2 + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.liquidityPool.exchangeBase();
      await fastForward(Number(DEFAULT_CB_PARAMS.boardSettlementCBTimeout) + 1);

      // NAV aware of undercollateralized short put
      poolValue = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      assertCloseToPercentage(poolValue, toBN('385490.6206'), toBN('0.001'));

      // process second deposit post settlement
      await hre.f.c.liquidityPool.processDepositQueue(1);
      expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(3);
      expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('0'));
      assertCloseToPercentage(
        await hre.f.c.liquidityToken.balanceOf(hre.f.signers[2].address),
        toBN('129.738'),
        toBN('0.001'),
      );
    });

    it('accounts for short collateral excess insolvency once board settled', async () => {
      // tested in mints correct token amount when spotPrice up
    });
    it('accounts for used delta funds', async () => {
      // tested in mints correct token amount when spotPrice up
    });

    it('mints correct token amount when spotPrice down', async () => {
      // 50% decrease
      await setETHPrice(toBN('1000'));
      await fastForward(WEEK_SEC + 1);

      // NAV calculation
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      const poolValue = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      assertCloseTo(poolValue, toBN('528345.64'), toBN('0.5'));

      // process both deposits
      await hre.f.c.liquidityPool.processDepositQueue(2);
      expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(3);
      expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('0'));
      assertCloseTo(await hre.f.c.liquidityToken.balanceOf(hre.f.alice.address), toBN('94.63'), toBN('0.1'));
      assertCloseTo(await hre.f.c.liquidityToken.balanceOf(hre.f.signers[2].address), toBN('94.63'), toBN('0.1'));
    });
  });
});

export async function expectProcessDeposit(
  head: number,
  queuedDepositVal: BigNumber,
  lpTokenBalance: BigNumber,
  beneficiary: SignerWithAddress,
) {
  // console.log(`Total queued: ${await hre.f.c.liquidityPool.totalQueuedDeposits()}`)
  // console.log(`Queued depos: ${queuedDepositVal}`)
  expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(head);
  expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(queuedDepositVal);
  assertCloseTo(await hre.f.c.liquidityToken.balanceOf(beneficiary.address), lpTokenBalance, toBN('0.01'));
}
