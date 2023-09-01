import { beforeEach } from 'mocha';
import { MAX_UINT, OptionType, toBN, toBytes32 } from '../../../scripts/util/web3utils';
import { closePosition, openPosition } from '../../utils/contractHelpers';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { fastForward } from '../../utils/evm';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { MarketViewStruct } from '../../../typechain-types/OptionMarketViewer';
import { BigNumberish } from 'ethers';
import { PoolHedgerParametersStruct } from '../../../typechain-types/GMXFuturesPoolHedger';

describe('Hedging against mock contract', async () => {
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

  it('checking futures contract will hedge long when pool gets long', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('20'),
    });
    let curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).gt(0);

    // see if the logic to hedge delta works
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(0);

    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(curValue);
  });

  it('checking futures contract will hedge short when pool gets short', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('20'),
    });

    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).lt(0);

    // see if the logic to hedge delta works
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(0);

    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(curValue);
    expect(await hre.f.pc.perpHedger.getCappedExpectedHedge()).eq(curValue);
    // expected Hedge should be zero as the pool is hedged.. right
  });

  it('checking futures contract will hedge long when pool gets long and then reduces exposure when sold shorter', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('20'),
    });
    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).gt(0);

    // see if the logic to hedge delta works
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(0);

    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(curValue);
    expect(await hre.f.pc.perpHedger.getCappedExpectedHedge()).eq(curValue);
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('20'),
    });

    await fastForward(60 * 60 * 25);

    await hre.f.pc.perpHedger.hedgeDelta();

    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);
  });

  it('checking futures contract will hedge short when pool gets short and then reduces exposure when sold longer', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('20'),
    });
    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).lt(0);

    // see if the logic to hedge delta works
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(0);

    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);
    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).eq(curValue);
    expect(await hre.f.pc.perpHedger.getCappedExpectedHedge()).eq(curValue);

    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('500000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('20'),
    });
    await fastForward(60 * 60 * 25);
    await hre.f.pc.perpHedger.hedgeDelta();

    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    await hre.f.pc.perpHedger.updateCollateral();
  });

  it('hedge delta when the delta exposure has not changed', async () => {
    expect(await hre.f.pc.perpHedger.getCappedExpectedHedge()).to.be.eq(0)
    await hre.f.pc.perpHedger.hedgeDelta();
  })

  it('hedge delta down beyond cap', async () => {
    await hre.f.pc.perpHedger.setFuturesPoolHedgerParams({
      targetLeverage: toBN('1.1'),
      maximumFundingRate: toBN('0.1'),
      deltaThreshold: toBN('1000'),
      marketDepthBuffer: toBN('1.1'),
      priceDeltaBuffer: toBN('1.1'),
      worstStableRate: toBN('1.1'),
      maxOrderCap: toBN('10')
    });
    // open 100 long puts
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_PUT,
      amount: toBN('100'),
    });

    // hedge delta down
    await hre.f.pc.perpHedger.hedgeDelta();
    
    //execute order
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    const postValue = await hre.f.pc.perpHedger.getCurrentHedgedNetDelta();

    expect(postValue).equal(toBN('-10'));
  })

  it('check minMargin requirement is met when the pool tries to hedge a small amount', async () => {
    await openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_PUT,
        amount: toBN('0.001'),
      }
    )

    await hre.f.pc.perpHedger.hedgeDelta();

    expect(await hre.f.pc.perpHedger.getCurrentPositionMargin()).to.be.eq((await hre.f.pc.perpMarketSettings.minInitialMargin()).add((await hre.f.pc.perpMarket.orderFee(100, '1')).fee));
  });

  it('check that minMargin is met on rehedge', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_PUT,
      amount: toBN('10'),
    });

    // hedge delta 
    await hre.f.pc.perpHedger.hedgeDelta();

    // update collateral
    await hre.f.pc.perpHedger.updateCollateral();
    
    const currentUsedMargin = (await hre.f.pc.perpHedger.getHedgingLiquidity(await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, '2'))).pendingDeltaLiquidity;
    console.log('current used margin', currentUsedMargin);
    // TODO: open position on other side to reduce the marign requirement below min margin. 
  });

  it('check that when rehedging with a small amount, the min margin is met', async () => {

    await hre.f.pc.perpHedger.setPoolHedgerParams({
      interactionDelay: 0,
      hedgeCap: MAX_UINT,
    } as PoolHedgerParametersStruct)

    // open position
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('0.01')
    });

    // hedge delta
    await hre.f.pc.perpHedger.hedgeDelta();

    // execute order
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    // update collateral
    await hre.f.pc.perpHedger.updateCollateral();

    expect((await hre.f.pc.perpHedger.getHedgingLiquidity((await hre.f.c.synthetixPerpV2Adapter.getSpotPriceForMarket(hre.f.c.optionMarket.address, '2')))).usedDeltaLiquidity)
      .to.be.eq((await hre.f.pc.perpMarketSettings.minInitialMargin()));
  });

  it.skip('checking canHedge vs hedging when the flipping on max market value', async () => {
    await hre.f.pc.perpHedger.setPoolHedgerParams({
      interactionDelay: 0,
      hedgeCap: MAX_UINT,
    } as PoolHedgerParametersStruct);

    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('10')
    });

    await hre.f.pc.perpHedger.hedgeDelta();

    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    // check the amount of open interest used, divide by spot price
    const curDeltas = await hre.f.pc.perpHedger.getCurrentHedgedNetDelta();

    // can hedge should be true
    expect(await hre.f.pc.perpHedger.canHedge(0, true, 0)).to.be.true;

    // set maximum market value to be equal to openInterest
    await hre.f.pc.perpMarketSettings.setMaxMarketValue(toBytes32('ETHPERP'), curDeltas);

    console.log('curDeltas', curDeltas);
    console.log('max market value', await hre.f.pc.perpMarketSettings.maxMarketValue(toBytes32('ETHPERP')));

    // flip skew to be long and equal to the max market value
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('25')
    });

    // can hedge should be false
    expect(await hre.f.pc.perpHedger.canHedge(0, true, 0)).to.be.false;
  })
  
});
