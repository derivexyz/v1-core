import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { getAllMatchingEvents, OptionType, PositionState, toBN } from '../../../scripts/util/web3utils';
import {
  closeShortCallBase,
  DEFAULT_LONG_CALL,
  DEFAULT_SHORT_CALL_BASE,
  openPositionWithOverrides,
} from '../../utils/contractHelpers';
import { allTradesFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

async function splitWithOverrides(overrides?: {
  positionId?: BigNumber;
  amount?: BigNumber;
  collateral?: BigNumber;
  recipient?: string;
  sender?: SignerWithAddress;
}) {
  const tx = await hre.f.c.optionToken
    .connect(overrides?.sender || hre.f.deployer)
    .split(
      overrides?.positionId || hre.f.positionIds[OptionType.SHORT_CALL_BASE],
      overrides?.amount || DEFAULT_SHORT_CALL_BASE.amount.div(2),
      overrides?.collateral || DEFAULT_SHORT_CALL_BASE.setCollateralTo.div(2),
      overrides?.recipient || hre.f.alice.address,
    );

  const updateEvents = getAllMatchingEvents(await tx.wait(), 'PositionUpdated');
  let newPositionId;
  for (const event of updateEvents) {
    if (event.args.updatedType == 4) {
      newPositionId = event.args.positionId;
    }
  }
  if (newPositionId == undefined) {
    throw new Error('could not find split event');
  }
  return newPositionId;
}

describe('OptionToken - Split', () => {
  beforeEach(allTradesFixture);

  let splitPositionId: number;
  beforeEach(async () => {
    splitPositionId = hre.f.positionIds[OptionType.SHORT_CALL_BASE].toNumber();
  });

  it('Cannot split 0 amount', async () => {
    await expect(
      hre.f.c.optionToken.split(
        splitPositionId,
        0,
        DEFAULT_SHORT_CALL_BASE.setCollateralTo.div(2),
        hre.f.deployer.address,
      ),
    ).revertedWith('InvalidSplitAmount');
  });

  it('cannot split invalid positions', async () => {
    await closeShortCallBase(splitPositionId);
    await expect(
      hre.f.c.optionToken.split(
        splitPositionId,
        DEFAULT_SHORT_CALL_BASE.amount.div(2),
        DEFAULT_SHORT_CALL_BASE.setCollateralTo.div(2),
        hre.f.deployer.address,
      ),
    ).revertedWith('ERC721: operator query for nonexistent token');
  });

  it('cannot split whole amount', async () => {
    await expect(splitWithOverrides({ amount: DEFAULT_SHORT_CALL_BASE.amount })).to.be.revertedWith(
      'InvalidSplitAmount',
    );
  });

  it('cannot split unowned position', async () => {
    await expect(splitWithOverrides({ sender: hre.f.alice })).to.be.revertedWith('SplittingUnapprovedPosition');
  });

  it('cannot split if minCollateral for newPosition not met', async () => {
    await expect(
      hre.f.c.optionToken.split(splitPositionId, DEFAULT_SHORT_CALL_BASE.amount.div(2), 1, hre.f.deployer.address),
    ).revertedWith('ResultingNewPositionLiquidatable');
  });

  it('cannot split if minCollateral for oldPosition not met', async () => {
    await expect(
      hre.f.c.optionToken.split(
        splitPositionId,
        DEFAULT_SHORT_CALL_BASE.amount.div(2),
        DEFAULT_SHORT_CALL_BASE.setCollateralTo.sub(toBN('0.00001')),
        hre.f.deployer.address,
      ),
    ).revertedWith('ResultingOriginalPositionLiquidatable');
  });

  it('cannot split if more minCollateral than old position', async () => {
    await expect(
      hre.f.c.optionToken.split(
        splitPositionId,
        DEFAULT_SHORT_CALL_BASE.amount.div(2),
        DEFAULT_SHORT_CALL_BASE.setCollateralTo.add(1),
        hre.f.deployer.address,
      ),
    ).revertedWith('Arithmetic operation underflowed or overflowed outside of an unchecked block');
  });

  it('can split short position', async () => {
    // function mint
    const newPositionId = await splitWithOverrides();

    expect(await hre.f.c.optionToken.balanceOf(hre.f.alice.address)).eq(1);

    await expectSplitPosition(
      splitPositionId,
      newPositionId,
      DEFAULT_SHORT_CALL_BASE.amount.div(2),
      DEFAULT_SHORT_CALL_BASE.amount.div(2),
      DEFAULT_SHORT_CALL_BASE.setCollateralTo.div(2),
      DEFAULT_SHORT_CALL_BASE.setCollateralTo.div(2),
      hre.f.deployer.address,
      hre.f.alice.address,
    );
  });

  it('Can split a longs', async () => {
    const longs = [OptionType.LONG_CALL, OptionType.LONG_PUT] as OptionType[];
    for (const type of longs) {
      const [, positionId] = await openPositionWithOverrides(hre.f.c, {
        strikeId: hre.f.strike.strikeId,
        optionType: type,
        amount: DEFAULT_LONG_CALL.amount,
        setCollateralTo: toBN('1000'),
      });
      const newPositionId = await splitWithOverrides({
        positionId: positionId,
        amount: DEFAULT_LONG_CALL.amount.div(2),
        collateral: toBN('1000'),
        recipient: hre.f.alice.address,
      });

      await expectSplitPosition(
        positionId.toNumber(),
        newPositionId,
        DEFAULT_LONG_CALL.amount.div(2),
        DEFAULT_LONG_CALL.amount.div(2),
        toBN('0'),
        toBN('0'),
        hre.f.deployer.address,
        hre.f.alice.address,
      );
    }
  });

  it('Cannot split if global paused', async () => {
    await hre.f.c.synthetixAdapter.setGlobalPaused(true);
    await expect(
      splitWithOverrides({
        positionId: hre.f.positionIds[OptionType.LONG_CALL],
        amount: DEFAULT_LONG_CALL.amount.div(2),
        collateral: toBN('1000'),
        recipient: hre.f.alice.address,
      }),
    ).revertedWith('AllMarketsPaused');
  });
});

async function expectSplitPosition(
  oldId: number,
  newId: number,
  splitAmount: BigNumber,
  newAmount: BigNumber,
  splitCollat: BigNumber,
  newCollat: BigNumber,
  splitOwner: string,
  newOwner: string,
) {
  const splitPos = await hre.f.c.optionToken.getPositionWithOwner(oldId);
  const newPos = await hre.f.c.optionToken.getPositionWithOwner(newId);

  expect(splitPos.collateral).eq(splitCollat);
  expect(newPos.collateral).eq(newCollat);

  expect(splitPos.amount).eq(splitAmount);
  expect(newPos.amount).eq(newAmount);

  expect(splitPos.owner).eq(splitOwner);
  expect(newPos.owner).eq(newOwner);

  expect(newPos.state).eq(splitPos.state).eq(PositionState.ACTIVE);
  expect(newPos.strikeId).eq(splitPos.strikeId).eq(hre.f.strike.strikeId);
}
