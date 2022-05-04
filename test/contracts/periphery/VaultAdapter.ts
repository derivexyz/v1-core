import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { DAY_SEC, fromBN, MAX_UINT, MONTH_SEC, OptionType, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { TestVaultAdapter } from '../../../typechain-types';
import { assertCloseTo } from '../../utils/assert';
import { deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { createDefaultBoardWithOverrides, seedTestSystem } from '../../utils/seedTestSystem';
import { expect } from '../../utils/testSetup';

describe('VaultAdapter tests', () => {
  let account: SignerWithAddress;
  let accountAddr: string;
  let boardId: BigNumber;
  let listingIds: BigNumber[];

  let testVaultAdapter: TestVaultAdapter;
  let c: TestSystemContractsType;
  let snap: number;

  before(async () => {
    const signers = await ethers.getSigners();
    account = signers[0];
    accountAddr = await account.getAddress();

    c = await deployTestSystem(account);

    await seedTestSystem(account, c);

    await c.snx.quoteAsset.mint(accountAddr, toBN('100000'));
    await c.snx.quoteAsset.connect(account).approve(c.optionMarketWrapper.address, MAX_UINT);
    await c.snx.baseAsset.connect(account).approve(c.optionMarketWrapper.address, MAX_UINT);

    const blackScholes = await (await ethers.getContractFactory('BlackScholes')).connect(account).deploy();
    testVaultAdapter = (await (
      await ethers.getContractFactory('TestVaultAdapter', {
        libraries: {
          BlackScholes: blackScholes.address,
        },
      })
    )
      .connect(account)
      .deploy()) as TestVaultAdapter;

    await testVaultAdapter.setLyraAddressesExt(
      c.testCurve.address,
      c.optionToken.address,
      c.optionMarket.address,
      c.liquidityPool.address,
      c.shortCollateral.address,
      c.synthetixAdapter.address,
      c.optionMarketPricer.address,
      c.optionGreekCache.address,
      c.snx.quoteAsset.address,
      c.snx.baseAsset.address,
      c.basicFeeCounter.address,
    );

    await c.snx.quoteAsset.mint(testVaultAdapter.address, toBN('100000'));
    await c.snx.baseAsset.mint(testVaultAdapter.address, toBN('100000'));

    boardId = (await c.optionMarket.getLiveBoards())[0];
    listingIds = await c.optionMarket.getBoardStrikes(boardId);

    await createDefaultBoardWithOverrides(c, {
      expiresIn: DAY_SEC,
      baseIV: '1.0',
      strikePrices: ['1250', '1500', '1750'],
      skews: ['0.9', '1', '1.1'],
    });
    await createDefaultBoardWithOverrides(c, {
      expiresIn: WEEK_SEC,
      baseIV: '1.1',
      strikePrices: ['1000', '1500', '2000'],
      skews: ['0.9', '1.1', '1.3'],
    });
    await createDefaultBoardWithOverrides(c, {
      expiresIn: MONTH_SEC,
      baseIV: '1.2',
      strikePrices: ['1000', '2000', '3000'],
      skews: ['0.8', '1.1', '1.4'],
    });

    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
  });

  describe('Market Getters', async () => {
    it('getBoard', async () => {
      boardId = (await c.optionMarket.getLiveBoards())[0];
      const returnedBoard = await testVaultAdapter.getBoardExt(boardId);
      expect(returnedBoard.id).to.eq(1);
      expect(returnedBoard.boardIv).to.eq(toBN('1'));
      expect(returnedBoard.strikeIds[0]).to.eq(1);
      expect(returnedBoard.strikeIds[1]).to.eq(2);
      expect(returnedBoard.strikeIds[2]).to.eq(3);
      // const tx = (await testVaultAdapter.estimateGas.getBoardExt(boardId)) as any;
    });

    it('getStrikes', async () => {
      const strikeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const strikes = await testVaultAdapter.getStrikesExt(strikeIds); // id3 expiry = 0 ?

      expect(strikes[0].id).to.eq(1);
      expect(strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(strikes[1].id).to.eq(2);
      expect(strikes[1].strikePrice).to.eq(toBN('2000'));
      expect(strikes[5].id).to.eq(6);
      expect(strikes[5].strikePrice).to.eq(toBN('1750'));
      expect(strikes[9].id).to.eq(10);
      expect(strikes[9].strikePrice).to.eq(toBN('1000'));

      // const tx = await testVaultAdapter.estimateGas.getStrikesExt(strikeIds);
      // console.log(`tx gas: ${tx}`)
    });

    it('getVols', async () => {
      const vols = await testVaultAdapter.getVolsExt([1, 2, 3]);

      assertCloseTo(vols[0], toBN('0.9'));
      assertCloseTo(vols[0], toBN('1.0'));
      assertCloseTo(vols[0], toBN('1.1'));
    });

    it('getDeltas', async () => {
      const callDeltas = await testVaultAdapter.getDeltasExt([1, 2, 3]);
      // const gas = await testVaultAdapter.estimateGas.getDeltasExt([1, 2, 3]);

      assertCloseTo(callDeltas[0], toBN('0.77'));
      assertCloseTo(callDeltas[1], toBN('0.36'));
      assertCloseTo(callDeltas[2], toBN('0.15'));
    });

    it('getVegas', async () => {
      const vegas = await testVaultAdapter.getVegasExt([1, 2, 3]);
      // const gas = await testVaultAdapter.estimateGas.getVegasExt([1, 2, 3]);

      assertCloseTo(vegas[0], toBN('146'));
      assertCloseTo(vegas[1], toBN('181'));
      assertCloseTo(vegas[2], toBN('114'));
    });

    it('getPurePremiumForStrike', async () => {
      const [call, put] = await testVaultAdapter.getPurePremiumForStrikeExt(1);

      assertCloseTo(call, toBN('313.615'));
      assertCloseTo(put, toBN('65.8'));
    });

    it('getFreeLiquidity', async () => {
      const freeLiq = await testVaultAdapter.getFreeLiquidityExt();
      expect(freeLiq).to.eq(toBN('500000'));
    });

    it('getMarketParams', async () => {
      const params = await testVaultAdapter.getMarketParamsExt();

      assertCloseTo(params[0], toBN('5'));
      assertCloseTo(params[1], toBN('0.75'));
      assertCloseTo(params[2], toBN('0.5'));
      assertCloseTo(params[3], toBN('0.15'));
    });

    it('getExchangeParams', async () => {
      const params = await testVaultAdapter.getExchangeParamsExt();

      assertCloseTo(params[0], toBN('1742'));
      assertCloseTo(params[1], toBN('0.005'));
      assertCloseTo(params[2], toBN('0.075'));
    });

    it('getLiveBoards', async () => {
      const liveBoards = await testVaultAdapter.getLiveBoardsExt();

      expect(liveBoards[0]).to.eq(1);
      expect(liveBoards[1]).to.eq(2);
      expect(liveBoards[2]).to.eq(3);
      expect(liveBoards[3]).to.eq(4);
    });
  });

  describe('Position functions', async () => {
    it('can open position', async () => {
      const params = {
        strikeId: listingIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('500'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.openPositionExt(params);

      const result1 = await c.optionToken.getPositionWithOwner(1);
      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // let pos = await testVaultAdapter.getPositionsExt([1, 2, 3]);
      // console.log(`pos ${pos}`);
    });

    it('can open position with rewards', async () => {
      const params = {
        strikeId: listingIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('500'),
        rewardRecipient: accountAddr,
      };

      await c.basicFeeCounter.setTrustedCounter(testVaultAdapter.address, true);

      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.openPositionExt(params);

      const result1 = await c.optionToken.getPositionWithOwner(1);
      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      const trustedCounter = await c.basicFeeCounter.trustedCounter(testVaultAdapter.address);
      expect(trustedCounter).to.eq(true);
    });

    it('can close position', async () => {
      const params = {
        strikeId: listingIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      const closeParams = {
        strikeId: listingIds[0],
        positionId: 1,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('300'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.closePositionExt(closeParams);
      await expect(c.optionToken.getPositionWithOwner(1)).revertedWith('ERC721: owner query for nonexistent token');
    });

    it('can split position', async () => {
      const params = {
        strikeId: listingIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.splitPositionExt(1, toBN('0.2'), 0, accountAddr);
      const result1 = await c.optionToken.getPositionWithOwner(2);

      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('0.2'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);
    });

    it('can merge positions', async () => {
      const params = {
        strikeId: listingIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.openPositionExt(params);
      await testVaultAdapter.mergePositionsExt([1, 2, 3]);

      const result1 = await c.optionToken.getPositionWithOwner(1);
      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);
    });
  });

  describe('Exchange to exact quote/base', async () => {
    it('exchangeFromExactQuote', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      // Exchange quote for base
      await testVaultAdapter.exchangeFromExactQuoteExt(toBN('1751'), toBN('1'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      expect(quoteBalBefore - quoteBalAfter).to.eq(1751);
      expect(baseBalAfter - baseBalBefore).to.eq(1.0001329668302787);

      // Revert for not enough base received
      await expect(testVaultAdapter.exchangeFromExactQuoteExt(toBN('1751'), toBN('1.1'))).to.revertedWith(
        'base received too low',
      );
    });

    it('exchangeToExactQuote', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      // Exchange base for quote
      await testVaultAdapter.exchangeToExactQuoteExt(toBN('1720'), toBN('1'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      expect(quoteBalAfter - quoteBalBefore).to.eq(1720);
      expect(baseBalBefore - baseBalAfter).to.eq(0.99482444334717);

      // Revert for not enough base sent
      await expect(testVaultAdapter.exchangeToExactQuoteExt(toBN('1750'), toBN('1'))).to.revertedWith(
        'BaseQuoteExchangeExceedsLimit',
      );
    });

    it('exchangeFromExactBase', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      // Exchange base for quote
      await testVaultAdapter.exchangeFromExactBaseExt(toBN('1'), toBN('1720'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      expect(quoteBalAfter - quoteBalBefore).to.eq(1728.948269725006);
      expect(baseBalBefore - baseBalAfter).to.eq(1);

      // Revert for quote received too low
      await expect(testVaultAdapter.exchangeFromExactBaseExt(toBN('1'), toBN('1730'))).to.revertedWith(
        'quote received too low',
      );
    });

    it('exchangeToExactBase', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      // Exchange quote for base
      await testVaultAdapter.exchangeToExactBaseExt(toBN('1'), toBN('1751'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testVaultAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testVaultAdapter.address));

      expect(quoteBalBefore - quoteBalAfter).to.eq(1750.7672060301556);
      expect(baseBalAfter - baseBalBefore).to.eq(1);

      // Revert for not enough quote sent
      await expect(testVaultAdapter.exchangeToExactBaseExt(toBN('1'), toBN('1740'))).to.revertedWith(
        'QuoteBaseExchangeExceedsLimit',
      );
    });
  });
});
