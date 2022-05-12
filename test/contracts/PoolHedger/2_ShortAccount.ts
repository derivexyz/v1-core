import { beforeEach } from 'mocha';
import { forceCloseShortAccount, setFreeLiquidityToZero } from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('Short Account', async () => {
  beforeEach(seedFixture);
  it('cannot reopen account if account already open', async () => {
    await expect(hre.f.c.poolHedger.openShortAccount()).to.revertedWith('ShortAccountAlreadyOpen');
  });

  it('cannot open account when freeLiquidity = zero', async () => {
    await setFreeLiquidityToZero();
    await forceCloseShortAccount();
    await expect(hre.f.c.poolHedger.openShortAccount()).revertedWith('NotEnoughQuoteForMinCollateral');
  });

  it('creates shortId when new short account open', async () => {
    const shortId = await hre.f.c.poolHedger.shortId();
    const loan = await hre.f.c.snx.collateralShort.loans(shortId);
    expect(loan.account).to.eq(hre.f.c.poolHedger.address);
    expect(loan.collateral).to.eq(0);
    expect(loan.currency).to.eq(await hre.f.c.synthetixAdapter.baseKey(hre.f.c.optionMarket.address));
    expect(loan.amount).to.eq(0);
    expect(loan.short).to.eq(true);
  });

  it('reopens short account if previous closed/liquidated', async () => {
    const oldId = await hre.f.c.poolHedger.shortId();
    await forceCloseShortAccount();
    await hre.f.c.poolHedger.openShortAccount();
    const newId = await hre.f.c.poolHedger.shortId();
    expect(oldId.add(1)).to.eq(newId);
  });

  it('reverts on invalid approval', async () => {
    await forceCloseShortAccount();
    await hre.f.c.snx.quoteAsset.setForceFail(true);
    await expect(hre.f.c.poolHedger.openShortAccount()).revertedWith('QuoteApprovalFailure');
  });
});
