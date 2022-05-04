import { BigNumber } from 'ethers';
import { beforeEach } from 'mocha';
import { OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  closePositionWithOverrides,
  getLiquidity,
  getRequiredHedge,
  getSpotPrice,
  setPositiveExpectedHedge,
} from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// Integration tests using external wrappers
describe('Adjust Long', async () => {
  beforeEach(seedFixture);

  describe('Increase Long', async () => {
    beforeEach(async () => {
      await setPositiveExpectedHedge();
    });

    it('increases long to desired amount, accounting for fees', async () => {
      await hre.f.c.poolHedger.hedgeDelta();
      await expectFullyAdjustedLong(); // 2.296698
    });
    it.skip('need distinction between freeLiquidity and pedingDelta');
    it('increases long up to available LP funds', async () => {
      await setPositiveExpectedHedge();
      await limitFreeLiquidity();
      const oldPendingDeltaLiquidity = (await getLiquidity()).pendingDeltaLiquidity;
      await hre.f.c.poolHedger.hedgeDelta();
      await expectPartiallyAdjustedLong(oldPendingDeltaLiquidity);
      expect((await getLiquidity()).pendingDeltaLiquidity).to.gt(0);
    });
    it.skip('does not increase long if freeLiquidity is zero');
    it.skip('will revert if exchange fails');
  });

  describe('Decrease Long', async () => {
    beforeEach(async () => {
      // create scenario: current hedge = positive, desired hedge = less positive
      const positionId = await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await closePositionWithOverrides(hre.f.c, {
        strikeId: 1,
        positionId: positionId,
        optionType: OptionType.SHORT_PUT_QUOTE,
        amount: toBN('5'),
        setCollateralTo: toBN('10000'),
      });
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
    });

    it('will decrease long to desired amount, accounting for fees', async () => {
      await hre.f.c.poolHedger.hedgeDelta();
      await expectFullyAdjustedLong();
    });
    it.skip('will revert if trying to sell more');
    it.skip('will revert if exchange fails');
  });
});

export async function expectFullyAdjustedLong() {
  const targetLong = await getRequiredHedge();
  const baseBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.poolHedger.address);
  assertCloseTo(baseBalance, targetLong, toBN('0.0001'));
  assertCloseTo(baseBalance, await hre.f.c.optionGreekCache.getGlobalNetDelta(), toBN('0.0001'));
}

export async function expectPartiallyAdjustedLong(pendingDeltaLiquidity: BigNumber) {
  // const targetLong = await getRequiredHedge()
  const baseBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.poolHedger.address);
  assertCloseToPercentage(baseBalance, pendingDeltaLiquidity.mul(UNIT).div(await getSpotPrice()), toBN('0.01'));
  const remainingHedge = (await getRequiredHedge()).sub(await hre.f.c.poolHedger.getCurrentHedgedNetDelta());
  expect(remainingHedge).to.gt(toBN('0.1'));
}

// limits liquidity approximately to 1000 quote
export async function limitFreeLiquidity() {
  // TODO: need more precise method to get 1000 quote of freeLiquidity
  const LPtokens = await hre.f.c.liquidityTokens.balanceOf(hre.f.signers[0].address);
  await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, LPtokens.sub(toBN('5000')));
}
