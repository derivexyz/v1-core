import { BigNumber } from 'ethers';
import { beforeEach } from 'mocha';
import { MONTH_SEC, OptionType, toBN, UNIT } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  expectBalance,
  fullyClosePosition,
  getLiquidity,
  getRequiredHedge,
  getShortAmount,
  getShortCollateral,
  getSpotPrice,
  openPosition,
  setETHPrice,
  setNegativeExpectedHedge,
  setPositiveExpectedHedge,
} from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_PRICING_PARAMS,
  DEFAULT_SHORT_BUFFER,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { mockPrice, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

// test full scenario (do not use external wrapper/unit tests)
describe('Hedge Delta', async () => {
  // Integration test
  // not testing collateral and hedge cap conditions as those are tested in setShortTo/updateCollateral
  beforeEach(seedFixture);
  // for each "it" check
  //      expect(correct balanceOf LP)
  //      expect(correct balanceOf PoolHedger)
  //      expect(correct shortBalance/shortCollateral)
  //      expect(correct currentHedgeDelta using getCurrentHedgedNetDelta())

  // different hedging scenarios
  describe('currentHedge = 0', async () => {
    it('expectedHedge = 0', async () => {
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
      await hre.f.c.poolHedger.hedgeDelta();
      await expectBalance(hre.f.c.snx.quoteAsset, oldLPBalace, hre.f.c.liquidityPool.address);
      expect(await getShortAmount()).to.eq(0);
      expect(await getShortCollateral()).to.eq(0);
      expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).to.eq(0);
    });
    it('expectedHedge = positive', async () => {
      // set positive delta
      await setPositiveExpectedHedge();
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.lt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('2.297'));
      expect(await getShortAmount()).to.eq(0);
      expect(await getShortCollateral()).to.eq(0);
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2.297'));
    });
    it('expectedHedge = negative', async () => {
      // set positive delta
      await setNegativeExpectedHedge();
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.lt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('0'));
      assertCloseToPercentage(await getShortAmount(), toBN('7.7033'), toBN('0.01'));
      assertCloseToPercentage(await getShortCollateral(), toBN('26838.50'), toBN('0.01'));
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-7.7033'));
    });
  });

  describe('currentHedge = positive', async () => {
    let positiveHedgePositionId: BigNumber;
    beforeEach(async () => {
      positiveHedgePositionId = await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2.297'));
    });
    it('expectedHedge = 0', async () => {
      // set positive delta
      await fullyClosePosition(positiveHedgePositionId);
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.gt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('0'));
      expect(await getShortAmount()).to.eq(0);
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0'));
    });
    it('expectedHedge = positive & > currentHedge', async () => {
      // increase expectedHedge
      await setPositiveExpectedHedge();
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.lt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('4.594'));
      expect(await getShortAmount()).to.eq(0);
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('4.594'));
    });
    it('expectedHedge = positive & < currentHedge', async () => {
      // reduce expectedHedge
      await setNegativeExpectedHedge(toBN('1'), toBN('1'));
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.gt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('2.297').sub(toBN('0.77033')));
      expect(await getShortAmount()).to.eq(0);
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2.297').sub(toBN('0.77033')));
    });
    it('expectedHedge = currentHedge', async () => {
      const preBal = await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.poolHedger.address);
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.poolHedger.address), preBal);
    });
    it('expectedHedge = negative', async () => {
      await fullyClosePosition(positiveHedgePositionId);
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await expectBalance(hre.f.c.snx.baseAsset, toBN('0'), hre.f.c.poolHedger.address);
      expect(await getShortAmount()).to.eq(toBN('0').sub(await getRequiredHedge()));
    });
    it('reverts on transfer failing', async () => {
      await fullyClosePosition(positiveHedgePositionId);
      await hre.f.c.snx.quoteAsset.setForceFail(true);
      await expect(hre.f.c.poolHedger.hedgeDelta()).revertedWith('QuoteTransferFailed');
    });
  });

  describe('currentHedge = negative', async () => {
    let negativeHedgePositionId: BigNumber;
    beforeEach(async () => {
      negativeHedgePositionId = await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-7.7033'));
    });

    it('expectedHedge = 0', async () => {
      // set hedge to 0
      await fullyClosePosition(negativeHedgePositionId);
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.gt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('0'));
      expect(await getShortAmount()).to.eq(0);
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0'));
    });
    it('expectedHedge = positive', async () => {
      // increase expectedHedge
      await setPositiveExpectedHedge(toBN('50'), toBN('50000'));
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.gt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('3.78'));
      expect(await getShortAmount()).to.eq(0);
      expect(await getShortCollateral()).to.eq(0);
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('3.78'));
    });
    it('expectedHedge = negative & < currentHedge', async () => {
      // make expectedHedge less negative
      await setPositiveExpectedHedge();
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.gt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('0'));
      assertCloseToPercentage(await getShortAmount(), toBN('5.4066'), toBN('0.01'));
      assertCloseToPercentage(await getShortCollateral(), toBN('18836.752'), toBN('0.01'));
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-5.4066'));
    });
    it('expectedHedge = negative & > currentHedge', async () => {
      // make expectedHedge less negative
      await setNegativeExpectedHedge();
      const oldLPBalace = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // hedge delta
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.be.lt(oldLPBalace);

      await assertCloseToBaseBal(hre.f.c.poolHedger.address, toBN('0'));
      assertCloseToPercentage(await getShortAmount(), toBN('7.7033').mul(2), toBN('0.01'));
      assertCloseToPercentage(await getShortCollateral(), toBN('26838.50').mul(2), toBN('0.01'));
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-7.7033').mul(2));
    });
  });

  describe('reverts', async () => {
    it('reverts hedgeDelta if repayWithCollateral larger than short collateral', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await hre.f.c.poolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setNegativeExpectedHedge(toBN('1700'), toBN('100000'));

      // hedge
      await hre.f.c.poolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);

      // increase spot to liquidation range
      await mockPrice(hre.f.c, toBN('10000'), 'sETH');

      // setShortTo
      // const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;
      await expect(hre.f.c.poolHedger.hedgeDelta()).to.revertedWith('reverted with panic code 0x11');
    });
  });

  describe('complex scenarios', async () => {
    // existing hedge for all scenarios
    it('spotPrice up, shortBuffer up: collateral added', async () => {
      await setNegativeExpectedHedge();
      await setPositiveExpectedHedge();
      expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.be.lt('0');

      // hedge
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-5.4066'));

      // increase spot and shortBuffer
      await mockPrice(hre.f.c, DEFAULT_BASE_PRICE.mul(2), 'sETH');
      await hre.f.c.poolHedger.setShortBuffer(toBN('2.2'));
      const oldCollat = await getShortCollateral();
      const oldShort = await getShortAmount();

      // no need for interaction delay skip as only collateral is changing
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseToPercentage(await getShortAmount(), oldShort, toBN('0.01'));
      expect(await getShortCollateral()).to.gt(oldCollat);
    });
    it('spotPrice up, shortBuffer down, hedgeCap < expectedHedge: short reduced and collateral returned with revert on first try', async () => {
      await setNegativeExpectedHedge();
      await setNegativeExpectedHedge();
      await setPositiveExpectedHedge();
      await setPositiveExpectedHedge();
      expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.be.lt('0');

      // hedge
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-5.4066').mul(2));

      // increase spot and shortBuffer
      await mockPrice(hre.f.c, DEFAULT_BASE_PRICE.mul(3), 'sETH');
      await hre.f.c.poolHedger.setShortBuffer(toBN('1.2'));
      const oldCollat = await getShortCollateral();
      const oldShort = await getShortAmount();

      // cap hedge
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        hedgeCap: toBN('1'),
      });

      // revert due to not enough collateral
      await expect(hre.f.c.poolHedger.hedgeDelta()).to.revertedWith('reverted with panic code 0x11');

      // top up collateral and try again
      await hre.f.c.poolHedger.updateCollateral();
      await hre.f.c.poolHedger.hedgeDelta();

      // verify both short and collateral were reduced
      expect(await getShortAmount()).to.lt(oldShort);
      expect(await getShortCollateral()).to.lt(oldCollat);
      assertCloseToPercentage(await getShortAmount(), toBN('1'), toBN('0.01'));
      assertCloseToPercentage(
        await getShortCollateral(),
        toBN('1')
          .mul(await getSpotPrice())
          .mul(toBN('1.2'))
          .div(UNIT)
          .div(UNIT),
        toBN('0.01'),
      );
    });
    it('spotPrice up, pendingLiquidity < desiredCollateral: reduced short/collateral added', async () => {
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseToPercentage(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-7.703'));
      const oldCollat = await getShortCollateral();
      const oldShort = await getShortAmount();

      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('1600'), toBN('1600'));
      const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;

      // increase spot
      await mockPrice(hre.f.c, DEFAULT_BASE_PRICE.mul(3), 'sETH');

      // no need for interaction delay skip as only collateral is changing
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await hre.f.c.poolHedger.hedgeDelta();

      assertCloseToPercentage(await getShortAmount(), toBN('4.82'), toBN('0.01'));

      assertCloseToPercentage(await getShortCollateral(), toBN('35282.547'), toBN('0.01'));

      // expect part of the collateral to have been used to pay down short
      expect(await getShortCollateral()).to.be.lt(pendingLiq.add(oldCollat));

      // expect final buffer to be less than short buffer as part of collateral
      // is used to pay down excess short
      const effectiveShort = (await getShortAmount()).mul(await getSpotPrice()).div(UNIT);
      const effectiveBuffer = (await getShortCollateral()).mul(UNIT).div(effectiveShort);
      assertCloseToPercentage(effectiveBuffer, toBN('1.3998'), toBN('0.01'));
      expect(effectiveBuffer).to.be.lt(DEFAULT_SHORT_BUFFER);
    });

    it('does not use locked collateral to hedges delta when full pool but pendingDelta != 0', async () => {
      await setETHPrice(toBN('2000'));
      await openPosition({
        strikeId: 2,
        iterations: 5,
        optionType: OptionType.LONG_PUT,
        amount: toBN('200'),
      });

      await hre.f.c.poolHedger.hedgeDelta();
      const newLPBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      const liquidity = await getLiquidity();
      expect(newLPBalance).to.gte(liquidity.usedCollatLiquidity);
    });

    it('fully remove hedge when bored expired', async () => {
      // set negative delta
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await setNegativeExpectedHedge(toBN('50'), toBN('50'));
      expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.lt(toBN('0'));

      // hedge
      await hre.f.c.poolHedger.hedgeDelta();
      expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).to.lt(toBN('0'));

      // settle expired board
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(1);
      await hre.f.c.liquidityPool.exchangeBase();

      // expected hedge and LP base balance = 0
      expect(await hre.f.c.optionGreekCache.getGlobalNetDelta()).to.eq(0);
      expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(0);
      expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.eq(0);
      await hre.f.c.poolHedger.hedgeDelta();

      assertCloseToPercentage(await getShortAmount(), toBN('0'), toBN('0.01'));

      assertCloseToPercentage(await getShortCollateral(), toBN('0'), toBN('0.01'));
    });
  });
});

async function assertCloseToBaseBal(address: string, balance: BigNumber) {
  await assertCloseToPercentage(await hre.f.c.snx.baseAsset.balanceOf(address), balance);
}
