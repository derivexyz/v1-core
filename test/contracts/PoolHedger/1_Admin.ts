import { beforeEach } from 'mocha';
import { HOUR_SEC, MAX_UINT, toBN } from '../../../scripts/util/web3utils';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

const modParams = {
  shortBuffer: toBN('2.1'),
  hedgeCap: toBN('1000000'),
  interactionDelay: HOUR_SEC * 6,
};

async function setParams(overrides?: any) {
  return await hre.f.c.poolHedger.setPoolHedgerParams({
    ...DEFAULT_POOL_HEDGER_PARAMS,
    ...(overrides || {}),
  });
}

describe('Admin', async () => {
  beforeEach(seedFixture);

  it('cannot initialized contract twice', async () => {
    await expect(
      hre.f.c.poolHedger.init(
        hre.f.c.synthetixAdapter.address,
        hre.f.c.optionMarket.address,
        hre.f.c.optionGreekCache.address,
        hre.f.c.liquidityPool.address,
        hre.f.c.snx.quoteAsset.address,
        hre.f.c.snx.baseAsset.address,
      ),
    ).revertedWith('AlreadyInitialised');
  });

  it('updates successfully', async () => {
    const oldParams = await hre.f.c.poolHedger.poolHedgerParams();
    await setParams(modParams);
    const newParams = await hre.f.c.poolHedger.poolHedgerParams();

    expect(oldParams.shortBuffer).not.eq(newParams.shortBuffer);
    expect(newParams.shortBuffer).eq(modParams.shortBuffer);

    expect(oldParams.interactionDelay).not.eq(newParams.interactionDelay);
    expect(newParams.interactionDelay).eq(modParams.interactionDelay);

    expect(oldParams.hedgeCap).not.eq(newParams.hedgeCap);
    expect(newParams.hedgeCap).eq(modParams.hedgeCap);
  });

  it('reverts with invalid parameters', async () => {
    await expect(setParams({ shortBuffer: toBN('0.9') })).revertedWith('InvalidPoolHedgerParameters');
  });

  it('reverts with invalid parameters', async () => {
    await expect(
      hre.f.c.poolHedger.setPoolHedgerParams({
        shortBuffer: toBN('0.9'),
        interactionDelay: 24 * HOUR_SEC,
        hedgeCap: MAX_UINT,
      }),
    ).revertedWith('InvalidPoolHedgerParameters');
  });
});
