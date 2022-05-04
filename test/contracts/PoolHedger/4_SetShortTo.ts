// Unit test with external wrapper
// Top-Level: collateral to short ratios
// Sub-Level: target scenarios
//      desiredShort is zero:
//      desiredShort > shortBalance
//      desiredShort > shortBalance & freeLiquidity not enough:
//      desiredShort < shortBalance
//      desiredShort > shortBalance & freeLiquidity not enough:
//      freeLiquidity is zero:
// Some scenarios can double up for different collateral cases, some might not be required
describe('setShortTo', async () => {
  // for each "it" check
  //      expect(correct balanceOf LP)
  //      expect(correct balanceOf PoolHedger)
  //      expect(correct shortBalance/shortCollateral using getShortPosition)
  //      expect(correct currentHedgeDelta using getCurrentHedgedNetDelta())

  describe('from 0 : 0 (collateral : short)', async () => {
    it.skip('desiredShort is zero: no change');
    it.skip('desiredShort > shortBalance: increases short/collateral');
    it.skip('desiredShort > shortBalance & freeLiquidity not enough: increases short to maxPossibleShort');
    it.skip('need distinction between freeLiquidity and pedingDelta');
    it.skip('freeLiquidity is zero: no change');
  });

  describe('from 1 : 0 (collateral : short)', async () => {
    it.skip('desiredShort is zero: removes all collateral');
    it.skip('desiredShort > shortBalance: increases short/decreases collateral');
    it.skip('desiredShort > shortBalance: increases short/collateral');
    it.skip('desiredShort > shortBalance & freeLiquidity not enough: increases short to maxPossibleShort');
    it.skip('freeLiquidity is zero: no change');
  });

  describe('from 2 : 1 (collateral : short)', async () => {
    it.skip('desiredShort is zero: removes all collateral/short');
    it.skip('desiredShort > shortBalance: increases short/decreases collateral');
    it.skip('desiredShort > shortBalance: increases short/collateral');
    it.skip('desiredShort > shortBalance & freeLiquidity not enough: increases short to maxPossibleShort');
    it.skip('desiredShort < shortBalance: decreases short/decreases collateral');
    it.skip('freeLiquidity is zero: no change');
  });

  describe('from 1 : 1 (collateral : short)', async () => {
    it.skip('desiredShort is zero: removes all collateral/short');
    it.skip('desiredShort > shortBalance: increases short/ collateral');
    it.skip('desiredShort > shortBalance & freeLiquidity not enough: increases short to maxPossibleShort');
    it.skip('desiredShort < shortBalance: decreases short/collateral');
    it.skip('desiredShort < shortBalance: decreases short/increases collateral');
    it.skip('desiredShort < shortBalance & freeLiquidity not enough: increases short to maxPossibleShort');
    it.skip('freeLiquidity is zero: no change');
  });
});
