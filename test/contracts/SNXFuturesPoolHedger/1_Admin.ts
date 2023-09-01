import { beforeEach } from 'mocha';
import { HOUR_SEC, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { HedgerStateStruct } from '../../../typechain-types/SNXPerpsV2PoolHedger';
import { ethers } from 'hardhat';

const modParams = {
  shortBuffer: toBN('2.1'),
  hedgeCap: toBN('1000000'),
  interactionDelay: HOUR_SEC * 12,
};

async function setParams(overrides?: any) {
  await hre.f.pc.perpHedger.setPoolHedgerParams({
    ...DEFAULT_POOL_HEDGER_PARAMS,
    ...(overrides || {}),
  });
  // await hre.f.c.poolHedger.setShortBuffer(modParams.shortBuffer);
}

describe('Admin', async () => {
  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });
  });

  it('can be initialized', async () => {
    expect(await hre.f.pc.perpHedger.exchangeAdapter()).to.be.not.eq(ZERO_ADDRESS);
    expect(await hre.f.pc.perpHedger.perpsMarket()).to.be.not.eq(ZERO_ADDRESS);
    expect(await hre.f.pc.perpHedger.curveSwap()).to.be.not.eq(ZERO_ADDRESS);

    expect(await hre.f.pc.perpHedger.marketKey()).to.be.eq(toBytes32('sETHPERP'));
  });

  it('check resovler', async () => {
    await expect(hre.f.c.snx.addressResolver.getAddress(toBytes32('PerpsV2MarketSettings'))).to.be.not.equal(
      ZERO_ADDRESS,
    );
  });

  it('cannot initialized contract twice', async () => {
    await expect(
      hre.f.pc.perpHedger.init(
        hre.f.c.snx.addressResolver.address,
        hre.f.c.synthetixPerpV2Adapter.address,
        hre.f.c.optionMarket.address,
        hre.f.c.optionGreekCache.address,
        hre.f.c.liquidityPool.address,
        hre.f.pc.perpMarket.address,
        hre.f.c.snx.quoteAsset.address,
        hre.f.pc.sUSD.address,
        hre.f.c.testCurve.address,
        toBytes32('sETHPERPS'),
      ),
    ).to.be.revertedWith('AlreadyInitialised');
  });

  it('updates successfully', async () => {
    const oldParams = await hre.f.pc.perpHedger.getPoolHedgerParams();
    await setParams(modParams);
    const newParams = await hre.f.pc.perpHedger.getPoolHedgerParams();

    expect(oldParams.interactionDelay).not.eq(newParams.interactionDelay);
    expect(newParams.interactionDelay).eq(modParams.interactionDelay);

    expect(oldParams.hedgeCap).not.eq(newParams.hedgeCap);
    expect(newParams.hedgeCap).eq(modParams.hedgeCap);
  });

  it('only liquidity pool can reset interaction delay', async () => {
    await expect(hre.f.pc.perpHedger.resetInteractionDelay()).to.be.revertedWith('OnlyLiquidityPool');
  });

  // TODO: This test is failing. 
  it('get hedger state', async () => {
    const state = await hre.f.pc.perpHedger.getHedgerState() as HedgerStateStruct;
    expect(state.lastInteraction).to.be.eq(0);
    // expect(state.hedgedDelta).to.be.eq(0);
    // expect(state.margin).to.be.eq(0);
    // expect(state.leverage).to.be.eq(0);
    // expect(state.hedgerQuoteBalance).to.be.eq(0);
    // expect(state.hedgerMarginQuoteBalance).to.be.eq(0);
    // expect(state.pendingDeltaLiquidity).to.be.eq(0);
    // expect(state.usedDeltaLiquidity).to.be.eq(0);
    // expect(state.pendingDelta).to.be.eq(0);
    // expect(state.trackingCode).to.be.eq(toBytes32('LYRA'));
    // expect(state.optionMarket).to.be.eq(hre.f.c.optionMarket.address);
    // expect(state.optionGreekCache).to.be.eq(hre.f.c.optionGreekCache.address);
    // expect(state.perpsMarket).to.be.eq(hre.f.pc.perpMarket.address);
    // expect(state.curveSwap).to.be.eq(hre.f.c.testCurve.address);
    // expect(state.quoteAsset).to.be.eq(hre.f.c.snx.quoteAsset.address);
    // expect(state.sUSD).to.be.eq(hre.f.pc.sUSD.address);

  });

  it('set tracking code', async () => {
    // can only set tracking code as owner
    const newSigner = (await ethers.getSigners())[2];
    await expect(hre.f.pc.perpHedger.connect(newSigner).setTrackingCode(toBytes32('LYRA'))).to.be.revertedWith('OnlyOwner');
    
    // setting tracking code as owner
    await hre.f.pc.perpHedger.connect(hre.f.deployer).setTrackingCode(toBytes32('LYRA'));
    expect(await hre.f.pc.perpHedger.trackingCode()).to.be.eq(toBytes32('LYRA'));
  });

  // it('reverts if max leverage is larger then permitted by snx settings contract', async () => {
  //   await expect(hre.f.pc.perpHedger.(maxLeverage)).revertedWith('InvalidMaxLeverage');
  // });
});
