import { BigNumberish } from 'ethers';
import { getEventArgs, MONTH_SEC, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  DEFAULT_LONG_CALL,
  estimateCallPayout,
  estimatePutPayout,
  getLiquidity,
  getSpotPrice,
  mockPrice,
  openPosition,
  openPositionWithOverrides,
  setETHPrice,
} from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
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

  describe('LP no free liquidity', async () => {
    it('reverts base reclamation when no freeLiq, but resumes with donation', async () => {
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

      // reclaim when base donated (add 10% extra to account for exchange fees)
      await hre.f.c.snx.quoteAsset
        .connect(hre.f.deployer)
        .transfer(hre.f.c.liquidityPool.address, insolventAmount.mul(await getSpotPrice()).div(UNIT.sub(toBN('0.1'))));
      await hre.f.c.shortCollateral.settleOptions([insolventPos]);
      expect(await hre.f.c.snx.baseAsset.balanceOf(await hre.f.c.shortCollateral.address)).to.eq(
        remainingCollatOfSafeShort,
      );
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

    it.skip('pays less if settle amount > totalOutstandingSettlements due to rounding', async () => {
      // not hitting the rounding error
      const [, smallPosition] = await openPosition({ ...DEFAULT_LONG_CALL, strikeId: 2, amount: toBN('0.00000001') });
      const [, largePosition] = await openPosition({ ...DEFAULT_LONG_CALL, strikeId: 2, amount: toBN('0.00000001') });
      // const [, largePosition] = await openPosition(
      //   { ...DEFAULT_LONG_CALL, strikeId: 2, amount: toBN("0.00000009") });
      await setETHPrice(toBN('2000.0000000006'));
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await hre.f.c.shortCollateral.settleOptions([smallPosition, largePosition]);
    });

    it.skip('getting dust on 100% withdrawal...');
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
