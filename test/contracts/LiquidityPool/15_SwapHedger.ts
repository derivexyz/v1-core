import { ethers } from 'hardhat';
import { toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { PoolHedger } from '../../../typechain-types';
import { getLiquidity, setNegativeExpectedHedge, setPositiveExpectedHedge } from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_BALANCE,
  DEFAULT_BASE_PRICE,
  DEFAULT_POOL_DEPOSIT,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_QUOTE_BALANCE,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { deployFixture, seedFixture } from '../../utils/fixture';
import {
  createDefaultBoardWithOverrides,
  seedBalanceAndApprovalFor,
  seedLiquidityPool,
} from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('Swap Hedger', async () => {
  let poolHedgerV2: PoolHedger;
  beforeEach(async () => {
    await seedFixture(); /// seed is probably overriding
    poolHedgerV2 = (await (await ethers.getContractFactory('PoolHedger'))
      .connect(hre.f.signers[0])
      .deploy()) as PoolHedger;
    await poolHedgerV2.init(
      hre.f.c.synthetixAdapter.address,
      hre.f.c.optionMarket.address,
      hre.f.c.optionGreekCache.address,
      hre.f.c.liquidityPool.address,
      hre.f.c.snx.quoteAsset.address,
      hre.f.c.snx.baseAsset.address,
    );
    await poolHedgerV2.setPoolHedgerParams(DEFAULT_POOL_HEDGER_PARAMS);
  });

  describe('revert swap', async () => {
    it('revert swap if shortBalance > 0', async () => {
      // set hedge
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();

      // changing pool hedger reverted
      await expect(hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address)).revertedWith('HedgerIsNotEmpty');
    });

    it('revert swap if long amount > 0', async () => {
      // set hedge
      await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();

      // changing pool hedger reverted
      await expect(hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address)).revertedWith('HedgerIsNotEmpty');
    });

    it('revert swap if shortCollateral > 0', async () => {
      await deployFixture();
      await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32('sETH'), DEFAULT_BASE_PRICE, false);

      await seedLiquidityPool(hre.f.deployer, hre.f.c, DEFAULT_POOL_DEPOSIT);
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, DEFAULT_QUOTE_BALANCE, DEFAULT_BASE_BALANCE);
      await hre.f.c.poolHedger.openShortAccount();
      await createDefaultBoardWithOverrides(hre.f.c);

      const [, collateral] = await hre.f.c.poolHedger.getShortPosition(hre.f.c.snx.collateralShort.address);
      expect(collateral).to.be.gt(0);

      // changing pool hedger reverted
      await expect(hre.f.c.liquidityPool.setPoolHedger(poolHedgerV2.address)).revertedWith('HedgerIsNotEmpty');
    });
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
