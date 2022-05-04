// integration tests
import { BigNumber, BigNumberish } from 'ethers';
import { MONTH_SEC, OptionType, PositionState, toBN } from '../../../scripts/util/web3utils';
import { OptionPositionStruct } from '../../../typechain-types/OptionToken';
import {
  ALL_TYPES,
  closePositionWithOverrides,
  DEFAULT_OPTIONS,
  openDefaultLongPut,
} from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { allTradesFixture } from '../../utils/fixture';
import { mockPrice, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { expectLiquidatable } from './5_MinCollateral';

describe('Misc', () => {
  beforeEach(async () => {
    await allTradesFixture();
    await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c);
    expect(await hre.f.c.optionToken.balanceOf(hre.f.alice.address)).eq(0);
    expect(await hre.f.c.optionToken.balanceOf(hre.f.deployer.address)).eq(5); // starts with 5 option Tokens
    for (const optionType of ALL_TYPES) {
      await hre.f.c.optionToken['safeTransferFrom(address,address,uint256)'](
        hre.f.deployer.address,
        hre.f.alice.address,
        hre.f.positionIds[optionType],
      );
    }
  });

  describe('Transfers', () => {
    it('can transfer positions', async () => {
      for (const optionType of ALL_TYPES) {
        await expectTransferPosition(
          hre.f.positionIds[optionType],
          DEFAULT_OPTIONS[optionType].amount,
          hre.f.alice.address,
          hre.f.strike.strikeId,
          DEFAULT_OPTIONS[optionType].setCollateralTo,
        );
      }
      expect(await hre.f.c.optionToken.balanceOf(hre.f.deployer.address)).eq(0);
      expect(await hre.f.c.optionToken.balanceOf(hre.f.alice.address)).eq(5);
    });

    it('cannot transfer unowned owner positions', async () => {
      await expect(
        hre.f.c.optionToken['safeTransferFrom(address,address,uint256)'](
          hre.f.deployer.address,
          hre.f.alice.address,
          hre.f.positionIds[OptionType.LONG_PUT],
        ),
      ).to.revertedWith('ERC721: transfer caller is not owner nor approved');
    });

    it('allows recipient to close the position', async () => {
      for (const optionType of ALL_TYPES) {
        expect(await hre.f.c.optionToken.ownerOf(hre.f.positionIds[optionType])).to.eq(hre.f.alice.address);
        await closePositionWithOverrides(
          hre.f.c,
          {
            strikeId: hre.f.strike.strikeId,
            amount: DEFAULT_OPTIONS[optionType].amount,
            positionId: hre.f.positionIds[optionType],
            optionType: optionType,
            setCollateralTo: toBN('0'),
          },
          hre.f.alice,
        );
      }
    });
  });

  describe('Getters', () => {
    it('gets active owner positions', async () => {
      // liquidated
      await mockPrice(hre.f.c, toBN('5000'), 'sETH');
      await expectLiquidatable(hre.f.positionIds[OptionType.SHORT_CALL_BASE]);
      await hre.f.c.optionMarket.liquidatePosition(
        hre.f.positionIds[OptionType.SHORT_CALL_BASE],
        hre.f.deployer.address,
      );
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.SHORT_CALL_BASE])).to.eq(
        PositionState.LIQUIDATED,
      );

      const positions: OptionPositionStruct[] = await hre.f.c.optionToken.getOwnerPositions(hre.f.alice.address);
      for (const position of positions) {
        // short_call_base position shouldn't be returned
        expect(position.optionType).to.not.eq(OptionType.SHORT_CALL_BASE);
        const optionType = Number(position.optionType) as OptionType;

        expect(position.positionId).to.eq(hre.f.positionIds[optionType]);
        expect(position.strikeId).to.eq(hre.f.strike.strikeId);
        expect(position.amount).to.eq(DEFAULT_OPTIONS[optionType].amount);
        expect(position.collateral).to.eq(DEFAULT_OPTIONS[optionType].setCollateralTo);
        expect(position.state).to.eq(PositionState.ACTIVE);
      }
    });
    it('reverts on non-active positions on getPositionWithOwner', async () => {
      await closePositionWithOverrides(
        hre.f.c,
        {
          strikeId: hre.f.strike.strikeId,
          amount: DEFAULT_OPTIONS[OptionType.LONG_CALL].amount,
          positionId: hre.f.positionIds[OptionType.LONG_CALL],
          optionType: OptionType.LONG_CALL,
          setCollateralTo: toBN('0'),
        },
        hre.f.alice,
      );
      await expect(hre.f.c.optionToken.getPositionWithOwner(hre.f.positionIds[OptionType.LONG_CALL])).to.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
    it('gets position state of every position type', async () => {
      // empty
      expect(await hre.f.c.optionToken.getPositionState(1000)).to.eq(PositionState.EMPTY);

      // active
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.LONG_CALL])).to.eq(
        PositionState.ACTIVE,
      );

      // closed
      await closePositionWithOverrides(
        hre.f.c,
        {
          strikeId: hre.f.strike.strikeId,
          amount: DEFAULT_OPTIONS[OptionType.LONG_CALL].amount,
          positionId: hre.f.positionIds[OptionType.LONG_CALL],
          optionType: OptionType.LONG_CALL,
          setCollateralTo: toBN('0'),
        },
        hre.f.alice,
      );
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.LONG_CALL])).to.eq(
        PositionState.CLOSED,
      );

      // liquidated
      await mockPrice(hre.f.c, toBN('5000'), 'sETH');
      await expectLiquidatable(hre.f.positionIds[OptionType.SHORT_CALL_BASE]);
      await hre.f.c.optionMarket.liquidatePosition(
        hre.f.positionIds[OptionType.SHORT_CALL_BASE],
        hre.f.deployer.address,
      );
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.SHORT_CALL_BASE])).to.eq(
        PositionState.LIQUIDATED,
      );

      // merged
      await mockPrice(hre.f.c, DEFAULT_BASE_PRICE, 'sETH');
      const secondId = await openDefaultLongPut(hre.f.alice);
      await hre.f.c.optionToken.connect(hre.f.alice).merge([secondId, hre.f.positionIds[OptionType.LONG_PUT]]);
      expect(await hre.f.c.optionToken.getPositionState(secondId)).to.eq(PositionState.ACTIVE);
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.LONG_PUT])).to.eq(
        PositionState.MERGED,
      );

      // settled
      await fastForward(MONTH_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(1);
      await hre.f.c.shortCollateral.settleOptions([hre.f.positionIds[OptionType.SHORT_PUT_QUOTE]]);
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.SHORT_PUT_QUOTE])).to.eq(
        PositionState.SETTLED,
      );
    });
  });
});

async function expectTransferPosition(
  positionId: BigNumber,
  amount: BigNumber,
  newOwner: string,
  strikeId: BigNumberish,
  collateral?: BigNumber,
) {
  const newPos = await hre.f.c.optionToken.getPositionWithOwner(positionId);
  expect(newPos.amount).eq(amount);
  expect(newPos.collateral || toBN('0')).eq(collateral);
  expect(newPos.owner).eq(newOwner);
  expect(newPos.state).eq(PositionState.ACTIVE);
  expect(newPos.strikeId).eq(strikeId);
}
