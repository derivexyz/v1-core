import { toBN } from '../../../scripts/util/web3utils';
import { openDefaultLongCall } from '../../utils/contractHelpers';
import { DEFAULT_PARTIAL_COLLAT_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

const modParams = {
  penaltyRatio: toBN('0.4'),
  liquidatorFeeRatio: toBN('0.2'),
  smFeeRatio: toBN('0.4'),
  minLiquidationFee: toBN('50'),
};

async function setParams(overrides?: any) {
  return await hre.f.c.optionToken.setPartialCollateralParams({
    ...DEFAULT_PARTIAL_COLLAT_PARAMS,
    ...(overrides || {}),
  });
}

async function expectInvalidParams(overrides?: any) {
  await expect(setParams(overrides)).revertedWith('InvalidPartialCollateralParameters');
}

describe('Admin', async () => {
  beforeEach(seedFixture);

  describe('Initialization', async () => {
    it('cannot init twice', async () => {
      await expect(
        hre.f.c.optionToken.init(
          hre.f.c.optionMarket.address,
          hre.f.c.optionGreekCache.address,
          hre.f.c.shortCollateral.address,
          hre.f.c.synthetixAdapter.address,
        ),
      ).to.be.revertedWith('AlreadyInitialised');
    });
  });

  describe('setPartialCollateralParams', async () => {
    it('updates successfully', async () => {
      const oldParams = await hre.f.c.optionToken.getPartialCollatParams();
      await setParams(modParams);
      const newParams = await hre.f.c.optionToken.getPartialCollatParams();

      // Verify all parameters updated as expected
      expect(oldParams.penaltyRatio).not.eq(newParams.penaltyRatio);
      expect(newParams.penaltyRatio).eq(modParams.penaltyRatio);

      expect(oldParams.liquidatorFeeRatio).not.eq(newParams.liquidatorFeeRatio);
      expect(newParams.liquidatorFeeRatio).eq(modParams.liquidatorFeeRatio);

      expect(oldParams.smFeeRatio).not.eq(newParams.smFeeRatio);
      expect(newParams.smFeeRatio).eq(modParams.smFeeRatio);

      expect(oldParams.minLiquidationFee).not.eq(newParams.minLiquidationFee);
      expect(newParams.minLiquidationFee).eq(modParams.minLiquidationFee);
    });

    it('reverts with invalid parameters', async () => {
      await expectInvalidParams({ penaltyRatio: toBN('1.0001') });
      await expectInvalidParams({ liquidatorFeeRatio: toBN('1.0001'), smFeeRatio: 0 });
      await expectInvalidParams({ smFeeRatio: toBN('1.0001'), liquidatorFeeRatio: 0 });
      await expectInvalidParams({ smFeeRatio: toBN('0.6'), liquidatorFeeRatio: toBN('0.41') });
    });

    it('only callable by owner', async () => {
      await expect(hre.f.c.optionToken.connect(hre.f.alice).setPartialCollateralParams(modParams)).revertedWith(
        'OnlyOwner',
      );
    });
  });

  describe('setURI', async () => {
    it('sets uri successfully', async () => {
      await openDefaultLongCall();
      await hre.f.c.optionToken.setURI('testURI/');
      expect(await hre.f.c.optionToken.tokenURI(1)).eq('testURI/1');
    });
    it('only callable by owner', async () => {
      await expect(hre.f.c.optionToken.connect(hre.f.alice).setURI('testURI/')).to.revertedWith('OnlyOwner');
    });
  });
});
