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
    await hre.f.c.snx.quoteAsset.mint(hre.f.c.optionMarket.address, toBN('1000'));
    const oldSMBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).eq(toBN('1000'));

    await hre.f.c.snx.quoteAsset.setForceFail(true);
    await expect(hre.f.c.optionMarket.connect(sm).smClaim()).revertedWith('QuoteTransferFailed');

    await hre.f.c.snx.quoteAsset.setForceFail(false);
    await hre.f.c.optionMarket.connect(sm).smClaim();

    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(0);
    expect(oldSMBal.add(toBN('1000'))).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
  });

  it('claim 0 amounts', async () => {
    await openAllTrades();
    await hre.f.c.snx.baseAsset.transfer(hre.f.c.optionMarket.address, toBN('1'));
    await hre.f.c.optionMarket.connect(sm).smClaim();
    expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address)).to.eq(toBN('0'));

    const oldSMQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);
    const oldSMBaseBal = await hre.f.c.snx.baseAsset.balanceOf(sm.address);

    await hre.f.c.optionMarket.connect(sm).smClaim();

    expect(oldSMQuoteBal).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
    // Base isn't claimed
    expect(oldSMBaseBal).to.eq(await hre.f.c.snx.baseAsset.balanceOf(sm.address));
  });

  it('claims both balances', async () => {
    await hre.f.c.snx.baseAsset.mint(hre.f.c.optionMarket.address, toBN('1'));
    await hre.f.c.snx.quoteAsset.mint(hre.f.c.optionMarket.address, toBN('1000'));
    const oldSMQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(sm.address);

    await hre.f.c.optionMarket.connect(sm).smClaim();

    expect(oldSMQuoteBal.add(toBN('1000'))).to.eq(await hre.f.c.snx.quoteAsset.balanceOf(sm.address));
  });
});
