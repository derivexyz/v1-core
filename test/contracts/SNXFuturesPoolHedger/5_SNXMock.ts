// testing for cases where the changes in snx system should stop opening of new positions

import { BigNumber, BigNumberish } from "ethers";
import { OptionType, toBN, toBytes32 } from "../../../scripts/util/web3utils";
import { MarketViewStruct } from "../../../typechain-types/OptionMarketViewer";
import { openPosition } from "../../utils/contractHelpers";
import { deployFixturePerpsAdapter } from "../../utils/fixture";
import { seedTestSystem } from "../../utils/seedTestSystem";
import { expect, hre } from "../../utils/testSetup";

describe('SNXFuturesPoolHedger - SNX stopping trading testing', async () => {
  let market: MarketViewStruct;
  let strikeId: BigNumberish;
  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });
    market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    strikeId = market.liveBoards[0].strikes[2].strikeId;
  });

  it('System Status for market is suspended', async () => {
    await hre.f.pc.systemStatus.setFuturesMarketSuspended(true);

    await expect(openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_CALL,
        amount: toBN('10'),
      }
    )).to.be.revertedWith('SNXPerpV2MarketSuspended');
  });

  it('set funding rate to be higher than permitted', async () => {
    await hre.f.pc.perpMarket.setFundingRate(toBN('0.2'));
    await expect(openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_CALL,
        amount: toBN('10'),
      }
    )).to.be.revertedWith('UnableToHedgeDelta');
  });

  it('snx market is not deep enough to support hedge', async () => {
    await hre.f.pc.perpMarketSettings.setMaxMarketValue(toBytes32('sETHPERP'), toBN('10'));

    await expect(openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_CALL,
        amount: toBN('100'),
      }
    )).to.be.revertedWith('UnableToHedgeDelta');
  });

  it('snx market is not deep enough to support hedge after position is already open', async () => {

    await openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_CALL,
        amount: toBN('100'),
      }
    );

    await hre.f.pc.perpHedger.hedgeDelta();

    await hre.f.pc.perpMarket.executeOffchainDelayedOrder(hre.f.pc.perpHedger.address, [toBytes32('0x0')]);
    
    await openPosition(
      {
        strikeId: strikeId,
        setCollateralTo: 0,
        optionType: OptionType.LONG_CALL,
        amount: toBN('100'),
      }
    );

    expect(await hre.f.pc.perpHedger.canHedge(0, false, 0)).to.be.eq(true);

    await hre.f.pc.perpMarketSettings.setMaxMarketValue(toBytes32('sETHPERP'), toBN('10'));

    expect(await hre.f.pc.perpHedger.canHedge(0, false, 0)).to.be.eq(false);
  });
})