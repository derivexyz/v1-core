import { beforeEach } from 'mocha';
import { toBN } from '../../../scripts/util/web3utils';
import { assertCloseTo } from '../../utils/assert';
import { setETHPrice, setNegativeExpectedHedge } from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

// Integration test for internal _updateCollateral() and external updateCollateral()
describe('updateCollateral', async () => {
  // for each "it" check
  //      expect(correct balanceOf LP)
  //      expect(correct balanceOf PoolHedger)
  //      expect(correct shortBalance/shortCollateral using getShortPosition)
  //      expect(correct currentHedgeDelta using getCurrentHedgedNetDelta)

  // reverts

  beforeEach(seedFixture);

  it.skip('reverts if shortId == 0');
  it.skip('reverts if short account closed or liquidated');
  it.skip('updates collateral even if interaction delay unexpired');

  // Short Buffer change
  describe('shortBuffer increase', async () => {
    it.skip('adds collateral from LP');
    it.skip('freeLiquidity not enough: adds only received quote amount');
    it.skip('freeLiquidity == 0: no change to collateral');
  });

  describe('shortBuffer decrease', async () => {
    it.skip('returns collateral to LP');
    it.skip('freeLiquidity not enough: returns collateral to LP');
    it.skip('freeLiquidity == 0: returns collateral to LP');
  });

  // Spot Price changes
  describe('spotPrice increase', async () => {
    it.skip('adds collateral from LP ');
    it.skip('freeLiquidity not enough: adds only received quote amount');
    it.skip('freeLiquidity == 0: no change to collateral');
    it('add collateral with external call', async () => {
      await setNegativeExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta(); // 26838.509861243190415706
      await setETHPrice(toBN('2500'));
      await hre.f.c.poolHedger.updateCollateral();

      const params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
      const [, collateral] = await hre.f.c.poolHedger.getShortPosition(params.short);
      assertCloseTo(collateral, toBN('38516.509579434500000000'), toBN('0.01'));

      await hre.f.c.poolHedger.updateCollateral();
      const [, newCollateral] = await hre.f.c.poolHedger.getShortPosition(params.short);
      // collateral doesn't change between two calls
      expect(collateral).eq(newCollateral);
    });
  });

  describe('spotPrice decrease', async () => {
    it.skip('returns collateral to LP');
    it.skip('freeLiquidity not enough: returns collateral to LP');
    it.skip('freeLiquidity == 0: returns collateral to LP');
    it.skip('add collateral with external call');
  });
});
