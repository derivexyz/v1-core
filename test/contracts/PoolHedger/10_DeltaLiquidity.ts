// Integration test
// Can skip testing hedge cap use cases since hedgeDelta() uses same internal function
import { BigNumber, BigNumberish } from 'ethers';
import { toBN, UNIT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { assertCloseTo, assertCloseToPercentage } from '../../utils/assert';
import {
  fullyClosePosition,
  partiallyClosePosition,
  setNegativeExpectedHedge,
  setPositiveExpectedHedge,
} from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE, DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

async function expectHedgingLiquidityCloseTo(
  pendingLiquidity: BigNumberish,
  usedLiquidity: BigNumberish,
  priceOverride?: BigNumberish,
) {
  const res = await hre.f.c.poolHedger.getHedgingLiquidity(
    hre.f.c.snx.collateralShort.address,
    priceOverride || DEFAULT_BASE_PRICE,
  );
  assertCloseTo(res[0], BigNumber.from(pendingLiquidity), toBN('1'));
  assertCloseTo(res[1], BigNumber.from(usedLiquidity), toBN('1'));
}

async function expectCurrentDelta(expectedDelta: BigNumberish) {
  const currentDelta = await hre.f.c.poolHedger.getCappedExpectedHedge();
  assertCloseToPercentage(currentDelta, BigNumber.from(expectedDelta), toBN('0.01'));
}

describe('Delta Liquidity', () => {
  let snap: number;
  let shortId: BigNumber;

  before(seedFixture);

  beforeEach(async () => {
    if (snap) {
      await restoreSnapshot(snap);
    } else {
      await hre.f.c.poolHedger.setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        interactionDelay: 0,
      });
      shortId = await hre.f.c.poolHedger.shortId();
    }
    snap = await takeSnapshot();
  });

  describe('getHedgingLiquidity', () => {
    it('currentHedge == 0', async () => {
      await expectHedgingLiquidityCloseTo(0, 0);
      let position = await setPositiveExpectedHedge();
      await expectHedgingLiquidityCloseTo(toBN('4000'), 0);
      await fullyClosePosition(position);
      position = await setNegativeExpectedHedge();
      await expectHedgingLiquidityCloseTo(toBN('26838'), 0);
      await fullyClosePosition(position);
      await expectHedgingLiquidityCloseTo(0, 0);
    });
    it('currentHedge > 0', async () => {
      const initialPosition = await setPositiveExpectedHedge();
      await hre.f.c.poolHedger.hedgeDelta();

      // expectedHedge = 0
      await expectHedgingLiquidityCloseTo(0, toBN('4000'));
      await expectCurrentDelta(toBN('2.3'));

      // Check case where someone "donates" collateral to the short
      await hre.f.c.snx.collateralShort.deposit(ZERO_ADDRESS, shortId, toBN('10'));
      await expectHedgingLiquidityCloseTo(0, toBN('4010'));
      await hre.f.c.poolHedger.hedgeDelta();
      await expectHedgingLiquidityCloseTo(0, toBN('4000'));

      // expectedHedge is positive & > currentHedge
      let position = await setPositiveExpectedHedge();
      await expectHedgingLiquidityCloseTo(toBN('4000'), toBN('4000'));
      await expectCurrentDelta(toBN('4.6'));

      // expectedHedge = positive & < currentHedge
      await hre.f.c.poolHedger.hedgeDelta();
      await fullyClosePosition(position);
      await expectHedgingLiquidityCloseTo(0, toBN('8001'));
      await expectCurrentDelta(toBN('2.3'));

      // expectedHedge < 0 & over current hedge
      position = await setNegativeExpectedHedge();
      await expectHedgingLiquidityCloseTo(toBN('2833'), toBN('8001'));
      await expectCurrentDelta(toBN('-5.4'));

      // expectedHedge < 0 & under current hedge
      await partiallyClosePosition(position, toBN('5')); // -13 required, so between 0 and 8k
      await expectHedgingLiquidityCloseTo(0, toBN('8001'));
      await expectCurrentDelta(toBN('-1.55'));

      await fullyClosePosition(initialPosition);
      await fullyClosePosition(position);
      await hre.f.c.poolHedger.hedgeDelta();
      await expectHedgingLiquidityCloseTo(0, 0);
    });

    it('currentHedge < zero', async () => {
      const initialPosition = await setNegativeExpectedHedge(toBN('1'));

      await hre.f.c.poolHedger.hedgeDelta();

      // expectedHedge = 0
      await expectHedgingLiquidityCloseTo(0, toBN('1341'));
      await expectCurrentDelta(toBN('-0.77'));

      // Check case where someone "donates" baseAsset to the contract
      await hre.f.c.snx.baseAsset.mint(hre.f.c.poolHedger.address, toBN('1'));
      await expectHedgingLiquidityCloseTo(0, toBN('1341').add(DEFAULT_BASE_PRICE));
      await hre.f.c.poolHedger.hedgeDelta();
      await expectHedgingLiquidityCloseTo(0, toBN('1341'));

      // expectedHedge = positive & > currentHedge
      let position = await setPositiveExpectedHedge();
      await expectCurrentDelta(toBN('1.53'));
      await expectHedgingLiquidityCloseTo(toBN('1317'), toBN('1341'));

      // expectedHedge = positive & < currentHedge
      await partiallyClosePosition(position, toBN('6'));
      await expectCurrentDelta(toBN('0.148'));
      await expectHedgingLiquidityCloseTo(0, toBN('1341'));

      // expectedHedge = negative & < currentHedge
      await partiallyClosePosition(position, toBN('2'));
      await expectCurrentDelta(toBN('-0.31'));
      await expectHedgingLiquidityCloseTo(0, toBN('1341'));

      // expectedHedge = negative & > currentHedge
      await fullyClosePosition(position);
      position = await setNegativeExpectedHedge(toBN('1'));
      await expectCurrentDelta(toBN('-1.54'));
      // TODO: check this is fine, 2x the buffer even if it becomes 1x the buffer...
      await expectHedgingLiquidityCloseTo(toBN('2683'), toBN('1341'));

      await fullyClosePosition(position);
      await fullyClosePosition(initialPosition);
      await hre.f.c.poolHedger.hedgeDelta();
      await expectHedgingLiquidityCloseTo(0, 0);
    });

    it('usedDeltaLiquidity', async () => {
      // currentHedge = 0
      await expectHedgingLiquidityCloseTo(0, 0);

      // currentHedge > 0: quote value of hedge
      await hre.f.c.snx.baseAsset.mint(hre.f.c.poolHedger.address, toBN('1'));
      await expectHedgingLiquidityCloseTo(0, DEFAULT_BASE_PRICE);

      // can handle both long and short together
      await hre.f.c.snx.collateralShort.deposit(ZERO_ADDRESS, shortId, toBN('1000'));
      await expectHedgingLiquidityCloseTo(0, DEFAULT_BASE_PRICE.add(toBN('1000')));

      // currentHedge < 0 & collateral > short value: remaining collateral
      await setNegativeExpectedHedge(toBN('1'));
      await hre.f.c.poolHedger.hedgeDelta();
      await expectHedgingLiquidityCloseTo(0, toBN('1341'));
      const shortPos = await hre.f.c.poolHedger.getShortPosition(hre.f.c.snx.collateralShort.address);
      assertCloseTo(
        toBN('1341'),
        shortPos.collateral.sub(shortPos.shortBalance.mul(DEFAULT_BASE_PRICE).div(UNIT)),
        UNIT,
      );

      // currentHedge < 0 & collateral < short value: zero used
      await expectHedgingLiquidityCloseTo(0, 0, toBN('4000'));
    });
  });
});
