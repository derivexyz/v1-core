import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { beforeEach } from 'mocha';
import { toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import { fullyClosePosition, setNegativeExpectedHedge, setPositiveExpectedHedge } from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

// Integration test
describe('Hedge Cap', async () => {
  beforeEach(seedFixture);
  // for each "it" check
  //      expect(correct balanceOf LP)
  //      expect(correct balanceOf PoolHedger)
  //      expect(correct shortBalance/shortCollateral)
  //      expect(correct currentHedgeDelta using getCurrentHedgedNetDelta())

  describe('currentHedge = positive & expectedHedge = positive', async () => {
    beforeEach(async () => {
      await setPositiveExpectedHedge();
    });
    it('currentHedge > hedgeCap & expectedHedge > hedgeCap: sub long up to hedgeCap', async () => {
      await setPositiveExpectedHedge(toBN('10'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('4.5925'), toBN('0.01'));
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('3') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('3'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub long up to expectedHedge', async () => {
      const positionId = await setPositiveExpectedHedge(toBN('10'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('4.5925'), toBN('0.01'));
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await fullyClosePosition(positionId);
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('4') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2.29627'), toBN('0.01'));
    });
    it('currentHedge < hedgeCap & expectedHedge > hedgeCap: add long up to hedgeCap', async () => {
      await hre.f.c.poolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('2') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2'), toBN('0.01'));
    });
  });

  describe('currentHedge = positive & expectedHedge = negative', async () => {
    let positivePositionId: BigNumber = toBN('0');
    beforeEach(async () => {
      positivePositionId = await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2.29627'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge > hedgeCap: sub long/add short up to hedgeCap', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await fullyClosePosition(positivePositionId);
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('1') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-1'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub long/add short up to expectedHedge', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await fullyClosePosition(positivePositionId);
      await setNegativeExpectedHedge(toBN('0.1'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('1') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-0.077'), toBN('0.01'));
    });
  });

  describe('currentHedge = negative & expectedHedge = positive', async () => {
    let negativePositionId: BigNumber = toBN('0');
    beforeEach(async () => {
      negativePositionId = await setNegativeExpectedHedge(toBN('10'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-7.7037'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge > hedgeCap: sub short to hedgeCap', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await fullyClosePosition(negativePositionId);
      await setPositiveExpectedHedge(toBN('20'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('3') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('3'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub short to expectedHedge', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await fullyClosePosition(negativePositionId);
      await setPositiveExpectedHedge(toBN('10'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('3') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('2.29'), toBN('0.01'));
    });
    it('currentHedge < hedgeCap & expectedHedge > hedgeCap: add short to hedgeCap', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await fullyClosePosition(negativePositionId);
      await setPositiveExpectedHedge(toBN('50'), toBN('100000'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('10') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('10'), toBN('0.01'));
    });
  });

  describe('currentHedge = negative & expectedHedge = negative', async () => {
    beforeEach(async () => {
      await setNegativeExpectedHedge(toBN('1'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-0.77037'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge > hedgeCap: add long/sub short to hedgeCap', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setNegativeExpectedHedge(toBN('5'), toBN('100'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('2') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-2'), toBN('0.01'));
    });
    it('currentHedge > hedgeCap & expectedHedge < hedgeCap: add long/sub short to expectedHedge', async () => {
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await setNegativeExpectedHedge(toBN('5'), toBN('100'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('10') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-4.6222'), toBN('0.01'));
    });
  });

  describe('hedgeCap = 0', async () => {
    beforeEach(async () => {
      // call hedgeDelta() to create currentHedge
    });

    // within each it, expect(does not revert even if interaction delay not expired)
    it('currentHedge = positive, expectedHedge = positive: sub short to hedgeCap', async () => {
      await setPositiveExpectedHedge(toBN('1'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0.2296'), toBN('0.01'));
      await setPositiveExpectedHedge(toBN('1'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0'), toBN('0.01'));
    });
    it('currentHedge = positive, expectedHedge = negative: sub short to hedgeCap', async () => {
      await setPositiveExpectedHedge(toBN('1'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0.2296'), toBN('0.01'));
      await setNegativeExpectedHedge(toBN('10'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0'), toBN('0.01'));
    });
    it('currentHedge = negative, expectedHedge = positive: sub short to hedgeCap', async () => {
      const negativePositionId = await setNegativeExpectedHedge(toBN('15'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-11.5555'), toBN('0.01'));
      await fullyClosePosition(negativePositionId);
      await setPositiveExpectedHedge(toBN('20'), toBN('50000'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0'), toBN('0.01'));
    });
    it('currentHedge = negative, expectedHedge = negative: sub short to hedgeCap', async () => {
      await setNegativeExpectedHedge(toBN('5'));
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('-3.85186'), toBN('0.01'));
      await setNegativeExpectedHedge(toBN('5'));
      await hre.f.c.poolHedger.setPoolHedgerParams({ ...DEFAULT_POOL_HEDGER_PARAMS, hedgeCap: toBN('0') });
      await hre.f.c.poolHedger.hedgeDelta();
      assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), toBN('0'), toBN('0.01'));
    });
  });
});
