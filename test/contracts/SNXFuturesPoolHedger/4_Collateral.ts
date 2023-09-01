import { beforeEach } from 'mocha';
import { DAY_SEC, HOUR_SEC, OptionType, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { DEFAULT_SHORT_CALL_QUOTE, openPosition } from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS, DEFAULT_SNX_FUTURES_HEDGER_PARAMS } from '../../utils/defaultParams';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { MarketViewStruct } from '../../../typechain-types/OptionMarketViewer';
import { BigNumberish } from 'ethers';
import { fastForward } from '../../utils/evm';
import { assertCloseToPercentage } from '../../utils/assert';

describe('Collateral Management - hedger', async () => {
  let market: MarketViewStruct;
  let strikeId: BigNumberish;
  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });
    market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    strikeId = market.liveBoards[0].strikes[2].strikeId;
  });

  it('checking delta is zero without trading', async () => {
    expect(await hre.f.pc.perpHedger.getCappedExpectedHedge()).eq(toBN('0'));
  });

  it('check desired collat', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('10'),
    });
    // no current positions open so margin should be zero as well
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(0);
    expect((await hre.f.pc.perpMarket.userPositions(hre.f.pc.perpMarket.address)).margin).eq(0);

    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    const spot = await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, 2);
    const expectedMargin = curValue.mul(spot).div(DEFAULT_SNX_FUTURES_HEDGER_PARAMS.targetLeverage);
    // see if the logic to hedge delta works
    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);
    assertCloseToPercentage(
      (await hre.f.pc.perpMarket.userPositions(hre.f.pc.perpHedger.address)).margin,
      expectedMargin,
    );
  });

  it('check desired collat with short', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('10'),
    });
    console.log('expected hedge', await hre.f.pc.perpHedger.getCappedExpectedHedge());
    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('10'),
    });
    console.log('expected hedge', await hre.f.pc.perpHedger.getCappedExpectedHedge());
    const curExpectedHedge = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).gt(curExpectedHedge);
    await fastForward(DAY_SEC);

    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('10'),
    });

    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    const spot = await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, 2);

    const currentHedgingLiquidity = await hre.f.pc.perpHedger.getHedgingLiquidity(spot);
    console.log('hardhat pending liquidity for hedging', currentHedgingLiquidity);
    console.log('sUsd balance harhdat', await hre.f.pc.sUSD.balanceOf(hre.f.pc.perpHedger.address));
    await hre.f.pc.perpHedger.updateCollateral();
    expect(await hre.f.pc.sUSD.balanceOf(hre.f.pc.perpHedger.address)).eq(0);
  });

  it('transfer sUSD to hedger and check that it correctly swaps', async () => {
    await hre.f.pc.sUSD.mint(hre.f.pc.perpHedger.address, toBN('100000'));
    await hre.f.pc.perpHedger.updateCollateral();
    expect(await hre.f.pc.sUSD.balanceOf(hre.f.pc.perpHedger.address)).eq(0);
  });

  it('transfer sUSd and change rate too simulate a usdc depeg and check it swaps directly', async () => {
    await hre.f.pc.sUSD.mint(hre.f.pc.perpHedger.address, toBN('100000'));
    const currentHedgingLiquidity = (await hre.f.pc.perpHedger.getHedgingLiquidity(await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, '2'))).usedDeltaLiquidity;
    console.log('current hedigng liquidity', currentHedgingLiquidity);
    await hre.f.c.testCurve.setRate(hre.f.pc.sUSD.address, toBN('0.12')); // sUSD trading at premium above usdc

    const postLiquidity = (await hre.f.pc.perpHedger.getHedgingLiquidity(await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, '2'))).usedDeltaLiquidity;
    expect(postLiquidity).gt(currentHedgingLiquidity); // sUSD trading at premium above usdc
  });

  
});
