import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { HOUR_SEC, MAX_UINT, MONTH_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import {
  ALL_TYPES,
  closePositionWithOverrides,
  openPosition,
  openPositionWithOverrides,
} from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { fillLiquidityWithWithdrawal } from '../ShortCollateral/3_Reclaim';

describe('Reverted Open', async () => {
  const collaterals = [toBN('0'), toBN('0'), toBN('1'), toBN('1500'), toBN('1500')];

  let DEFAULT_PARAM: {
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
        DEFAULT_PARAM = {
          optionType: optionType,
          strikeId: hre.f.strike.strikeId,
          amount: toBN('1'),
          setCollateralTo: collaterals[optionType],
        };
      });
      it('board expired', async () => {
        await fastForward(MONTH_SEC * 2);
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith('BoardExpired');
      });
      it('board frozen', async () => {
        // opens trade if set to false
        await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, false);
        await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
        });

        // blocks trade if set to true
        await hre.f.c.optionMarket.setBoardFrozen(hre.f.board.boardId, true);
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith('BoardIsFrozen');
      });

      it('post cutoff', async () => {
        await fastForward(MONTH_SEC - 3 * HOUR_SEC);
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith('TradingCutoffReached');
      });
      it('zero iterations', async () => {
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            iterations: 0,
          }),
        ).revertedWith('ExpectedNonZeroValue');
      });
      it('zero amount', async () => {
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            amount: 0,
          }),
        ).revertedWith('CannotOpenZeroAmount');
      });
      it('adding to non existent position', async () => {
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: 100,
          }),
        ).revertedWith('CannotAdjustInvalidPosition');
      });
      it('amount rounds down to 0', async () => {
        await expect(openPosition({ optionType: optionType, amount: 4, iterations: 5 })).to.revertedWith(
          'TradeIterationsHasRemainder',
        );

        await expect(openPosition({ optionType: optionType, amount: 4, iterations: 5 })).to.revertedWith(
          'TradeIterationsHasRemainder',
        );

        const lockedCollateral = await hre.f.c.liquidityPool.lockedCollateral();
        expect(lockedCollateral.quote).to.eq(toBN('0'));
        expect(lockedCollateral.base).to.eq(toBN('0'));
      });
      it('outside of min/max cost', async () => {
        await expect(
          openPosition({
            ...DEFAULT_PARAM,
            minTotalCost: MAX_UINT,
          }),
        ).revertedWith('TotalCostOutsideOfSpecifiedBounds');

        await expect(
          openPosition({
            ...DEFAULT_PARAM,
            maxTotalCost: 1,
          }),
        ).revertedWith('TotalCostOutsideOfSpecifiedBounds');
      });
      it('fails quote transfer', async () => {
        let error;
        if (optionType != OptionType.SHORT_CALL_BASE) {
          await hre.f.c.snx.quoteAsset.setForceFail(true);
          error = 'QuoteTransferFailed';
        } else {
          await hre.f.c.snx.baseAsset.setForceFail(true);
          error = 'BaseTransferFailed';
        }
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith(error);
      });

      it('no liquidity', async () => {
        let error;
        if (optionType == OptionType.LONG_CALL) {
          error = 'QuoteBaseExchangeExceedsLimit';
        } else if (optionType == OptionType.LONG_PUT) {
          error = 'LockingMoreQuoteThanIsFree';
        } else {
          error = 'SendPremiumNotEnoughCollateral';
        }
        await fillLiquidityWithWithdrawal();
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
          }),
        ).revertedWith(error);
      });

      it('not enough quote', async () => {
        await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c, toBN('10'), toBN('10'), 'sETH');

        if (optionType != OptionType.SHORT_CALL_BASE) {
          await expect(
            openPositionWithOverrides(
              hre.f.c,
              { ...DEFAULT_PARAM, amount: toBN('20'), setCollateralTo: toBN('20000') },
              hre.f.alice,
            ),
          ).revertedWith('ERC20: transfer amount exceeds balance');
        } else {
          await expect(
            openPositionWithOverrides(
              hre.f.c,
              { ...DEFAULT_PARAM, amount: toBN('20'), setCollateralTo: toBN('20') },
              hre.f.alice,
            ),
          ).revertedWith('ERC20: transfer amount exceeds balance');
        }
      });
      it('setCollateralTo field', async () => {
        await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c, toBN('100'), toBN('100'), 'sETH');
        if (optionType == OptionType.LONG_CALL || optionType == OptionType.LONG_PUT) {
          await openPositionWithOverrides(
            hre.f.c,
            {
              ...DEFAULT_PARAM,
              amount: toBN('0.01'),
              setCollateralTo: MAX_UINT,
            },
            hre.f.alice,
          );

          let position = await hre.f.c.optionToken.getOptionPosition(1);
          expect(position.collateral).to.eq(0);

          await closePositionWithOverrides(
            hre.f.c,
            {
              ...DEFAULT_PARAM,
              positionId: 1,
              amount: toBN('0.005'),
              setCollateralTo: MAX_UINT,
            },
            hre.f.alice,
          );

          position = await hre.f.c.optionToken.getOptionPosition(1);
          expect(position.collateral).to.eq(0);
        }
      });
    });
  });
});
