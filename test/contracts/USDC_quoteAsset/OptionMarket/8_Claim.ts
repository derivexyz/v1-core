import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { toBN } from '../../../../scripts/util/web3utils';
import { openAllTrades } from '../../../utils/contractHelpers';
import { DEFAULT_OPTION_MARKET_PARAMS } from '../../../utils/defaultParams';
import { seedFixtureUSDCwBTC } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('USDC_quote - OptionMarket - SM Claim', () => {
  let sm: SignerWithAddress;
  beforeEach(async () => {
    await seedFixtureUSDCwBTC();
    sm = hre.f.alice;
    await hre.f.c.optionMarket.setOptionMarketParams({
      ...DEFAULT_OPTION_MARKET_PARAMS,
      securityModule: sm.address,
    });
  });

  it('reverts if called by non-SM', async () => {
    await expect(hre.f.c.optionMarket.connect(hre.f.deployer).smClaim()).to.revertedWith('OnlySecurityModule');
  });
  it('can harvest all quote', async () => {
    await hre.f.c.snx.quoteAsset.mint(hre.f.c.optionMarket.address, 1000e6);
    const oldSMBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).eq(1000e6);

    await hre.f.c.snx.quoteAsset.setForceFail(true);
    await expect(hre.f.c.optionMarket.connect(sm).smClaim()).revertedWith('QuoteTransferFailed');

    await hre.f.c.snx.quoteAsset.setForceFail(false);
    await hre.f.c.optionMarket.connect(sm).smClaim();

    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(0);
    expect(oldSMBal.add(1000e6)).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
  });

  it('claim 0 amounts', async () => {
    await openAllTrades();
    await hre.f.c.optionMarket.connect(sm).smClaim();
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));

    const oldSMQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);

    await hre.f.c.optionMarket.connect(sm).smClaim();

    expect(oldSMQuoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
  });

  it('only claims quote', async () => {
    await hre.f.c.snx.baseAsset.mint(hre.f.c.optionMarket.address, toBN('1', 8));
    await hre.f.c.snx.quoteAsset.mint(hre.f.c.optionMarket.address, toBN('1000', 6));
    const oldSMQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);

    await hre.f.c.optionMarket.connect(sm).smClaim();

    expect(oldSMQuoteBal.add(toBN('1000', 6))).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
    expect(toBN('1', 8)).to.eq(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.optionMarket.address));
  });
});
