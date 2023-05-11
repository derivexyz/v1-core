import { BigNumberish } from "ethers";
import { OptionType, toBN } from "../../../scripts/util/web3utils";
import { OptionMarketParametersStruct } from "../../../typechain-types/OptionMarketGovernanceWrapper";
import { MarketViewStruct } from "../../../typechain-types/OptionMarketViewer";
import { closePositionWithOverrides, openPositionWithOverrides } from "../../utils/contractHelpers";
import { DEFAULT_OPTION_MARKET_PARAMS } from "../../utils/defaultParams";
import { deployFixturePerpsAdapter } from "../../utils/fixture";
import { seedTestSystem } from "../../utils/seedTestSystem";
import { expect, hre } from "../../utils/testSetup";

describe("Short Call Base state tests", () => {
  let market: MarketViewStruct;
  let strikeId: BigNumberish;
  beforeEach(async () => {
    await deployFixturePerpsAdapter();
    await seedTestSystem(hre.f.deployer, hre.f.c, { noHedger: true });
    
    market = await hre.f.c.optionMarketViewer.getMarket(hre.f.c.optionMarket.address);
    strikeId = market.liveBoards[0].strikes[2].strikeId;
  });

  it("should be able to open a short call with max_unit base allowed", async () => {
    // getting quote amount before premium is paid for opening the option
    const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
    
    // opening short call base position
    await openPositionWithOverrides(hre.f.c, {
      optionType: OptionType.SHORT_CALL_BASE,
      strikeId: strikeId,
      amount: 1,
      setCollateralTo: toBN('1'),
    });

    const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

    expect(newBalance).to.be.gt(oldBalance);
  });

  it("should be able to open a short call with base limit set to 100 base", async () => {
    await hre.f.c.optionMarket.connect(hre.f.deployer).setOptionMarketParams({
      ...DEFAULT_OPTION_MARKET_PARAMS,
    } as OptionMarketParametersStruct);

    // getting quote amount before premium is paid for opening the option
    const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  
    // opening short call base position
    await openPositionWithOverrides(hre.f.c, {
      optionType: OptionType.SHORT_CALL_BASE,
      strikeId: strikeId,
      amount: 1,
      setCollateralTo: toBN('1'),
    });
 
    const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
 
    expect(newBalance).to.be.gt(oldBalance);
  });

  it("should not be able to open a short call with base collateral if limit is set to 0", async () => {
    await hre.f.c.optionMarket.connect(hre.f.deployer).setBaseLimit(0);


    // getting quote amount before premium is paid for opening the option
    const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
  
    // opening short call base position
    await expect(openPositionWithOverrides(hre.f.c, {
      optionType: OptionType.SHORT_CALL_BASE,
      strikeId: strikeId,
      amount: 1,
      setCollateralTo: toBN('1'),
    })).to.be.revertedWith('BaseLimitExceeded');
 
    const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
 
    expect(newBalance).to.be.eq(oldBalance);
  })

  it("should be able to collateralize a call with quote if the base limit is reached", async () => {
    await hre.f.c.optionMarket.connect(hre.f.deployer).setBaseLimit(toBN('0.9'));

    // getting quote amount before premium is paid for opening the option
    const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
    const quoteCollateral = toBN('1500');
    // opening short call base position
    await openPositionWithOverrides(hre.f.c, {
      optionType: OptionType.SHORT_CALL_QUOTE,
      strikeId: strikeId,
      amount: 1,
      setCollateralTo: quoteCollateral,
    });
 
    const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
 
    expect(newBalance).to.be.gt(oldBalance.sub(quoteCollateral));
  });

  it("should be able to adjust a short call base position even if base limit is exceeded", async () => {
    const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
    const quoteCollateral = toBN('1500');
    // opening short call base position
    const positionId = (await openPositionWithOverrides(hre.f.c, {
      optionType: OptionType.SHORT_CALL_BASE,
      strikeId: strikeId,
      amount: 1,
      setCollateralTo: toBN('1'),
    }))[1];
    
    const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
 
    expect(newBalance).to.be.gt(oldBalance.sub(quoteCollateral));

    // set base limit to 0
    await hre.f.c.optionMarket.connect(hre.f.deployer).setBaseLimit(0);

    // adjust position
    await closePositionWithOverrides(hre.f.c, {
      strikeId: strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: 0,
      positionId: positionId,
      setCollateralTo: toBN('0.95'),
    });

    // should revert when trying to increase the position collateral
    await expect(openPositionWithOverrides(
      hre.f.c,{
      strikeId: strikeId,
      optionType: OptionType.SHORT_CALL_BASE,
      amount: 0,
      positionId: positionId,
      setCollateralTo: toBN('25'),
    })).to.be.revertedWith('BaseLimitExceeded')
    
  })
});