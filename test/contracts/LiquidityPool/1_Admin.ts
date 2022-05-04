import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DAY_SEC, HOUR_SEC, MONTH_SEC, toBN, WEEK_SEC, YEAR_SEC } from '../../../scripts/util/web3utils';
import { LiquidityPoolParametersStruct } from '../../../typechain-types/LiquidityPool';
import { DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

const modParams = {
  depositDelay: MONTH_SEC,
  withdrawalDelay: WEEK_SEC / 2,
  withdrawalFee: toBN('0.1'),
  liquidityCBThreshold: toBN('0.1'),
  liquidityCBTimeout: 300 * HOUR_SEC,
  ivVarianceCBThreshold: toBN('0.01'),
  skewVarianceCBTimeout: WEEK_SEC,
  guardianDelay: DAY_SEC,
  boardSettlementCBTimeout: HOUR_SEC * 5,
} as LiquidityPoolParametersStruct;

const setParams = async (overrides?: any) => {
  return await hre.f.c.liquidityPool.setLiquidityPoolParameters({
    ...DEFAULT_LIQUIDITY_POOL_PARAMS,
    ...(overrides || {}),
  });
};

const expectInvalidParams = async (overrides?: any) => {
  await expect(setParams(overrides)).revertedWith('InvalidLiquidityPoolParameters');
};

describe('LiquidityPool - Admin', async () => {
  beforeEach(seedFixture);

  describe('Initialization', async () => {
    it('cannot init twice', async () => {
      await expect(
        hre.f.c.liquidityPool.init(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
        ),
      ).to.be.revertedWith('AlreadyInitialised');
    });

    it('only owner can initialize', async () => {
      await expect(
        hre.f.c.liquidityPool
          .connect(hre.f.alice)
          .init(
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
          ),
      ).to.be.revertedWith('OnlyOwner');
    });
    it('delegates snx approval when initialized', async () => {
      expect(
        await hre.f.c.snx.delegateApprovals.canExchangeOnBehalf(
          hre.f.c.synthetixAdapter.address,
          hre.f.c.liquidityPool.address,
        ),
      ).be.true;
    });
  });

  describe('LP params', async () => {
    it('sets liquidity pool params and updates', async () => {
      const oldParams = await hre.f.c.liquidityPool.lpParams();

      await setParams(modParams);

      const newParams = await hre.f.c.liquidityPool.lpParams();
      // Verify all parameters updated as expected
      expect(oldParams.depositDelay).not.eq(newParams.depositDelay);
      expect(newParams.depositDelay).eq(modParams.depositDelay);

      expect(oldParams.withdrawalDelay).not.eq(newParams.withdrawalDelay);
      expect(newParams.withdrawalDelay).eq(modParams.withdrawalDelay);

      expect(oldParams.withdrawalFee).not.eq(newParams.withdrawalFee);
      expect(newParams.withdrawalFee).eq(modParams.withdrawalFee);

      expect(oldParams.liquidityCBThreshold).not.eq(newParams.liquidityCBThreshold);
      expect(newParams.liquidityCBThreshold).eq(modParams.liquidityCBThreshold);

      expect(oldParams.liquidityCBTimeout).not.eq(newParams.liquidityCBTimeout);
      expect(newParams.liquidityCBTimeout).eq(modParams.liquidityCBTimeout);

      expect(oldParams.ivVarianceCBThreshold).not.eq(newParams.ivVarianceCBThreshold);
      expect(newParams.ivVarianceCBThreshold).eq(modParams.ivVarianceCBThreshold);

      expect(oldParams.skewVarianceCBTimeout).not.eq(newParams.skewVarianceCBTimeout);
      expect(newParams.skewVarianceCBTimeout).eq(modParams.skewVarianceCBTimeout);

      expect(oldParams.guardianDelay).not.eq(newParams.guardianDelay);
      expect(newParams.guardianDelay).eq(modParams.guardianDelay);

      expect(oldParams.boardSettlementCBTimeout).not.eq(newParams.boardSettlementCBTimeout);
      expect(newParams.boardSettlementCBTimeout).eq(modParams.boardSettlementCBTimeout);
    });
  });

  it('Lp Params revert testing', async () => {
    await expectInvalidParams({ depositDelay: YEAR_SEC * 2 });
    await expectInvalidParams({ withdrawalDelay: YEAR_SEC * 2 });
    await expectInvalidParams({ withdrawalFee: toBN('3') });
    await expectInvalidParams({ liquidityCBThreshold: toBN('20') });
    await expectInvalidParams({ ivVarianceCBTimeout: 61 * DAY_SEC });
    await expectInvalidParams({ skewVarianceCBTimeout: YEAR_SEC * 2 });
    await expectInvalidParams({ guardianDelay: YEAR_SEC * 2 });
    await expectInvalidParams({ boardSettlementCBTimeout: YEAR_SEC * 2 });
  });
});
