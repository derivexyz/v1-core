import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { MONTH_SEC, OptionType, PositionState, toBN } from '../../../../scripts/util/web3utils';
import { openPositionWithOverrides, setETHPrice } from '../../../utils/contractHelpers';
import { getBatches } from '../../../utils/contractHelpers/keeperHelperPacking';
import { fastForward } from '../../../utils/evm';
import { seedFixture } from '../../../utils/fixture';
import { hre } from '../../../utils/testSetup';

describe('Basic Testing - KeeperHelper', () => {
  let strikeId: BigNumberish;
  let alice: SignerWithAddress;

  beforeEach(async () => {
    await seedFixture();
    [, alice] = await ethers.getSigners();
    strikeId = hre.f.market.liveBoards[0].strikes[1].strikeId;
  });

  it('settle16', async () => {
    // Open a bunch of positions to be settled
    const positions: BigNumberish[] = [];

    // Open one less to test removing from array assembly code
    for (let i = 0; i < 15; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });

      positions.push(pos);
    }

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Create packed batches from positions array
    const batches = getBatches(positions);
    await hre.f.c.keeperHelper.settle16(batches[0], batches[1]);

    // check that these positions have been settled
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.SETTLED);
      }
    }
  });

  it('settle24', async () => {
    // Open a bunch of positions to be settled
    const positions: BigNumberish[] = [];

    // Open one less to test removing from array assembly code
    for (let i = 0; i < 23; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });

      positions.push(pos);
    }

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Create packed batches from positions array
    const batches = getBatches(positions);
    await hre.f.c.keeperHelper.settle24(batches[0], batches[1], batches[2]);

    // check that these positions have been settled
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.SETTLED);
      }
    }
  });

  it('settle32', async () => {
    // Open a bunch of positions to be settled
    const positions: BigNumberish[] = [];

    // Open one less to test removing from array assembly code
    for (let i = 0; i < 31; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });

      positions.push(pos);
    }

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Create packed batches from positions array
    const batches = getBatches(positions);

    await hre.f.c.keeperHelper.settle32(batches[0], batches[1], batches[2], batches[3]);

    // check that these positions have been settled
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.SETTLED);
      }
    }
  });

  it('settle40', async () => {
    // Open a bunch of positions to be settled
    const positions: BigNumberish[] = [];

    // Open one less to test removing from array assembly code
    for (let i = 0; i < 39; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });

      positions.push(pos);
    }

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Create packed batches from positions array
    const batches = getBatches(positions);
    await hre.f.c.keeperHelper.settle40(batches[0], batches[1], batches[2], batches[3], batches[4]);

    // check that these positions have been settled
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.SETTLED);
      }
    }
  });

  it('settleMany external', async () => {
    // Open a bunch of positions to be settled
    const positions: BigNumberish[] = [];

    for (let i = 0; i < 11; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });

      positions.push(pos);
    }

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    await hre.f.c.keeperHelper.settleMany(positions);

    // check that these positions have been settled
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.SETTLED);
      }
    }
  });

  it('liquidateMany external', async () => {
    // Open a bunch of positions to be liquidated
    const positions = [];

    for (let i = 0; i < 11; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.7'),
        strikeId,
      });
      positions.push(pos);
    }

    // Should be unable to liquidate
    await expect(hre.f.c.optionMarket.connect(alice).liquidatePosition(positions[0], alice.address)).revertedWith(
      'PositionNotLiquidatable',
    );

    // Now should be able to liquidate
    await setETHPrice(toBN('3000'));

    await hre.f.c.keeperHelper.liquidateMany(positions);

    // check that these positions have been liquidated
    for (let i = 0; i < positions.length; i++) {
      expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.LIQUIDATED);
    }
  });
});
