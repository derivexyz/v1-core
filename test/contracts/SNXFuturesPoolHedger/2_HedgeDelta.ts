import { beforeEach } from 'mocha';
import { OptionType, toBN, toBytes32 } from '../../../scripts/util/web3utils';
import { openPosition } from '../../utils/contractHelpers';
import { deployFixturePerpsAdapter } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { seedTestSystem } from '../../utils/seedTestSystem';
import { BigNumberish } from 'ethers';
import { MarketViewStruct } from '../../../typechain-types/OptionMarketViewer';
import { DEFAULT_SNX_FUTURES_HEDGER_PARAMS } from '../../utils/defaultParams';

describe('Hedging Delta(views)', async () => {
  let market: MarketViewStruct;
  let strikeId: BigNumberish;
  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });

    market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    strikeId = market.liveBoards[0].strikes[2].strikeId;
  });

  it('checking delta is zero without trading', async () => {
    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    await expect(curValue).eq(0);
  });

  it('checking futures contract will hedge long when pool gets long', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('20'),
    });
    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).gt(0); // TODO: should figure out the exact value of this.
  });

  it('checking futures contract will hedge short', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('20'),
    });
    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).lt(toBN('1')); // TODO: should figure out the exact value of this.
  });

  // TODO:  finish this test
  it('checking no delta has been hedged', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: toBN('100000'),
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('20'),
    });
    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(curValue).lt(0); // TODO: should figure out the exact value of this.

    expect(await hre.f.pc.perpHedger.getCurrentHedgedNetDelta()).to.be.equal(0); // TODO: should figure out the exact value of this.
  });

  it('check that orders are being broken up', async () => {
    await hre.f.pc.perpHedger.setFuturesPoolHedgerParams({
      targetLeverage: toBN('1.1'),
      maximumFundingRate: toBN('0.1'),
      deltaThreshold: 0,
      marketDepthBuffer: toBN('1.1'),
      priceDeltaBuffer: toBN('1.1'),
      worstStableRate: toBN('1.1'),
      maxOrderCap: toBN('10')
    })

    await openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_CALL,
        amount: toBN('100'),
      }
    );

    const curValue = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    await hre.f.pc.perpHedger.hedgeDelta();
    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);

    const postValue = await hre.f.pc.perpHedger.getCurrentHedgedNetDelta();
    expect(postValue).to.be.equal(toBN('10'));

  });

  it('Check can Hedge is capped on either side', async () => {
    // set poolHedger params to have a hedge cap of 10 big number

    await hre.f.pc.perpHedger.setPoolHedgerParams({
      interactionDelay: 0,
      hedgeCap: toBN('10'),
    });

    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_CALL,
      amount: toBN('100'),
    });

    const cappedHedge = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(cappedHedge).to.be.equal(toBN('10'));

    await openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_PUT,
        amount: toBN('100'),
      }
    )

    const cappedHedge2 = await hre.f.pc.perpHedger.getCappedExpectedHedge();
    expect(cappedHedge2).to.be.equal(toBN('-10'));

  })

  it('Check canhedge view returns false when market is suspended', async () => {
    await hre.f.pc.perpHedger.setPoolHedgerParams({
      interactionDelay: 0,
      hedgeCap: toBN('10'),
    });

    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_CALL,
      amount: toBN('100'),
    });

    await hre.f.pc.systemStatus.setFuturesMarketSuspended(true);

    const canHedge = await hre.f.pc.perpHedger.canHedge(100, true, 1);
    expect(canHedge).to.be.equal(false);
  })

  it('delta increase and hedge is positive', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_CALL,
      amount: toBN('100'),
    });

    expect(await hre.f.pc.perpHedger.canHedge(100, true, 1)).to.be.equal(true);
  });
  
  it('delta decrease and hedge is negative', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_PUT,
      amount: toBN('100'),
    });
  
    expect(await hre.f.pc.perpHedger.canHedge(100, false, 1)).to.be.equal(true);
  });

  
});
