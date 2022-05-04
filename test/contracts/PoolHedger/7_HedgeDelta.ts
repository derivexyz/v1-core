import { BigNumber } from 'ethers';
import { beforeEach } from 'mocha';
import { OptionType, toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import {
  expectBalance,
  fullyClosePosition,
  getLiquidity,
  getRequiredHedge,
  getShortAmount,
  getShortCollateral,
  openPosition,
  setETHPrice,
  setNegativeExpectedHedge,
  setPositiveExpectedHedge,
} from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
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
    it.skip('expectedHedge = positive');
    it.skip('expectedHedge = negative');
  });

  describe('currentHedge = positive', async () => {
    let positiveHedgePositionId: BigNumber;
    beforeEach(async () => {
      positiveHedgePositionId = await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).gt(0);
    });

    it.skip('expectedHedge = 0');
    it.skip('expectedHedge = positive & > currentHedge');
    it.skip('expectedHedge = positive & < currentHedge');
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
    it.skip('expectedHedge = 0');
    it.skip('expectedHedge = positive');
    it.skip('expectedHedge = negative & < currentHedge');
    it.skip('expectedHedge = negative & > currentHedge');
  });

  describe('reverts', async () => {
    it.skip('reverts hedgeDelta if short account not opened');
    it.skip('reverts hedgeDelta if short account liquidated');
  });

  describe('complex scenario', async () => {
    // existing hedge for all scenarios
    it.skip('spotPrice up, shortBuffer up: collateral added');
    it.skip('spotPrice up, shortBuffer down, hedgeCap < expectedHedge: reduced collateral added');
    it.skip('spotPrice up, shortBuffer up, freeLiquidity < desiredCollateral: reduced collateral added');
    it.skip('spotPrice down, shortBuffer up, hedgeCap < expectedHedge: collateral is returned');

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

      // await fastForward(MONTH_SEC + 1)
      // await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId)
      // await hre.f.c.poolHedger.hedgeDelta();
      // console.log(await hre.f.c.liquidityPool.getLiquidity(params.spotPrice, params.short))
    });
  });
});
