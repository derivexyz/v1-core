import { BigNumberish } from 'ethers';
import { getEventArgs, MONTH_SEC, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  estimateCallPayout,
  estimatePutPayout,
  getLiquidity,
  getSpotPrice,
  mockPrice,
  openPosition,
  openPositionWithOverrides,
  setETHPrice,
} from '../../utils/contractHelpers';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('Reclaims insolvent amount from LP', async () => {
  beforeEach(async () => {
    await seedFixture();
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, toBN('100000'));
    await hre.f.c.snx.baseAsset.mint(hre.f.alice.address, toBN('1000'));
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.optionMarket.address, toBN('100000'));
    await hre.f.c.snx.baseAsset.connect(hre.f.alice).approve(hre.f.c.optionMarket.address, toBN('100000'));
  });
  afterEach(async () => {
    expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
    expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
  });

  it('short call base', async () => {
    const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('0.5'),
    });
    const [, fullCollateralPos] = await openPositionWithOverrides(
      hre.f.c,
      {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('1'),
        setCollateralTo: toBN('1'),
      },
      hre.f.alice,
    );

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('4000'));

    // Settle Board
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    const insolventAmount = (await estimateCallPayout('1', hre.f.strike.strikeId, false)).sub(toBN('0.5'));
    const remainingCollatOfSafeShort = toBN('1').sub(await estimateCallPayout('1', hre.f.strike.strikeId, false));

    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(
      remainingCollatOfSafeShort.sub(insolventAmount),
    );
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(0);

    await expectNotEnoughBalance(fullCollateralPos, insolventPos, false);

    // Settle solvent position
    await hre.f.c.shortCollateral.settleOptions([insolventPos]);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingCollatOfSafeShort);
    // 1% lenience for exchange fees
    assertCloseToPercentage(
      await hre.f.c.liquidityPool.insolventSettlementAmount(),
      insolventAmount.mul(await getSpotPrice()).div(UNIT),
      toBN('0.01'),
    );

    // Finally settle solvent position and return all funds
    await hre.f.c.shortCollateral.settleOptions([fullCollateralPos]);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.alice.address)).to.eq(
      toBN('1000').sub(toBN('1')).add(remainingCollatOfSafeShort),
    );
  });

  it('short call quote', async () => {
    const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('1'),
      setCollateralTo: toBN('900'),
    });
    const [tx, safeCollateralPos] = await openPositionWithOverrides(
      hre.f.c,
      {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('1'),
        setCollateralTo: toBN('5000'),
      },
      hre.f.alice,
    );

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('4000'));

    // Settle Board
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    const insolventAmount = (await estimateCallPayout('1', hre.f.strike.strikeId, true)).sub(toBN('900'));
    const remainingCollatOfSafeShort = toBN('5000').sub(await estimateCallPayout('1', hre.f.strike.strikeId, true));

    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(
      remainingCollatOfSafeShort.sub(insolventAmount),
    );
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(0);

    await expectNotEnoughBalance(safeCollateralPos, insolventPos, true);

    // Settle solvent position
    await hre.f.c.shortCollateral.settleOptions([insolventPos]);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingCollatOfSafeShort);
    // 1% lenience for exchange fees
    assertCloseToPercentage(await hre.f.c.liquidityPool.insolventSettlementAmount(), insolventAmount, toBN('0.01'));

    // Finally settle solvent position and return all funds
    await hre.f.c.shortCollateral.settleOptions([safeCollateralPos]);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);

    const premiumEarned = (await getEventArgs(await tx.wait(), 'Trade')).trade.totalCost;
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address)).to.eq(
      toBN('100000').sub(toBN('5000')).add(remainingCollatOfSafeShort).add(premiumEarned),
    );
  });
  it('short put quote', async () => {
    const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('1'),
      setCollateralTo: toBN('900'),
    });
    const [tx, safeCollateralPos] = await openPositionWithOverrides(
      hre.f.c,
      {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_PUT_QUOTE,
        amount: toBN('1'),
        setCollateralTo: toBN('5000'),
      },
      hre.f.alice,
    );

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('500'));

    // Settle Board
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    const insolventAmount = (await estimatePutPayout('1', hre.f.strike.strikeId)).sub(toBN('900'));
    const remainingCollatOfSafeShort = toBN('5000').sub(await estimatePutPayout('1', hre.f.strike.strikeId));

    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(
      remainingCollatOfSafeShort.sub(insolventAmount),
    );
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(0);

    await expectNotEnoughBalance(safeCollateralPos, insolventPos, true);

    // Settle insolvent position
    await hre.f.c.shortCollateral.settleOptions([insolventPos]);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingCollatOfSafeShort);
    // 1% lenience for exchange fees
    assertCloseToPercentage(await hre.f.c.liquidityPool.insolventSettlementAmount(), insolventAmount, toBN('0.01'));

    // Finally settle solvent position and return all funds
    await hre.f.c.shortCollateral.settleOptions([safeCollateralPos]);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);

    const premiumEarned = (await getEventArgs(await tx.wait(), 'Trade')).trade.totalCost;
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.alice.address)).to.eq(
      toBN('100000').sub(toBN('5000')).add(remainingCollatOfSafeShort).add(premiumEarned),
    );
  });

  describe('LP no free liquidity', async () => {
    it('reverts base reclamation when no freeLiq, but resumes with donation', async () => {
      // open positions that will expire
      const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_BASE,
        amount: toBN('1'),
        setCollateralTo: toBN('0.5'),
      });
      const [, fullCollateralPos] = await openPositionWithOverrides(
        hre.f.c,
        {
          strikeId: hre.f.strike.strikeId,
          optionType: OptionType.SHORT_CALL_BASE,
          amount: toBN('1'),
          setCollateralTo: toBN('1'),
        },
        hre.f.alice,
      );

      // open new board that attacker can use to clog freeLiq
      await createDefaultBoardWithOverrides(hre.f.c, {
        baseIV: '1',
        strikePrices: ['2000', '2500', '3000'],
        skews: ['0.9', '1', '1.1'],
        expiresIn: 2 * MONTH_SEC,
      });

      // settle board
      await fastForward(MONTH_SEC);
      await mockPrice('sETH', toBN('4000'));
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.liquidityPool.exchangeBase();
      const insolventAmount = (await estimateCallPayout('1', hre.f.strike.strikeId, false)).sub(toBN('0.5'));
      const remainingCollatOfSafeShort = toBN('1').sub(await estimateCallPayout('1', hre.f.strike.strikeId, false));

      // fill up liquidity pool
      await fillLiquidityWithWithdrawal();

      // revert both due to no free liquidity and order of settling
      await revertOnNoLiquidity(insolventPos, fullCollateralPos, false);

      // freeze boards to make sure liquidity isn't used up
      await hre.f.c.optionMarket.setBoardFrozen(2, true);
      await expect(
        openPosition({
          strikeId: 5,
          optionType: OptionType.SHORT_PUT_QUOTE,
          amount: toBN('10'),
          setCollateralTo: toBN('50000'), // partial collateral
        }),
      ).to.revertedWith('BoardIsFrozen');

      // SM donating base directly will not let settleOption through if 100% of pool is being removed
      // (so the new donation will be counted as part of withdarwal)
      const insolventAmountInQuote = insolventAmount.mul(await getSpotPrice()).div(UNIT.sub(toBN('0.1')));
      await hre.f.c.snx.quoteAsset
        .connect(hre.f.deployer)
        .transfer(hre.f.c.liquidityPool.address, insolventAmountInQuote);
      await expect(hre.f.c.shortCollateral.settleOptions([insolventPos])).to.revertedWith(
        'QuoteBaseExchangeExceedsLimit',
      );

      // (1) SM guardian deposits insolvent amount (2) Trading is paused (3) settle option
      await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c);
      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        guardianDelay: 1,
        guardianMultisig: hre.f.alice.address,
      });

      await hre.f.c.liquidityPool.initiateDeposit(hre.f.alice.address, insolventAmountInQuote);
      await fastForward(1);
      await hre.f.c.liquidityPool.connect(hre.f.alice).processDepositQueue(2);
      await hre.f.c.shortCollateral.settleOptions([insolventPos]);

      // ensure safe short can settle
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingCollatOfSafeShort);

      // now withdraw SM funds and see how much they are worth
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(2);
      await hre.f.c.liquidityPool.connect(hre.f.alice).processWithdrawalQueue(2);
      assertCloseToPercentage(await hre.f.c.liquidityPool.getTotalPoolValueQuote(), toBN('5620.628'), toBN('0.01'));
      expect(await hre.f.c.liquidityPool.getTotalPoolValueQuote()).to.gt(insolventAmountInQuote); // SM actually earns from this if all LPs runaway
    });
    it('reverts quote reclamation when no freeLiq, but resumes with donation', async () => {
      const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('1'),
        setCollateralTo: toBN('900'),
      });
      const [, safeCollateralPos] = await openPositionWithOverrides(
        hre.f.c,
        {
          strikeId: hre.f.strike.strikeId,
          optionType: OptionType.SHORT_CALL_QUOTE,
          amount: toBN('1'),
          setCollateralTo: toBN('5000'),
        },
        hre.f.alice,
      );

      // settle board
      await fastForward(MONTH_SEC);
      await mockPrice('sETH', toBN('4000'));
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      const insolventAmount = (await estimateCallPayout('1', hre.f.strike.strikeId, true)).sub(toBN('900'));
      const remainingCollatOfSafeShort = toBN('5000').sub(await estimateCallPayout('1', hre.f.strike.strikeId, true));

      // fill up liquidity pool
      await fillLiquidityWithWithdrawal();

      // revert both due to no free liquidity and order of settling
      await revertOnNoLiquidity(insolventPos, safeCollateralPos, true);

      // reclaim when quote donated
      await hre.f.c.snx.quoteAsset.connect(hre.f.deployer).transfer(hre.f.c.liquidityPool.address, insolventAmount);
      await hre.f.c.shortCollateral.settleOptions([insolventPos]);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.c.shortCollateral.address)).to.eq(
        remainingCollatOfSafeShort,
      );
    });
  });
});

export async function fillLiquidityWithWithdrawal() {
  await hre.f.c.liquidityPool.initiateWithdraw(
    hre.f.deployer.address,
    await hre.f.c.liquidityToken.balanceOf(hre.f.deployer.address),
  );
  expect((await getLiquidity()).freeLiquidity).to.lt(toBN('0.01')); // dust
}

export async function revertOnNoLiquidity(
  insolventPosition: BigNumberish,
  fullCollateralPos: BigNumberish,
  isQuote: boolean,
) {
  // revert insolvent position settle
  await expect(hre.f.c.shortCollateral.settleOptions([insolventPosition])).revertedWith(
    isQuote ? 'NotEnoughFreeToReclaimInsolvency' : 'QuoteBaseExchangeExceedsLimit',
  );

  // revert solvent position settle
  await expect(hre.f.c.shortCollateral.settleOptions([fullCollateralPos])).to.revertedWith(
    isQuote ? 'OutOfQuoteCollateralForTransfer' : 'OutOfBaseCollateralForTransfer',
  );
}

export async function expectNotEnoughBalance(
  safePosition: BigNumberish,
  insolventPosition: BigNumberish,
  isQuote: boolean,
) {
  expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
  expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);

  // Revert solvent position as insolvent one must be settled first
  await expect(hre.f.c.shortCollateral.settleOptions([safePosition])).revertedWith(
    isQuote ? 'OutOfQuoteCollateralForTransfer' : 'OutOfBaseCollateralForTransfer',
  );

  // Revert if all positions settled as insolvent one must be settled first
  await expect(hre.f.c.shortCollateral.settleOptions([safePosition, insolventPosition])).revertedWith(
    isQuote ? 'OutOfQuoteCollateralForTransfer' : 'OutOfBaseCollateralForTransfer',
  );
}
