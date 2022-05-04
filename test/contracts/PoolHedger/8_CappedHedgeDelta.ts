import { beforeEach } from 'mocha';
import { toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import { setPositiveExpectedHedge } from '../../utils/contractHelpers';
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
    it.skip('currentHedge > hedgeCap & expectedHedge > hedgeCap: sub long up to hedgeCap');
    it.skip('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub long up to expectedHedge');
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
    it.skip('currentHedge > hedgeCap & expectedHedge > hedgeCap: sub long/add short up to hedgeCap');
    it.skip('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub long/add short up to expectedHedge');
  });

  describe('currentHedge = negative & expectedHedge = positive', async () => {
    it.skip('currentHedge > hedgeCap & expectedHedge > hedgeCap: sub short to hedgeCap');
    it.skip('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub short to expectedHedge');
    it.skip('currentHedge < hedgeCap & expectedHedge > hedgeCap: add short to hedgeCap');
  });

  describe('currentHedge = negative & expectedHedge = negative', async () => {
    it.skip('currentHedge > hedgeCap & expectedHedge > hedgeCap: add long/sub short to hedgeCap');
    it.skip('currentHedge > hedgeCap & expectedHedge < hedgeCap: add long/sub short to expectedHedge');
  });

  describe('hedgeCap = 0', async () => {
    beforeEach(async () => {
      // call hedgeDelta() to create currentHedge
    });

    // within each it, expect(does not revert even if interaction delay not expired)
    it.skip('skips interaction delay for all hedges');
    it.skip('currentHedge = positive, expectedHedge = positive: sub short to hedgeCap');
    it.skip('currentHedge = positive, expectedHedge = negative: sub short to hedgeCap');
    it.skip('currentHedge = negative, expectedHedge = positive: sub short to hedgeCap');
    it.skip('currentHedge = negative, expectedHedge = negative: sub short to hedgeCap');

    it.skip('currentHedge > hedgeCap & expectedHedge < hedgeCap: sub short to expectedHedge');
    it.skip('currentHedge < hedgeCap & expectedHedge > hedgeCap: add short to hedgeCap');
  });
});
