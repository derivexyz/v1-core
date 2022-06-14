import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { assert, expect } from 'chai';
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

  it('contract is deployed with address', async () => {
    const contract = await hre.f.c.keeperHelper.deployed();
    assert.isOk(contract.address);
  });

  it('can liquidate many at a time', async () => {
    // Open a bunch of positions to be liquidated
    const positions = [];
    process.stdout.write(`Positions opened: `);
    for (let i = 0; i < 23; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.7'),
        strikeId,
      });
      process.stdout.write(`${i} `);
      positions.push(pos);
    }
    console.log(`\n`);

    // Should be unable to liquidate
    await expect(hre.f.c.optionMarket.connect(alice).liquidatePosition(positions[0], alice.address)).revertedWith(
      'PositionNotLiquidatable',
    );

    // Now should be able to liquidate
    await setETHPrice(toBN('3000'));

    // Create packed batches for optimising calldata
    const batches = getBatches(positions);

    // Liquidate positions in batches
    for (let i = 0; i < batches.length; i++) {
      console.log(`batch[${i}] = ${batches[i]}`);
      await hre.f.c.keeperHelper.liquidate8(batches[i]);
    }

    // check that these positions have been liquidated
    for (let i = 0; i < positions.length; i++) {
      expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.LIQUIDATED);
    }
  });

  it('can settle many options at a time', async () => {
    // Open a bunch of positions to be settled
    const positions = [];
    process.stdout.write(`Positions opened: `);
    for (let i = 0; i < 73; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });
      process.stdout.write(`${i} ${pos} | `);
      positions.push(pos);
    }
    console.log(`\n`);

    positions.push(0);
    positions.push(0);

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Create packed batches from positions array
    const batches = getBatches(positions);

    for (let i = 0; i < batches.length; i++) {
      console.log(`batch[${i}] = ${batches[i]}`);
    }

    // Use function based off batches length then splice the indexes used
    while (batches.length > 0) {
      console.log(`bLength is ${batches.length}`);
      switch (batches.length) {
        case 9:
        case 8:
        case 7:
        case 6:
        case 5:
          await hre.f.c.keeperHelper.settle40(batches[0], batches[1], batches[2], batches[3], batches[4]);
          batches.splice(0, 5);
          break;
        case 4:
          await hre.f.c.keeperHelper.settle32(batches[0], batches[1], batches[2], batches[3]);
          batches.splice(0, 4);
          break;
        case 3:
          await hre.f.c.keeperHelper.settle24(batches[0], batches[1], batches[2]);
          batches.splice(0, 3);
          break;
        case 2:
          await hre.f.c.keeperHelper.settle16(batches[0], batches[1]);
          batches.splice(0, 2);
          break;
        case 1:
          await hre.f.c.keeperHelper.settle8(batches[0]);
          batches.splice(0, 1);
          break;
        default:
          await hre.f.c.keeperHelper.settle80(
            batches[0],
            batches[1],
            batches[2],
            batches[3],
            batches[4],
            batches[5],
            batches[6],
            batches[7],
            batches[8],
            batches[9],
          );
          batches.splice(0, 10);
          break;
      }
    }

    // check that these positions have been settled
    for (let i = 0; i < positions.length; i++) {
      // console.log(`Checking ${positions[i]}`);
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.SETTLED);
      }
    }
  });

  it('should be able to liquidate [1,2,0,3,4]', async () => {
    // Open a bunch of positions to be liquidated
    const positions = [];
    process.stdout.write(`Positions opened: `);
    for (let i = 0; i < 2; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.7'),
        strikeId,
      });
      process.stdout.write(`${i} `);
      positions.push(pos);
    }
    console.log(`\n`);

    positions.push(0); // positionId == 0 ignored in liquidating

    for (let i = 0; i < 2; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.7'),
        strikeId,
      });
      process.stdout.write(`${i} `);
      positions.push(pos);
    }

    // Now should be able to liquidate
    await setETHPrice(toBN('3000'));

    // Create packed batches for optimising calldata
    const batches = getBatches(positions);

    // Liquidate positions in batches
    for (let i = 0; i < batches.length; i++) {
      console.log(`batch[${i}] = ${batches[i]}`);
      await hre.f.c.keeperHelper.liquidate8(batches[i]);
    }

    // check that these positions have been liquidated
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] != 0) {
        expect(await hre.f.c.optionToken.getPositionState(positions[i])).to.eq(PositionState.LIQUIDATED);
      }
    }
  });

  it('expect revert for settle [1,2,0,3,4]', async () => {
    // Open a bunch of positions to be settled
    const positions = [];
    process.stdout.write(`Positions opened: `);
    for (let i = 0; i < 2; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });
      process.stdout.write(`${i} ${pos} | `);
      positions.push(pos);
    }
    console.log(`\n`);

    positions.push(0); // this position should be reverted later

    for (let i = 0; i < 2; i++) {
      const [, pos] = await openPositionWithOverrides(hre.f.c, {
        amount: toBN('0.2'),
        optionType: OptionType.SHORT_CALL_BASE,
        setCollateralTo: toBN('0.2'),
        strikeId,
      });
      process.stdout.write(`${i} ${pos} | `);
      positions.push(pos);
    }

    // Expire board
    await fastForward(MONTH_SEC);
    await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

    // Only one batch for 5 positions
    const batches = getBatches(positions);

    // Expect revert for positionId 0
    await expect(hre.f.c.keeperHelper.settle8(batches[0])).revertedWith('ERC721: owner query for nonexistent token');
  });
});
