import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import {
  DAY_SEC,
  fromBN,
  HOUR_SEC,
  MAX_UINT,
  MONTH_SEC,
  OptionType,
  toBN,
  UNIT,
  WEEK_SEC,
  ZERO_ADDRESS,
} from '../../../scripts/util/web3utils';
import { OptionMarket, TestERC20Fail, TestERC20SetDecimals, TestLyraAdapter } from '../../../typechain-types';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import { openPositionWithOverrides } from '../../utils/contractHelpers';
import { DEFAULT_BOARD_PARAMS } from '../../utils/defaultParams';
import { deployTestSystem, TestSystemContractsType } from '../../utils/deployTestSystem';
import { fastForward, restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { createDefaultBoardWithOverrides, seedTestSystem } from '../../utils/seedTestSystem';
import { expect } from '../../utils/testSetup';

describe('LyraAdapter tests', () => {
  let account: SignerWithAddress;
  let accountAddr: string;
  let boardId: BigNumber;
  let strikeIds: BigNumber[];

  let testLyraAdapter: TestLyraAdapter;
  let c: TestSystemContractsType;
  let snap: number;

  let USDC: TestERC20SetDecimals;
  let DAI: TestERC20Fail;

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
    testLyraAdapter = (await (
      await ethers.getContractFactory('TestLyraAdapter', {
        libraries: {
          BlackScholes: blackScholes.address,
        },
      })
    )
      .connect(account)
      .deploy()) as TestLyraAdapter;

    await testLyraAdapter.setLyraAddressesExt(
      c.lyraRegistry.address,
      c.optionMarket.address,
      c.testCurve.address,
      c.basicFeeCounter.address,
    );

    await c.snx.quoteAsset.mint(testLyraAdapter.address, toBN('100000'));
    await c.snx.baseAsset.mint(testLyraAdapter.address, toBN('100000'));

    boardId = (await c.optionMarket.getLiveBoards())[0];
    strikeIds = await c.optionMarket.getBoardStrikes(boardId);

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

    USDC = (await (await ethers.getContractFactory('TestERC20SetDecimals'))
      .connect(account)
      .deploy('USDC', 'USDC', 6)) as TestERC20SetDecimals;
    DAI = (await (await ethers.getContractFactory('TestERC20Fail'))
      .connect(account)
      .deploy('DAI', 'DAI')) as unknown as TestERC20Fail;

    await USDC.mint(account.address, 100000 * 1e6);
    await DAI.mint(account.address, toBN('100000'));

    await c.snx.quoteAsset.connect(account).approve(testLyraAdapter.address, MAX_UINT);
    await c.snx.baseAsset.connect(account).approve(testLyraAdapter.address, MAX_UINT);
    await USDC.connect(account).approve(testLyraAdapter.address, MAX_UINT);
    await DAI.connect(account).approve(testLyraAdapter.address, MAX_UINT);

    await c.snx.quoteAsset.permitMint(c.testCurve.address, true);
    await USDC.permitMint(c.testCurve.address, true);
    await DAI.permitMint(c.testCurve.address, true);

    await c.testCurve.setRate(USDC.address, 1010000);
    await c.testCurve.setRate(DAI.address, toBN('1.01'));
    await c.testCurve.setRate(c.snx.quoteAsset.address, toBN('0.999'));

    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
    snap = await takeSnapshot();
  });

  it('misc actions', async () => {
    await testLyraAdapter.updateDelegateApproval();
  });

  describe('can set addresses', async () => {
    it('reverts if setting non-existent market', async () => {
      const optionMarket2 = (await ((await ethers.getContractFactory('OptionMarket')) as ContractFactory)
        .connect(account)
        .deploy()) as OptionMarket;

      await expect(
        testLyraAdapter.setLyraAddressesExt(
          c.lyraRegistry.address,
          optionMarket2.address,
          c.testCurve.address,
          c.basicFeeCounter.address,
        ),
      ).to.revertedWith('NonExistentMarket');
    });

    it('setLyraAddresses', async () => {
      const optionMarket2 = (await ((await ethers.getContractFactory('OptionMarket')) as ContractFactory)
        .connect(account)
        .deploy()) as OptionMarket;

      await c.lyraRegistry.addMarket({
        greekCache: c.optionGreekCache.address,
        liquidityPool: c.liquidityPool.address,
        liquidityToken: c.liquidityToken.address,
        optionMarket: optionMarket2.address,
        optionMarketPricer: c.optionMarketPricer.address,
        optionToken: c.optionToken.address,
        poolHedger: c.poolHedger.address,
        shortCollateral: c.shortCollateral.address,
        gwavOracle: c.GWAVOracle.address,
        baseAsset: c.snx.baseAsset.address,
        quoteAsset: c.snx.quoteAsset.address,
      });

      await testLyraAdapter.setLyraAddressesExt(
        c.lyraRegistry.address,
        optionMarket2.address,
        c.testCurve.address,
        c.basicFeeCounter.address,
      );

      // When setting new optionMarket, the old optionMarket allowance is set to 0
      const quoteAllowance = await c.snx.quoteAsset.allowance(testLyraAdapter.address, c.optionMarket.address);
      const baseAllowance = await c.snx.baseAsset.allowance(testLyraAdapter.address, c.optionMarket.address);
      const quoteAllowance2 = await c.snx.quoteAsset.allowance(testLyraAdapter.address, optionMarket2.address);
      const baseAllowance2 = await c.snx.baseAsset.allowance(testLyraAdapter.address, optionMarket2.address);
      expect(quoteAllowance).to.eq(0);
      expect(baseAllowance).to.eq(0);
      expect(quoteAllowance2).to.eq(MAX_UINT);
      expect(baseAllowance2).to.eq(MAX_UINT);
    });
  });

  describe('Market Getters', async () => {
    it('getBoard', async () => {
      boardId = (await c.optionMarket.getLiveBoards())[0];
      const returnedBoard = await testLyraAdapter.getBoardExt(boardId);
      expect(returnedBoard.id).to.eq(1);
      expect(returnedBoard.boardIv).to.eq(toBN('1'));
      expect(returnedBoard.strikeIds[0]).to.eq(1);
      expect(returnedBoard.strikeIds[1]).to.eq(2);
      expect(returnedBoard.strikeIds[2]).to.eq(3);
      // const tx = (await testLyraAdapter.estimateGas.getBoardExt(boardId)) as any;
    });

    it('getStrikes', async () => {
      const strikeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const strikes = await testLyraAdapter.getStrikesExt(strikeIds); // id3 expiry = 0 ?

      expect(strikes[0].id).to.eq(1);
      expect(strikes[0].strikePrice).to.eq(toBN('1500'));
      expect(strikes[1].id).to.eq(2);
      expect(strikes[1].strikePrice).to.eq(toBN('2000'));
      expect(strikes[5].id).to.eq(6);
      expect(strikes[5].strikePrice).to.eq(toBN('1750'));
      expect(strikes[9].id).to.eq(10);
      expect(strikes[9].strikePrice).to.eq(toBN('1000'));

      // const tx = await testLyraAdapter.estimateGas.getStrikesExt(strikeIds);
      // console.log(`tx gas: ${tx}`)
    });

    it('getVols', async () => {
      const vols = await testLyraAdapter.getVolsExt([1, 2, 3]);

      assertCloseTo(vols[0], toBN('0.9'));
      assertCloseTo(vols[0], toBN('1.0'));
      assertCloseTo(vols[0], toBN('1.1'));
    });

    it('getDeltas', async () => {
      const callDeltas = await testLyraAdapter.getDeltasExt([1, 2, 3]);
      // const gas = await testLyraAdapter.estimateGas.getDeltasExt([1, 2, 3]);

      assertCloseTo(callDeltas[0], toBN('0.77'));
      assertCloseTo(callDeltas[1], toBN('0.36'));
      assertCloseTo(callDeltas[2], toBN('0.15'));
    });

    it('getVegas', async () => {
      const vegas = await testLyraAdapter.getVegasExt([1, 2, 3]);
      // const gas = await testLyraAdapter.estimateGas.getVegasExt([1, 2, 3]);

      assertCloseTo(vegas[0], toBN('146'));
      assertCloseTo(vegas[1], toBN('181'));
      assertCloseTo(vegas[2], toBN('114'));
    });

    it('getPurePremium', async () => {
      const [call, put] = await testLyraAdapter.getPurePremiumExt(MONTH_SEC, toBN('0.5'), toBN('1100'), toBN('1000'));
      assertCloseTo(call, toBN('123.956'));
      assertCloseTo(put, toBN('20.13'));
    });

    it('getPurePremiumForStrike', async () => {
      const [call, put] = await testLyraAdapter.getPurePremiumForStrikeExt(1);

      assertCloseTo(call, toBN('313.615'));
      assertCloseTo(put, toBN('65.8'));
    });

    it('getLiquidity', async () => {
      const liq = await testLyraAdapter.getLiquidityExt();
      expect(liq.freeLiquidity).to.eq(toBN('500000'));
      expect(liq.burnableLiquidity).to.eq(toBN('500000'));
      expect(liq.usedCollatLiquidity).to.eq(0);
      expect(liq.pendingDeltaLiquidity).to.eq(0);
      expect(liq.usedDeltaLiquidity).to.eq(0);
      expect(liq.NAV).to.eq(toBN('500000'));
    });

    it('getFreeLiquidity', async () => {
      const freeLiq = await testLyraAdapter.getFreeLiquidityExt();
      expect(freeLiq).to.eq(toBN('500000'));
    });

    it('getMarketParams', async () => {
      const params = await testLyraAdapter.getMarketParamsExt();

      assertCloseTo(params[0], toBN('5'));
      assertCloseTo(params[1], toBN('0.75'));
      assertCloseTo(params[2], toBN('0.5'));
      assertCloseTo(params[3], toBN('0.15'));
      assertCloseTo(params[4], BigNumber.from(DAY_SEC / 2));
      assertCloseTo(params[5], toBN('0.25'));
    });

    it('getExchangeParams', async () => {
      const params = await testLyraAdapter.getExchangeParamsExt();

      assertCloseTo(params[0], toBN('1742'));
      assertCloseTo(params[1], toBN('0.005'));
      assertCloseTo(params[2], toBN('0.075'));
    });

    it('getLiveBoards', async () => {
      const liveBoards = await testLyraAdapter.getLiveBoardsExt();

      expect(liveBoards[0]).to.eq(1);
      expect(liveBoards[1]).to.eq(2);
      expect(liveBoards[2]).to.eq(3);
      expect(liveBoards[3]).to.eq(4);
    });

    it('getLiveBoards', async () => {
      const liveBoards = await testLyraAdapter.getLiveBoardsExt();

      expect(liveBoards[0]).to.eq(1);
      expect(liveBoards[1]).to.eq(2);
      expect(liveBoards[2]).to.eq(3);
      expect(liveBoards[3]).to.eq(4);
    });

    it('getMinCollateral', async () => {
      const now = await Date.now();
      const minCollateral = await testLyraAdapter.getMinCollateralExt(
        3,
        toBN('1000'),
        now + MONTH_SEC,
        toBN('1200'),
        toBN('1'),
      );
      assertCloseTo(minCollateral, toBN('1440'));
    });

    it('getMinCollateralForPosition', async () => {
      const [, pos] = await openPositionWithOverrides(c, {
        strikeId: strikeIds[1],
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('1'),
        amount: toBN('1'),
      });
      const minCollateral = await testLyraAdapter.getMinCollateralForPositionExt(pos);
      assertCloseTo(minCollateral, toBN('0.265'));
    });

    it('getMinCollateralForPosition for LONG', async () => {
      const [, pos] = await openPositionWithOverrides(c, {
        strikeId: strikeIds[1],
        optionType: OptionType.LONG_CALL,
        setCollateralTo: toBN('1'),
        amount: toBN('1'),
      });
      const minCollateral = await testLyraAdapter.getMinCollateralForPositionExt(pos);
      expect(minCollateral).to.eq(0);
    });

    it('getMinCollateralForStrike', async () => {
      const minCollateral = await testLyraAdapter.getMinCollateralForStrikeExt(3, 1, toBN('1'));
      assertCloseTo(minCollateral, toBN('798.67'));
    });

    it('getMinCollateralForStrike for LONG', async () => {
      const minCollateral = await testLyraAdapter.getMinCollateralForStrikeExt(0, 1, toBN('1'));
      expect(minCollateral).to.eq(0);
    });

    it('getPositions', async () => {
      const [, pos1] = await openPositionWithOverrides(c, {
        strikeId: strikeIds[1],
        optionType: OptionType.LONG_CALL,
        amount: toBN('0.01'),
      });
      const [, pos2] = await openPositionWithOverrides(c, {
        strikeId: strikeIds[1],
        optionType: OptionType.LONG_PUT,
        amount: toBN('0.02'),
      });
      const [, pos3] = await openPositionWithOverrides(c, {
        strikeId: strikeIds[1],
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.01'),
        amount: toBN('0.01'),
      });
      const positions = await testLyraAdapter.getPositionsExt([pos1, pos2, pos3]);
      expect(positions[0].positionId).to.eq(1);
      expect(positions[0].amount).to.eq(toBN('0.01'));
      expect(positions[1].positionId).to.eq(2);
      expect(positions[1].amount).to.eq(toBN('0.02'));
      expect(positions[2].positionId).to.eq(3);
      expect(positions[2].amount).to.eq(toBN('0.01'));
    });
  });

  describe('Position functions', async () => {
    it('can open position', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('500'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testLyraAdapter.openPositionExt(params);

      const result1 = await c.optionToken.getPositionWithOwner(1);
      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // let pos = await testLyraAdapter.getPositionsExt([1, 2, 3]);
      // console.log(`pos ${pos}`);
    });

    it('can open position with rewards', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('500'),
        rewardRecipient: accountAddr,
      };

      await expect(testLyraAdapter.openPositionExt(params)).to.be.revertedWith('not trusted counter');

      // Set adapter as trusted address
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.openPositionExt({ ...params, rewardRecipient: ZERO_ADDRESS });
      await testLyraAdapter.openPositionExt(params);

      const result1 = await c.optionToken.getPositionWithOwner(1);
      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      const trustedCounter = await c.basicFeeCounter.trustedCounter(testLyraAdapter.address);
      expect(trustedCounter).to.eq(true);
    });

    it('can close position', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: accountAddr,
      };

      const closeParams = {
        strikeId: strikeIds[0],
        positionId: 1,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('0.5'),
        setCollateralTo: 0,
        minTotalCost: 0,
        maxTotalCost: toBN('300'),
        rewardRecipient: accountAddr,
      };

      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.openPositionExt(params);
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, false);

      await expect(testLyraAdapter.closePositionExt(closeParams)).to.be.revertedWith('not trusted counter');

      // Set adapter as trusted address
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.closePositionExt({ ...closeParams, rewardRecipient: ZERO_ADDRESS });
      await testLyraAdapter.closePositionExt(closeParams);
      await expect(c.optionToken.getPositionWithOwner(1)).revertedWith('ERC721: owner query for nonexistent token');
    });

    it('can force close position', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: accountAddr,
      };

      const closeParams = {
        strikeId: strikeIds[0],
        positionId: 1,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('0.5'),
        setCollateralTo: 0,
        minTotalCost: 0,
        maxTotalCost: toBN('300'),
        rewardRecipient: accountAddr,
      };

      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.openPositionExt(params);
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, false);

      await expect(testLyraAdapter.forceClosePositionExt(closeParams)).to.be.revertedWith('not trusted counter');

      // Set adapter as trusted address
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.forceClosePositionExt({ ...closeParams, rewardRecipient: ZERO_ADDRESS });
      await testLyraAdapter.forceClosePositionExt(closeParams);
      await expect(c.optionToken.getPositionWithOwner(1)).revertedWith('ERC721: owner query for nonexistent token');
    });

    it('will close or force close', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: accountAddr,
      };

      const closeParams = {
        strikeId: strikeIds[0],
        positionId: 1,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('0.5'),
        setCollateralTo: 0,
        minTotalCost: 0,
        maxTotalCost: toBN('300'),
        rewardRecipient: accountAddr,
      };

      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.openPositionExt(params);
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, false);

      await expect(testLyraAdapter.closeOrForceClosePosition(closeParams)).to.be.revertedWith('not trusted counter');

      // Set adapter as trusted address
      await c.basicFeeCounter.setTrustedCounter(testLyraAdapter.address, true);
      await testLyraAdapter.closeOrForceClosePosition(closeParams);
      await fastForward(DEFAULT_BOARD_PARAMS.expiresIn - HOUR_SEC);
      await testLyraAdapter.closeOrForceClosePosition(closeParams);
      await expect(c.optionToken.getPositionWithOwner(1)).revertedWith('ERC721: owner query for nonexistent token');
    });

    it('can split position', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testLyraAdapter.openPositionExt(params);
      await testLyraAdapter.splitPositionExt(1, toBN('0.2'), 0, accountAddr);
      const result1 = await c.optionToken.getPositionWithOwner(2);

      expect(result1.strikeId).to.eq(1);
      expect(result1.amount).to.eq(toBN('0.2'));
      expect(result1.state).to.eq(1);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);
    });

    it('can merge positions', async () => {
      const params = {
        strikeId: strikeIds[0],
        positionId: 0,
        iterations: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
        setCollateralTo: 0,
        minTotalCost: toBN('200'),
        maxTotalCost: toBN('400'),
        rewardRecipient: '0x0000000000000000000000000000000000000000',
      };

      await testLyraAdapter.openPositionExt(params);
      await testLyraAdapter.openPositionExt(params);
      await testLyraAdapter.openPositionExt(params);
      await testLyraAdapter.mergePositionsExt([1, 2, 3]);

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
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      // Exchange quote for base
      await testLyraAdapter.exchangeFromExactQuoteExt(toBN('1751'), toBN('1'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      expect(quoteBalBefore - quoteBalAfter).to.eq(1751);
      expect(baseBalAfter - baseBalBefore).to.eq(1.0001329668302787);

      // Revert for not enough base received
      await expect(testLyraAdapter.exchangeFromExactQuoteExt(toBN('1751'), toBN('1.1'))).to.revertedWith(
        'ExchangerBaseReceivedTooLow',
      );
    });

    it('exchangeToExactQuote', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      // Exchange base for quote
      await testLyraAdapter.exchangeToExactQuoteExt(toBN('1720'), toBN('1'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      expect(quoteBalAfter - quoteBalBefore).to.eq(1720);
      expect(baseBalBefore - baseBalAfter).to.eq(0.99482444334717);

      // Revert for not enough base sent
      await expect(testLyraAdapter.exchangeToExactQuoteExt(toBN('1750'), toBN('1'))).to.revertedWith(
        'BaseQuoteExchangeExceedsLimit',
      );
    });

    it('exchangeFromExactBase', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      // Exchange base for quote
      await testLyraAdapter.exchangeFromExactBaseExt(toBN('1'), toBN('1720'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      expect(quoteBalAfter - quoteBalBefore).to.eq(1728.948269725006);
      expect(baseBalBefore - baseBalAfter).to.eq(1);

      // Revert for quote received too low
      await expect(testLyraAdapter.exchangeFromExactBaseExt(toBN('1'), toBN('1730'))).to.revertedWith(
        'ExchangerQuoteReceivedTooLow',
      );
    });

    it('exchangeToExactBase', async () => {
      // Log before balances
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalBefore = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      // Exchange quote for base
      await testLyraAdapter.exchangeToExactBaseExt(toBN('1'), toBN('1751'));

      // Log after balances
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(testLyraAdapter.address));
      const baseBalAfter = +fromBN(await c.snx.baseAsset.balanceOf(testLyraAdapter.address));

      expect(quoteBalBefore - quoteBalAfter).to.eq(1750.7672060301556);
      expect(baseBalAfter - baseBalBefore).to.eq(1);

      // Revert for not enough quote sent
      await expect(testLyraAdapter.exchangeToExactBaseExt(toBN('1'), toBN('1740'))).to.revertedWith(
        'QuoteBaseExchangeExceedsLimit',
      );
    });
  });

  describe('swapping stables', async () => {
    it('DAI to sUSD', async () => {
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const daiBalBefore = +fromBN(await DAI.balanceOf(accountAddr));

      await testLyraAdapter.swapStablesExt(
        DAI.address,
        c.snx.quoteAsset.address,
        toBN('1000'),
        toBN('989'),
        accountAddr,
      );
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const daiBalAfter = +fromBN(await DAI.balanceOf(accountAddr));

      expect(daiBalBefore - daiBalAfter).to.eq(1000);
      expect(quoteBalAfter - quoteBalBefore).to.eq(989.1089108909946);
    });
    it('sUSD to DAI', async () => {
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const daiBalBefore = +fromBN(await DAI.balanceOf(accountAddr));

      await testLyraAdapter.swapStablesExt(
        c.snx.quoteAsset.address,
        DAI.address,
        toBN('1000'),
        toBN('1000'),
        accountAddr,
      );
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const daiBalAfter = +fromBN(await DAI.balanceOf(accountAddr));

      expect(quoteBalBefore - quoteBalAfter).to.eq(1000);
      expect(daiBalAfter - daiBalBefore).to.eq(1011.0110110110109);
    });

    it('USDC to sUSD', async () => {
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const usdcBalBefore = +(await USDC.balanceOf(accountAddr));

      const usdcAmt = 1000 * 1e6;
      await testLyraAdapter.swapStablesExt(USDC.address, c.snx.quoteAsset.address, usdcAmt, toBN('989'), accountAddr);
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const usdcBalAfter = +(await USDC.balanceOf(accountAddr));

      expect(usdcBalBefore - usdcBalAfter).to.eq(usdcAmt);
      expect(quoteBalAfter - quoteBalBefore).to.eq(989.1089108909946);
    });

    it('sUSD to USDC', async () => {
      const quoteBalBefore = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const usdcBalBefore = +(await USDC.balanceOf(accountAddr));

      await testLyraAdapter.swapStablesExt(c.snx.quoteAsset.address, USDC.address, toBN('1000'), 900, accountAddr);
      const quoteBalAfter = +fromBN(await c.snx.quoteAsset.balanceOf(accountAddr));
      const usdcBalAfter = +(await USDC.balanceOf(accountAddr));

      expect(quoteBalBefore - quoteBalAfter).to.eq(1000);
      expect(usdcBalAfter - usdcBalBefore).to.eq(1011011011); // 1011 e6
    });
  });

  it('gwav functions', async () => {
    const baseIv = toBN(DEFAULT_BOARD_PARAMS.baseIV);
    const skew = toBN(DEFAULT_BOARD_PARAMS.skews[0]);
    assertCloseToPercentage(await testLyraAdapter.ivGWAV(strikeIds[0], DAY_SEC), baseIv);
    assertCloseToPercentage(await testLyraAdapter.skewGWAV(strikeIds[0], DAY_SEC), skew);
    assertCloseToPercentage(await testLyraAdapter.volGWAV(strikeIds[0], DAY_SEC), baseIv.mul(skew).div(UNIT));
    assertCloseToPercentage(await testLyraAdapter.deltaGWAV(strikeIds[0], DAY_SEC), toBN('0.77037'));
    assertCloseToPercentage(await testLyraAdapter.vegaGWAV(strikeIds[0], DAY_SEC), toBN('146.37'));
    const [callPrice, putPrice] = await testLyraAdapter.optionPriceGWAV(strikeIds[0], DAY_SEC);
    assertCloseToPercentage(callPrice, toBN('313.6'));
    assertCloseToPercentage(putPrice, toBN('65.87'));
  });
});
