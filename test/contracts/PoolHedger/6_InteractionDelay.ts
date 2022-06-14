import { beforeEach } from 'mocha';
import { HOUR_SEC, MAX_UINT, MONTH_SEC, toBN } from '../../../scripts/util/web3utils';
import { fullyClosePosition, openDefaultShortCallBase } from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

const defaultDelay = Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay);

// test full scenario (do not use external wrapper/unit tests)
describe('Interaction Delay', async () => {
  // Integration test
  // collateral and hedge cap conditions tested in setShortTo/cappedHedgeDelta

  beforeEach(async () => {
    await seedFixture();
    await openDefaultShortCallBase();
    await hre.f.c.poolHedger.hedgeDelta();
  });

  it('reverts hedge if interaction delay not expired', async () => {
    await fastForward(defaultDelay / 2);
    await openDefaultShortCallBase();
    await expect(hre.f.c.poolHedger.hedgeDelta()).revertedWith('InteractionDelayNotExpired');
  });
  it('proceeds with hedge if interaction delay expired', async () => {
    const lastInteraction = await hre.f.c.poolHedger.lastInteraction();
    await fastForward(defaultDelay + 1);
    await openDefaultShortCallBase();
    await hre.f.c.poolHedger.hedgeDelta();
    expect(await hre.f.c.poolHedger.lastInteraction()).to.be.gt(lastInteraction);
  });
  it('resets interaction delay if board settled', async () => {
    await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: 2 * MONTH_SEC });
    await fastForward(MONTH_SEC + 1);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
    // await openPosition({strikeId: 5, optionType: OptionType.LONG_PUT, amount: toBN("1")})
    expect(await hre.f.c.poolHedger.lastInteraction()).to.eq(0);
    await hre.f.c.poolHedger.hedgeDelta();
  });
  it('proceeds with hedge if interaction delay param adjusted', async () => {
    await openDefaultShortCallBase();
    await expect(hre.f.c.poolHedger.hedgeDelta()).revertedWith('InteractionDelayNotExpired');
    await hre.f.c.poolHedger.setPoolHedgerParams({ interactionDelay: 0, hedgeCap: MAX_UINT });
    await hre.f.c.poolHedger.setShortBuffer(toBN('2'));
    await hre.f.c.poolHedger.hedgeDelta();
  });
  it('skip interaction delay if hedge unchanged', async () => {
    await fastForward(defaultDelay + 1);
    await fullyClosePosition(1);
    await hre.f.c.poolHedger.hedgeDelta();
    const lastInteraction = await hre.f.c.poolHedger.lastInteraction();

    await fastForward(defaultDelay + 1);

    await hre.f.c.poolHedger.hedgeDelta();
    expect(await hre.f.c.poolHedger.lastInteraction()).to.eq(lastInteraction);
  });
  it('skip interaction delay if new hedge is 0', async () => {
    const lastInteraction = await hre.f.c.poolHedger.lastInteraction();
    await fastForward(defaultDelay + 1);
    await openDefaultShortCallBase();
    await hre.f.c.poolHedger.setPoolHedgerParams({
      interactionDelay: 24 * HOUR_SEC,
      hedgeCap: 0,
    });
    await hre.f.c.poolHedger.setShortBuffer(toBN('2'));
    await hre.f.c.poolHedger.hedgeDelta();
    expect(await hre.f.c.poolHedger.lastInteraction()).to.eq(lastInteraction);
  });
  it('resetInteraction can only be called by LP', async () => {
    await expect(hre.f.c.poolHedger.resetInteractionDelay()).revertedWith('OnlyLiquidityPool');
  });
});
