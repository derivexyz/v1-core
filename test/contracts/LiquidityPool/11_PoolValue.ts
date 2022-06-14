import { BigNumber, BigNumberish } from 'ethers';
import { DAY_SEC, getEventArgs, MONTH_SEC, OptionType, toBN, UNIT, WEEK_SEC } from '../../../scripts/util/web3utils';
import { TradeResultStructOutput } from '../../../typechain-types/OptionMarketPricer';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  closePosition,
  getLiquidity,
  getSpotPrice,
  mockPrice,
  openPosition,
  openPositionWithOverrides,
} from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_FEE_RATE_FOR_BASE,
  DEFAULT_FEE_RATE_FOR_QUOTE,
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_POOL_DEPOSIT,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { deployFixture, seedFixture } from '../../utils/fixture';
import { seedBalanceAndApprovalFor, seedLiquidityPool } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('Pool Value', async () => {
  // integration tests
  beforeEach(seedFixture);

  describe('initial/closing states', async () => {
    it('zero value when pool is empty', async () => {
      await deployFixture();
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(toBN('0'));
    });

    it('gets pool value when no live boards', async () => {
      await deployFixture();
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c);
      await seedLiquidityPool(hre.f.deployer, hre.f.c);

      expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(0);
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(DEFAULT_POOL_DEPOSIT);
    });

    it('gets pool value when all boards settled', async () => {
      await fastForward(MONTH_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      expect((await hre.f.c.optionMarket.getLiveBoards()).length).to.eq(0);
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(DEFAULT_POOL_DEPOSIT);
    });
  });

  describe('base donations', async () => {
    it('accounts for donated base in NAV', async () => {
      await hre.f.c.snx.baseAsset.transfer(hre.f.c.liquidityPool.address, toBN('10'));
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('10'));
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.gt(DEFAULT_POOL_DEPOSIT);
      assertCloseToPercentage(
        await hre.f.c.liquidityPool.getTotalPoolValueQuote(),
        DEFAULT_POOL_DEPOSIT.add((await getSpotPrice()).mul(toBN('10').div(UNIT))),
        toBN('0.01'),
      );
    });
    it('accounts for donated quote in NAV', async () => {
      await hre.f.c.snx.quoteAsset.transfer(hre.f.c.liquidityPool.address, toBN('1000'));
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.eq(DEFAULT_POOL_DEPOSIT.add(toBN('1000')));
    });
    it('liquidates non-locked base during trade', async () => {
      await hre.f.c.snx.baseAsset.transfer(hre.f.c.liquidityPool.address, toBN('10'));
      const oldQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
      assertCloseToPercentage(
        await hre.f.c.liquidityPool.getTotalPoolValueQuote(),
        DEFAULT_POOL_DEPOSIT.add((await getSpotPrice()).mul(toBN('10').div(UNIT))),
        toBN('0.01'),
      );
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('10'));
      await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('0.1'),
      });

      // opening a position should auto-liquidate base that is not locked
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('0.1'));
      await hre.f.c.liquidityPool.exchangeBase();
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('0.1'));
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.gt(oldQuoteBal);
    });

    it('allows anyone to liquidate non-locked base', async () => {
      await openPositionWithOverrides(hre.f.c, {
        strikeId: 1,
        optionType: OptionType.LONG_CALL,
        amount: toBN('5'),
      });
      await hre.f.c.snx.baseAsset.transfer(hre.f.c.liquidityPool.address, toBN('10'));

      const oldQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('15'));

      // opening a position should auto-liquidate base that is not locked
      await hre.f.c.liquidityPool.exchangeBase();
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(toBN('5'));
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.gt(oldQuoteBal);
      assertCloseToPercentage(
        await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address),
        oldQuoteBal.add((await getSpotPrice()).mul(toBN('10').div(UNIT))),
        toBN('0.01'),
      );
    });

    it('sends less quote to last withdrawer if base is not exchanged', async () => {
      await hre.f.c.liquidityPool.initiateWithdraw(
        hre.f.deployer.address,
        await hre.f.c.liquidityTokens.balanceOf(hre.f.deployer.address),
      );
      await hre.f.c.snx.baseAsset.mint(hre.f.c.liquidityPool.address, toBN('5'));
      await fastForward(WEEK_SEC);
      // withdrawing 100% will trigger liquidity CB even though no outstanding options
      let tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);

      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        guardianMultisig: hre.f.deployer.address,
        guardianDelay: DAY_SEC,
      });

      tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      let args = getEventArgs(await tx.wait(), 'WithdrawPartiallyProcessed');
      expect(args.tokenPrice).eq(toBN('1.007245932363000000'));

      await hre.f.c.liquidityPool.exchangeBase();
      // And a small amount of base won't block the withdrawal due to the fee
      await hre.f.c.snx.baseAsset.mint(hre.f.c.liquidityPool.address, toBN('0.000001'));

      // remainder of withdrawal is processed including the fees captured from the previous withdrawal
      // leading to a higher tokenPrice than would be expected
      tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      args = getEventArgs(await tx.wait(), 'WithdrawProcessed');
      expect(args.tokenPrice).eq(toBN('2.379351078473477253'));
    });

    it('sends less quote to last withdrawer if base is not exchanged - no withdrawal fee', async () => {
      const amtTokens = await hre.f.c.liquidityTokens.balanceOf(hre.f.deployer.address);
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, amtTokens);
      await hre.f.c.snx.quoteAsset.burn(hre.f.c.liquidityPool.address, DEFAULT_BASE_PRICE);
      await hre.f.c.snx.baseAsset.mint(hre.f.c.liquidityPool.address, toBN('5'));
      await fastForward(WEEK_SEC);
      // withdrawing 100% will trigger liquidity CB even though no outstanding options
      let tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);

      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        guardianMultisig: hre.f.deployer.address,
        guardianDelay: DAY_SEC,
        withdrawalFee: 0,
      });

      await fastForward(MONTH_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      let args = getEventArgs(await tx.wait(), 'WithdrawPartiallyProcessed');
      expect(args.tokenPrice).eq(toBN('1.013936106960000000')); // from the extra base

      await hre.f.c.liquidityPool.exchangeBase();
      tx = await hre.f.c.liquidityPool.processWithdrawalQueue(1);
      args = getEventArgs(await tx.wait(), 'WithdrawProcessed');
      // Note the loss due to exchange fee.
      expect(args.tokenPrice).eq(toBN('1.006331586157800000'));
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).eq(1);
    });
  });

  describe('post open/close/hedge/settle', async () => {
    it('accounts for fees and reservedFee when long call open', async () => {
      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const [premium, accruedFee] = await openCallWithFee(toBN('50'));
      const snxFee = await estimateBaseExchangeExpense(toBN('50'), true);
      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const premiumDelta = premium.sub(await getGWAVPremium(OptionType.LONG_CALL, hre.f.strike.strikeId, toBN('50')));

      assertCloseToPercentage(oldNAV.add(premiumDelta).add(accruedFee).sub(snxFee), newNAV, toBN('0.00001')); //up to 0.001%
    });

    it('accounts for fees and reservedFee when long put open', async () => {
      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const [premium, accruedFee] = await openPutWithFee(toBN('50'));
      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const premiumDelta = premium.sub(await getGWAVPremium(OptionType.LONG_PUT, hre.f.strike.strikeId, toBN('50')));

      assertCloseToPercentage(oldNAV.add(premiumDelta).add(accruedFee), newNAV, toBN('0.00001')); //up to 0.001%
    });

    it('accounts for fees and reservedFee when short call open', async () => {
      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const [premium, accruedFee] = await openShortCallWithFee(toBN('50'));
      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const premiumDelta = premium.sub(
        await getGWAVPremium(OptionType.SHORT_CALL_BASE, hre.f.strike.strikeId, toBN('50')),
      );

      assertCloseToPercentage(
        oldNAV.sub(premiumDelta).add(accruedFee), //flip premium delta sign
        newNAV,
        toBN('0.00001'),
      ); //up to 0.001%
    });

    it('accounts for fees and reservedFee when long call closed', async () => {
      await openCallWithFee(toBN('50'));

      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const [premium, accruedFee] = await closeCallWithFee(toBN('50'), 1);
      const snxFee = await estimateBaseExchangeExpense(toBN('50'), false);
      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();

      const premiumDelta = premium.sub(await getGWAVPremium(OptionType.LONG_CALL, hre.f.strike.strikeId, toBN('50')));

      assertCloseToPercentage(
        oldNAV.sub(premiumDelta).add(accruedFee).sub(snxFee), //flip premium delta sign
        newNAV,
        toBN('0.00001'),
      ); //up to 0.001%
    });
    it('accounts for fees and reservedFee when short put closed', async () => {
      await openShortPutWithFee(toBN('10'), toBN('30000'));
      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const [premium, accruedFee] = await closeShortPutWithFee(1, toBN('10'), toBN('0'));
      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();

      const premiumDelta = premium.sub(
        await getGWAVPremium(OptionType.SHORT_PUT_QUOTE, hre.f.strike.strikeId, toBN('10')),
      );

      assertCloseToPercentage(
        oldNAV.sub(premiumDelta).add(accruedFee), //flip premium delta sign
        newNAV,
        toBN('0.00001'),
      ); //up to 0.001%
    });

    it('accounts for hedging fees when hedge is performed', async () => {
      await openCallWithFee(toBN('50'));

      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const tx = await hre.f.c.poolHedger.hedgeDelta(); // going short
      const shortSetEvent = getEventArgs(await tx.wait(), 'ShortSetTo');
      const sentToPH = shortSetEvent.newCollateral.sub(shortSetEvent.oldCollateral);
      const returnedToLP = getEventArgs(await tx.wait(), 'QuoteReturnedToLP').amountQuote;
      const usedDeltaLiquidity = (await getLiquidity()).usedDeltaLiquidity;
      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();

      expect(oldNAV.sub(sentToPH).add(returnedToLP).add(usedDeltaLiquidity)).to.eq(newNAV);
    });
  });

  describe('market volatility', async () => {
    it('changes value as time passes', async () => {
      await openCallWithFee(toBN('50'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // let GWAV stabilize
      await fastForward(WEEK_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const oldGWAV = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, DAY_SEC);
      const oldOptionVal = await hre.f.c.optionGreekCache.getGlobalOptionValue();

      await fastForward(2 * WEEK_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const newGWAV = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, DAY_SEC);
      const newOptionVal = await hre.f.c.optionGreekCache.getGlobalOptionValue();

      expect(newGWAV).to.be.eq(oldGWAV);
      expect(newOptionVal).to.be.lt(oldOptionVal); // option value drops as timeToExpiry gets lower
      expect(newNAV).to.be.gt(oldNAV); // lower option val means higher NAV
    });

    // can get into more elaborate scenarios in greekCache/poolHedger
    it('changes value when twap baseIv/skew change', async () => {
      await openCallWithFee(toBN('50'));
      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const oldGWAV = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, DAY_SEC);

      await fastForward(2 * DAY_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const newGWAV = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, DAY_SEC);

      expect(newGWAV).to.be.gt(oldGWAV);
      expect(newNAV).to.be.lt(oldNAV); // lower option val means higher NAV
    });

    it('changes value when base price changes', async () => {
      await openCallWithFee(toBN('50'));
      await fastForward(WEEK_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      const oldNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const oldGWAV = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, DAY_SEC);

      // increase spot by $1000
      await mockPrice('sETH', (await getSpotPrice()).add(toBN('1000')));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      const newNAV = await hre.f.c.liquidityPool.getTotalPoolValueQuote();
      const newGWAV = await hre.f.c.optionGreekCache.getIvGWAV(hre.f.board.boardId, DAY_SEC);

      const baseAppreciation = toBN('50').mul(toBN('1000')).div(UNIT);
      expect(newGWAV).to.be.eq(oldGWAV);
      expect(newNAV.sub(baseAppreciation)).to.be.lt(oldNAV); // excluding base gain, NAV should drop
    });
  });
  // todo: any edge cases?
});

async function getGWAVPremium(optionType: OptionType, strikeId: BigNumberish, amount: BigNumber) {
  // Used to account for differences in received premium and optionValue
  let GWAVPrice;
  if (
    optionType == OptionType.LONG_CALL ||
    optionType == OptionType.SHORT_CALL_BASE ||
    optionType == OptionType.SHORT_CALL_QUOTE
  ) {
    GWAVPrice = (await hre.f.c.optionGreekCache.getStrikeCache(strikeId)).greeks.callPrice;
  } else {
    GWAVPrice = (await hre.f.c.optionGreekCache.getStrikeCache(strikeId)).greeks.putPrice;
  }
  return GWAVPrice.mul(amount).div(UNIT);
}

function getPremiumAndFee(openPositionEvent: any) {
  const tradeResult: TradeResultStructOutput = openPositionEvent.tradeResults[0];
  // assumes one iteration
  return [
    tradeResult.premium,
    tradeResult.optionPriceFee
      .add(tradeResult.spotPriceFee)
      .add(tradeResult.varianceFee.varianceFee)
      .add(tradeResult.vegaUtilFee.vegaUtilFee)
      .sub(openPositionEvent.trade.reservedFee),
  ];
}

async function estimateBaseExchangeExpense(longCalls: BigNumber, toBase: boolean) {
  const quoteToExchange = longCalls.mul(await getSpotPrice()).div(UNIT);
  if (toBase) {
    return quoteToExchange.mul(DEFAULT_FEE_RATE_FOR_QUOTE).div(UNIT);
  } else {
    return quoteToExchange.mul(DEFAULT_FEE_RATE_FOR_BASE).div(UNIT);
  }
}

async function openCallWithFee(amount: BigNumber) {
  const [tx] = await openPosition({
    optionType: OptionType.LONG_CALL,
    amount,
    strikeId: hre.f.strike.strikeId,
  });
  const event = getEventArgs(await tx.wait(), 'Trade');

  return getPremiumAndFee(event);
}

async function closeCallWithFee(amount: BigNumber, positionId: BigNumberish) {
  const tx = await closePosition({
    positionId: positionId,
    optionType: OptionType.LONG_CALL,
    amount,
    strikeId: hre.f.strike.strikeId,
  });
  const event = getEventArgs(await tx.wait(), 'Trade');

  return getPremiumAndFee(event);
}

async function openPutWithFee(amount: BigNumber) {
  const [tx] = await openPosition({
    optionType: OptionType.LONG_PUT,
    amount,
    strikeId: hre.f.strike.strikeId,
  });
  const event = getEventArgs(await tx.wait(), 'Trade');

  return getPremiumAndFee(event);
}

async function openShortCallWithFee(amount: BigNumber) {
  const [tx] = await openPosition({
    optionType: OptionType.SHORT_CALL_BASE,
    amount,
    setCollateralTo: amount,
    strikeId: hre.f.strike.strikeId,
  });
  const event = getEventArgs(await tx.wait(), 'Trade');

  return getPremiumAndFee(event);
}

async function openShortPutWithFee(amount: BigNumber, collateral: BigNumber) {
  const [tx] = await openPosition({
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount,
    setCollateralTo: collateral,
    strikeId: hre.f.strike.strikeId,
  });
  const event = getEventArgs(await tx.wait(), 'Trade');

  return getPremiumAndFee(event);
}

async function closeShortPutWithFee(positionId: BigNumberish, amount: BigNumber, collateral: BigNumber) {
  const tx = await closePosition({
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount,
    positionId,
    setCollateralTo: collateral,
    strikeId: hre.f.strike.strikeId,
  });
  const event = getEventArgs(await tx.wait(), 'Trade');

  return getPremiumAndFee(event);
}
