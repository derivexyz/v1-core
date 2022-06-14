import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { beforeEach } from 'mocha';
import { toBN } from '../../../scripts/util/web3utils';
import { TestShortPoolHedger } from '../../../typechain-types';
import { assertCloseToPercentage } from '../../utils/assert';
import { getLiquidity, openDefaultLongCall, setETHPrice, setNegativeExpectedHedge } from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS, DEFAULT_SHORT_BUFFER } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { mockPrice } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { estimateBufferCollat, limitLiquidityWithSettlement } from './4_SetShortTo';

// Integration test for internal _updateCollateral() and external updateCollateral()
describe('updateCollateral', async () => {
  // for each "it" check
  //      expect(correct balanceOf LP)
  //      expect(correct balanceOf PoolHedger)
  //      expect(correct shortBalance/shortCollateral using getShortPosition)
  //      expect(correct currentHedgeDelta using getCurrentHedgedNetDelta)

  // reverts
  let testPoolHedger: TestShortPoolHedger;
  beforeEach(async () => {
    await seedFixture();

    testPoolHedger = (await (await ethers.getContractFactory('TestShortPoolHedger'))
      .connect(hre.f.signers[0])
      .deploy()) as TestShortPoolHedger;
    await testPoolHedger.init(
      hre.f.c.synthetixAdapter.address,
      hre.f.c.optionMarket.address,
      hre.f.c.optionGreekCache.address,
      hre.f.c.liquidityPool.address,
      hre.f.c.snx.quoteAsset.address,
      hre.f.c.snx.baseAsset.address,
    );
    await testPoolHedger.setPoolHedgerParams(DEFAULT_POOL_HEDGER_PARAMS);
    await testPoolHedger.setShortBuffer(DEFAULT_SHORT_BUFFER);
    await hre.f.c.liquidityPool.setPoolHedger(testPoolHedger.address);
    // await testPoolHedger.openShortAccount();
    // await testPoolHedger.hedgeDelta();
  });
  describe('restrictions', async () => {
    it('no change if shortId == 0', async () => {
      await openDefaultLongCall();
      expect(await testPoolHedger.getCappedExpectedHedge()).to.not.eq(0);
      await testPoolHedger.updateCollateral();
      expect((await testPoolHedger.getShortPosition()).collateral).to.eq(0);
    });
    it('reverts if short account closed or liquidated', async () => {
      await testPoolHedger.openShortAccount();
      await testPoolHedger.hedgeDelta();

      // create delta
      await openDefaultLongCall();
      await testPoolHedger.hedgeDelta();
      await mockPrice(hre.f.c, toBN('3000'), 'sETH');

      // close account and attempt updateCollateral
      await hre.f.c.snx.collateralShort.testForceClose(await testPoolHedger.shortId());
      await expect(testPoolHedger.updateCollateral()).to.revertedWith('Loan is closed');
    });
    it('updates collateral even if interaction delay unexpired', async () => {
      await testPoolHedger.openShortAccount();
      await testPoolHedger.hedgeDelta();

      // create delta
      await openDefaultLongCall();
      await testPoolHedger.hedgeDelta();

      // increase spot to allow update
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;
      await mockPrice(hre.f.c, toBN('3000'), 'sETH');
      await testPoolHedger.updateCollateral();
      expect((await testPoolHedger.getShortPosition()).collateral).to.gt(oldCollat);
    });
  });

  // Short Buffer change
  describe('shortBuffer changes', async () => {
    let oldLPBal: BigNumber;
    beforeEach(async () => {
      await testPoolHedger.openShortAccount();
      await testPoolHedger.hedgeDelta();

      // create delta
      await openDefaultLongCall();
      await testPoolHedger.hedgeDelta();

      // saving lp balance
      oldLPBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
    });

    it('shortBuffer increase: adds collateral from LP', async () => {
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;
      await testPoolHedger.setShortBuffer(DEFAULT_SHORT_BUFFER.add(toBN('1')));
      await testPoolHedger.updateCollateral();
      expect((await testPoolHedger.getShortPosition()).collateral).to.gt(oldCollat);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.c.liquidityPool.address)).to.lt(oldLPBal);
    });
    it('shortBuffer increase & pendingLiquidity not enough: adds only received quote amount', async () => {
      // save old collat
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;

      // limit liquidity
      await limitLiquidityWithSettlement(hre.f.c, 4, toBN('280'));
      const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;

      // increase short buffer
      await testPoolHedger.setShortBuffer(DEFAULT_SHORT_BUFFER.add(toBN('1000')));
      const bufferCollat = await estimateBufferCollat(
        toBN('0').sub(await testPoolHedger.getCurrentHedgedNetDelta()),
        DEFAULT_SHORT_BUFFER.add(toBN('1000')),
      );

      // update collateral
      await testPoolHedger.updateCollateral();
      assertCloseToPercentage(
        (await testPoolHedger.getShortPosition()).collateral,
        pendingLiq.add(oldCollat),
        toBN('0.01'),
      );
      expect((await testPoolHedger.getShortPosition()).collateral).to.lt(bufferCollat);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.c.liquidityPool.address)).to.lt(oldLPBal);
    });

    it('shortBuffer decrease: returns collateral to LP', async () => {
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;
      await testPoolHedger.setShortBuffer(DEFAULT_SHORT_BUFFER.sub(toBN('0.75')));
      await testPoolHedger.updateCollateral();
      expect((await testPoolHedger.getShortPosition()).collateral).to.lt(oldCollat);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.c.liquidityPool.address)).to.gt(oldLPBal);
    });
  });

  // Spot Price changes
  describe('spotPrice changes', async () => {
    let oldLPBal: BigNumber;

    beforeEach(async () => {
      await testPoolHedger.openShortAccount();
      await testPoolHedger.hedgeDelta();

      // create delta
      await openDefaultLongCall();
      await testPoolHedger.hedgeDelta();

      // saving lp balance
      oldLPBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
    });
    it('spot up: adds collateral from LP ', async () => {
      // create delta
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await openDefaultLongCall();
      await openDefaultLongCall();
      await openDefaultLongCall();
      await testPoolHedger.hedgeDelta();

      // increase spot to allow update
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;
      await mockPrice(hre.f.c, toBN('10000'), 'sETH');
      await testPoolHedger.updateCollateral();
      expect((await testPoolHedger.getShortPosition()).collateral).to.gt(oldCollat);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.c.liquidityPool.address)).to.lt(oldLPBal);
    });
    it('spot up: pendingLiquidity not enough: adds only received quote amount', async () => {
      // save old collat
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;

      // limit liquidity
      await limitLiquidityWithSettlement(hre.f.c, 4, toBN('280'));
      const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;

      // increase spot
      await mockPrice(hre.f.c, toBN('20000'), 'sETH');
      const bufferCollat = await estimateBufferCollat(
        toBN('0').sub(await testPoolHedger.getCurrentHedgedNetDelta()),
        DEFAULT_SHORT_BUFFER,
      );

      // update collateral
      await testPoolHedger.updateCollateral();
      assertCloseToPercentage(
        (await testPoolHedger.getShortPosition()).collateral,
        pendingLiq.add(oldCollat),
        toBN('0.01'),
      );
      expect((await testPoolHedger.getShortPosition()).collateral).to.lt(bufferCollat);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.lt(oldLPBal);
    });
    it('spot up: add collateral with external call', async () => {
      await setNegativeExpectedHedge();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await testPoolHedger.hedgeDelta(); // 26838.509861243190415706
      await setETHPrice(toBN('2500'));
      await testPoolHedger.updateCollateral();

      const [, collateral] = await testPoolHedger.getShortPosition();
      assertCloseToPercentage(collateral, toBN('39664.8586'), toBN('0.01'));

      await testPoolHedger.updateCollateral();
      const [, newCollateral] = await testPoolHedger.getShortPosition();
      // collateral doesn't change between two calls
      expect(collateral).eq(newCollateral);
    });
    it('spot down: returns collateral to LP', async () => {
      // decrease spot to allow update
      const oldCollat = (await testPoolHedger.getShortPosition()).collateral;
      await mockPrice(hre.f.c, toBN('500'), 'sETH');

      // reduce collateral
      await testPoolHedger.updateCollateral();
      expect((await testPoolHedger.getShortPosition()).collateral).to.lt(oldCollat);
      expect(await hre.f.c.snx.quoteAsset.balanceOf(await hre.f.c.liquidityPool.address)).to.gt(oldLPBal);
    });
  });
});
