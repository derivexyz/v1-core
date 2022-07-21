import { BigNumberish } from 'ethers';
import { HOUR_SEC, MONTH_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import { forceClosePositionWithOverrides, openPositionWithOverrides } from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

describe('ForceClose', () => {
  // exact limits and cutoffs tested in 6_Cutoffs

  let strikeId: BigNumberish;
  beforeEach(async () => {
    await seedFixture();
    strikeId = hre.f.market.liveBoards[0].strikes[1].strikeId;
  });

  it('long call', async () => {
    const [, positionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.LONG_CALL,
      strikeId,
    });
    await fastForward(MONTH_SEC - 3 * HOUR_SEC);
    await forceClosePositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.LONG_CALL,
      strikeId,
      positionId,
    });
  });
  it('long put', async () => {
    const [, positionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.LONG_PUT,
      strikeId,
    });
    await fastForward(MONTH_SEC - 3 * HOUR_SEC);
    await forceClosePositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.LONG_PUT,
      strikeId,
      positionId,
    });
  });
  it('short call base', async () => {
    const [, positionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_CALL_BASE,
      setCollateralTo: toBN('1'),
      strikeId,
    });
    await fastForward(MONTH_SEC - 3 * HOUR_SEC);
    await forceClosePositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_CALL_BASE,
      strikeId,
      positionId,
    });
  });
  it('short call quote', async () => {
    const [, positionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      setCollateralTo: toBN('3000'),
      strikeId,
    });
    await fastForward(MONTH_SEC - 3 * HOUR_SEC);
    await forceClosePositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      strikeId,
      positionId,
    });
  });
  it('short put quote', async () => {
    const [, positionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      setCollateralTo: toBN('3000'),
      strikeId,
    });
    await fastForward(MONTH_SEC - 3 * HOUR_SEC);
    await forceClosePositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      strikeId,
      positionId,
    });
  });
});
