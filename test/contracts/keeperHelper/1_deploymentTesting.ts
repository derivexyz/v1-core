import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { assert, expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { OptionType, toBN } from '../../../scripts/util/web3utils';
import { openPositionWithOverrides, setETHPrice } from '../../utils/contractHelpers';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

describe('Basic Testing - KeeperHelper', () => {
  let strikeId: BigNumberish;
  let alice: SignerWithAddress;

  beforeEach(async () => {
    await seedFixture();
    [, alice] = await ethers.getSigners();
    strikeId = hre.f.market.liveBoards[0].strikes[1].strikeId;
  });

  it('contract is deployed with address', async () => {
    const contract = await hre.f.c.keeperHelper.deployed();
    assert.isOk(contract.address);
  });

  //TODO: change this over to error correct testing.
  // test to see if it can liquidate many at a time.
  it('can liquidate many at a time', async () => {
    // create multiple listings and liquidate them all at once.

    const [, positionId] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_CALL_BASE,
      setCollateralTo: toBN('0.7'),
      strikeId,
    });
    await expect(hre.f.c.optionMarket.connect(alice).liquidatePosition(positionId, alice.address)).revertedWith(
      'PositionNotLiquidatable',
    );

    const [, positionId1] = await openPositionWithOverrides(hre.f.c, {
      amount: toBN('2'),
      optionType: OptionType.SHORT_CALL_BASE,
      setCollateralTo: toBN('0.7'),
      strikeId,
    });

    await expect(hre.f.c.optionMarket.connect(alice).liquidatePosition(positionId1, alice.address)).revertedWith(
      'PositionNotLiquidatable',
    );
    await setETHPrice(toBN('3000'));
    // Liquidate here for keeper helper
    await hre.f.c.keeperHelper.liquidateMany([positionId, positionId1]);

    // need to check that these positions have been liquidated.
  });
});
