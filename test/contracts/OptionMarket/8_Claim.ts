import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { toBN } from '../../../scripts/util/web3utils';
import { openAllTrades } from '../../utils/contractHelpers';
import { DEFAULT_OPTION_MARKET_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('OptionMarket - SM Claim', () => {
  let sm: SignerWithAddress;
  beforeEach(async () => {
    await seedFixture();
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
    await openAllTrades();
    const oldOMBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
    const oldSMBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.gt(toBN('0'));

    await hre.f.c.optionMarket.connect(sm).smClaim();
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));
    expect(oldSMBal.add(oldOMBal)).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
  });
  it('can harvest all base if accidentally donated', async () => {
    await openAllTrades();
    await hre.f.c.snx.baseAsset.transfer(hre.f.c.optionMarket.address, toBN('1'));

    const oldOMBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
    const oldSMQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);
    const oldSMBaseBal = await hre.f.c.snx.baseAsset.balanceOf(sm.address);

    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.gt(toBN('0'));
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.optionMarket.address)).to.gt(toBN('0'));

    await hre.f.c.optionMarket.connect(sm).smClaim();
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));

    expect(oldSMQuoteBal.add(oldOMBal)).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
    expect(oldSMBaseBal.add(toBN('1'))).to.eq(await hre.f.c.snx.baseAsset.balanceOf(sm.address));
  });

  it('claim 0 amounts', async () => {
    await openAllTrades();
    await hre.f.c.snx.baseAsset.transfer(hre.f.c.optionMarket.address, toBN('1'));
    await hre.f.c.optionMarket.connect(sm).smClaim();
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));
    expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));

    const oldSMQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);
    const oldSMBaseBal = await hre.f.c.snx.baseAsset.balanceOf(sm.address);

    await hre.f.c.optionMarket.connect(sm).smClaim();
    expect(oldSMQuoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
    expect(oldSMBaseBal).to.eq(await hre.f.c.snx.baseAsset.balanceOf(sm.address));
  });
});
