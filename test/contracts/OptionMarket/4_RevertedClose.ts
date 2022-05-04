import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { HOUR_SEC, MAX_UINT, MONTH_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import { ALL_TYPES, closePositionWithOverrides, openPositionWithOverrides } from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('Reverted Close', async () => {
  const collaterals = [toBN('0'), toBN('0'), toBN('1'), toBN('1500'), toBN('1500')];

  let positionId: BigNumber;
  let DEFAULT_PARAM: {
    positionId: BigNumber;
    optionType: OptionType;
    strikeId: BigNumberish;
    amount: BigNumber;
    setCollateralTo?: BigNumber;
  };

  beforeEach(async () => {
    await seedFixture();
  });

  ALL_TYPES.forEach(async optionType => {
    describe('revert: ' + OptionType[optionType], async () => {
      beforeEach(async () => {
        [, positionId] = await openPositionWithOverrides(hre.f.c, {
          optionType: optionType,
          strikeId: hre.f.strike.strikeId,
          amount: toBN('1'),
          setCollateralTo: collaterals[optionType],
        });
        DEFAULT_PARAM = {
          positionId: positionId,
          optionType: optionType,
          strikeId: hre.f.strike.strikeId,
          amount: toBN('1'),
          setCollateralTo: collaterals[optionType],
        };
      });
      it('board expired', async () => {
        await fastForward(MONTH_SEC * 2);
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith('BoardExpired');
      });
      it('post cutoff', async () => {
        await fastForward(MONTH_SEC - 3 * HOUR_SEC);
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith('TradingCutoffReached');
      });
      it('closing more than open amount', async () => {
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            amount: toBN('10'),
            setCollateralTo: collaterals[optionType].mul(11),
          }),
        ).revertedWith(
          'reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
        );
      });

      it('closing non-existent position', async () => {
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: 100,
          }),
        ).revertedWith('CannotAdjustInvalidPosition');
      });
      it('zero iterations', async () => {
        // reverts if zero iterations
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            iterations: 0,
          }),
        ).revertedWith('ExpectedNonZeroValue');
      });
      it('outside bounds', async () => {
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            minTotalCost: MAX_UINT,
            setCollateralTo: toBN('0'),
          }),
        ).revertedWith('TotalCostOutsideOfSpecifiedBounds');
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            maxTotalCost: 1,
            setCollateralTo: toBN('0'),
          }),
        ).revertedWith('TotalCostOutsideOfSpecifiedBounds');
      });
      it('positionId is zero', async () => {
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: 0,
          }),
        ).revertedWith('CannotClosePositionZero');
      });
      it('board frozen', async () => {
        await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, true);
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith('BoardIsFrozen');
      });
    });
  });
});
