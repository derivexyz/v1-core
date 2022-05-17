import { MONTH_SEC, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  estimateCallPayout,
  estimatePutPayout,
  getSpotPrice,
  openPositionWithOverrides,
  setETHPrice,
  settleBoardAtPrice,
} from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { allTradesFixture, seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('LP excess', () => {
  beforeEach(seedFixture);
  it('short call base with large & tiny insolvency', async () => {
    const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('4'),
      setCollateralTo: toBN('2'),
    });

    const [, insolventPosTiny] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('0.5'),
      setCollateralTo: toBN('0.25'),
    });

    const [, solventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('1'),
    });

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('4000'));

    // settle board and create base excess
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
    const insolventAmount = (await estimateCallPayout('4.5', hre.f.strike.strikeId, false)).sub(toBN('2.25'));
    const remainingCollatOfSafeShort = toBN('1').sub(await estimateCallPayout('1', hre.f.strike.strikeId, false));
    const excessEstimate = insolventAmount.sub(remainingCollatOfSafeShort);
    const excessEstimateinQuote = excessEstimate.mul(await getSpotPrice()).div(UNIT);
    expect(excessEstimate).to.be.gt(0);
    expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(excessEstimate);
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(excessEstimateinQuote);

    // attempt safe position settle first
    await expect(hre.f.c.shortCollateral.settleOptions([solventPos])).revertedWith('OutOfBaseCollateralForTransfer');

    // settle tiny insolvent position and doesn't call reclaim()
    await hre.f.c.shortCollateral.settleOptions([insolventPosTiny]);
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(excessEstimateinQuote);
    expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.not.eq(0);

    // Cover edge case for coverage
    await hre.f.c.snx.baseAsset.setForceFail(true);
    await expect(hre.f.c.shortCollateral.settleOptions([insolventPos])).revertedWith('BaseTransferFailed');
    await hre.f.c.snx.baseAsset.setForceFail(false);

    // settle large insolvent position and calls reclaim()
    await hre.f.c.shortCollateral.settleOptions([insolventPos]);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingCollatOfSafeShort);
    expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(0);
    assertCloseToPercentage(
      await hre.f.c.liquidityPool.insolventSettlementAmount(),
      insolventAmount.mul(await getSpotPrice()).div(UNIT),
      toBN('0.01'),
    );

    // settle safe position
    await hre.f.c.shortCollateral.settleOptions([solventPos]); // shouldn't revert
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
  });

  it('short call quote', async () => {
    const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('4'),
      setCollateralTo: toBN('3500'),
    });
    const [, scqResult] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('1'),
      setCollateralTo: toBN('3000'),
    });

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('4000'));

    // settle board and create base excess
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    const insolventAmount = (await estimateCallPayout('4', hre.f.strike.strikeId, true)).sub(toBN('3500'));
    const remainingCollatOfSafeShort = toBN('3000').sub(await estimateCallPayout('1', hre.f.strike.strikeId, true));
    const excessEstimate = insolventAmount.sub(remainingCollatOfSafeShort);
    expect(excessEstimate).to.be.gt(0);
    expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(excessEstimate);
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(excessEstimate);

    // attempt safe position settle first
    await expect(hre.f.c.shortCollateral.settleOptions([scqResult])).revertedWith('OutOfQuoteCollateralForTransfer');

    // settle large insolvent position and calls reclaim()
    await hre.f.c.shortCollateral.settleOptions([insolventPos]);
    expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    assertCloseToPercentage(await hre.f.c.liquidityPool.insolventSettlementAmount(), insolventAmount, toBN('0.01'));

    // settle safe position
    await hre.f.c.shortCollateral.settleOptions([scqResult]); // shouldn't revert
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
  });
  it('short put quote', async () => {
    const [, insolventPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('4'),
      setCollateralTo: toBN('2500'),
    });
    const [, safeCollateralPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('1'),
      setCollateralTo: toBN('2000'),
    });

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('500'));

    // settle board and create base excess
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
    const insolventAmount = (await estimatePutPayout('4', hre.f.strike.strikeId)).sub(toBN('2500'));
    const remainingCollatOfSafeShort = toBN('2000').sub(await estimatePutPayout('1', hre.f.strike.strikeId));
    const excessEstimate = insolventAmount.sub(remainingCollatOfSafeShort);
    expect(excessEstimate).to.be.gt(0);
    expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(excessEstimate);
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.eq(excessEstimate);

    // attempt safe position settle first
    await expect(hre.f.c.shortCollateral.settleOptions([safeCollateralPos])).revertedWith(
      'OutOfQuoteCollateralForTransfer',
    );

    // settle large insolvent position and calls reclaim()
    await hre.f.c.shortCollateral.settleOptions([insolventPos]);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingCollatOfSafeShort);
    expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    assertCloseToPercentage(await hre.f.c.liquidityPool.insolventSettlementAmount(), insolventAmount, toBN('0.01'));

    // settle safe position
    await hre.f.c.shortCollateral.settleOptions([safeCollateralPos]); // shouldn't revert
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
  });
  it('should let quote settle if only base excess present', async () => {
    const [, insolventBasePos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('4'),
      setCollateralTo: toBN('2'),
    });

    const [, solventBasePos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('0.5'),
      setCollateralTo: toBN('0.5'),
    });

    const [, solventQuotePos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('2'),
      setCollateralTo: toBN('10000'),
    });

    await fastForward(MONTH_SEC);
    await setETHPrice(toBN('4000'));

    // settle board
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    const insolventBaseAmount = (await estimateCallPayout('4.5', hre.f.strike.strikeId, false)).sub(toBN('2.5'));
    const remainingQuoteAmount = toBN('10000').sub(await estimateCallPayout('2', hre.f.strike.strikeId, true));

    // ensure insolvency/excess only occured on base position
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(remainingQuoteAmount);
    expect(insolventBaseAmount).to.be.gt(0);
    expect(remainingQuoteAmount).to.be.gt(0);
    expect(await hre.f.c.shortCollateral.LPBaseExcess()).to.eq(insolventBaseAmount);
    expect(await hre.f.c.shortCollateral.LPQuoteExcess()).to.eq(0);
    expect(await hre.f.c.liquidityPool.insolventSettlementAmount()).to.gt(0);

    // revert base settle
    await expect(hre.f.c.shortCollateral.settleOptions([insolventBasePos, solventBasePos])).revertedWith(
      'OutOfBaseCollateralForTransfer',
    );

    // reverts if quote and base settled together
    await expect(
      hre.f.c.shortCollateral.settleOptions([insolventBasePos, solventBasePos, solventQuotePos]),
    ).revertedWith('OutOfBaseCollateralForTransfer');

    // allow quote settle even if base is unsettled/excess
    await hre.f.c.shortCollateral.settleOptions([solventQuotePos]);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(toBN('0'));
  });

  it('edge cases', async () => {
    await allTradesFixture();
    await settleBoardAtPrice(toBN('400'));
    const preBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
    await hre.f.c.shortCollateral.settleOptions([hre.f.positionIds[OptionType.SHORT_PUT_QUOTE]]);
    // insolvent short put
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address)).eq(preBal);

    await expect(hre.f.c.shortCollateral.sendQuoteCollateral(hre.f.deployer.address, toBN('100'))).revertedWith(
      'OnlyOptionMarket',
    );
  });
});
