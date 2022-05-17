import { OptionType, PositionState, toBN } from '../../../scripts/util/web3utils';
import {
  closeLongCall,
  DEFAULT_LONG_CALL,
  openDefaultLongCall,
  openPosition,
  openPositionWithOverrides,
  setETHPrice,
} from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE, DEFAULT_BOARD_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { allTradesFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { expectLiquidatable } from './5_MinCollateral';

describe('OptionToken - Merge', () => {
  beforeEach(allTradesFixture);

  it('can merge positions', async () => {
    // function mint
    const secondPos = await openDefaultLongCall();

    expect(await hre.f.c.optionToken.balanceOf(hre.f.deployer.address)).eq(6);

    await hre.f.c.optionToken.merge([secondPos, hre.f.positionIds[OptionType.LONG_CALL]]); // merging 2 positions together

    expect(await hre.f.c.optionToken.balanceOf(hre.f.deployer.address)).eq(5);

    const mergedPos = await hre.f.c.optionToken.getPositionWithOwner(secondPos);
    expect(mergedPos.amount).eq(DEFAULT_LONG_CALL.amount.mul(2));
    expect(mergedPos.owner).eq(hre.f.deployer.address);

    const originalPos = await hre.f.c.optionToken.getOptionPosition(hre.f.positionIds[OptionType.LONG_CALL]);
    expect(originalPos.amount).eq(0);
    expect(originalPos.collateral).eq(0);
    expect(originalPos.state).eq(PositionState.MERGED);
  });

  it('cannot merge if one is liquidated', async () => {
    const [, safePositionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      setCollateralTo: toBN('20000'),
      strikeId: hre.f.strike.strikeId,
    });

    const [, liquidatedPositionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      setCollateralTo: toBN('2000'),
      strikeId: hre.f.strike.strikeId,
    });

    await setETHPrice(toBN('500'));
    await hre.f.c.optionMarket.connect(hre.f.alice).liquidatePosition(liquidatedPositionId, hre.f.alice.address);

    await expect(hre.f.c.optionToken.merge([safePositionId, liquidatedPositionId])).to.revertedWith(
      'ERC721: operator query for nonexistent token',
    );
  });

  it('cannot merge if results is liquidatable', async () => {
    const [, firstPositionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('1'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      setCollateralTo: toBN('1000'),
      strikeId: hre.f.strike.strikeId,
    });

    const [, secondPositionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('1'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      setCollateralTo: toBN('1000'),
      strikeId: hre.f.strike.strikeId,
    });

    await setETHPrice(toBN('100'));
    await expectLiquidatable(firstPositionId);
    await expectLiquidatable(secondPositionId);

    await expect(hre.f.c.optionToken.merge([firstPositionId, secondPositionId])).to.revertedWith(
      'ResultingNewPositionLiquidatable',
    );

    await setETHPrice(DEFAULT_BASE_PRICE);

    // Goes through successfully if the end result isn't liquidatable
    await hre.f.c.optionToken.merge([firstPositionId, secondPositionId]);
  });

  it('cannot merge the same position', async () => {
    const positionId = await openDefaultLongCall();
    await expect(hre.f.c.optionToken.merge([positionId, positionId])).revertedWith('PositionMismatchWhenMerging');
  });

  it('cannot merge settled options', async () => {
    const secondPos = await openDefaultLongCall();
    const thirdPos = await openDefaultLongCall();

    await fastForward(DEFAULT_BOARD_PARAMS.expiresIn);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // can merge after expiry
    await hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos]);

    await hre.f.c.shortCollateral.settleOptions([hre.f.positionIds[OptionType.LONG_CALL]]);

    // firstPos is burnt, so it reverts in the _burn step
    await expect(hre.f.c.optionToken.merge([thirdPos, hre.f.positionIds[OptionType.LONG_CALL]])).revertedWith(
      'ERC721: operator query for nonexistent token',
    );

    await expect(hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], thirdPos])).revertedWith(
      'ERC721: operator query for nonexistent token',
    );
  });

  it('cannot merge if any position is invalid (not open/not active)', async () => {
    const positionId = await openDefaultLongCall();
    await closeLongCall(positionId);
    await expect(hre.f.c.optionToken.merge([positionId, positionId])).revertedWith(
      'ERC721: operator query for nonexistent token',
    );
  });

  it('merge reverts for various reasons', async () => {
    const secondPos = await openDefaultLongCall();

    // Cannot merge someone else's positions
    await expect(
      hre.f.c.optionToken.connect(hre.f.alice).merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos]),
    ).to.be.revertedWith('MergingUnapprovedPosition');

    // Cannot merge only 1 position
    await expect(hre.f.c.optionToken.connect(hre.f.alice).merge([secondPos])).to.be.revertedWith(
      'MustMergeTwoOrMorePositions',
    );

    // Cannot merge if global pause
    await hre.f.c.synthetixAdapter.setGlobalPaused(true);
    await expect(hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos])).to.be.revertedWith(
      'AllMarketsPaused',
    );
    await hre.f.c.synthetixAdapter.setGlobalPaused(false);

    // Cannot merge different types
    await expect(
      hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], hre.f.positionIds[OptionType.LONG_PUT]]),
    ).to.be.revertedWith('PositionMismatchWhenMerging');

    // Cannot merge different strikes
    const [, diffStrike] = await openPosition({
      ...DEFAULT_LONG_CALL,
      strikeId: hre.f.board.strikes[1].strikeId,
    });

    await expect(hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], diffStrike])).to.be.revertedWith(
      'PositionMismatchWhenMerging',
    );

    // Cannot merge from different owners
    await hre.f.c.optionToken.transferFrom(hre.f.deployer.address, hre.f.alice.address, secondPos);

    // Checking approvals and owners when merging two positions of the same type
    await expect(hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos])).to.be.revertedWith(
      'MergingUnapprovedPosition',
    );

    await expect(
      hre.f.c.optionToken.connect(hre.f.alice).merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos]),
    ).to.be.revertedWith('MergingUnapprovedPosition');

    await hre.f.c.optionToken.connect(hre.f.alice).approve(hre.f.deployer.address, secondPos);

    await expect(hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos])).to.be.revertedWith(
      'PositionMismatchWhenMerging',
    );

    // Can merge when both are owned by someone else, as long as approved
    await hre.f.c.optionToken.transferFrom(
      hre.f.deployer.address,
      hre.f.alice.address,
      hre.f.positionIds[OptionType.LONG_CALL],
    );
    await hre.f.c.optionToken
      .connect(hre.f.alice)
      .approve(hre.f.deployer.address, hre.f.positionIds[OptionType.LONG_CALL]);
    await hre.f.c.optionToken.merge([hre.f.positionIds[OptionType.LONG_CALL], secondPos]);
  });
});
