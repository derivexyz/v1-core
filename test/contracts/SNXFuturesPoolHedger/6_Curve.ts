// testing for curve related exchange rate changes

import { BigNumber, BigNumberish } from "ethers";
import { OptionType, toBN } from "../../../scripts/util/web3utils"
import { MarketViewStruct } from "../../../typechain-types/OptionMarketViewer";
import { openPosition } from "../../utils/contractHelpers";
import { deployFixturePerpsAdapter } from "../../utils/fixture";
import { seedTestSystem } from "../../utils/seedTestSystem";
import { expect, hre } from "../../utils/testSetup"

describe('SNXFuturesPoolHedger - Curve exchange rate changes', async () => {
  let market: MarketViewStruct;
  let strikeId: BigNumberish;
  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });
    market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    strikeId = market.liveBoards[0].strikes[2].strikeId;
  });

  
  it('curve exchange rate is out of bounds for canHedge', async () => {
    await openPosition({
      strikeId: strikeId,
      setCollateralTo: 0,
      optionType: OptionType.LONG_CALL,
      amount: toBN('100'),
    })

    await hre.f.c.testCurve.setRate(hre.f.pc.sUSD.address, toBN('0.8'));
    await hre.f.c.testCurve.setRate(hre.f.c.snx.quoteAsset.address, toBN('1.5'));
    expect(await hre.f.pc.perpHedger.canHedge(100, false, 100)).to.be.eq(false);
  })

  it.skip('when pending margin is 0, i.e trying to can hedge on no change, ')
})