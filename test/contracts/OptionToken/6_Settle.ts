// integration tests
import { MONTH_SEC, OptionType, PositionState, toBN } from '../../../scripts/util/web3utils';
import { estimateCallPayout, openPositionWithOverrides, setETHPrice } from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('Settle', () => {
  // check shortCollateral 2_SettlePosition.ts
  beforeEach(seedFixture);
  it('can only be called by short collateral', async () => {
    await expect(hre.f.c.optionToken.settlePositions([1, 2, 3])).revertedWith('OnlyShortCollateral');
  });

  it('settles split positions', async () => {
    await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('2'),
      setCollateralTo: toBN('1'),
    });

    // split
    await hre.f.c.optionToken.split(1, toBN('1'), toBN('0.5'), hre.f.alice.address);
    expect((await hre.f.c.optionToken.getPositionWithOwner(1)).owner).to.be.eq(hre.f.deployer.address);
    expect((await hre.f.c.optionToken.getPositionWithOwner(2)).owner).to.be.eq(hre.f.alice.address);
    expect((await hre.f.c.optionToken.getPositionWithOwner(2)).collateral).to.be.eq(toBN('0.5'));

    await setETHPrice(toBN('1000'));
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Settle solvent option and confirm correct expected balance
    await hre.f.c.shortCollateral.settleOptions([1, 2]);
    expect((await hre.f.c.optionToken.getOptionPosition(1)).state).to.be.eq(PositionState.SETTLED);
    expect((await hre.f.c.optionToken.getOptionPosition(2)).state).to.be.eq(PositionState.SETTLED);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.alice.address)).to.eq(toBN('0.5'));
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address)).to.eq(toBN('10000').sub(toBN('0.5')));
  });

  it('does not settle liquidated options', async () => {
    const [, liquidatablePos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('0.5'),
    });
    const [, fullCollateralPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('1'),
    });

    // liquidate option
    await setETHPrice(toBN('3000'));
    await hre.f.c.optionMarket.liquidatePosition(liquidatablePos, hre.f.deployer.address);
    expect((await hre.f.c.optionToken.getOptionPosition(liquidatablePos)).state).to.be.eq(PositionState.LIQUIDATED);

    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    const expectedShortCollatBal = toBN('1').sub(await estimateCallPayout('1', hre.f.strike.strikeId, false));
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(expectedShortCollatBal);

    // Revert if trying to settle liquidated position
    await expect(hre.f.c.shortCollateral.settleOptions([liquidatablePos, fullCollateralPos])).to.revertedWith(
      'ERC721: owner query for nonexistent token',
    );

    // Settle solvent option and confirm correct expected balance
    await hre.f.c.shortCollateral.settleOptions([fullCollateralPos]);
    expect((await hre.f.c.optionToken.getOptionPosition(liquidatablePos)).state).to.be.eq(PositionState.LIQUIDATED);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);
  });

  it('has nothing to settle if all options liquidated', async () => {
    const [, firstPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('0.5'),
    });

    const [, secondPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('0.5'),
    });

    // liquidate option
    await setETHPrice(toBN('3000'));
    await hre.f.c.optionMarket.liquidatePosition(firstPos, hre.f.deployer.address);
    expect((await hre.f.c.optionToken.getOptionPosition(firstPos)).state).to.be.eq(PositionState.LIQUIDATED);
    await hre.f.c.optionMarket.liquidatePosition(secondPos, hre.f.deployer.address);
    expect((await hre.f.c.optionToken.getOptionPosition(secondPos)).state).to.be.eq(PositionState.LIQUIDATED);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);

    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.shortCollateral.address)).to.eq(0);

    // Revert if trying to settle liquidated position
    await expect(hre.f.c.shortCollateral.settleOptions([firstPos, secondPos])).to.revertedWith(
      'ERC721: owner query for nonexistent token',
    );
  });

  it('cannot settle if global pause is on', async () => {
    const [, firstPos] = await openPositionWithOverrides(hre.f.c, {
      strikeId: hre.f.strike.strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: toBN('1'),
      setCollateralTo: toBN('0.5'),
    });

    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    await hre.f.c.synthetixAdapter.setGlobalPaused(true);
    await expect(hre.f.c.shortCollateral.settleOptions([firstPos])).to.revertedWith('AllMarketsPaused');
  });
});
