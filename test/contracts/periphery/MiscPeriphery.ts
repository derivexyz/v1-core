import { beforeEach } from 'mocha';
import { ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('MiscPeriphery', async () => {
  beforeEach(seedFixture);

  it('BasicLiquidityCounter edge cases', async () => {
    await expect(hre.f.c.basicLiquidityCounter.addTokens(ZERO_ADDRESS, 0)).revertedWith(
      'can only be called by LiquidityToken',
    );
  });
});
