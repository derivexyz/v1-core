import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { DAY_SEC, getTxTimestamp, HOUR_SEC, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  DEFAULT_LONG_CALL,
  DEFAULT_SHORT_CALL_QUOTE,
  DEFAULT_SHORT_PUT_QUOTE,
  openDefaultLongCall,
  openPosition,
  setETHPrice,
} from '../../utils/contractHelpers';
import {
  DEFAULT_CB_PARAMS,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { validateDepositRecord } from './2_InitiateDeposit';
const initialBalance = toBN('100000');

// integration tests
describe('Process Deposit', async () => {
  // for each "it"
  //      expect(correct liquidityToken.balanceOf)
  //      expect(correct quote balance of depositor/withdrawer)
  //      expect(correct quote balance of LP)
  //      expect(correct totalQueuedWithdrawal incrementation)

  beforeEach(async () => {
    await seedFixture(); /// seed is probably overriding
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, initialBalance);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, initialBalance);
  });

  // state tracking
  it('tracks deposit head and totalQueuedDeposits after single process', async () => {
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('600'));
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

    // process
    await hre.f.c.liquidityPool.processDepositQueue(1);
    await expectProcessDeposit(2, toBN('0'), toBN('600'), hre.f.alice);
  });

  it('tracks deposit receipt mintTokens for multiple deposits', async () => {
    const firstTx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('600'));
    const secondTx = await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('400'));

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
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('100'));
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('200'));
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('300'));
    await fastForward(WEEK_SEC + 1);
    await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

    // process
    await hre.f.c.liquidityPool.processDepositQueue(5);
    await expectProcessDeposit(4, toBN('0'), toBN('600'), hre.f.alice);
  });

  it('takes quote from operator but mints to beneficiary', async () => {
    // deposit called by signer_1 to signer_2
    await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.signers[2].address, toBN('1000'));

    // deposit initiated
    expect(await hre.f.c.liquidityPool.nextQueuedDepositId()).eq(2);
    expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('1000'));

    // tokens transferred and minted
    expect(initialBalance.sub(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address))).to.eq(toBN('1000'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('501000'));

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
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('100'));
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('200'));
      await fastForward(DAY_SEC);
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('300'));
      await fastForward(WEEK_SEC - DAY_SEC + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // process up to second deposit
      await hre.f.c.liquidityPool.processDepositQueue(5);
      await expectProcessDeposit(3, toBN('300'), toBN('300'), hre.f.alice);
    });

    it('blocks if board is stale', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('100'));
      await fastForward(WEEK_SEC + 1);

      // return due to stale board
      await hre.f.c.liquidityPool.processDepositQueue(1);
      await expectProcessDeposit(1, toBN('100'), toBN('0'), hre.f.alice);
    });

    it('reverts if CB fired', async () => {
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('100'));
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
        skewVarianceCBTimeout: HOUR_SEC,
      });
      await hre.f.c.liquidityPool.processDepositQueue(1);
      await expectProcessDeposit(2, toBN('0'), toBN('100'), hre.f.alice);
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
  describe('NAV accounting', async () => {
    beforeEach(async () => {
      // initiate second depositor
      await hre.f.c.snx.quoteAsset.mint(hre.f.signers[2].address, toBN('100'));
      await hre.f.c.snx.quoteAsset.connect(hre.f.signers[2]).approve(hre.f.c.liquidityPool.address, toBN('100'));

      // allow skews and variances to fluctuate alot
      await hre.f.c.liquidityPool.setCircuitBreakerParameters({
        ...DEFAULT_CB_PARAMS,
        skewVarianceCBThreshold: toBN('10000'),
        ivVarianceCBThreshold: toBN('10000'),
      });

      // initiate and open a LONG CALL, $2000 strike, 1mo expiry
      await setETHPrice(toBN('2000')); // for easier accounting
      await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, toBN('100'));
      await hre.f.c.liquidityPool.connect(hre.f.signers[2]).initiateDeposit(hre.f.signers[2].address, toBN('100'));
      await openPosition({ ...DEFAULT_LONG_CALL, strikeId: 2, amount: toBN('100'), iterations: 5 });

      // hedge delta for one of two positions
      await hre.f.c.poolHedger.hedgeDelta();

      // open a SHORT CALL, $2000 strike, 1mo expiry
      await openPosition({
        ...DEFAULT_SHORT_CALL_QUOTE,
        strikeId: 2,
        amount: toBN('20'),
        setCollateralTo: toBN('20000'),
        iterations: 5,
      });

      // AMM net positions:
      // 1. 36 delta in hedger, with $72k backing this
      // 2. 100 short calls (~$20k received, $200k locked in quote)
      // 3. 20 long calls (~$5k spent)
    });

    it('mints correct token amount when spotPrice up', async () => {
      // 100% increase & short call undercollateralized
      await setETHPrice(toBN('4000'));
      await fastForward(WEEK_SEC * 2 + 1);

      // AMM net positions:
      // 1. hedger: gained ~$72k
      // 2. 100 short calls: lost ~$200k but got $20k in premiums
      // 3. 20 long calls: gained $40k in premiums, but insolvency present
      // net should go from $500k -> ~$440k

      // NAV unaware of undercollateralized short put
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      // console.log(await hre.f.c.optionGreekCache.getGlobalOptionValue());
      let poolValue = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      // console.log(await hre.f.c.liquidityPool.getLiquidity());
      assertCloseToPercentage(poolValue, toBN('436052.467'), toBN('0.0001'));

      // cap hedging to 50 delta to prevent CB
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        hedgeCap: toBN('10'),
      });
      await hre.f.c.poolHedger.hedgeDelta();

      // process first deposit before settlement
      await hre.f.c.liquidityPool.processDepositQueue(1);
      expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(2);
      expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('100'));
      assertCloseToPercentage(
        await hre.f.c.liquidityToken.balanceOf(hre.f.alice.address),
        toBN('114.87'),
        toBN('0.001'),
      );

      // settle board
      await fastForward(WEEK_SEC * 2 + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.liquidityPool.exchangeBase();
      await fastForward(Number(DEFAULT_CB_PARAMS.boardSettlementCBTimeout) + 1);

      // NAV aware of undercollateralized short put (readjusted by ~$20k)
      poolValue = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      assertCloseToPercentage(poolValue, toBN('415719.907'), toBN('0.001'));

      // process second deposit post settlement
      await hre.f.c.liquidityPool.processDepositQueue(1);
      expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(3);
      expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('0'));
      assertCloseToPercentage(
        await hre.f.c.liquidityToken.balanceOf(hre.f.signers[2].address),
        toBN('120.30'), // token value drops further post insolvency awareness
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
      // open a SHORT PUT, $2000 strike, 1mo expiry to simulate tokenPrice up
      await openPosition({
        ...DEFAULT_SHORT_PUT_QUOTE,
        strikeId: 2,
        amount: toBN('50'),
        setCollateralTo: toBN('100000'),
        iterations: 5,
      });

      // 50% decrease
      await setETHPrice(toBN('1000'));
      await fastForward(WEEK_SEC + 1);

      // AMM net positions -> lost ~$30k
      // 1. hedger: lost ~$35k
      // 2. 100 short calls: worth ~$0, gained ~$20k in premiums
      // 3. 20 long calls: worth ~$0, lost ~$5k in premiums
      // 3. 20 put calls: worth ~$50k, lost ? in premiums

      // NAV calculation
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      const poolValue = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      assertCloseTo(poolValue, toBN('524993.117'), toBN('0.5'));

      // process both deposits
      await hre.f.c.liquidityPool.processDepositQueue(2);
      expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(3);
      expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(toBN('0'));
      assertCloseTo(await hre.f.c.liquidityToken.balanceOf(hre.f.alice.address), toBN('95.2393'), toBN('0.1'));
      assertCloseTo(await hre.f.c.liquidityToken.balanceOf(hre.f.signers[2].address), toBN('95.2393'), toBN('0.1'));
    });
  });
});

export async function expectProcessDeposit(
  head: number,
  queuedDepositVal: BigNumber,
  lpTokenBalance: BigNumber,
  beneficiary: SignerWithAddress,
) {
  expect(await hre.f.c.liquidityPool.queuedDepositHead()).eq(head);
  expect(await hre.f.c.liquidityPool.totalQueuedDeposits()).to.eq(queuedDepositVal);
  assertCloseTo(await hre.f.c.liquidityToken.balanceOf(beneficiary.address), lpTokenBalance, toBN('0.01'));
}
