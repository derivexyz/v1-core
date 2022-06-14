import { BigNumber } from 'ethers';
import { beforeEach } from 'mocha';
import { OptionType, toBN, UNIT, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  closePositionWithOverrides,
  getLiquidity,
  getRequiredHedge,
  getSpotPrice,
  initiateFullLPWithdrawal,
  setNegativeExpectedHedge,
  setPositiveExpectedHedge,
} from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS, DEFAULT_PRICING_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
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
    it('increases long up to available LP funds', async () => {
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, toBN('10000000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setPositiveExpectedHedge(toBN('2000'), toBN('10000000'));

      // await limitFreeLiquidity();
      const oldPendingDeltaLiquidity = (await getLiquidity()).pendingDeltaLiquidity;
      await hre.f.c.poolHedger.hedgeDelta();
      await expectPartiallyAdjustedLong(oldPendingDeltaLiquidity);
    });
    it('increases long: freeLiquidity=0 & pendingDelta=enough', async () => {
      // fill up free Liquidity with withdrawal
      await initiateFullLPWithdrawal(hre.f.deployer);
      await fastForward(WEEK_SEC);
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
      await hre.f.c.liquidityPool.processDepositQueue(2);

      // do full hedge
      await hre.f.c.poolHedger.hedgeDelta();
      await expectFullyAdjustedLong();
    });
    it('will revert if exchange fails', async () => {
      // set synth exchange failure
      await hre.f.c.snx.synthetix.setReturnZero(true);

      // fail hedge
      await expect(hre.f.c.poolHedger.hedgeDelta()).to.be.revertedWith('ReceivedZeroFromExchange');
    });
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
    it('will reduce long even if freeLiquidity=0, pendingLiquidity=0', async () => {
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));

      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('1700'), toBN('100000'));

      // expect hedge net delta < expected
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.poolHedger.address)).to.eq(toBN('0'));
      expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).to.gt(
        await hre.f.c.poolHedger.getCappedExpectedHedge(),
      );
    });
    it('will revert if exchange fails', async () => {
      // set synth exchange failure
      await hre.f.c.snx.synthetix.setReturnZero(true);

      // fail hedge
      await expect(hre.f.c.poolHedger.hedgeDelta()).to.be.revertedWith('ReceivedZeroFromExchange');
    });
  });
});

export async function expectFullyAdjustedLong() {
  const targetLong = await getRequiredHedge();
  const baseBalance = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.poolHedger.address);
  assertCloseToPercentage(baseBalance, targetLong, toBN('0.01'));
  assertCloseToPercentage(baseBalance, await hre.f.c.optionGreekCache.getGlobalNetDelta(), toBN('0.01'));
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
