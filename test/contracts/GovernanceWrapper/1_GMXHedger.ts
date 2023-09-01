import {
  DEFAULT_GMX_POOL_HEDGER_PARAMS,
  DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS,
  DEFAULT_POOL_HEDGER_PARAMS,
} from '../../utils/defaultParams';
import { MAX_UINT, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';

import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';

describe('GMXHedgerGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.gmxHedgerGov.setRiskCouncil(RC.address);
    await govWrap.gmxHedgerGov.setHedgerBounds(DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS);
  });

  ///////////
  // Admin //
  ///////////

  it('should be able to set risk council', async () => {
    // set risk council
    await govWrap.gmxHedgerGov.setRiskCouncil(hre.f.alice.address);
    expect(await govWrap.gmxHedgerGov.riskCouncil()).eq(hre.f.alice.address);
  });

  it('should be able to forceChangeOwner', async () => {
    expect(await hre.f.gc.futuresPoolHedger.owner()).eq(govWrap.gmxHedgerGov.address);
    await govWrap.gmxHedgerGov.forceChangeOwner(await govWrap.gmxHedgerGov.marketHedger(), RC.address);
    expect(await hre.f.gc.futuresPoolHedger.owner()).eq(govWrap.gmxHedgerGov.address);
    expect(await hre.f.gc.futuresPoolHedger.nominatedOwner()).eq(RC.address);
    await hre.f.gc.futuresPoolHedger.connect(RC).acceptOwnership();
    expect(await hre.f.gc.futuresPoolHedger.owner()).eq(RC.address);
  });

  it('should be able to set position router', async () => {
    await govWrap.gmxHedgerGov.setPositionRouter(hre.f.alice.address);
    expect(await hre.f.gc.futuresPoolHedger.positionRouter()).eq(hre.f.alice.address);
  });

  it('should be able to recover eth', async () => {
    // mint some ETH to hedger
    const amount = toBN('100');
    await hre.f.gc.gmx.eth.mint(hre.f.gc.futuresPoolHedger.address, amount);
    await govWrap.gmxHedgerGov.recoverEth(hre.f.alice.address);
    expect((await ethers.provider.getBalance(hre.f.gc.futuresPoolHedger.address)).eq(0)).to.be.true;
  });

  it('should be able to set referral code', async () => {
    await govWrap.gmxHedgerGov.setReferralCode(toBytes32('code'));
    expect(await hre.f.gc.futuresPoolHedger.referralCode()).eq(toBytes32('code'));
  });

  it('should be able to recover hedger funds', async () => {
    // Mint some ERC20 to hedger
    const LYRA = await (
      await ethers.getContractFactory('TestERC20SetDecimalsFail', hre.f.deployer)
    ).deploy('LYRA', 'LYRA', 18);
    const amount = ethers.utils.parseUnits('100', 18);
    await LYRA.mint(hre.f.gc.futuresPoolHedger.address, amount);

    // Recover hedger funds
    await govWrap.gmxHedgerGov.recoverHedgerFunds(LYRA.address, hre.f.alice.address);

    // Expect hedger funds to be recovered
    const balance = await LYRA.balanceOf(hre.f.alice.address);
    expect(balance).to.equal(amount);
  });

  it('should be able to get hedger bounds', async () => {
    compareStruct(await govWrap.gmxHedgerGov.getHedgerBounds(), DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS);
  });

  it('should NOT be able to set liquidity pool', async () => {
    await expect(govWrap.gmxHedgerGov.setLiquidityPool(ZERO_ADDRESS)).revertedWith('GMXHGW_LiquidityPoolAlreadySet');
  });

  it('should NOT be able to update market hedger if LP not set', async () => {
    const noLPgovWrappers = await (
      await ethers.getContractFactory('GMXHedgerGovernanceWrapper', hre.f.deployer)
    ).deploy();
    await expect(noLPgovWrappers.updateMarketHedger()).revertedWith('GMXHGW_LiquidityPoolNotSet');
  });

  it('should NOT be able to update market hedger if LP not set', async () => {
    await expect(govWrap.gmxHedgerGov.updateMarketHedger()).revertedWith('GMXHGW_HedgerIsUnchanged');
  });

  ////////////
  // Params //
  ////////////

  it('can set Hedger params', async () => {
    await govWrap.gmxHedgerGov.setFuturesPoolHedgerParams(DEFAULT_GMX_POOL_HEDGER_PARAMS);
    // can set to min and max
    await govWrap.gmxHedgerGov
      .connect(RC)
      .setFuturesPoolHedgerParams(DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.minFuturesPoolHedgerParams);
    await govWrap.gmxHedgerGov
      .connect(RC)
      .setFuturesPoolHedgerParams(DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxFuturesPoolHedgerParams);
    await expect(
      govWrap.gmxHedgerGov.connect(hre.f.signers[3]).setFuturesPoolHedgerParams(DEFAULT_GMX_POOL_HEDGER_PARAMS),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.futuresPoolHedger.futuresPoolHedgerParams(),
      DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxFuturesPoolHedgerParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.gmxHedgerGov.connect(RC).setFuturesPoolHedgerParams({
        ...DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxFuturesPoolHedgerParams,
        deltaThreshold: toBN('0.01'),
      }),
    ).revertedWith('GMXHGW_FuturesPoolHedgerParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.gmxHedgerGov.connect(RC).setFuturesPoolHedgerParams({
        ...DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxFuturesPoolHedgerParams,
        deltaThreshold: toBN('1000000'),
      }),
    ).revertedWith('GMXHGW_FuturesPoolHedgerParamsOutOfBounds');

    // owner can bypass
    await govWrap.gmxHedgerGov.setFuturesPoolHedgerParams({
      ...DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxFuturesPoolHedgerParams,
      deltaThreshold: toBN('0.01'),
    });
  });

  it('can set pool Hedger params', async () => {
    await govWrap.gmxHedgerGov.setPoolHedgerParams(DEFAULT_POOL_HEDGER_PARAMS);
    await govWrap.gmxHedgerGov
      .connect(RC)
      .setPoolHedgerParams(DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.minPoolHedgerParams);
    await govWrap.gmxHedgerGov
      .connect(RC)
      .setPoolHedgerParams(DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxPoolHedgerParams);

    await expect(
      govWrap.gmxHedgerGov
        .connect(hre.f.signers[3])
        .setPoolHedgerParams(DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.minPoolHedgerParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.futuresPoolHedger.getPoolHedgerParams(),
      DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxFuturesPoolHedgerParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.gmxHedgerGov.connect(RC).setPoolHedgerParams({
        ...DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.minPoolHedgerParams,
        interactionDelay: 0,
      }),
    ).revertedWith('GMXHGW_PoolHedgerParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.gmxHedgerGov.connect(RC).setPoolHedgerParams({
        ...DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.maxPoolHedgerParams,
        interactionDelay: MAX_UINT,
      }),
    ).revertedWith('GMXHGW_PoolHedgerParamsOutOfBounds');

    // owner can bypass bounds
    await govWrap.gmxHedgerGov.setPoolHedgerParams({
      ...DEFAULT_GOV_GMX_FUTURES_HEDGER_BOUNDS.minPoolHedgerParams,
      interactionDelay: 0,
    });
  });
});
