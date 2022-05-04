import { beforeEach } from 'mocha';
import { toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import { getRequiredHedge, setNegativeExpectedHedge, setPositiveExpectedHedge } from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// Unit test on getCurrentHedgedNetDelta()
describe('Current Hedge', async () => {
  beforeEach(seedFixture);

  it('returns negative delta if net short', async () => {
    await setNegativeExpectedHedge();
    await hre.f.c.poolHedger.hedgeDelta();
    assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), await getRequiredHedge(), toBN('0.0001'));
    expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).to.lt(0);
  });
  it('returns positive delta if net long', async () => {
    await setPositiveExpectedHedge();
    await hre.f.c.poolHedger.hedgeDelta();
    assertCloseTo(await hre.f.c.poolHedger.getCurrentHedgedNetDelta(), await getRequiredHedge(), toBN('0.0001'));
    expect(await hre.f.c.poolHedger.getCurrentHedgedNetDelta()).to.gt(0);
  });
  it.skip('returns zero if no hedge');
  it.skip('returns zero if short account not open');
  it.skip('returns zero if short account was liquidated');
});
