import { beforeEach } from 'mocha';
import { HOUR_SEC, toBN, toBytes32, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { changeDelegateApprovalAddress, openDefaultShortPutQuote } from '../../utils/contractHelpers';
import { DEFAULT_POOL_HEDGER_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

const modParams = {
  shortBuffer: toBN('2.1'),
  hedgeCap: toBN('1000000'),
  interactionDelay: HOUR_SEC * 6,
};

async function setParams(overrides?: any) {
  await hre.f.c.poolHedger.setPoolHedgerParams({
    ...DEFAULT_POOL_HEDGER_PARAMS,
    ...(overrides || {}),
  });
  await hre.f.c.poolHedger.setShortBuffer(modParams.shortBuffer);
}

describe('Admin', async () => {
  beforeEach(seedFixture);

  it('cannot initialized contract twice', async () => {
    await expect(
      hre.f.c.poolHedger.init(
        hre.f.c.synthetixAdapter.address,
        hre.f.c.optionMarket.address,
        hre.f.c.optionGreekCache.address,
        hre.f.c.liquidityPool.address,
        hre.f.c.snx.quoteAsset.address,
        hre.f.c.snx.baseAsset.address,
      ),
    ).revertedWith('AlreadyInitialised');
  });

  it('updates successfully', async () => {
    const oldParams = await hre.f.c.poolHedger.getPoolHedgerParams();
    const oldShortBuffer = await hre.f.c.poolHedger.shortBuffer();
    await setParams(modParams);
    const newParams = await hre.f.c.poolHedger.getPoolHedgerParams();
    const newShortBuffer = await hre.f.c.poolHedger.shortBuffer();

    expect(oldShortBuffer).not.eq(newShortBuffer);
    expect(newShortBuffer).eq(modParams.shortBuffer);

    expect(oldParams.interactionDelay).not.eq(newParams.interactionDelay);
    expect(newParams.interactionDelay).eq(modParams.interactionDelay);

    expect(oldParams.hedgeCap).not.eq(newParams.hedgeCap);
    expect(newParams.hedgeCap).eq(modParams.hedgeCap);
  });

  it('reverts with invalid parameters', async () => {
    await expect(hre.f.c.poolHedger.setShortBuffer(toBN('0.9'))).revertedWith('InvalidShortBuffer');
  });

  it('will update collateralShort address', async () => {
    await hre.f.c.snx.addressResolver.setAddresses([toBytes32('CollateralShort')], [ZERO_ADDRESS]);
    await hre.f.c.poolHedger.updateCollateralShortAddress();
    expect(await hre.f.c.poolHedger.collateralShort()).eq(ZERO_ADDRESS);
    await hre.f.c.snx.addressResolver.setAddresses(
      [toBytes32('CollateralShort')],
      [hre.f.c.snx.collateralShort.address],
    );
    expect(await hre.f.c.poolHedger.collateralShort()).eq(ZERO_ADDRESS);
    await hre.f.c.poolHedger.updateCollateralShortAddress();
    expect(await hre.f.c.poolHedger.collateralShort()).eq(hre.f.c.snx.collateralShort.address);
  });

  it('updateDelegateApproval', async () => {
    await changeDelegateApprovalAddress();
    await hre.f.c.liquidityPool.updateDelegateApproval();
    await openDefaultShortPutQuote();
    expect(await hre.f.c.poolHedger.getCappedExpectedHedge()).to.be.gt(toBN('0'));

    await expect(hre.f.c.poolHedger.hedgeDelta()).to.revertedWith('Not approved to act on behalf');
    await hre.f.c.poolHedger.updateDelegateApproval();
    await hre.f.c.poolHedger.hedgeDelta();
  });

  it('gets corret poolHedger settings', async () => {
    const result = await hre.f.c.poolHedger.getPoolHedgerSettings();
    expect(result[0].interactionDelay).to.eq(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay);
    expect(result[0].hedgeCap).to.eq(DEFAULT_POOL_HEDGER_PARAMS.hedgeCap);
    expect(result[1]).to.eq(await hre.f.c.poolHedger.shortBuffer());
  });
});
