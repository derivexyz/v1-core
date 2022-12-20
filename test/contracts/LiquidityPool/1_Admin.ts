import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DAY_SEC, HOUR_SEC, MONTH_SEC, toBN, WEEK_SEC, YEAR_SEC } from '../../../scripts/util/web3utils';
import { CircuitBreakerParametersStruct, LiquidityPoolParametersStruct } from '../../../typechain-types/LiquidityPool';
import { DEFAULT_CB_PARAMS, DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

const modLPParams = {
  depositDelay: MONTH_SEC,
  withdrawalDelay: WEEK_SEC / 2,
  withdrawalFee: toBN('0.1'),
  guardianDelay: DAY_SEC,
} as LiquidityPoolParametersStruct;

const modCBParams = {
  liquidityCBThreshold: toBN('0.1'),
  liquidityCBTimeout: 300 * HOUR_SEC,
  ivVarianceCBThreshold: toBN('0.01'),
  skewVarianceCBTimeout: WEEK_SEC,
  boardSettlementCBTimeout: HOUR_SEC * 5,
} as CircuitBreakerParametersStruct;

const setLPParams = async (overrides?: any) => {
  return await hre.f.c.liquidityPool.setLiquidityPoolParameters({
    ...DEFAULT_LIQUIDITY_POOL_PARAMS,
    ...(overrides || {}),
  });
};
const setCBParams = async (overrides?: any) => {
  return await hre.f.c.liquidityPool.setCircuitBreakerParameters({
    ...DEFAULT_CB_PARAMS,
    ...(overrides || {}),
  });
};

const expectInvalidLPParams = async (overrides?: any) => {
  await expect(setLPParams(overrides)).revertedWith('InvalidLiquidityPoolParameters');
};

const expectInvalidCBParams = async (overrides?: any) => {
  await expect(setCBParams(overrides)).revertedWith('InvalidCircuitBreakerParameters');
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
    it.skip('delegates snx approval when initialized', async () => {
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
      const oldLPParams = await hre.f.c.liquidityPool.lpParams();
      const oldCBParams = await hre.f.c.liquidityPool.cbParams();

      await setLPParams(modLPParams);
      await setCBParams(modCBParams);

      const newLPParams = await hre.f.c.liquidityPool.lpParams();
      const newCBParams = await hre.f.c.liquidityPool.cbParams();
      // Verify all parameters updated as expected
      expect(oldLPParams.depositDelay).not.eq(newLPParams.depositDelay);
      expect(newLPParams.depositDelay).eq(modLPParams.depositDelay);

      expect(oldLPParams.withdrawalDelay).not.eq(newLPParams.withdrawalDelay);
      expect(newLPParams.withdrawalDelay).eq(modLPParams.withdrawalDelay);

      expect(oldLPParams.withdrawalFee).not.eq(newLPParams.withdrawalFee);
      expect(newLPParams.withdrawalFee).eq(modLPParams.withdrawalFee);

      expect(oldCBParams.liquidityCBThreshold).not.eq(newCBParams.liquidityCBThreshold);
      expect(newCBParams.liquidityCBThreshold).eq(modCBParams.liquidityCBThreshold);

      expect(oldCBParams.liquidityCBTimeout).not.eq(newCBParams.liquidityCBTimeout);
      expect(newCBParams.liquidityCBTimeout).eq(modCBParams.liquidityCBTimeout);

      expect(oldCBParams.ivVarianceCBThreshold).not.eq(newCBParams.ivVarianceCBThreshold);
      expect(newCBParams.ivVarianceCBThreshold).eq(modCBParams.ivVarianceCBThreshold);

      expect(oldCBParams.skewVarianceCBTimeout).not.eq(newCBParams.skewVarianceCBTimeout);
      expect(newCBParams.skewVarianceCBTimeout).eq(modCBParams.skewVarianceCBTimeout);

      expect(oldLPParams.guardianDelay).not.eq(newLPParams.guardianDelay);
      expect(newLPParams.guardianDelay).eq(modLPParams.guardianDelay);

      expect(oldCBParams.boardSettlementCBTimeout).not.eq(newCBParams.boardSettlementCBTimeout);
      expect(newCBParams.boardSettlementCBTimeout).eq(modCBParams.boardSettlementCBTimeout);
    });
  });

  it('Lp Params revert testing', async () => {
    await expectInvalidLPParams({ depositDelay: YEAR_SEC * 2 });
    await expectInvalidLPParams({ withdrawalDelay: YEAR_SEC * 2 });
    await expectInvalidLPParams({ withdrawalFee: toBN('3') });
    await expectInvalidLPParams({ guardianDelay: YEAR_SEC * 2 });
  });
  it('Lp Params revert testing', async () => {
    await expectInvalidCBParams({ liquidityCBThreshold: toBN('20') });
    await expectInvalidCBParams({ ivVarianceCBTimeout: 61 * DAY_SEC });
    await expectInvalidCBParams({ skewVarianceCBTimeout: YEAR_SEC * 2 });
    await expectInvalidCBParams({ boardSettlementCBTimeout: YEAR_SEC * 2 });
  });
});
