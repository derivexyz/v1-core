import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { DAY_SEC, getEventArgs, MONTH_SEC, toBN, TradeType, UNIT, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { TestLiquidityPool, TestPoolHedger } from '../../typechain';
import {
  assertCloseToPercentage,
  assertNotCloseToPercentage,
  currentTime,
  fastForward,
  fastForwardTo,
  restoreSnapshot,
  takeSnapshot,
} from '../utils';
import { createDefaultBoardWithOverrides } from '../utils/contractHelpers';
import {
  deployTestContracts,
  deployTestSystem,
  initTestSystem,
  TestSystemContractsType,
} from '../utils/deployTestSystem';
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('LiquidityPool - unit tests', () => {
  let deployer: Signer;
  let deployerAddr: string;
  let account: Signer;
  let accountAddr: string;
  let c: TestSystemContractsType;
  let snap: number;
  const EXCHANGE_TYPE = 2;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    account = signers[1];
    accountAddr = await account.getAddress();

    c = await deployTestContracts(deployer);
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
        c.liquidityPool.init(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          [],
        ),
      ).revertedWith('already initialized');
    });
  });

  describe('tokenPriceQuote', async () => {
    it('Returns the initial rate if the token supply is 0', async () => {
      const result = await c.liquidityPool.tokenPriceQuote();
      expect(result).equal(toBN('1'));
    });

    it.skip('Correctly calculates the price of tokens');

    it.skip('Errors if the token supply > 0 and pool value = 0');
  });

  describe('deposit', async () => {
    const depositAmount = toBN('100');

    describe('before a round', async () => {
      beforeEach(async () => {
        await c.test.quoteToken.mint(deployerAddr, depositAmount);
        await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount);
        await c.liquidityPool.deposit(deployerAddr, depositAmount);
      });

      it('Fails if the user does not have enough funds', async () => {
        await expect(c.liquidityPool.connect(account).deposit(deployerAddr, toBN('1'))).to.be.revertedWith(
          'ERC20: transfer amount exceeds balance',
        );
      });

      it('Correctly adds the amount to the queuedQuoteFunds', async () => {
        expect((await c.liquidityPool.queuedQuoteFunds()).eq(depositAmount));
      });

      it('Issues a certificate for the user with enteredAt 0 if no boards have been created', async () => {
        const id = (await c.liquidityCertificate.certificates(deployerAddr))[0];
        expect(await c.liquidityCertificate.enteredAt(id)).eq(toBN('0'));
      });
    });

    describe('during a round', async () => {
      beforeEach(async () => {
        await c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC / 2,
          toBN('1'),
          [toBN('1500')],
          [toBN('1')],
        );
        await c.test.quoteToken.mint(deployerAddr, depositAmount);
        await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount);
        await c.liquidityPool.deposit(deployerAddr, depositAmount);
      });

      it('Issues a certificate for the user with enteredAt = maxExpiryTimestamp if round is active', async () => {
        const certificateId = (await c.liquidityCertificate.certificates(deployerAddr))[0];
        const maxExpiryTimestamp = await c.optionMarket.maxExpiryTimestamp();
        expect(await c.liquidityCertificate.enteredAt(certificateId)).eq(maxExpiryTimestamp);
      });
    });

    describe('after a round', async () => {
      beforeEach(async () => {
        const tx = await c.optionMarket.createOptionBoard(
          (await currentTime()) + MONTH_SEC / 2,
          toBN('1'),
          [toBN('1500')],
          [toBN('1')],
        );
        const boardId = getEventArgs(await tx.wait(), 'BoardCreated').boardId;
        await fastForward(MONTH_SEC / 2);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await c.liquidityPool.endRound();

        await c.test.quoteToken.mint(deployerAddr, depositAmount);
        await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount);
        await c.liquidityPool.deposit(deployerAddr, depositAmount);
      });

      it('Issues a certificate for the user with enteredAt = maxExpiryTimestamp if round has ended', async () => {
        const certificateId = (await c.liquidityCertificate.certificates(deployerAddr))[0];
        const maxExpiryTimestamp = await c.optionMarket.maxExpiryTimestamp();
        expect(await c.liquidityCertificate.enteredAt(certificateId)).eq(maxExpiryTimestamp);
      });
    });
  });

  describe('signalWithdrawal', async () => {
    const depositAmount = toBN('100');
    let id: BigNumber;
    let boardId: BigNumber;
    let expiry: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(deployerAddr, toBN('1000000'));
      await c.test.quoteToken.approve(c.liquidityPool.address, toBN('1000000'));
      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      id = (await c.liquidityCertificate.certificates(deployerAddr))[0];
      boardId = await createDefaultBoardWithOverrides(c);
      expiry = (await c.optionMarket.optionBoards(boardId)).expiry;
    });

    it('correctly sets burnableAt', async () => {
      const maxExpiryTimestamp = await c.optionMarket.maxExpiryTimestamp();
      await c.liquidityPool.signalWithdrawal(id);
      expect(await c.liquidityCertificate.burnableAt(id)).eq(maxExpiryTimestamp);
    });

    it('tokens burnable for round is added to correctly if funds enteredAt == 0', async () => {
      await c.liquidityPool.signalWithdrawal(id);
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).eq(depositAmount);
    });

    it('reverts if the funds entered in the current round', async () => {
      await c.test.quoteToken.mint(accountAddr, depositAmount);
      await c.test.quoteToken.connect(account).approve(c.liquidityPool.address, depositAmount);
      await c.liquidityPool.connect(account).deposit(accountAddr, depositAmount);
      id = (await c.liquidityCertificate.certificates(accountAddr))[0];
      await expect(c.liquidityPool.signalWithdrawal(id)).revertedWith('SignallingBetweenRounds');
    });

    it('tokens burnable for round is added to correctly if funds enteredAt != 0', async () => {
      // Add some value to the pool
      await c.test.quoteToken.mint(c.liquidityPool.address, depositAmount.mul(10));

      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      expect(await c.liquidityPool.expiryToTokenValue(expiry)).eq(toBN('11'));
      await c.liquidityPool.deposit(deployerAddr, toBN('110'));
      boardId = await createDefaultBoardWithOverrides(c);
      const newExpiry = (await c.optionMarket.optionBoards(boardId)).expiry;
      expect(await c.liquidityPool.tokenPriceQuote()).to.eq(toBN('11'));
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('990'));

      id = (await c.liquidityCertificate.certificates(deployerAddr))[1];
      await c.liquidityPool.signalWithdrawal(id);
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).to.eq(toBN('10'));
      await c.liquidityPool.unSignalWithdrawal(id);
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).to.eq(toBN('0'));
      await c.liquidityPool.signalWithdrawal(id);
      // $110 at $11 each => 10 tokens, even though pool is larger now
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).to.eq(toBN('10'));

      await fastForwardTo(newExpiry.toNumber());
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      await c.liquidityPool.withdraw(deployerAddr, id);

      expect(await c.liquidityPool.tokenPriceQuote()).to.eq(toBN('20'));
    });

    it('cannot signal withdrawal twice', async () => {
      await c.liquidityPool.signalWithdrawal(id);
      await expect(c.liquidityPool.signalWithdrawal(id)).revertedWith('AlreadySignalledWithdrawal');
    });
  });

  describe('unsignalWithdrawal', async () => {
    const depositAmount = toBN('100');
    let id: BigNumber;
    let boardId: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(deployerAddr, depositAmount.mul(3));
      await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount.mul(3));
      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      id = (await c.liquidityCertificate.certificates(deployerAddr))[0];
      boardId = await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.signalWithdrawal(id);
    });

    it('correctly resets burnableAt to 0', async () => {
      await c.liquidityPool.unSignalWithdrawal(id);
      expect(await c.liquidityCertificate.burnableAt(id)).eq(toBN('0'));
    });

    it('allows unsignalling token if burnableAt set, but < current timestamp', async () => {
      // fast forward to end the round, then try to unsignal.
      await fastForward(MONTH_SEC);
      await c.liquidityPool.unSignalWithdrawal(id);
    });

    it('reverts if trying to unsignal after a round has ended', async () => {
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      await expect(c.liquidityPool.unSignalWithdrawal(id)).revertedWith('UnSignalAlreadyBurnable');
    });

    it('reverts if the token has burnableAt == 0', async () => {
      // try to do it from a different certificate ID that hasn't signalled
      await c.test.quoteToken.mint(deployerAddr, depositAmount);
      await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount);
      await c.liquidityPool.deposit(deployerAddr, depositAmount);

      const newId = (await c.liquidityCertificate.certificates(deployerAddr))[1];
      await expect(c.liquidityPool.unSignalWithdrawal(newId)).to.be.revertedWith('UnSignalMustSignalFirst');
    });

    it('correctly subtracts from tokensBurnableForRound if enteredAt == 0', async () => {
      const tokensBurnableForRoundBefore = await c.liquidityPool.pub_tokensBurnableForRound();

      await c.liquidityPool.unSignalWithdrawal(id);

      const tokensBurnableForRoundAfter = await c.liquidityPool.pub_tokensBurnableForRound();
      const liquidity = await c.liquidityCertificate.liquidity(id);
      expect(tokensBurnableForRoundAfter).eq(tokensBurnableForRoundBefore.sub(liquidity));
    });

    it('correctly subtracts from tokensBurnableForRound if enteredAt != 0', async () => {
      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      id = (await c.liquidityCertificate.certificates(deployerAddr))[1];
      await fastForward(MONTH_SEC + 1);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      boardId = await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.signalWithdrawal(id);

      const tokensBurnableForRoundBefore = await c.liquidityPool.pub_tokensBurnableForRound();
      await c.liquidityPool.unSignalWithdrawal(id);
      const tokensBurnableForRoundAfter = await c.liquidityPool.pub_tokensBurnableForRound();
      const certificateData = await c.liquidityCertificate.certificateData(id);

      const expiryToTokenValue = await c.liquidityPool.expiryToTokenValue(certificateData.enteredAt);
      const substracted = certificateData.liquidity.mul(toBN('1')).div(expiryToTokenValue);

      expect(tokensBurnableForRoundAfter).eq(tokensBurnableForRoundBefore.sub(substracted));
    });
  });

  describe('withdraw', async () => {
    const seedAmount = toBN('100000');
    const depositAmount = toBN('100');
    let id: BigNumber;
    let boardId: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(deployerAddr, seedAmount);
      await c.test.quoteToken.approve(c.liquidityPool.address, seedAmount);
      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      id = (await c.liquidityCertificate.certificates(deployerAddr))[0];
    });

    it('should get back their liquidity exactly if enteredAt == maxExpiryTimestamp == 0', async () => {
      await c.liquidityPool.withdraw(deployerAddr, id);
      const bal = await c.test.quoteToken.balanceOf(deployerAddr);
      expect(bal).eq(seedAmount);
    });

    it('should reduce totalQuoteAmountReserved by the amount of quote withdrawn', async () => {
      boardId = await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.signalWithdrawal(id);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      let bal = await c.liquidityPool.pub_totalQuoteAmountReserved();
      expect(bal).eq(depositAmount);

      await c.liquidityPool.withdraw(deployerAddr, id);
      bal = await c.liquidityPool.pub_totalQuoteAmountReserved();
      expect(bal).eq(toBN('0'));
    });

    it('should allow withdrawing after a round has ended', async () => {
      boardId = await createDefaultBoardWithOverrides(c);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      let bal = await c.liquidityPool.pub_totalQuoteAmountReserved();
      expect(bal).eq(toBN('0')); // None is reserved

      await c.liquidityPool.withdraw(deployerAddr, id);
      bal = await c.liquidityPool.pub_totalQuoteAmountReserved();
      expect(bal).eq(toBN('0'));
    });

    describe('certificateData.enteredAt == 0', async () => {
      it('cannot withdraw tokens twice', async () => {
        await c.liquidityPool.withdraw(deployerAddr, id);
        await expect(c.liquidityPool.withdraw(deployerAddr, id)).to.revertedWith('certificate does not exist');
      });
    });

    describe('certificateData.enteredAt == maxExpiryTimestamp', async () => {
      beforeEach(async () => {
        boardId = await createDefaultBoardWithOverrides(c);
        const tx = await c.liquidityPool.deposit(deployerAddr, depositAmount);
        id = getEventArgs(await tx.wait(), 'Deposit').certificateId;
      });

      it('cannot withdraw tokens twice', async () => {
        await c.liquidityPool.withdraw(deployerAddr, id);
        await expect(c.liquidityPool.withdraw(deployerAddr, id)).to.revertedWith('certificate does not exist');
      });
    });

    describe('certificateData.burnableAt == 0 && currentRoundValue != 0', async () => {
      beforeEach(async () => {
        boardId = await createDefaultBoardWithOverrides(c);
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await c.liquidityPool.endRound();
      });
      it('cannot withdraw tokens twice', async () => {
        await c.liquidityPool.withdraw(deployerAddr, id);
        await expect(c.liquidityPool.withdraw(deployerAddr, id)).to.revertedWith('certificate does not exist');
      });
    });

    describe('certificateData.burnableAt != 0  && exitValue != 0', async () => {
      beforeEach(async () => {
        boardId = await createDefaultBoardWithOverrides(c);
        await c.liquidityPool.signalWithdrawal(id);
        await fastForward(MONTH_SEC);
        await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
        await c.optionMarket.liquidateExpiredBoard(boardId);
        await c.liquidityPool.endRound();

        await createDefaultBoardWithOverrides(c);
      });

      it('cannot withdraw tokens twice', async () => {
        await c.liquidityPool.withdraw(deployerAddr, id);
        await expect(c.liquidityPool.withdraw(deployerAddr, id)).to.revertedWith('certificate does not exist');
      });
    });
  });

  describe('endRound', async () => {
    let boardId: BigNumber;
    const depositAmount = toBN('10000');
    const purchaseAmount = toBN('1000');

    beforeEach(async () => {
      await c.test.quoteToken.mint(deployerAddr, depositAmount);
      await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount);
      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      const certId = (await c.liquidityCertificate.certificates(deployerAddr))[0];
      boardId = await createDefaultBoardWithOverrides(c);
      await c.poolHedger.initShort();
      await c.liquidityPool.signalWithdrawal(certId);
    });

    it('should end round as expected if hedged delta is 0', async () => {
      await fastForward(MONTH_SEC);
      // calls end round for us
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      expect(await c.liquidityPool.expiryToTokenValue(await c.optionMarket.maxExpiryTimestamp())).eq(toBN('1'));
      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).eq(depositAmount);
      expect(await c.liquidityPool.pub_totalTokenSupply()).eq(0);
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).eq(0);
    });

    it('should end round as expected if hedged delta is negative', async () => {
      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      await c.test.quoteToken.mint(deployerAddr, purchaseAmount);
      await c.test.quoteToken.approve(c.optionMarket.address, purchaseAmount);
      await c.optionMarket.openPosition(5, TradeType.LONG_CALL, toBN('1'));
      await c.poolHedger.hedgeDelta();

      await fastForward(MONTH_SEC);
      // calls end round for us
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.poolHedger.hedgeDelta();
      await c.liquidityPool.endRound();

      expect(await c.poolHedger.getValueQuote(globals.short, globals.spotPrice)).eq(0);
      expect(await c.liquidityPool.expiryToTokenValue(await c.optionMarket.maxExpiryTimestamp())).gt(toBN('1'));
      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).gt(depositAmount);
      expect(await c.liquidityPool.pub_totalTokenSupply()).eq(0);
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).eq(0);
    });

    it('should end round as expected if hedged delta is positive', async () => {
      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      const collateral = toBN('10000');
      await c.test.quoteToken.mint(deployerAddr, collateral);
      await c.test.quoteToken.approve(c.optionMarket.address, collateral);
      await c.optionMarket.openPosition(5, TradeType.SHORT_PUT, toBN('1'));
      await c.poolHedger.hedgeDelta();

      await fastForward(MONTH_SEC);
      // calls end round for us
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.poolHedger.hedgeDelta();
      await c.liquidityPool.endRound();

      expect(await c.poolHedger.getValueQuote(globals.short, globals.spotPrice)).eq(0);
      expect(await c.liquidityPool.expiryToTokenValue(await c.optionMarket.maxExpiryTimestamp())).lt(toBN('1'));
      expect(await c.liquidityPool.pub_totalQuoteAmountReserved()).lt(depositAmount);
      expect(await c.liquidityPool.pub_totalTokenSupply()).eq(0);
      expect(await c.liquidityPool.pub_tokensBurnableForRound()).eq(0);
    });

    it('cannot end round if netDelta is negative', async () => {
      await c.test.quoteToken.mint(deployerAddr, purchaseAmount);
      await c.test.quoteToken.approve(c.optionMarket.address, purchaseAmount);
      await c.optionMarket.openPosition(5, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();
      await c.poolHedger.hedgeDelta();
      await c.poolHedger.hedgeDelta();

      await fastForward(MONTH_SEC);
      // calls end round for us
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await expect(c.liquidityPool.endRound()).revertedWith('EndRoundMustExchangeBase');
      await c.liquidityPool.exchangeBase();
      await expect(c.liquidityPool.endRound()).revertedWith('EndRoundMustHedgeDelta');
    });

    it('cannot end round if netDelta is positive', async () => {
      const collateral = toBN('10000');
      await c.test.quoteToken.mint(deployerAddr, collateral);
      await c.test.quoteToken.approve(c.optionMarket.address, collateral);
      await c.optionMarket.openPosition(5, TradeType.SHORT_PUT, toBN('1'));
      await c.poolHedger.hedgeDelta();
      await c.poolHedger.hedgeDelta();

      await fastForward(MONTH_SEC);
      // calls end round for us
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await expect(c.liquidityPool.endRound()).revertedWith('EndRoundMustHedgeDelta');
    });

    it('reverts for different reasons', async () => {
      await c.test.quoteToken.mint(deployerAddr, purchaseAmount);
      await c.test.quoteToken.approve(c.optionMarket.address, purchaseAmount);

      await expect(c.liquidityPool.endRound()).revertedWith('EndRoundWithLiveBoards');
      await c.optionMarket.openPosition(5, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();

      await fastForward(MONTH_SEC);
      await c.optionMarket.liquidateExpiredBoard(boardId);

      await expect(c.liquidityPool.endRound()).revertedWith('EndRoundMustExchangeBase');
      await c.liquidityPool.exchangeBase();
      await c.liquidityPool.endRound();
      await expect(c.liquidityPool.endRound()).revertedWith('EndRoundAlreadyEnded');
    });
  });

  describe('startRound', async () => {
    const depositAmount = toBN('100');

    const addBoard = async () =>
      c.optionMarket.createOptionBoard((await currentTime()) + MONTH_SEC / 2, toBN('1'), [toBN('1500')], [toBN('1')]);
    let boardId: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(deployerAddr, depositAmount.mul(10));
      await c.test.quoteToken.approve(c.liquidityPool.address, depositAmount.mul(10));
      await c.liquidityPool.deposit(deployerAddr, depositAmount);

      await addBoard();
      boardId = (await c.optionMarket.getLiveBoards())[0];
    });

    it('if lastMaxExpiryTimestamp == 0 sets totalTokenSupply to queuedQuoteFunds, and resets queuedFunds', async () => {
      expect(await c.liquidityPool.pub_totalTokenSupply()).eq(depositAmount);
      expect(await c.liquidityPool.queuedQuoteFunds()).eq(toBN('0'));
    });

    it("reverts if previous round hasn't ended", async () => {
      await fastForward(MONTH_SEC);
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await expect(addBoard()).revertedWith('StartRoundMustEndRound');
      // Can add board after ending round
      await c.liquidityPool.endRound();
      await addBoard();
    });

    it('if lastMaxExpiryTimestamp > 0 adds queuedQuoteFunds/price to totalTokenSupply, and resets queuedFunds', async () => {
      await fastForward(MONTH_SEC);
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      expect(await c.liquidityPool.queuedQuoteFunds()).eq(depositAmount);
      await addBoard();

      expect(await c.liquidityPool.pub_totalTokenSupply()).eq(depositAmount.mul(2));
      expect(await c.liquidityPool.queuedQuoteFunds()).eq(toBN('0'));
    });
  });

  describe('getLiquidity', async () => {
    const initialValue = toBN('30000');
    const funds = toBN('1000');
    let globals: any;

    beforeEach(async () => {
      globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      await c.test.quoteToken.mint(c.liquidityPool.address, initialValue);
      await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('0'));
    });

    it('Returns 0 for used and free liquidity if the pool is empty', async () => {
      await c.test.quoteToken.burn(c.liquidityPool.address, initialValue);
      const liquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      expect(liquidity.freeCollatLiquidity).eq(toBN('0'));
      expect(liquidity.freeDeltaLiquidity).eq(toBN('0'));
      expect(liquidity.usedCollatLiquidity).eq(toBN('0'));
      expect(liquidity.usedDeltaLiquidity).eq(toBN('0'));
    });

    it('Given 0 used, correctly splits the liquidity into 2 : 1 ratio', async () => {
      const liquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      expect(liquidity.freeCollatLiquidity).eq(initialValue.mul(2).div(3));
      expect(liquidity.freeDeltaLiquidity).eq(initialValue.div(3));
      expect(liquidity.usedCollatLiquidity).eq(toBN('0'));
      expect(liquidity.usedDeltaLiquidity).eq(toBN('0'));
    });

    it('Correctly returns the used collat and delta liquidity after a trade and BEFORE hedging', async () => {
      const oldLiquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      await c.test.quoteToken.mint(deployerAddr, funds);
      await c.test.quoteToken.approve(c.optionMarket.address, funds);
      await createDefaultBoardWithOverrides(c, {
        expiresIn: MONTH_SEC / 2,
        baseIV: '1',
        strikes: ['1500'],
        skews: ['1'],
      });
      const tx = await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();
      const newLiquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      const cost = getEventArgs(await tx.wait(), 'PositionOpened').totalCost;
      expect(newLiquidity.freeCollatLiquidity).eq(
        oldLiquidity.freeCollatLiquidity.sub(globals.spotPrice).add(cost.mul(2).div(3)),
      );
      // This add 1 comes from rounding issues which change based on how long this test-helpers takes to run...
      expect(newLiquidity.freeDeltaLiquidity).eq(oldLiquidity.freeDeltaLiquidity.add(cost.div(3).add(1)));
      expect(newLiquidity.usedCollatLiquidity).eq(globals.spotPrice);
      expect(newLiquidity.usedDeltaLiquidity).eq(toBN('0'));
    });

    it('Correctly returns the used collat and delta liquidity after a trade and AFTER hedging', async () => {
      await c.test.quoteToken.mint(deployerAddr, funds);
      await c.test.quoteToken.approve(c.optionMarket.address, funds);
      await createDefaultBoardWithOverrides(c, {
        expiresIn: MONTH_SEC / 2,
        baseIV: '1',
        strikes: ['1500'],
        skews: ['1'],
      });
      await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'));
      await c.poolHedger.initShort();
      await c.poolHedger.hedgeDelta();

      const newLiquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      const valueQuote = await c.poolHedger.getValueQuote(globals.short, globals.spotPrice);

      const totalPoolValueQuote = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, valueQuote);
      const usedCollatLiquidityQuote = (
        await c.liquidityPool.getLiquidity(globals.spotPrice, c.test.collateralShort.address)
      ).usedCollatLiquidity;

      expect(newLiquidity.freeCollatLiquidity).eq(totalPoolValueQuote.mul(2).div(3).sub(usedCollatLiquidityQuote));
      expect(newLiquidity.freeDeltaLiquidity).eq(
        totalPoolValueQuote.sub(totalPoolValueQuote.mul(2).div(3)).sub(valueQuote),
      );
      expect(newLiquidity.usedCollatLiquidity).eq(globals.spotPrice);
      expect(newLiquidity.usedDeltaLiquidity).eq(valueQuote);
    });
    it('If the vol liquidity > 2/3rds, scales the delta liquidity down', async () => {
      await c.test.quoteToken.mint(deployerAddr, funds);
      await c.test.quoteToken.approve(c.optionMarket.address, funds);
      await createDefaultBoardWithOverrides(c, {
        expiresIn: MONTH_SEC / 2,
        baseIV: '1',
        strikes: ['1500'],
        skews: ['1'],
      });
      await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();
      await c.poolHedger.initShort();
      await c.poolHedger.hedgeDelta();
      const valueQuote = await c.poolHedger.getValueQuote(globals.short, globals.spotPrice);

      const usedCollatLiquidityQuote = (
        await c.liquidityPool.getLiquidity(globals.spotPrice, c.test.collateralShort.address)
      ).usedCollatLiquidity;
      const tL = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, valueQuote);
      await c.test.quoteToken.burn(c.liquidityPool.address, tL.sub(usedCollatLiquidityQuote.div(2).mul(3)).add(1));
      const tL2 = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, valueQuote);
      const deltaPortion = tL2.sub(usedCollatLiquidityQuote);

      const newLiquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);

      expect(newLiquidity.freeCollatLiquidity).eq(0);
      expect(newLiquidity.freeDeltaLiquidity).eq(deltaPortion.sub(valueQuote));
    });
    it('If the delta liquidity > 1/3rds, scales the vol liquidity down', async () => {
      await c.test.quoteToken.mint(deployerAddr, funds);
      await c.test.quoteToken.approve(c.optionMarket.address, funds);
      await createDefaultBoardWithOverrides(c, {
        expiresIn: MONTH_SEC / 2,
        baseIV: '1',
        strikes: ['1500'],
        skews: ['1'],
      });
      await c.optionMarket.openPosition(1, TradeType.LONG_CALL, toBN('1'));
      await c.liquidityPool.exchangeBase();
      await c.poolHedger.initShort();
      await c.poolHedger.hedgeDelta();
      const valueQuote = await c.poolHedger.getValueQuote(globals.short, globals.spotPrice);

      const b = await c.test.quoteToken.balanceOf(c.liquidityPool.address);
      await c.test.quoteToken.burn(c.liquidityPool.address, b.sub(264));
      await c.test.baseToken.mint(c.poolHedger.address, toBN('1'));

      const tL2 = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, valueQuote);
      const collatPortion = tL2.sub(valueQuote);
      const usedCollatLiquidityQuote = (
        await c.liquidityPool.getLiquidity(globals.spotPrice, c.test.collateralShort.address)
      ).usedCollatLiquidity;

      const newLiquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);

      expect(newLiquidity.freeCollatLiquidity).eq(collatPortion.sub(usedCollatLiquidityQuote));
      expect(newLiquidity.freeDeltaLiquidity).eq(0);
    });
  });

  it('getTotalPoolValueQuote - Returns the quote balance minus any quote queued for the next round', async () => {
    const initialValue = toBN('100000');

    await c.test.quoteToken.mint(c.liquidityPool.address, initialValue);
    await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('0'));
    const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);

    const queuedAmount = toBN('1000');
    await c.test.quoteToken.mint(deployerAddr, queuedAmount);
    await c.test.quoteToken.approve(c.liquidityPool.address, queuedAmount);
    await c.liquidityPool.deposit(deployerAddr, queuedAmount);

    const val = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, toBN('0'));
    const poolBalance = await c.test.quoteToken.balanceOf(c.liquidityPool.address);

    expect(val).eq(initialValue);
    expect(poolBalance).eq(initialValue.add(queuedAmount));
  });
});

// Separate this logic as the initialisation is different
// In this section we override the optionMarket address
describe('LiquidityPool - unit tests', () => {
  let deployer: Signer;
  let account: Signer;
  let accountAddr: string;
  let c: TestSystemContractsType;
  let snap: number;
  const EXCHANGE_TYPE = 2;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    account = signers[1];
    accountAddr = await account.getAddress();

    c = await deployTestContracts(deployer);

    await initTestSystem(c, {});
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('lockQuote', async () => {
    it('Passes successfully given parameters are 0', async () => {
      const amount = toBN('0');
      const freeLiq = toBN('0');
      await c.liquidityPool.lockQuote(amount, freeLiq);
      const locked = (await c.liquidityPool.lockedCollateral()).quote;
      expect(locked).eq(amount);
    });

    it('locked quote is updated correctly given amount < freeVolLiq', async () => {
      const amount = toBN('1000');
      const freeLiq = toBN('100000');
      await c.liquidityPool.lockQuote(amount, freeLiq);
      const locked = (await c.liquidityPool.lockedCollateral()).quote;
      expect(locked).eq(amount);
    });

    it('locked quote is updated correctly given amount == freeVolLiq', async () => {
      const amount = toBN('1000');
      const freeLiq = toBN('1000');
      await c.liquidityPool.lockQuote(amount, freeLiq);
      const locked = (await c.liquidityPool.lockedCollateral()).quote;
      expect(locked).eq(amount);
    });

    it('reverts if amount > freeVolLiq', async () => {
      const amount = toBN('1000');
      const freeLiq = toBN('100');
      await expect(c.liquidityPool.lockQuote(amount, freeLiq)).revertedWith('LockingMoreQuoteThanIsFree');
    });
  });

  describe('lockBase', async () => {
    const collatLiq = toBN('10000');
    const liquidity = {
      freeCollatLiquidity: collatLiq,
      usedCollatLiquidity: 0,
      freeDeltaLiquidity: 0,
      usedDeltaLiquidity: 0,
    };

    beforeEach(async () => {
      // give quote straight to the LP, so we can bypass the deposit flow
      await c.test.quoteToken.mint(c.liquidityPool.address, collatLiq);
    });

    it('Locks the correct amount of base, accounting for fee', async () => {
      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      const amount = toBN('1');
      await c.liquidityPool.lockBase(amount, globals, liquidity);
      const locked = (await c.liquidityPool.lockedCollateral()).base;
      expect(locked).eq(amount);
    });

    it('Locks the correct amount of base if fee is 0', async () => {
      await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('0'));
      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      const amount = toBN('1');
      await c.liquidityPool.lockBase(amount, globals, liquidity);
      const locked = (await c.liquidityPool.lockedCollateral()).base;
      expect(locked).eq(amount);
    });

    it('Reverts if there is not enough quote in the pool to cover the cost of the base', async () => {
      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      const amount = toBN('10');
      await expect(c.liquidityPool.lockBase(amount, globals, liquidity)).revertedWith(
        'LockingMoreBaseThanCanBeExchanged',
      );
    });

    it('Will revert if there is not enough quote to cover all missing base', async () => {
      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      const amount = toBN('5');
      await c.liquidityPool.lockBase(amount, globals, liquidity);
      await expect(
        c.liquidityPool.lockBase(amount, globals, { ...liquidity, freeCollatLiquidity: toBN('3115') }),
      ).revertedWith('LockingMoreBaseThanCanBeExchanged');
    });

    it('Will account for base balances >= than required', async () => {
      const zeroLiquidity = { ...liquidity, freeCollatLiquidity: 0 };

      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      await expect(c.liquidityPool.lockBase(toBN('1'), globals, zeroLiquidity)).revertedWith(
        'LockingMoreBaseThanCanBeExchanged',
      );
      await c.test.baseToken.mint(c.liquidityPool.address, toBN('1'));
      // passes even though available collat liquidity is 0, as it uses excess base balance
      await c.liquidityPool.lockBase(toBN('1'), globals, zeroLiquidity);
    });

    it('Will account for base balances < than required, but > 0', async () => {
      const zeroLiquidity = { ...liquidity, freeCollatLiquidity: 0 };
      const someLiquidity = { ...liquidity, freeCollatLiquidity: toBN('1000') };

      const globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      await expect(c.liquidityPool.lockBase(toBN('1'), globals, zeroLiquidity)).revertedWith(
        'LockingMoreBaseThanCanBeExchanged',
      );
      await c.test.baseToken.mint(c.liquidityPool.address, toBN('0.5'));
      // passes even though available collat liquidity is 0, as it uses excess base balance
      await expect(c.liquidityPool.lockBase(toBN('1'), globals, zeroLiquidity)).revertedWith(
        'LockingMoreBaseThanCanBeExchanged',
      );
      await c.liquidityPool.lockBase(toBN('1'), globals, someLiquidity);
    });
  });

  describe('freeQuoteCollateral', async () => {
    const amount = toBN('1000');
    const freeLiq = toBN('100000');

    beforeEach(async () => {
      await c.liquidityPool.lockQuote(amount, freeLiq);
    });

    it('will free an amount of quote', async () => {
      const freeAmount = toBN('1000');
      await c.liquidityPool.freeQuoteCollateral(freeAmount);
      const locked = (await c.liquidityPool.lockedCollateral()).quote;
      expect(locked).eq(amount.sub(freeAmount));
    });

    it("will send remaining if there isn't enough available quote", async () => {
      const freeAmount = toBN('1100');
      await c.liquidityPool.freeQuoteCollateral(freeAmount);
      const locked = (await c.liquidityPool.lockedCollateral()).quote;
      expect(locked).eq(0);
    });
  });

  describe('freeBase', async () => {
    const collatLiq = toBN('10000');
    const liquidity = {
      freeCollatLiquidity: collatLiq,
      usedCollatLiquidity: 0,
      freeDeltaLiquidity: 0,
      usedDeltaLiquidity: 0,
    };
    let globals: any;
    const amount = toBN('1');

    beforeEach(async () => {
      globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      await createDefaultBoardWithOverrides(c);
      // give quote straight to the LP, so we can bypass the deposit flow
      await c.test.quoteToken.mint(c.liquidityPool.address, collatLiq);
      await c.liquidityPool.lockBase(amount, globals, liquidity);
      await c.liquidityPool.exchangeBase();
    });

    it('will free an amount of base', async () => {
      const freeAmount = toBN('1');
      await c.liquidityPool.freeBase(amount);
      const locked = (await c.liquidityPool.lockedCollateral()).base;
      expect(locked).eq(amount.sub(freeAmount));
    });

    it('will return quote minus fee worth of base', async () => {
      const balBefore = await c.test.quoteToken.balanceOf(c.liquidityPool.address);
      const freeAmount = toBN('1');
      await c.liquidityPool.freeBase(freeAmount);
      await c.liquidityPool.exchangeBase();

      const balAfter = await c.test.quoteToken.balanceOf(c.liquidityPool.address);

      expect(balAfter).gt(balBefore);
    });

    it("will revert if there isn't enough available base", async () => {
      const freeAmount = toBN('2');
      await expect(c.liquidityPool.freeBase(freeAmount)).revertedWith('FreeingMoreBaseThanLocked');
    });
  });

  describe('liquidateCollateral', async () => {
    let exchangeGlobals: any;
    const collatLiq = toBN('10000');
    const liquidity = {
      freeCollatLiquidity: collatLiq,
      usedCollatLiquidity: 0,
      freeDeltaLiquidity: 0,
      usedDeltaLiquidity: 0,
    };

    beforeEach(async () => {
      exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
      // give quote straight to the LP, so we can bypass the deposit flow
      await c.test.quoteToken.mint(c.liquidityPool.address, collatLiq);
      // Without a board, exchangeBase will reset locked base to 0
      await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.lockBase(toBN('2'), exchangeGlobals, liquidity);
      await c.liquidityPool.lockQuote(toBN('500'), collatLiq);
      await c.liquidityPool.exchangeBase();
    });

    it('If values are 0, does nothing', async () => {
      const lockedCollateralBefore = await c.liquidityPool.lockedCollateral();

      await c.liquidityPool.boardLiquidation(toBN('0'), toBN('0'), toBN('0'));

      const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();
      expect(lockedCollateralAfter.base).to.be.eq(lockedCollateralBefore.base);
    });

    it('modifies locked collateral and quoteReserved as expected', async () => {
      const lockedCollateralBefore = await c.liquidityPool.lockedCollateral();

      const tx = await c.liquidityPool.boardLiquidation(toBN('100'), toBN('250'), toBN('1'));

      const lockedCollateralAfter = await c.liquidityPool.lockedCollateral();

      expect(getEventArgs(await tx.wait(), 'QuoteReserved').amountQuoteReserved).eq(toBN('250'));
      expect(lockedCollateralBefore.quote.sub(toBN('100'))).to.be.eq(lockedCollateralAfter.quote);
      expect(lockedCollateralBefore.base.sub(toBN('1'))).to.be.eq(lockedCollateralAfter.base);
    });
  });

  describe('exchangeBase', async () => {
    let exchangeGlobals: any;
    const collatLiq = toBN('10000');
    const liquidity = {
      freeCollatLiquidity: collatLiq,
      usedCollatLiquidity: 0,
      freeDeltaLiquidity: 0,
      usedDeltaLiquidity: 0,
    };
    const amount = toBN('1');

    beforeEach(async () => {
      exchangeGlobals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);

      // give quote straight to the LP, so we can bypass the deposit flow
      await c.test.quoteToken.mint(c.liquidityPool.address, collatLiq);
    });

    it('will purchase base from 0 to the correct amount', async () => {
      await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.lockBase(amount, exchangeGlobals, liquidity);
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('1'));
    });

    it('will sell base down to 0', async () => {
      await createDefaultBoardWithOverrides(c);
      await c.test.baseToken.mint(c.liquidityPool.address, toBN('1'));
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(0);
    });

    it('will buy base up to the correct amount', async () => {
      await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.lockBase(amount, exchangeGlobals, liquidity);
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('1'));
      await c.liquidityPool.lockBase(amount, exchangeGlobals, liquidity);
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('1'));
      await c.liquidityPool.lockBase(amount, exchangeGlobals, liquidity);
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('3'));
    });

    it('will sell base down to the correct amount', async () => {
      await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.lockBase(amount.mul(3), exchangeGlobals, liquidity);
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('3'));

      await c.liquidityPool.freeBase(amount);
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('2'));
      await c.liquidityPool.freeBase(amount);
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('2'));
      await c.liquidityPool.freeBase(amount);
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(toBN('2'));
      await c.liquidityPool.exchangeBase();
      expect(await c.test.baseToken.balanceOf(c.liquidityPool.address)).eq(0);
    });

    it('will buy base using all available quote, even if it cant buy everything', async () => {
      await createDefaultBoardWithOverrides(c);
      // Room for ~5.8
      await c.liquidityPool.lockBase(amount.mul(5), exchangeGlobals, liquidity);
      await c.liquidityPool.exchangeBase();
      await c.liquidityPool.lockBase(amount.mul(5), exchangeGlobals, {
        ...liquidity,
        freeCollatLiquidity: toBN('100000'),
      });
      const lockedCollateral = await c.liquidityPool.lockedCollateral();
      expect(lockedCollateral.base).to.eq(toBN('10'));
      await c.liquidityPool.exchangeBase();
      assertCloseToPercentage(await c.test.baseToken.balanceOf(c.liquidityPool.address), toBN('5.71178'));
    });

    it('will sell base to 0 and set locked.base to 0 if there are no boards', async () => {
      await c.liquidityPool.lockBase(amount.mul(5), exchangeGlobals, liquidity);
      await c.liquidityPool.exchangeBase();
      const lockedCollateral = await c.liquidityPool.lockedCollateral();
      expect(lockedCollateral.base).to.eq(0);
    });
  });

  describe('sendPremium', async () => {
    const amount = toBN('1000');

    beforeEach(async () => {
      await c.test.quoteToken.mint(c.liquidityPool.address, amount);
    });

    it('will revert if amount > freeCollatLiq', async () => {
      await expect(c.liquidityPool.sendPremium(accountAddr, amount, amount.sub(1))).to.be.revertedWith(
        'SendPremiumNotEnoughCollateral',
      );
    });

    it('will revert if not enough quoteAsset in pool', async () => {
      await expect(c.liquidityPool.sendPremium(accountAddr, amount.add(1), amount.add(1))).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance',
      );
    });

    it('will send funds correctly to recipient', async () => {
      const userBalanceBefore = await c.test.quoteToken.balanceOf(accountAddr);

      await c.liquidityPool.sendPremium(accountAddr, amount, amount.add(1));

      const userBalance = await c.test.quoteToken.balanceOf(accountAddr);
      expect(userBalance).to.eq(userBalanceBefore.add(amount));
    });
  });

  describe('getTotalPoolValueQuote', async () => {
    const initialValue = toBN('100000');
    let globals: any;

    beforeEach(async () => {
      await c.test.quoteToken.mint(c.liquidityPool.address, initialValue);
      await c.mocked.exchanger.mockFeeFor('sUSD', 'sETH', toBN('0'));
      globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
    });

    it('Returns the quote balance of the pool given no other factors', async () => {
      const val = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, toBN('0'));
      expect(val).eq(initialValue);
    });

    it('Returns the quote balance minus any reserved quote for paying out options', async () => {
      const reservedAmount = toBN('100');
      await c.liquidityPool.boardLiquidation(toBN('0'), reservedAmount, toBN('0'));

      const val = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, toBN('0'));
      expect(val).eq(initialValue.sub(reservedAmount));
    });

    it('Locking base does not effect the pool value', async () => {
      const liquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      await c.liquidityPool.lockBase(toBN('1'), globals, liquidity);
      await c.liquidityPool.exchangeBase();
      const val = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, toBN('0'));
      expect(val).eq(initialValue);
    });

    it("Locking quote doesn't affect the total pool value", async () => {
      const liquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
      await c.liquidityPool.lockQuote(toBN('1000'), liquidity.freeCollatLiquidity);
      const val = await c.liquidityPool.getTotalPoolValueQuote(globals.spotPrice, toBN('0'));
      expect(val).eq(initialValue);
    });
  });
});

// Separate this logic as the initialisation is different
// In this section we override the optionMarket address
describe('LiquidityPool - unit tests', () => {
  let deployer: Signer;
  let deployerAddr: string;
  let account: Signer;
  let accountAddr: string;
  let c: TestSystemContractsType;
  let snap: number;
  const reserveAmount = toBN('1000');

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    account = signers[1];
    accountAddr = await account.getAddress();

    c = await deployTestContracts(deployer);
    await initTestSystem(c, { shortCollateral: deployerAddr, optionMarket: deployerAddr });
    // await seedTestSystem(deployer, c);

    await c.test.quoteToken.mint(c.liquidityPool.address, reserveAmount);
    await c.liquidityPool.boardLiquidation(0, reserveAmount, 0);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('sendReservedQuote', async () => {
    it('will send funds from the LP to the user', async () => {
      const amountReservedBefore = await c.liquidityPool.pub_totalQuoteAmountReserved();
      const poolBalanceBefore = await c.test.quoteToken.balanceOf(c.liquidityPool.address);
      const userBalanceBefore = await c.test.quoteToken.balanceOf(accountAddr);

      await c.liquidityPool.sendReservedQuote(accountAddr, reserveAmount);

      const amountReserved = await c.liquidityPool.pub_totalQuoteAmountReserved();
      const poolBalance = await c.test.quoteToken.balanceOf(c.liquidityPool.address);
      const userBalance = await c.test.quoteToken.balanceOf(accountAddr);

      expect(amountReserved).to.eq(amountReservedBefore.sub(reserveAmount));
      expect(poolBalance).to.eq(poolBalanceBefore.sub(reserveAmount));
      expect(userBalance).to.eq(userBalanceBefore.add(reserveAmount));
    });

    it("will send less if there isn't enough reserved quote", async () => {
      const tooMuch = reserveAmount.add(toBN('1'));
      const tx = await c.liquidityPool.sendReservedQuote(deployerAddr, tooMuch);
      const event = getEventArgs(await tx.wait(), 'ReservedQuoteSent');
      expect(event.amount).eq(reserveAmount);
      expect(event.totalQuoteAmountReserved).eq(0);
    });

    it('will revert if not enough quoteAsset in pool', async () => {
      await c.test.quoteToken.burn(c.liquidityPool.address, toBN('1'));
      await expect(c.liquidityPool.sendReservedQuote(deployerAddr, reserveAmount)).revertedWith(
        'ERC20: transfer amount exceeds balance',
      );
    });

    it('will revert if transfer failed', async () => {
      await c.test.quoteToken.setForceFail(true);
      await expect(c.liquidityPool.sendReservedQuote(deployerAddr, reserveAmount)).revertedWith('QuoteTransferFailed');
    });
  });
});

// Separate this logic as the initialisation is different
// In this section we override the optionMarket address
describe('LiquidityPool - unit tests', () => {
  let deployer: Signer;
  let c: TestSystemContractsType;
  let snap: number;
  let testPoolHedger: TestPoolHedger;
  let globals: any;
  let liquidity: [BigNumber, BigNumber, BigNumber, BigNumber] & {
    freeCollatLiquidity: BigNumber;
    usedCollatLiquidity: BigNumber;
    freeDeltaLiquidity: BigNumber;
    usedDeltaLiquidity: BigNumber;
  };

  const EXCHANGE_TYPE = 2;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];

    c = await deployTestContracts(deployer);
    testPoolHedger = (await (await ethers.getContractFactory('TestPoolHedger'))
      .connect(deployer)
      .deploy()) as TestPoolHedger;
    await initTestSystem(c, { poolHedger: testPoolHedger.address });

    await testPoolHedger.init(
      c.lyraGlobals.address,
      c.optionMarket.address,
      c.optionGreekCache.address,
      c.liquidityPool.address,
      c.test.quoteToken.address,
      c.test.baseToken.address,
    );

    await seedTestSystem(deployer, c);

    globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
    liquidity = await c.liquidityPool.getLiquidity(globals.spotPrice, globals.short);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('transferQuoteToHedge', async () => {
    const amount = toBN('100');

    it('will send quote successfully', async () => {
      await testPoolHedger.callTransferQuoteToHedge(globals, amount);
      expect(await c.test.quoteToken.balanceOf(testPoolHedger.address)).eq(amount);
    });

    it('will only send up to the freeDeltaLiquidity', async () => {
      await testPoolHedger.callTransferQuoteToHedge(globals, liquidity.freeDeltaLiquidity.add(1));
      expect(await c.test.quoteToken.balanceOf(testPoolHedger.address)).eq(liquidity.freeDeltaLiquidity);
    });

    it('will fail if the transfer fails', async () => {
      await c.test.quoteToken.setForceFail(true);
      await expect(testPoolHedger.callTransferQuoteToHedge(globals, amount)).revertedWith('QuoteTransferFailed');
    });
  });
});

describe('LiquidityPool - unit tests', () => {
  let deployer: Signer;
  let deployerAddr: string;
  let account2: Signer;
  let account2Addr: string;
  let c: TestSystemContractsType;
  let globals: any;
  const liquidity = {
    freeCollatLiquidity: 0,
    usedCollatLiquidity: 0,
    freeDeltaLiquidity: 0,
    usedDeltaLiquidity: 0,
  };
  const EXCHANGE_TYPE = 2;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();
    account2 = signers[1];
    account2Addr = await account2.getAddress();

    c = await deployTestContracts(deployer);

    c.liquidityPool = (await (await ethers.getContractFactory('LiquidityPool'))
      .connect(deployer)
      .deploy()) as TestLiquidityPool;

    await initTestSystem(c, { poolHedger: account2Addr, optionMarket: account2Addr, shortCollateral: account2Addr });
    globals = await c.lyraGlobals.getExchangeGlobals(c.optionMarket.address, EXCHANGE_TYPE);
  });

  describe('function access', async () => {
    it('Blocks calls to certain functions', async () => {
      await expect(c.liquidityPool.transferQuoteToHedge(globals, toBN('1'))).revertedWith('OnlyPoolHedger');

      await expect(c.liquidityPool.sendReservedQuote(deployerAddr, toBN('1'))).revertedWith('OnlyShortCollateral');

      await expect(c.liquidityPool.startRound(0, 0)).revertedWith('OnlyOptionMarket');
      await expect(c.liquidityPool.lockQuote(0, 0)).revertedWith('OnlyOptionMarket');
      await expect(c.liquidityPool.lockBase(0, globals, liquidity)).revertedWith('OnlyOptionMarket');
      await expect(c.liquidityPool.freeQuoteCollateral(0)).revertedWith('OnlyOptionMarket');
      await expect(c.liquidityPool.freeBase(0)).revertedWith('OnlyOptionMarket');
      await expect(c.liquidityPool.boardLiquidation(0, 0, 0)).revertedWith('OnlyOptionMarket');
      await expect(c.liquidityPool.sendPremium(deployerAddr, 0, 0)).revertedWith('OnlyOptionMarket');
    });

    it('Works if caller is the correct address', async () => {
      await expect(c.liquidityPool.connect(account2).transferQuoteToHedge(globals, toBN('1'))).revertedWith(
        'function call to a non-contract account',
      );

      await c.liquidityPool.connect(account2).sendReservedQuote(deployerAddr, toBN('1'));

      await c.liquidityPool.connect(account2).startRound(0, 0);
      await c.liquidityPool.connect(account2).lockQuote(0, 0);
      await c.liquidityPool.connect(account2).lockBase(0, globals, liquidity);
      await c.liquidityPool.connect(account2).freeQuoteCollateral(0);
      await c.liquidityPool.connect(account2).freeBase(0);
      await c.liquidityPool.connect(account2).boardLiquidation(0, 0, 0);
      await c.liquidityPool.connect(account2).sendPremium(deployerAddr, 0, 0);
    });
  });
});

describe('LiquidityPool - minting and burning', () => {
  let account: SignerWithAddress;
  let accountAddr: string;
  let account2: SignerWithAddress;
  let account2Addr: string;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    accountAddr = await account.getAddress();
    account2 = signers[1];
    account2Addr = await account2.getAddress();

    c = await deployTestSystem(account);
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
        c.liquidityPool.init(
          c.lyraGlobals.address,
          c.optionMarket.address,
          c.liquidityCertificate.address,
          c.poolHedger.address,
          c.shortCollateral.address,
          c.test.quoteToken.address,
          c.test.baseToken.address,
          [],
        ),
      ).to.be.revertedWith('already initialized');
    });
  });

  describe('deposit', async () => {
    beforeEach(async () => {
      // Seed external tokens
      await c.test.quoteToken.mint(accountAddr, toBN('100'));
      await c.test.baseToken.mint(accountAddr, toBN('10'));
    });

    it('should mint tokens', async () => {
      await c.test.quoteToken.approve(c.liquidityPool.address, toBN('100'));
      await c.liquidityPool.deposit(accountAddr, toBN('100'));
      expect((await c.liquidityCertificate.certificates(accountAddr))[0]).to.eq(0);
    });

    it('should not mint tokens if not enough is approved', async () => {
      await c.test.quoteToken.approve(c.liquidityPool.address, toBN('99'));
      await expect(c.liquidityPool.deposit(accountAddr, toBN('100'))).revertedWith('transfer amount exceeds allowance');
    });

    it('should not mint tokens if the amount is less than the minimum', async () => {
      await c.test.quoteToken.approve(c.liquidityPool.address, toBN('0.99'));
      await expect(c.liquidityPool.deposit(accountAddr, toBN('0.99'))).revertedWith(
        'liquidity value of certificate must be >= 1',
      );
    });
  });

  describe('pre-listing activity', async () => {
    let certificateId: BigNumber;
    beforeEach(async () => {
      // Seed external tokens
      await c.test.quoteToken.mint(accountAddr, toBN('100'));
      await c.test.baseToken.mint(accountAddr, toBN('10'));
      await c.test.quoteToken.approve(c.liquidityPool.address, toBN('100'));
    });

    it('should allow burning if there is no expiry', async () => {
      await c.liquidityPool.deposit(accountAddr, toBN('100'));
      certificateId = (await c.liquidityCertificate.certificates(accountAddr))[0];
      await c.liquidityPool.withdraw(accountAddr, certificateId);
      expect(await c.test.quoteToken.balanceOf(accountAddr)).to.eq(toBN('100'));
    });

    it('should not give more back if the balance of the pool is larger', async () => {
      await c.liquidityPool.deposit(accountAddr, toBN('100'));
      certificateId = (await c.liquidityCertificate.certificates(accountAddr))[0];
      // add $100 directly to the pool
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('100'));
      await c.liquidityPool.withdraw(accountAddr, certificateId);
      expect(await c.test.quoteToken.balanceOf(accountAddr)).to.eq(toBN('100'));
      // There is still $100 floating in the pool, as the liquidity never took any risk
    });
  });

  describe('burning', async () => {
    let certificateId: BigNumber;
    let boardId: BigNumber;
    beforeEach(async () => {
      // Seed external tokens
      await c.test.quoteToken.mint(accountAddr, toBN('100'));
      await c.test.baseToken.mint(accountAddr, toBN('10'));
      await c.test.quoteToken.approve(c.liquidityPool.address, toBN('100'));
      await c.liquidityPool.deposit(accountAddr, toBN('100'));
      certificateId = (await c.liquidityCertificate.certificates(accountAddr))[0];
      const event = await c.optionMarket.createOptionBoard(
        (await currentTime()) + MONTH_SEC,
        toBN('10'),
        [toBN('1000')],
        [toBN('1')],
      );
      boardId = getEventArgs(await event.wait(), 'BoardCreated').boardId;
    });

    it('should give back the same balance of the pool if the pool is the same', async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();
      await c.liquidityPool.withdraw(accountAddr, certificateId);
      expect(await c.test.quoteToken.balanceOf(accountAddr)).to.eq(toBN('100'));
      // same as before
    });

    it('should give more back if the balance of the pool is larger', async () => {
      // add $100 directly to the pool
      await c.test.quoteToken.mint(c.liquidityPool.address, toBN('100'));
      await c.liquidityPool.signalWithdrawal(certificateId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();
      await c.liquidityPool.withdraw(accountAddr, certificateId);
      expect(await c.test.quoteToken.balanceOf(accountAddr)).to.eq(toBN('200'));
      // There is still $100 floating in the pool, as the liquidity never took any risk
    });

    it('should give less back if the balance of the pool is smaller', async () => {
      // burn $50 directly from the pool to imitate loss
      await c.test.quoteToken.burn(c.liquidityPool.address, toBN('50'));
      await c.liquidityPool.signalWithdrawal(certificateId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();
      await c.liquidityPool.withdraw(accountAddr, certificateId);
      expect(await c.test.quoteToken.balanceOf(accountAddr)).to.eq(toBN('50'));
      expect(await c.liquidityPool.expiryToTokenValue(await c.optionMarket.maxExpiryTimestamp())).to.equal(toBN('0.5'));
      // There is $50 belonging to the user
      // $0 in the pool
    });

    it('should start second round with half amount eq same amount of tokens', async () => {
      await c.test.quoteToken.burn(c.liquidityPool.address, toBN('50'));
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();
      // start second round
      const event = await c.optionMarket.createOptionBoard(
        (await currentTime()) + MONTH_SEC,
        toBN('10'),
        [toBN('1000')],
        [toBN('1')],
      );
      const boardId2 = getEventArgs(await event.wait(), 'BoardCreated').boardId;
      await c.liquidityPool.signalWithdrawal(certificateId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId2);
      await c.liquidityPool.endRound();

      expect(await c.liquidityPool.expiryToTokenValue(await c.optionMarket.maxExpiryTimestamp())).to.equal(toBN('0.5'));
    });

    it("should prevent burning if board hasn't been liquidated", async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await expect(c.liquidityPool.withdraw(accountAddr, certificateId)).revertedWith('WithdrawNotBurnable');
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await expect(c.liquidityPool.withdraw(accountAddr, certificateId)).revertedWith('WithdrawNotBurnable');
    });

    it('should prevent liquidating expired board if the rate is invalid', async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await expect(c.liquidityPool.withdraw(accountAddr, certificateId)).revertedWith('WithdrawNotBurnable');
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockInvalid(true);
      await expect(c.optionMarket.liquidateExpiredBoard(boardId)).revertedWith('rate is invalid');
      await expect(c.liquidityPool.withdraw(accountAddr, certificateId)).revertedWith('WithdrawNotBurnable');
    });

    it('cannot unexit funds that are past expiry', async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      await expect(c.liquidityPool.unSignalWithdrawal(certificateId)).revertedWith('UnSignalAlreadyBurnable');
    });

    it('cannot unexit funds that have not been signaled for withdrawal', async () => {
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await expect(c.liquidityPool.unSignalWithdrawal(certificateId)).revertedWith('UnSignalMustSignalFirst');
    });

    it('can unexit funds that are before expiry', async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await fastForward(DAY_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.liquidityPool.unSignalWithdrawal(certificateId);
    });

    it('can transfer tokens to another user to burn', async () => {
      await c.liquidityCertificate.transferFrom(accountAddr, account2Addr, certificateId);
      await c.liquidityPool.connect(account2).signalWithdrawal(certificateId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1700'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      // account1 is no longer the owner.
      await expect(c.liquidityPool.withdraw(accountAddr, certificateId)).revertedWith(
        'attempted to burn nonexistent certificate, or not owner',
      );
      await c.liquidityPool.connect(account2).withdraw(account2Addr, certificateId);
      expect(await c.test.quoteToken.balanceOf(account2Addr)).to.eq(toBN('100'));
    });

    it('cannot transfer tokens after signalling exit', async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await expect(c.liquidityCertificate.transferFrom(accountAddr, account2Addr, certificateId)).revertedWith(
        'cannot transfer certificates that have signalled exit',
      );
    });

    it('cannot split certificate after signalling exit', async () => {
      await c.liquidityPool.signalWithdrawal(certificateId);
      await expect(c.liquidityCertificate.split(certificateId, toBN('0.5'))).revertedWith(
        'cannot transfer certificates that have signalled exit',
      );
    });

    it('will block signalling if between rounds', async () => {
      await fastForward(MONTH_SEC);
      const acc1Certs = await c.liquidityCertificate.certificates(account.address);
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();
      await expect(c.liquidityPool.signalWithdrawal(acc1Certs[0])).revertedWith('SignallingBetweenRounds');
    });
  });

  it('will return scaled delta/collat portions based on usage', async () => {
    await seedTestSystem(account, c);
    await c.poolHedger.initShort();
    const boardId = (await c.optionMarket.getLiveBoards())[0];
    const listingId = (await c.optionMarket.getBoardListings(boardId))[0];
    await c.optionMarket.openPosition(listingId, TradeType.LONG_CALL, toBN('180').toString());
    await c.liquidityPool.exchangeBase();
    await c.poolHedger.hedgeDelta();
    await c.poolHedger.hedgeDelta();
    let liquidity = await c.liquidityPool.getLiquidity(toBN('1500'), c.test.collateralShort.address);

    let ratio = liquidity.freeCollatLiquidity
      .add(liquidity.usedCollatLiquidity)
      .mul(UNIT)
      .div(liquidity.usedDeltaLiquidity.add(liquidity.freeDeltaLiquidity));
    assertCloseToPercentage(ratio, toBN('2')); // 2 : 1 ratio

    // With an eth price of 1, used delta dominates
    liquidity = await c.liquidityPool.getLiquidity(toBN('1'), c.test.collateralShort.address);

    expect(liquidity.usedCollatLiquidity).to.eq(toBN('180')); // 180 base at $1 each
    expect(liquidity.freeDeltaLiquidity).to.eq(0);

    ratio = liquidity.freeCollatLiquidity
      .add(liquidity.usedCollatLiquidity)
      .mul(UNIT)
      .div(liquidity.usedDeltaLiquidity);
    assertNotCloseToPercentage(ratio, toBN('2'));

    // With an eth price of 10000, used collateral dominates
    liquidity = await c.liquidityPool.getLiquidity(toBN('10000'), c.test.collateralShort.address);

    expect(liquidity.freeCollatLiquidity).to.eq(0);
    expect(liquidity.usedDeltaLiquidity).to.eq(0);

    ratio = liquidity.usedCollatLiquidity.mul(UNIT).div(liquidity.freeDeltaLiquidity);
    assertNotCloseToPercentage(ratio, toBN('2'));
  });
});
