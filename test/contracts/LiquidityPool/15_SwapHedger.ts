import { ethers } from 'hardhat';
import { toBN, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { ShortPoolHedger } from '../../../typechain-types';
import { assertCloseToPercentage } from '../../utils/assert';
import { getLiquidity, setNegativeExpectedHedge, setPositiveExpectedHedge } from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS, DEFAULT_SHORT_BUFFER } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('Swap Hedger', async () => {
  let poolHedgerV2: ShortPoolHedger;
  beforeEach(async () => {
    await seedFixture(); /// seed is probably overriding
    poolHedgerV2 = (await (await ethers.getContractFactory('ShortPoolHedger'))
      .connect(hre.f.signers[0])
      .deploy()) as ShortPoolHedger;
    await poolHedgerV2.init(
      hre.f.c.synthetixAdapter.address,
      hre.f.c.optionMarket.address,
      hre.f.c.optionGreekCache.address,
      hre.f.c.liquidityPool.address,
      hre.f.c.snx.quoteAsset.address,
      hre.f.c.snx.baseAsset.address,
    );
    await poolHedgerV2.setPoolHedgerParams(DEFAULT_POOL_HEDGER_PARAMS);
    await poolHedgerV2.setShortBuffer(DEFAULT_SHORT_BUFFER);
  });

  it('will return zero hedging liquidity if no poolHedger set', async () => {
    await hre.f.c.liquidityPool.setPoolHedger(ZERO_ADDRESS);
    await setPositiveExpectedHedge();

    // attempt hedge with new hedge
    await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
    expect((await getLiquidity()).pendingDeltaLiquidity).to.eq(0);
    expect((await getLiquidity()).usedDeltaLiquidity).to.eq(0);
  });

  describe('successful swap', async () => {
    it('from negative hedge: empties old hedger and hedges with new hedger', async () => {
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await hre.f.c.poolHedger.hedgeDelta();
      expect((await getLiquidity()).usedDeltaLiquidity).to.eq(0);
      await hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address);
      await poolHedgerV2.openShortAccount();
      await poolHedgerV2.hedgeDelta();
      expect(await hre.f.c.liquidityPool.poolHedger()).to.eq(poolHedgerV2.address);
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setNegativeExpectedHedge();
      await poolHedgerV2.hedgeDelta();
      expect((await getLiquidity()).usedDeltaLiquidity).to.eq(toBN('26838.509861243190415706'));
    });

    it('from positive hedge: empties old hedger and hedges with new hedger', async () => {
      await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await hre.f.c.poolHedger.hedgeDelta();
      expect((await getLiquidity()).usedDeltaLiquidity).to.eq(0);
      await hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address);
      await poolHedgerV2.openShortAccount();
      await poolHedgerV2.hedgeDelta();
      expect(await hre.f.c.liquidityPool.poolHedger()).to.eq(poolHedgerV2.address);
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setPositiveExpectedHedge();
      await poolHedgerV2.hedgeDelta();
      expect((await getLiquidity()).usedDeltaLiquidity).to.eq(toBN('8001.757538756809582551'));
    });

    it('from negative hedge: swaps old hedger with balance', async () => {
      // use old hedger
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();

      // swap into new hedger with balance
      await hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address);
      await poolHedgerV2.openShortAccount();
      await poolHedgerV2.hedgeDelta();
      expect(await hre.f.c.liquidityPool.poolHedger()).to.eq(poolHedgerV2.address);
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);

      // rehedges even though old hedger has funds
      await poolHedgerV2.hedgeDelta();
      assertCloseToPercentage((await getLiquidity()).usedDeltaLiquidity, toBN('13419.25'), toBN('0.01'));

      // empty v2 and set new hedger
      await poolHedgerV2.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await poolHedgerV2.hedgeDelta();
      await hre.f.c.liquidityPool.setPoolHedger(hre.f.c.poolHedger.address);
      const lpOldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);

      // return all funds from old hedger
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setNegativeExpectedHedge(); // expect to hedge on top of existing hedge
      await hre.f.c.poolHedger.hedgeDelta();
      const lpNewBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address);
      expect((await getLiquidity()).usedDeltaLiquidity).to.eq(0);
      expect(lpNewBalance.gt(lpOldBalance));
    });
  });

  describe('disconnected hedger behavior', async () => {
    it('revert hedgeDelta of unlinked new hedger contract', async () => {
      await setPositiveExpectedHedge();
      await expect(poolHedgerV2.hedgeDelta()).to.revertedWith('OnlyPoolHedger');
    });
    it('revert hedgeDelta of old hedger contract', async () => {
      await setPositiveExpectedHedge();
      await hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address);
      await expect(hre.f.c.poolHedger.hedgeDelta()).to.revertedWith('OnlyPoolHedger');
    });
  });
});
