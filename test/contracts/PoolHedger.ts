import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  getEventArgs,
  HOUR_SEC,
  MAX_UINT,
  toBN,
  TradeType,
  UNIT,
  WEEK_SEC,
  ZERO_ADDRESS,
} from '../../scripts/util/web3utils';
import { TestPoolHedger } from '../../typechain';
import { assertCloseTo, fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import {
  deployTestContracts,
  deployTestSystem,
  initTestSystem,
  TestSystemContractsType,
} from '../utils/deployTestSystem';
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('PoolHedger', () => {
  let account: Signer;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];

    c = await deployTestSystem(account);
    await seedTestSystem(account, c);
    await c.poolHedger.initShort();
    snap = await takeSnapshot();
  });

  beforeEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
  });

  describe('simple delta hedging', async () => {
    it('long call causes hedge to short', async () => {
      // the delta of this call is 0.84899481938848
      await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();

      // since we fully collateralized, we need to short 1 - the call delta
      // Sets collateral
      let receipt = await (await c.poolHedger.hedgeDelta()).wait();

      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0',
        oldCollateral: '1000',
        newCollateral: '785.937',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '0',
        expectedNetDelta: '-0.22558',
      });
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '214.062' });

      // Sets short
      receipt = await (await c.poolHedger.hedgeDelta()).wait();
      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0.22558',
        oldCollateral: '785.937',
        newCollateral: '785.937',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '-0.22558',
        expectedNetDelta: '-0.22558',
      });
      // Proceeds from opening short are returned to LP
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '391' });

      let position = await c.poolHedger.getShortPosition(c.test.collateralShort.address);
      const expectedShort = (await c.optionGreekCache.globalCache()).netDelta.sub(toBN('1')).abs();
      assertCloseTo(expectedShort, toBN('0.2254025'));

      // 1e14 to represent interest
      assertCloseTo(position.shortBalance, expectedShort, toBN('0.00000001'));
      assertCloseTo(
        position.collateral,
        expectedShort.mul(toBN('1742.01337')).div(toBN('1')).mul(2),
        toBN('0.00000001'),
      );

      await c.optionMarket.closePosition(1, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();

      receipt = await (await c.poolHedger.hedgeDelta()).wait();
      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0.22558',
        newShort: '0',
        oldCollateral: '785.937',
        newCollateral: '390.9939',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '-0.22558',
        currentNetDelta: '0',
        expectedNetDelta: '0',
      });
      // Proceeds from opening short are returned to LP
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '0' });

      receipt = await (await c.poolHedger.hedgeDelta()).wait();

      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0',
        oldCollateral: '390.9939',
        newCollateral: '0',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '0',
        expectedNetDelta: '0',
      });
      // Proceeds from opening short are returned to LP
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '390.9939' });

      position = await c.poolHedger.getShortPosition(c.test.collateralShort.address);

      expect(position.shortBalance).to.eq(0);
      expect(position.collateral).to.eq(0);
    });

    it('short call causes hedge to short', async () => {
      await c.optionMarket.openPosition(1, TradeType.SHORT_CALL, toBN('1'));

      // Sets collateral
      let receipt = await (await c.poolHedger.hedgeDelta()).wait();

      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0',
        oldCollateral: '1000',
        newCollateral: '2701.968',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '0',
        expectedNetDelta: '-0.77442',
      });
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '0' });

      // Sets short
      receipt = await (await c.poolHedger.hedgeDelta()).wait();
      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0.77442',
        oldCollateral: '2701.968',
        newCollateral: '2701.968',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '-0.77442',
        expectedNetDelta: '-0.77442',
      });
      // Proceeds from opening short are returned to LP
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '1344.229' });

      const position = await c.poolHedger.getShortPosition(c.test.collateralShort.address);
      const expectedShort = (await c.optionGreekCache.globalCache()).netDelta.abs();
      assertCloseTo(expectedShort, toBN('0.7745975'));
      assertCloseTo(position.shortBalance, expectedShort);
      assertCloseTo(position.collateral, expectedShort.mul(toBN('1742.01337')).div(toBN('1')).mul(2));
    });

    it('long put causes hedge to short', async () => {
      // the delta of this put is 0.15
      await c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('1'));

      // Sets collateral
      let receipt = await (await c.poolHedger.hedgeDelta()).wait();

      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0',
        oldCollateral: '1000',
        newCollateral: '785.937',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '0',
        expectedNetDelta: '-0.22558',
      });
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '214.062' });

      // Sets short
      receipt = await (await c.poolHedger.hedgeDelta()).wait();
      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0.22558',
        oldCollateral: '785.937',
        newCollateral: '785.937',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '-0.22558',
        expectedNetDelta: '-0.22558',
      });
      // Proceeds from opening short are returned to LP
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '391' });

      const position = await c.poolHedger.getShortPosition(c.test.collateralShort.address);
      const expectedShort = (await c.optionGreekCache.globalCache()).netDelta.abs();
      assertCloseTo(expectedShort, toBN('0.2254025'));

      // 1e14 to represent interest
      assertCloseTo(position.shortBalance, expectedShort, toBN('0.00000001'));
      assertCloseTo(
        position.collateral,
        expectedShort.mul(toBN('1742.01337')).div(toBN('1')).mul(2),
        toBN('0.00000001'),
      );
    });

    it('short put causes hedge to go long', async () => {
      // the delta of this call is 0.15
      await c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('1'));

      let receipt = await (await c.poolHedger.hedgeDelta()).wait();

      assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
        oldShort: '0',
        newShort: '0',
        oldCollateral: '1000',
        newCollateral: '0',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '0',
        expectedNetDelta: '0.22558',
      });
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '1000' });

      receipt = await (await c.poolHedger.hedgeDelta()).wait();

      assertLongSetToMatches(getEventArgs(receipt, 'LongSetTo'), { oldAmount: '0', newAmount: '0.22558' });

      assertQuoteExchangedMatches(getEventArgs(receipt, 'QuoteExchanged'), {
        quoteAmount: '392.994',
        baseReceived: '0.22558',
      });
      assertPositionUpdatedMatches(getEventArgs(receipt, 'PositionUpdated'), {
        oldNetDelta: '0',
        currentNetDelta: '0.22558',
        expectedNetDelta: '0.22558',
      });
      assertQuoteReturnedToLPMatches(getEventArgs(receipt, 'QuoteReturnedToLP'), { amountQuote: '0' });

      assertCloseTo(
        await c.test.baseToken.balanceOf(c.poolHedger.address),
        (await c.optionGreekCache.globalCache()).netDelta,
      );

      await c.optionMarket.closePosition(1, TradeType.SHORT_PUT, toBN('1'));

      await c.poolHedger.hedgeDelta();

      expect(await c.test.baseToken.balanceOf(c.poolHedger.address)).to.be.equal(toBN('0'));
    });
  });

  describe('other scenarios', async () => {
    describe('Same listing id', async () => {
      it('If we are equal short calls and long puts, a call to hedge does nothing', async () => {
        await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('25'));
        await c.liquidityPool.exchangeBase();
        await c.poolHedger.hedgeDelta();
        await c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('25'));
        await c.poolHedger.hedgeDelta();

        expect(await c.test.baseToken.balanceOf(c.poolHedger.address)).to.eq(0);
        const position = await c.poolHedger.getShortPosition(c.test.collateralShort.address);
        expect(position.shortBalance).to.eq(0);
        expect(position.collateral).to.eq(0);
      });

      it('Equal short calls and long puts with same listing requires no delta hedging', async () => {
        await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('25'));
        await c.liquidityPool.exchangeBase();
        await c.poolHedger.hedgeDelta();
        await c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('25'));
        await c.poolHedger.hedgeDelta();

        expect(await c.test.baseToken.balanceOf(c.poolHedger.address)).to.eq(0);
        const position = await c.poolHedger.getShortPosition(c.test.collateralShort.address);
        expect(position.shortBalance).to.eq(0);
        expect(position.collateral).to.eq(0);
      });
    });
  });

  describe('reopening short', async () => {
    it('can be reopened by owner if closed by liquidation', async () => {
      await c.test.collateralShort.testForceClose(await c.poolHedger.shortId());
      await c.poolHedger.reopenShort();
      await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('25'));
      await c.liquidityPool.exchangeBase();
      await c.poolHedger.hedgeDelta();
    });

    it('reverts if trying to reopen the short before it is closed', async () => {
      await expect(c.poolHedger.reopenShort()).to.revertedWith('short still open');
    });
  });

  it('tests interaction delay', async () => {
    await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('25'));
    await c.liquidityPool.exchangeBase();
    await c.poolHedger.hedgeDelta();
    // updating collateral doesn't trigger interaction delay
    await c.poolHedger.hedgeDelta();
    // updates short position
    await c.optionMarket.closePosition(1, TradeType.LONG_CALL, toBN('1'));
    await expect(c.poolHedger.hedgeDelta()).revertedWith('Interaction delay');
    await c.poolHedger.setInteractionDelay(0);
    await c.poolHedger.hedgeDelta();
    await c.poolHedger.hedgeDelta();
    await c.poolHedger.setInteractionDelay(WEEK_SEC);
    // Even though net delta hasn't changed, we still get an interaction delay
    await expect(c.poolHedger.hedgeDelta()).revertedWith('Interaction delay');
    await fastForward(WEEK_SEC + 1);
    await c.optionGreekCache.updateAllStaleBoards();
    await c.poolHedger.hedgeDelta();
    await fastForward(WEEK_SEC + 1);
    await c.optionGreekCache.updateAllStaleBoards();
    await c.optionMarket.closePosition(1, TradeType.LONG_CALL, toBN('1'));
    await c.liquidityPool.exchangeBase();
    // now that netDelta has changed, we repay with collateral
    await c.poolHedger.hedgeDelta();
    // and fail because lastInteracted has been updated
    await expect(c.poolHedger.hedgeDelta()).revertedWith('Interaction delay');

    await c.optionMarket.closePosition(1, TradeType.LONG_CALL, toBN('23'));
    await c.liquidityPool.exchangeBase();
    // However we can hedge instantly and as many times we want if netDelta has reached 0
    await c.poolHedger.hedgeDelta();
    await c.poolHedger.hedgeDelta();
    await c.poolHedger.hedgeDelta();
  });

  it('must wait for interaction delay when flipping from negative to positive netDelta', async () => {
    await c.optionMarket.openPosition(1, TradeType.LONG_PUT, toBN('10'));
    let receipt = await (await c.poolHedger.hedgeDelta()).wait();

    assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
      oldShort: '0',
      newShort: '0',
      oldCollateral: '1000',
      newCollateral: '8028.299',
    });

    receipt = await (await c.poolHedger.hedgeDelta()).wait();

    assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
      oldShort: '0',
      newShort: '2.3043',
      oldCollateral: '8028.299',
      newCollateral: '8028.299',
    });

    assertCloseTo((await c.optionGreekCache.globalCache()).netDelta, toBN('-2.3043'));
    await c.optionMarket.closePosition(1, TradeType.LONG_PUT, toBN('10'));
    expect((await c.optionGreekCache.globalCache()).netDelta).eq(0);
    await c.optionMarket.openPosition(1, TradeType.SHORT_PUT, toBN('10'));
    assertCloseTo((await c.optionGreekCache.globalCache()).netDelta, toBN('2.1929'));

    await expect(c.poolHedger.hedgeDelta()).revertedWith('Interaction delay');
    await fastForward(HOUR_SEC * 3);

    receipt = await (await c.poolHedger.hedgeDelta()).wait();

    assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
      oldShort: '2.3043',
      newShort: '0',
      oldCollateral: '8028.299',
      newCollateral: '3993.9779',
    });

    await expect(c.poolHedger.hedgeDelta()).revertedWith('Interaction delay');
    await fastForward(HOUR_SEC * 3);

    receipt = await (await c.poolHedger.hedgeDelta()).wait();

    // Slight quirk that collateral cannot be reclaimed until after the interaction delay has passed
    // - this isn't super important, as the delay is bypassed in the 0 case.
    assertShortSetToMatches(getEventArgs(receipt, 'ShortSetTo'), {
      oldShort: '0',
      newShort: '0',
      oldCollateral: '3993.9779',
      newCollateral: '0',
    });
    receipt = await (await c.poolHedger.hedgeDelta()).wait();

    assertLongSetToMatches(getEventArgs(receipt, 'LongSetTo'), {
      oldAmount: '0',
      newAmount: '2.1929',
    });
  });
});

describe('PoolHedger - unit tests', async () => {
  let deployer: Signer;
  let account: Signer;
  let c: TestSystemContractsType;
  let testPoolHedger: TestPoolHedger;
  let snap: number;
  const EXCHANGE_TYPE = 2;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    account = signers[1];

    c = await deployTestContracts(deployer);

    testPoolHedger = (await (await ethers.getContractFactory('TestPoolHedger'))
      .connect(deployer)
      .deploy()) as TestPoolHedger;
    c.poolHedger = testPoolHedger;

    await initTestSystem(c, {});
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('init', async () => {
    it('should not allow init twice', async () => {
      await expect(
        testPoolHedger.init(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS),
      ).revertedWith('contract already initialized');
    });
  });

  describe('initShort', async () => {
    beforeEach(async () => {
      // Just mint more than the minCollateral to allow it to be initialized
      await c.test.quoteToken.mint(testPoolHedger.address, toBN('10000'));
    });
    it('can only be called by owner', async () => {
      await expect(testPoolHedger.connect(account).initShort()).revertedWith('Ownable: caller is not the owner');
    });

    it('cannot init short before hedger is initialized', async () => {
      const newPoolHedger = (await (await ethers.getContractFactory('TestPoolHedger'))
        .connect(deployer)
        .deploy()) as TestPoolHedger;
      await expect(newPoolHedger.initShort()).revertedWith('contract must be initialized');
    });

    it('cannot init short before hedger is initialized', async () => {
      await expect(testPoolHedger.reopenShort()).revertedWith('not initialized');
    });

    it('cannot init short twice', async () => {
      await testPoolHedger.initShort();
      await expect(testPoolHedger.initShort()).revertedWith('shorting already initialized');
    });

    it('quoteAsset approval to short contract is set to maxInt, shortId is set', async () => {
      // Create empty short with id = 0, so when calling initShort() the shortId will be 1 and we can check it was set
      await c.test.collateralShort.createTestEmptyLoanForAccount(testPoolHedger.address);

      const exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      const allowanceBefore = await c.test.quoteToken.allowance(testPoolHedger.address, exchangeGlobals.short);
      const shortIdBefore = await testPoolHedger.shortId();

      await testPoolHedger.initShort();

      const allowance = await c.test.quoteToken.allowance(testPoolHedger.address, exchangeGlobals.short);
      const shortId = await testPoolHedger.shortId();

      expect(allowanceBefore).to.eq(0);
      expect(allowance).to.eq(MAX_UINT);
      expect(shortIdBefore).to.eq(0);
      expect(shortId).to.gt(0);
    });
  });

  describe('setShortBuffer', async () => {
    describe('revert condtions', async () => {
      it('fails if too low', async () => {
        await expect(testPoolHedger.setShortBuffer(toBN('0'))).revertedWith('buffer too low');
      });

      it('fails if too high', async () => {
        await expect(testPoolHedger.setShortBuffer(toBN('100'))).revertedWith('buffer too high');
      });
    });

    describe('sucess', async () => {
      it('updates the buffer', async () => {
        const newBuffer = toBN('2');
        await testPoolHedger.setShortBuffer(newBuffer);
        const buffer = await testPoolHedger.shortBuffer();
        expect(buffer).eq(newBuffer);
      });
    });
  });

  describe('hedgeDelta', async () => {
    describe('revert conditions', async () => {
      it('cannot call hedge if shorting has not been initialized', async () => {
        await expect(testPoolHedger.hedgeDelta()).revertedWith('shorting must be initialized');
      });
    });

    describe('hedging scenarios', async () => {
      beforeEach(async () => {
        await c.test.quoteToken.mint(c.liquidityPool.address, toBN('1000000'));
        await testPoolHedger.initShort();
      });

      describe('from 0 position', async () => {
        it('net delta goes up', async () => {
          const netDelta = toBN('10');
          const poolHedgerBalBefore = await c.test.quoteToken.balanceOf(testPoolHedger.address);
          // once to remove collateral from init
          await testPoolHedger.hedgeDeltaExt(netDelta);
          // once to update position to long
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const bal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          const poolHedgerBal = await c.test.quoteToken.balanceOf(testPoolHedger.address);

          expect(bal).eq(netDelta);
          expect(poolHedgerBalBefore).eq(0);
          expect(poolHedgerBal).eq(0);
        });

        it('net delta goes down', async () => {
          const netDelta = toBN('-10');
          const poolHedgerBalBefore = await c.test.quoteToken.balanceOf(testPoolHedger.address);

          // once to update collateral
          await testPoolHedger.hedgeDeltaExt(netDelta);
          // once to update short
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
          const bal = await testPoolHedger.getShortPosition(globals.short);
          expect(bal.shortBalance).eq(netDelta.mul(-1));
          const ratio = await testPoolHedger.shortBuffer();
          expect(bal.collateral).eq(netDelta.mul(-1).mul(globals.spotPrice).mul(ratio).div(UNIT).div(UNIT));

          const poolHedgerBal = await c.test.quoteToken.balanceOf(testPoolHedger.address);
          expect(poolHedgerBalBefore).eq(0);
          expect(poolHedgerBal).eq(0);
        });
      });

      describe('from a positive net delta position', async () => {
        beforeEach(async () => {
          const netDelta = toBN('10');
          // once to update collateral to 0
          await testPoolHedger.hedgeDeltaExt(netDelta);
          // once to go long
          await testPoolHedger.hedgeDeltaExt(netDelta);
        });

        it('net delta goes further up', async () => {
          const netDelta = toBN('30');

          await testPoolHedger.hedgeDeltaExt(netDelta);

          const bal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(bal).eq(netDelta);
        });

        it('net delta goes down, but above 0', async () => {
          const netDelta = toBN('1');

          await testPoolHedger.hedgeDeltaExt(netDelta);

          const bal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(bal).eq(netDelta);
        });

        it('net delta goes to 0', async () => {
          const netDelta = toBN('0');

          await testPoolHedger.hedgeDeltaExt(netDelta);

          const bal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(bal).eq(netDelta);
        });

        it('net delta goes negative', async () => {
          const netDelta = toBN('-10');

          // close long
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const baseBal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(baseBal).eq(0);

          // get collateral
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
          let bal = await testPoolHedger.getShortPosition(globals.short);
          const ratio = await testPoolHedger.shortBuffer();
          expect(bal.shortBalance).eq(0);
          expect(bal.collateral).eq(netDelta.mul(-1).mul(globals.spotPrice).mul(ratio).div(UNIT).div(UNIT));

          // open short
          await testPoolHedger.hedgeDeltaExt(netDelta);

          bal = await testPoolHedger.getShortPosition(globals.short);
          expect(bal.shortBalance).eq(netDelta.mul(-1));
          expect(bal.collateral).eq(netDelta.mul(-1).mul(globals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
        });
      });

      describe('from a negative net delta position', async () => {
        beforeEach(async () => {
          const netDelta = toBN('-10');
          // Once to get the right collateral
          await testPoolHedger.hedgeDeltaExt(netDelta);
          // Once to set short
          await testPoolHedger.hedgeDeltaExt(netDelta);
        });

        it('net delta goes further down', async () => {
          const netDelta = toBN('-30');

          await testPoolHedger.hedgeDeltaExt(netDelta);
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const baseBal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(baseBal).eq(0);

          const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
          const bal = await testPoolHedger.getShortPosition(globals.short);
          expect(bal.shortBalance).eq(netDelta.mul(-1));
          const ratio = await testPoolHedger.shortBuffer();
          expect(bal.collateral).eq(netDelta.mul(-1).mul(globals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
        });

        it('net delta goes up, but below 0', async () => {
          const netDelta = toBN('-1');

          await testPoolHedger.hedgeDeltaExt(netDelta);
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const baseBal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(baseBal).eq(0);

          const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
          const bal = await testPoolHedger.getShortPosition(globals.short);
          expect(bal.shortBalance).eq(netDelta.mul(-1));
          const ratio = await testPoolHedger.shortBuffer();
          expect(bal.collateral).eq(netDelta.mul(-1).mul(globals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
        });

        it('net delta goes to 0', async () => {
          const netDelta = toBN('0');

          await testPoolHedger.hedgeDeltaExt(netDelta);
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const baseBal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(baseBal).eq(0);

          const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
          const bal = await testPoolHedger.getShortPosition(globals.short);
          expect(bal.shortBalance).eq(0);
          expect(bal.collateral).eq(0);
        });

        it('net delta goes positive', async () => {
          const netDelta = toBN('10');

          await testPoolHedger.hedgeDeltaExt(netDelta);
          await testPoolHedger.hedgeDeltaExt(netDelta);
          await testPoolHedger.hedgeDeltaExt(netDelta);

          const baseBal = await c.test.baseToken.balanceOf(testPoolHedger.address);
          expect(baseBal).eq(netDelta);

          const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
          const bal = await testPoolHedger.getShortPosition(globals.short);
          expect(bal.shortBalance).eq(0);
          expect(bal.collateral).eq(0);
        });
      });
    });
  });

  describe('increaseLong', async () => {
    let exchangeGlobals: any;
    let hedgerBaseInitialBalance: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('1000000'));
      await testPoolHedger.initShort();
      exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      hedgerBaseInitialBalance = await c.test.baseToken.balanceOf(testPoolHedger.address);
    });

    it('will increase long to desired amount, accounting for fees', async () => {
      const increaseBalance = toBN('10');
      await testPoolHedger.increaseLongExt(exchangeGlobals, increaseBalance);

      const hedgerBaseAfterBalance = await c.test.baseToken.balanceOf(testPoolHedger.address);

      expect(hedgerBaseAfterBalance).equal(hedgerBaseInitialBalance.add(increaseBalance));
    });

    it('will increase long up to the available delta hedging LP funds, even if more is desired', async () => {
      const increaseBalance = toBN('100000000000');
      await testPoolHedger.increaseLongExt(exchangeGlobals, increaseBalance);

      const hedgerBaseAfterBalance = await c.test.baseToken.balanceOf(testPoolHedger.address);

      expect(hedgerBaseAfterBalance).gt(hedgerBaseInitialBalance);
      expect(hedgerBaseAfterBalance).lt(hedgerBaseInitialBalance.add(increaseBalance));
    });

    it('will revert if exchange fails', async () => {
      await c.test.synthetix.setReturnZero(true);
      await expect(testPoolHedger.increaseLongExt(exchangeGlobals, toBN('10'))).revertedWith(
        'increaseLong: Received 0 from exchange',
      );
    });
  });

  describe('decreaseLong', async () => {
    let exchangeGlobals: any;
    let hedgerBaseInitialBalance: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('1000000'));
      await testPoolHedger.initShort();

      await c.test.baseToken.mint(testPoolHedger.address, toBN('100'));
      exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      hedgerBaseInitialBalance = await c.test.baseToken.balanceOf(testPoolHedger.address);
    });

    it('will sell the amount of baseAsset requested', async () => {
      const decreaseAmount = toBN('10');
      await testPoolHedger.decreaseLongExt(exchangeGlobals, decreaseAmount);

      const hedgerBaseAfterBalance = await c.test.baseToken.balanceOf(testPoolHedger.address);

      expect(hedgerBaseAfterBalance).equal(hedgerBaseInitialBalance.sub(decreaseAmount));
    });

    it('will revert if trying to sell more', async () => {
      const decreaseAmount = hedgerBaseInitialBalance.add(toBN('100'));
      await expect(testPoolHedger.decreaseLongExt(exchangeGlobals, decreaseAmount)).revertedWith(
        'ERC20: burn amount exceeds balance',
      );
    });

    it('will revert if exchange fails', async () => {
      await c.test.synthetix.setReturnZero(true);
      await expect(testPoolHedger.decreaseLongExt(exchangeGlobals, toBN('10'))).revertedWith(
        'decreaseLong: Received 0 from exchange',
      );
    });
  });

  it('will fail to set short if shorting not initialized', async () => {
    const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
    await expect(testPoolHedger.setShortToExt(globals, toBN('10'), toBN('10'), toBN('10'))).revertedWith(
      'shorting not initialized',
    );
  });

  describe('setShortTo', async () => {
    let exchangeGlobals: any;
    let ratio: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('10000000'));
      await testPoolHedger.initShort();

      exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      ratio = await testPoolHedger.shortBuffer();
    });

    describe('from a 1000 collateral 0 short position', async () => {
      it('will increase collateral to ratio * price * desiredShort and short to desiredShort', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(initBal.shortBalance).eq(0);
        expect(initBal.collateral).eq(toBN('1000'));

        const netDelta = toBN('-1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).gt(initBal.collateral);
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will reduce collateral to ratio * price * desiredShort and short to desiredShort', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(initBal.shortBalance).eq(0);
        expect(initBal.collateral).eq(toBN('1000'));

        const netDelta = toBN('-0.1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).lt(initBal.collateral);
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will set collateral to 0 if desiredShort = 0', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(initBal.shortBalance).eq(0);
        expect(initBal.collateral).eq(toBN('1000'));

        const netDelta = toBN('0');
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(0);
        expect(bal.collateral).eq(0);
      });
    });

    describe('from a 0 collateral position', async () => {
      beforeEach(async () => {
        const netDelta = toBN('0');
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const initBalAfter = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(initBalAfter.shortBalance).eq(0);
        expect(initBalAfter.collateral).eq(0);
      });

      it('will set collateral to ratio * price * desiredShort and short to desiredShort', async () => {
        const netDelta = toBN('-1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will set collateral to max available and short to half that', async () => {
        const netDelta = toBN('-100000000000000000000');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        const availableLiq = await c.liquidityPool.getLiquidity(exchangeGlobals.spotPrice, exchangeGlobals.short);

        // Note that free is close to half of used, minus any fee.
        // Also, the 2/3rds of the fee is "soaked" up by the free CollatLiquidity
        expect(availableLiq.freeCollatLiquidity).eq(toBN('6661111.111111111111111112'));
        expect(availableLiq.usedCollatLiquidity).eq(0);
        expect(availableLiq.freeDeltaLiquidity).eq(toBN('1663888.888888888888888624'));
        expect(availableLiq.usedDeltaLiquidity).eq(toBN('1666666.666666666666666932'));

        // as the ratio is 2, the usedDeltaLiquidity is:
        // (2 * ethPrice * dollars in collateral) - (eth amount * price)
        // Thus we test-helpers with ratio - 1, or in this case, 2 - 1 = 1
        expect(bal.shortBalance).eq(
          availableLiq.usedDeltaLiquidity.mul(UNIT).div(exchangeGlobals.spotPrice).mul(UNIT).div(ratio.sub(UNIT)),
        );
      });

      it('will keep collateral and short at 0 for desiredShort = 0', async () => {
        const netDelta = toBN('0');
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(0);
        expect(bal.collateral).eq(0);
      });

      it('will keep collateral and short at 0 for desiredShort > 0 if LP sends 0', async () => {
        const quoteBalance = await c.test.quoteToken.balanceOf(c.liquidityPool.address);
        await c.test.quoteToken.burn(c.liquidityPool.address, quoteBalance);

        const netDelta = toBN('-1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(0);
        expect(bal.collateral).eq(0);
      });
    });

    describe('from a 2 : 1 collateral : short position', async () => {
      beforeEach(async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        const desiredShort = initBal.collateral.mul(UNIT).mul(UNIT).div(exchangeGlobals.spotPrice).div(ratio);
        await testPoolHedger.hedgeDeltaExt(desiredShort.mul(-1));
        await testPoolHedger.hedgeDeltaExt(desiredShort.mul(-1));
      });

      it('will reduce collateral and short', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);

        const netDelta = toBN('-0.1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).lt(initBal.shortBalance);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).lt(initBal.collateral);
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will increase collateral and short', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);

        const netDelta = toBN('-1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).gt(initBal.shortBalance);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).gt(initBal.collateral);
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will set position to 0', async () => {
        const netDelta = toBN('0');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(0);
        expect(bal.collateral).eq(0);
      });

      it('will set collateral to max available and short to half that', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);

        const availableLiq = await c.liquidityPool.getLiquidity(exchangeGlobals.spotPrice, exchangeGlobals.short);

        const netDelta = toBN('-1000000000000000000000000');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.collateral).eq(initBal.collateral.add(availableLiq.freeDeltaLiquidity));
        expect(bal.shortBalance).eq(
          initBal.collateral
            .add(availableLiq.freeDeltaLiquidity)
            .mul(UNIT)
            .mul(UNIT)
            .div(exchangeGlobals.spotPrice)
            .div(ratio),
        );
      });
    });

    describe('from a 1 : 1 collateral : short position', async () => {
      beforeEach(async () => {
        const netDelta = toBN('-1');
        await c.mocked.exchangeRates.mockLatestPrice(toBN('500'));
        exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1000'));
        exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      });

      it('will reduce collateral and short', async () => {
        const netDelta = toBN('-0.25');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will increase collateral and reduce short', async () => {
        const netDelta = toBN('-0.75');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will increase collateral and short', async () => {
        const netDelta = toBN('-1.5');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will increase collateral to max and increase short to half that', async () => {
        const initBal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        const availableLiq = await c.liquidityPool.getLiquidity(exchangeGlobals.spotPrice, exchangeGlobals.short);

        const netDelta = toBN('-1000000000000000000000000');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);

        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.collateral).eq(initBal.collateral.add(availableLiq.freeDeltaLiquidity));
        expect(bal.shortBalance).eq(
          initBal.collateral
            .add(availableLiq.freeDeltaLiquidity)
            .mul(UNIT)
            .mul(UNIT)
            .div(exchangeGlobals.spotPrice)
            .div(ratio),
        );
      });

      it('will increase collateral and keep short the same', async () => {
        const netDelta = toBN('-1');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });

      it('will keep collateral the same and decrease short', async () => {
        const netDelta = toBN('-0.5');
        await testPoolHedger.hedgeDeltaExt(netDelta);
        await testPoolHedger.hedgeDeltaExt(netDelta);
        const bal = await testPoolHedger.getShortPosition(exchangeGlobals.short);
        expect(bal.shortBalance).eq(netDelta.mul(-1));
        expect(bal.collateral).eq(netDelta.mul(-1).mul(exchangeGlobals.spotPrice).mul(ratio).div(UNIT).div(UNIT));
      });
    });
  });

  it('will fail to send all quote to lp', async () => {
    await c.test.quoteToken.setForceFail(true);
    await expect(testPoolHedger.sendAllQuoteToLPExt()).revertedWith('quote transfer failed');
  });
});

function assertPositionUpdatedMatches(
  event: any,
  expected: { oldNetDelta: string; currentNetDelta: string; expectedNetDelta: string },
) {
  assertEventValsMatch(event, expected);
}
// function assertBaseExchangedMatches(event: any, expected: {baseAmount: string,  quoteReceived: string}) { assertEventValsMatch(event, expected); }
function assertQuoteExchangedMatches(event: any, expected: { quoteAmount: string; baseReceived: string }) {
  assertEventValsMatch(event, expected);
}
function assertLongSetToMatches(event: any, expected: { oldAmount: string; newAmount: string }) {
  assertEventValsMatch(event, expected);
}
function assertShortSetToMatches(
  event: any,
  expected: { oldShort: string; newShort: string; oldCollateral: string; newCollateral: string },
) {
  assertEventValsMatch(event, expected);
}
function assertQuoteReturnedToLPMatches(event: any, expected: { amountQuote: string }) {
  assertEventValsMatch(event, expected);
}

function assertEventValsMatch(event: any, expected: { [key: string]: string }) {
  for (const key of Object.keys(expected)) {
    assertCloseTo(event[key], toBN(expected[key]));
  }
}
