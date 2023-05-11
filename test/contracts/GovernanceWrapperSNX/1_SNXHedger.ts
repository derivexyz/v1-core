import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { HOUR_SEC, ZERO_ADDRESS, toBN, toBytes32 } from '../../../scripts/util/web3utils';
import {
  PoolHedgerParametersStruct,
  SNXPerpsV2PoolHedgerParametersStruct,
} from '../../../typechain-types/SNXHedgerGovernanceWrapper';
import { DEFAULT_GOV_SNX_FUTURES_HEDGER_PARAMS, DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { GovernanceWrappersTypeSNXPerps, deploySNXGovernanceWrapper } from '../GovernanceWrapper/utils';

describe('SNX Hedger - GovernanceWrapper', () => {
  let govWrappers: GovernanceWrappersTypeSNXPerps;
  let RC: SignerWithAddress;

  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    govWrappers = await deploySNXGovernanceWrapper(hre.f.c, hre.f.pc, hre.f.deployer);

    await govWrappers.snxHedgerGov
      .connect(hre.f.deployer)
      .setSNXFuturesHedgerBounds(DEFAULT_GOV_SNX_FUTURES_HEDGER_PARAMS);

    RC = hre.f.alice;
    await govWrappers.snxHedgerGov.setRiskCouncil(RC.address);
  });

  it('did deploy', async () => {
    expect(hre.f.c.synthetixPerpV2Adapter.address).to.not.equal(ZERO_ADDRESS);
    expect(hre.f.pc.perpHedger.address).to.not.equal(ZERO_ADDRESS);
    expect(govWrappers.snxAdapterGov.address).to.not.equal(ZERO_ADDRESS);
    expect(govWrappers.snxAdapterGov.address).to.not.equal(ZERO_ADDRESS);
  });

  ////////////////
  // OnlyOwner ///
  ////////////////

  it('can set tracking code as owner', async () => {
    const newTrackingCode = toBytes32('0x1234567890');
    expect(await hre.f.pc.perpHedger.trackingCode()).to.not.equal(newTrackingCode);

    await govWrappers.snxHedgerGov.connect(hre.f.deployer).setTrackingCode(newTrackingCode);
    expect(await hre.f.pc.perpHedger.trackingCode()).to.equal(newTrackingCode);
  });

  it('cant set tracking code unless owner', async () => {
    await expect(govWrappers.snxHedgerGov.connect(RC).setTrackingCode(toBytes32('asdfasdf'))).to.be.revertedWith(
      'OnlyOwner',
    );
  });

  it('cant set LiquidityPool unless owner', async () => {
    await expect(
      govWrappers.snxHedgerGov.connect(RC).setLiquidityPool(hre.f.c.liquidityPool.address),
    ).to.be.revertedWith('OnlyOwner');
  });

  //////////////////
  // Risk Council //
  //////////////////

  it('can set params as owner', async () => {
    const newPoolHedgerParams = {
      interactionDelay: HOUR_SEC,
      hedgeCap: toBN('100'),
    } as PoolHedgerParametersStruct;
    expect(await hre.f.pc.perpHedger.getPoolHedgerParams()).to.be.not.equal(newPoolHedgerParams);
    // make sure they equal to the default params
    const params = await hre.f.pc.perpHedger.getPoolHedgerParams();
    expect(params.interactionDelay).to.be.equal(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay);
    expect(params.hedgeCap).to.be.equal(DEFAULT_POOL_HEDGER_PARAMS.hedgeCap);

    await govWrappers.snxHedgerGov.connect(hre.f.deployer).setPoolHedgerParams(newPoolHedgerParams);

    const curParams = await hre.f.pc.perpHedger.getPoolHedgerParams();
    expect(curParams.interactionDelay).eq(newPoolHedgerParams.interactionDelay);
    expect(curParams.hedgeCap).eq(newPoolHedgerParams.hedgeCap);
  });

  it('can set valid params for pool hedger params as riskCouncil', async () => {
    const newPoolHedgerParams = {
      interactionDelay: HOUR_SEC,
      hedgeCap: toBN('100'),
    } as PoolHedgerParametersStruct;
    // make sure they equal to the default params
    const params = await hre.f.pc.perpHedger.getPoolHedgerParams();
    expect(params.interactionDelay).to.be.equal(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay);
    expect(params.hedgeCap).to.be.equal(DEFAULT_POOL_HEDGER_PARAMS.hedgeCap);

    await govWrappers.snxHedgerGov.connect(RC).setPoolHedgerParams(newPoolHedgerParams);

    const curParams = await hre.f.pc.perpHedger.getPoolHedgerParams();
    expect(curParams.interactionDelay).eq(newPoolHedgerParams.interactionDelay);
    expect(curParams.hedgeCap).eq(newPoolHedgerParams.hedgeCap);
  });

  it('can set valid futures hedger params as riskCouncil', async () => {
    const newFuturesHedgerParams = {
      ...DEFAULT_GOV_SNX_FUTURES_HEDGER_PARAMS.maxFuturesPoolHedgerParams,
      targetLeverage: toBN('1.3'),
    } as SNXPerpsV2PoolHedgerParametersStruct;
    // make sure they equal to the default params
    await govWrappers.snxHedgerGov.connect(hre.f.deployer).setFuturesPoolHedgerParams(newFuturesHedgerParams);
    const params = await hre.f.pc.perpHedger.futuresPoolHedgerParams();
    expect(params.targetLeverage).to.be.equal(newFuturesHedgerParams.targetLeverage);
    expect(params.maximumFundingRate).to.be.equal(newFuturesHedgerParams.maximumFundingRate);
    expect(params.deltaThreshold).to.be.equal(newFuturesHedgerParams.deltaThreshold);
    expect(params.marketDepthBuffer).to.be.equal(newFuturesHedgerParams.marketDepthBuffer);
    expect(params.priceDeltaBuffer).to.be.equal(newFuturesHedgerParams.priceDeltaBuffer);
    expect(params.worstStableRate).to.be.equal(newFuturesHedgerParams.worstStableRate);

    await govWrappers.snxHedgerGov.connect(RC).setFuturesPoolHedgerParams(newFuturesHedgerParams);

    const curParams = await hre.f.pc.perpHedger.futuresPoolHedgerParams();
    expect(curParams.targetLeverage).eq(newFuturesHedgerParams.targetLeverage);
    expect(curParams.maximumFundingRate).eq(newFuturesHedgerParams.maximumFundingRate);
    expect(curParams.deltaThreshold).eq(newFuturesHedgerParams.deltaThreshold);
    expect(curParams.marketDepthBuffer).eq(newFuturesHedgerParams.marketDepthBuffer);
    expect(curParams.priceDeltaBuffer).eq(newFuturesHedgerParams.priceDeltaBuffer);
    expect(curParams.worstStableRate).eq(newFuturesHedgerParams.worstStableRate);
  });

  //////////////////////////
  // Risk Council Reverts //
  //////////////////////////

  it('cant set invalid params for pool hedger params as riskCouncil', async () => {
    const newPoolHedgerParams = {
      interactionDelay: 60 * 60,
      hedgeCap: 0,
    } as PoolHedgerParametersStruct;
    // make sure they equal to the default params
    const params = await hre.f.pc.perpHedger.getPoolHedgerParams();
    expect(params.interactionDelay).to.be.equal(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay);
    expect(params.hedgeCap).to.be.equal(DEFAULT_POOL_HEDGER_PARAMS.hedgeCap);

    await expect(govWrappers.snxHedgerGov.connect(RC).setPoolHedgerParams(newPoolHedgerParams)).to.be.revertedWith(
      'SNXHGW_PoolHedgerParamsOutOfBounds',
    );
  });

  it('cant set invalid futures hedger params as riskCouncil', async () => {
    const newFuturesHedgerParams = {
      ...DEFAULT_GOV_SNX_FUTURES_HEDGER_PARAMS.maxFuturesPoolHedgerParams,
      targetLeverage: 0,
    } as SNXPerpsV2PoolHedgerParametersStruct;
    // make sure they equal to the default params
    console.log('max leverage', await hre.f.pc.perpMarketSettings.maxLeverage(toBytes32('aaa')));

    await expect(
      govWrappers.snxHedgerGov.connect(RC).setFuturesPoolHedgerParams(newFuturesHedgerParams),
    ).to.be.revertedWith('SNXHGW_FuturesPoolHedgerParamsOutOfBounds');
  });
});
