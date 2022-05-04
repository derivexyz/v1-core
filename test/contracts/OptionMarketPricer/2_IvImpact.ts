import { seedFixture } from '../../utils/fixture';

describe('IvImpact', async () => {
  beforeEach(seedFixture);
  it.skip('correctly computes affected IV and Skew based on parameters');
  it.skip('skewAdjustment of 0 stops skew moving');
  it.skip('skewAdjustment > 1 moves skew more than iv');
  it.skip('isBuy = true moves skew and iv up');
  it.skip('isBuy = false moves skew and iv down');
  it.skip('skew reverts if trying to go below 0');
  it.skip('iv reverts if trying to bo below 0');
});
