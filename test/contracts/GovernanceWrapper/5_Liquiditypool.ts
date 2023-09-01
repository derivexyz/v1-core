import { DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS } from '../../utils/defaultParams';
import { DAY_SEC, HOUR_SEC, MONTH_SEC, YEAR_SEC, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { LiquidityPoolBoundsStruct } from '../../../typechain-types/LiquidityPoolGovernanceWrapper';

describe('LiquidityPoolGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.liquidityPoolGov.setRiskCouncil(RC.address);
    await govWrap.liquidityPoolGov.setLiquidityPoolBounds(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS);
  });

  ///////////
  // Admin //
  ///////////

  it('should be able to set risk council', async () => {
    expect(await govWrap.liquidityPoolGov.riskCouncil()).eq(RC.address);
  });

  it('should be able to set pool hedger', async () => {
    await govWrap.liquidityPoolGov.setPoolHedger(hre.f.gc.futuresPoolHedger.address);
    expect(await hre.f.gc.liquidityPool.poolHedger()).eq(hre.f.gc.futuresPoolHedger.address);
  });

  it('should be able to set default guardian multisig', async () => {
    const newParams: LiquidityPoolBoundsStruct = DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS;
    newParams.defaultGuardianMultisig = hre.f.alice.address;
    await govWrap.liquidityPoolGov.setLiquidityPoolBounds(newParams);

    await govWrap.liquidityPoolGov
      .connect(RC)
      .setLiquidityPoolParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minLiquidityPoolParams);
    expect(await (await hre.f.gc.liquidityPool.getLpParams()).guardianMultisig).eq(hre.f.alice.address);
  });

  it('should NOT be able to set pool hedger if blocked', async () => {
    await expect(govWrap.liquidityPoolGov.connect(RC).setPoolHedger(hre.f.gc.futuresPoolHedger.address)).revertedWith(
      'LPGW_CannotUpdateHedge',
    );
    // expect(await hre.f.gc.liquidityPool.poolHedger()).eq(hre.f.gc.futuresPoolHedger.address);
  });

  it('should be able to forceChangeOwner', async () => {
    expect(await hre.f.gc.liquidityPool.owner()).eq(govWrap.liquidityPoolGov.address);
    await govWrap.liquidityPoolGov.forceChangeOwner(await govWrap.liquidityPoolGov.liquidityPool(), RC.address);
    expect(await hre.f.gc.liquidityPool.owner()).eq(govWrap.liquidityPoolGov.address);
    expect(await hre.f.gc.liquidityPool.nominatedOwner()).eq(RC.address);
    await hre.f.gc.liquidityPool.connect(RC).acceptOwnership();
    expect(await hre.f.gc.liquidityPool.owner()).eq(RC.address);
  });

  ////////////
  // Params //
  ////////////

  it('can set liquidity pool parameters', async () => {
    const newParams: LiquidityPoolBoundsStruct = DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS;
    newParams.defaultGuardianMultisig = ZERO_ADDRESS;
    await govWrap.liquidityPoolGov.setLiquidityPoolBounds(newParams);

    // can set to min and max
    await govWrap.liquidityPoolGov
      .connect(RC)
      .setLiquidityPoolParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minLiquidityPoolParams);
    await govWrap.liquidityPoolGov
      .connect(RC)
      .setLiquidityPoolParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxLiquidityPoolParams);
    await expect(
      govWrap.liquidityPoolGov
        .connect(hre.f.signers[3])
        .setLiquidityPoolParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxLiquidityPoolParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(await hre.f.gc.liquidityPool.lpParams(), DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxLiquidityPoolParams);

    // reverts if lower than min
    await expect(
      govWrap.liquidityPoolGov.connect(RC).setLiquidityPoolParameters({
        ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minLiquidityPoolParams,
        withdrawalDelay: DAY_SEC,
      }),
    ).revertedWith('LPGW_LiquidityPoolParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.liquidityPoolGov.connect(RC).setLiquidityPoolParameters({
        ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxLiquidityPoolParams,
        withdrawalDelay: YEAR_SEC,
      }),
    ).revertedWith('LPGW_LiquidityPoolParamsOutOfBounds');

    // owner can bypass
    await govWrap.liquidityPoolGov.setLiquidityPoolParameters({
      ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxLiquidityPoolParams,
      withdrawalFee: 6 * MONTH_SEC,
    });
  });

  it('can set circuitBreakerParameters', async () => {
    await govWrap.liquidityPoolGov.setCircuitBreakerParameters(
      DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxCircuitBreakerParams,
    );
    await govWrap.liquidityPoolGov
      .connect(RC)
      .setCircuitBreakerParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minCircuitBreakerParams);
    await govWrap.liquidityPoolGov
      .connect(RC)
      .setCircuitBreakerParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxCircuitBreakerParams);

    await expect(
      govWrap.liquidityPoolGov
        .connect(hre.f.signers[3])
        .setCircuitBreakerParameters(DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minCircuitBreakerParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(await hre.f.gc.liquidityPool.cbParams(), DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxCircuitBreakerParams);

    // reverts if lower than min
    await expect(
      govWrap.liquidityPoolGov.connect(RC).setCircuitBreakerParameters({
        ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minCircuitBreakerParams,
        liquidityCBTimeout: HOUR_SEC,
      }),
    ).revertedWith('LPGW_CircuitBreakerParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.liquidityPoolGov.connect(RC).setCircuitBreakerParameters({
        ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.maxCircuitBreakerParams,
        liquidityCBTimeout: 50 * DAY_SEC,
      }),
    ).revertedWith('LPGW_CircuitBreakerParamsOutOfBounds');

    // owner can bypass bounds
    await govWrap.liquidityPoolGov.setCircuitBreakerParameters({
      ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS.minCircuitBreakerParams,
      liquidityCBTimeout: HOUR_SEC,
    });
  });

  it('should NOT be able to set liquidity pool', async () => {
    await expect(govWrap.liquidityPoolGov.setLiquidityPool(ZERO_ADDRESS)).revertedWith('LPGW_LiquidityPoolAlreadySet');
  });

  it('should be able to recover LP funds', async () => {
    // Mint some ERC20 to LP
    const LYRA = await (
      await ethers.getContractFactory('TestERC20SetDecimalsFail', hre.f.deployer)
    ).deploy('LYRA', 'LYRA', 18);
    const amount = ethers.utils.parseUnits('100', 18);
    await LYRA.mint(hre.f.gc.liquidityPool.address, amount);

    // Recover funds
    await govWrap.liquidityPoolGov.recoverLPFunds(LYRA.address, hre.f.alice.address);

    // Expect funds to be recovered
    const balance = await LYRA.balanceOf(hre.f.alice.address);
    expect(balance).to.equal(amount);
  });

  it('should NOT able to recover LP funds if blocked', async () => {
    await govWrap.liquidityPoolGov.setLiquidityPoolBounds({
      ...DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS,
      recoverFundsBlocked: true,
    });

    // Mint some ERC20
    const LYRA = await (
      await ethers.getContractFactory('TestERC20SetDecimalsFail', hre.f.deployer)
    ).deploy('LYRA', 'LYRA', 18);
    const amount = ethers.utils.parseUnits('100', 18);
    await LYRA.mint(hre.f.gc.liquidityPool.address, amount);

    await expect(govWrap.liquidityPoolGov.recoverLPFunds(LYRA.address, ZERO_ADDRESS)).revertedWith(
      'LPGW_InvalidRecipient',
    );
    await expect(govWrap.liquidityPoolGov.connect(RC).recoverLPFunds(LYRA.address, hre.f.alice.address)).revertedWith(
      'LPGW_RecoverFundsBlocked',
    );
  });

  it('should be able to get LP bounds', async () => {
    compareStruct(await govWrap.liquidityPoolGov.getLiquidityPoolBounds(), DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS);
  });
});
