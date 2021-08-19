import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getEventArgs, MONTH_SEC, toBN, TradeType, ZERO_ADDRESS } from '../../scripts/util/web3utils';
import { fastForward, restoreSnapshot, takeSnapshot } from '../utils';
import { createDefaultBoardWithOverrides } from '../utils/contractHelpers';
import { deployTestContracts, initTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('transfer and exchange failure edge cases', async () => {
  let deployer: Signer;
  let deployerAddr: string;
  let c: TestSystemContractsType;
  let snap: number;
  let boardId: BigNumber;
  let listingIds: BigNumber[];

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployerAddr = await deployer.getAddress();

    c = await deployTestContracts(deployer);

    await c.test.synthetix.setReturnZero(true);

    await initTestSystem(c, {});
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  describe('LP - exchangeBase', async () => {
    beforeEach(async () => {
      boardId = await seedTestSystem(deployer, c);
      listingIds = await c.optionMarket.getBoardListings(boardId);
    });

    it('reverts when exchange returns 0', async () => {
      await c.optionMarket.openPosition(listingIds[1], TradeType.LONG_CALL, toBN('1'));
      await expect(c.liquidityPool.exchangeBase()).revertedWith('ReceivedZeroFromQuoteBaseExchange');
      await c.test.baseToken.mint(c.liquidityPool.address, toBN('2'));
      await expect(c.liquidityPool.exchangeBase()).revertedWith('ReceivedZeroFromBaseQuoteExchange');
    });
  });

  describe('LP - withdraw', async () => {
    const seedAmount = toBN('100000');
    const depositAmount = toBN('100');
    let certId: BigNumber;

    beforeEach(async () => {
      await c.test.quoteToken.mint(deployerAddr, seedAmount);
      await c.test.quoteToken.approve(c.liquidityPool.address, seedAmount);
      await c.liquidityPool.deposit(deployerAddr, depositAmount);
      certId = (await c.liquidityCertificate.certificates(deployerAddr))[0];
    });

    it('certificateData.enteredAt == 0', async () => {
      await c.test.quoteToken.setForceFail(true);
      await expect(c.liquidityPool.withdraw(deployerAddr, certId)).revertedWith('QuoteTransferFailed');
    });

    it('certificateData.enteredAt == maxExpiryTimestamp', async () => {
      boardId = await createDefaultBoardWithOverrides(c);
      const tx = await c.liquidityPool.deposit(deployerAddr, depositAmount);
      certId = getEventArgs(await tx.wait(), 'Deposit').certificateId;
      await c.test.quoteToken.setForceFail(true);
      await expect(c.liquidityPool.withdraw(deployerAddr, certId)).revertedWith('QuoteTransferFailed');
    });

    it('certificateData.burnableAt == 0 && currentRoundValue != 0', async () => {
      boardId = await createDefaultBoardWithOverrides(c);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();
      await c.test.quoteToken.setForceFail(true);
      await expect(c.liquidityPool.withdraw(deployerAddr, certId)).revertedWith('QuoteTransferFailed');
    });

    it('certificateData.burnableAt != 0 && exitValue != 0', async () => {
      boardId = await createDefaultBoardWithOverrides(c);
      await c.liquidityPool.signalWithdrawal(certId);
      await fastForward(MONTH_SEC);
      await c.mocked.exchangeRates.mockLatestPrice(toBN('1742.01337'));
      await c.optionMarket.liquidateExpiredBoard(boardId);
      await c.liquidityPool.endRound();

      await createDefaultBoardWithOverrides(c);
      await c.test.quoteToken.setForceFail(true);
      await expect(c.liquidityPool.withdraw(deployerAddr, certId)).revertedWith('QuoteTransferFailed');
    });
  });
});

describe('init edge cases', async () => {
  let deployer: Signer;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];

    c = await deployTestContracts(deployer);
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  it('LiquidityPool will fail to init with wrong number of strings', async () => {
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
    ).revertedWith('error msg count');

    // fails with 1 extra
    await expect(
      c.liquidityPool.init(
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        [
          'QuoteTransferFailed',
          'AlreadySignalledWithdrawal',
          'SignallingBetweenRounds',
          'UnSignalMustSignalFirst',
          'UnSignalAlreadyBurnable',
          'WithdrawNotBurnable',
          'EndRoundWithLiveBoards',
          'EndRoundAlreadyEnded',
          'EndRoundMustExchangeBase',
          'EndRoundMustHedgeDelta',
          'StartRoundMustEndRound',
          'ReceivedZeroFromBaseQuoteExchange',
          'ReceivedZeroFromQuoteBaseExchange',
          'LockingMoreQuoteThanIsFree',
          'LockingMoreBaseThanCanBeExchanged',
          'FreeingMoreBaseThanLocked',
          'SendPremiumNotEnoughCollateral',
          'OnlyPoolHedger',
          'OnlyOptionMarket',
          'OnlyShortCollateral',
          'ReentrancyDetected',
          'Last',
        ],
      ),
    ).revertedWith('error msg count');
  });

  it('OptionMarket will fail to init with wrong number of strings', async () => {
    await expect(
      c.optionMarket.init(
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        [],
      ),
    ).revertedWith('error msg count');

    // fails with 1 extra
    await expect(
      c.optionMarket.init(
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        [
          'TransferOwnerToZero',
          'InvalidBoardId',
          'InvalidBoardIdOrNotFrozen',
          'InvalidListingIdOrNotFrozen',
          'StrikeSkewLengthMismatch',
          'BoardMaxExpiryReached',
          'CannotStartNewRoundWhenBoardsExist',
          'ZeroAmountOrInvalidTradeType',
          'BoardFrozenOrTradingCutoffReached',
          'QuoteTransferFailed',
          'BaseTransferFailed',
          'BoardAlreadyLiquidated',
          'Last',
        ],
      ),
    ).revertedWith('error msg count');
  });
});
