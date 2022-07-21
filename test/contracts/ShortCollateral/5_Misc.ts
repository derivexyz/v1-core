import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { expect } from 'chai';
import { toBN } from '../../../scripts/util/web3utils';
import {
  changeDelegateApprovalAddress,
  DEFAULT_SHORT_CALL_BASE,
  openDefaultShortCallBase,
  resetMinCollateralParameters,
} from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

describe('ShortCollateral - Misc', async () => {
  beforeEach(seedFixture);

  it('updateDelegateApproval for SNX', async () => {
    await changeDelegateApprovalAddress();

    const positionId = await openDefaultShortCallBase();
    await expect(attemptBaseLiquidation(positionId)).to.revertedWith('Not approved to act on behalf');
    await hre.f.c.shortCollateral.updateDelegateApproval();
    await attemptBaseLiquidation(positionId);
  });
});

async function attemptBaseLiquidation(positionId: BigNumber) {
  await resetMinCollateralParameters({
    minStaticBaseCollateral: DEFAULT_SHORT_CALL_BASE.setCollateralTo.add(toBN('0.01')),
  });
  await hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.alice.address);
}
