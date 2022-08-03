import { toBN } from '../../../../scripts/util/web3utils';
import { setETHPrice } from '../../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE } from '../../../utils/defaultParams';
import { seedFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('KeeperHelper - updateCache', () => {
  beforeEach(async () => {
    await seedFixture();
  });

  it('updates all boards', async () => {
    let globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
    expect(globalCache.maxUpdatedAtPrice).eq(DEFAULT_BASE_PRICE);
    await setETHPrice(DEFAULT_BASE_PRICE.sub(toBN('1')));
    await hre.f.c.keeperHelper.updateAllBoardCachedGreeks();
    globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
    expect(globalCache.maxUpdatedAtPrice).eq(DEFAULT_BASE_PRICE.sub(toBN('1')));
  });

  it('updates all stale boards', async () => {
    let globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
    expect(globalCache.maxUpdatedAtPrice).eq(DEFAULT_BASE_PRICE);
    await setETHPrice(DEFAULT_BASE_PRICE.sub(toBN('1')));
    await hre.f.c.keeperHelper.updateStaleBoardCachedGreeks();
    // doesnt actually update because the board isn't stale
    globalCache = await hre.f.c.optionGreekCache.getGlobalCache();
    expect(globalCache.maxUpdatedAtPrice).eq(DEFAULT_BASE_PRICE);
  });
});
