// integration tests
import { OptionType, PositionState, toBN, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { PositionWithOwnerStruct } from '../../../typechain-types/OptionToken';
import { ALL_TYPES, closePosition, CLOSE_FUNCTIONS, DEFAULT_OPTIONS, openPosition } from '../../utils/contractHelpers';
import { allTradesFixture, seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';

describe('OptionToken - AdjustingPositions', async () => {
  // minCollateral tested in 3_minCollat and long open/close tested in optionMarket testing
  // exact balance shifting of adjust position on short positions is tested in 3_minCollat
  let validParams: any;
  beforeEach(seedFixture);
  describe('general reverts', async () => {
    beforeEach(async () => {
      await allTradesFixture();
      validParams = {
        positionId: hre.f.positionIds[OptionType.LONG_CALL],
        amount: toBN('10'),
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_CALL,
      };
    });
    it('only callable by optionMarket', async () => {
      await expect(
        hre.f.c.optionToken.adjustPosition(hre.f.defaultTradeParametersStruct, 0, ZERO_ADDRESS, 0, 0, 0, true),
      ).revertedWith('OnlyOptionMarket');
    });
    it(`invalid optionType`, async () => {
      await expect(
        openPosition({
          ...validParams,
          optionType: OptionType.LONG_PUT,
        }),
      ).to.be.revertedWith('CannotAdjustInvalidPosition');
    });
    it(`invalid strikeId`, async () => {
      await expect(
        openPosition({
          ...validParams,
          strikeId: hre.f.board.strikes[1].strikeId,
        }),
      ).to.be.revertedWith('CannotAdjustInvalidPosition');
    });
    it(`cannot close positionId = 0`, async () => {
      await expect(
        closePosition({
          ...validParams,
          positionId: 0,
        }),
      ).to.be.revertedWith('CannotClosePositionZero');
    });
    it(`non-existent positionId`, async () => {
      await expect(
        closePosition({
          ...validParams,
          positionId: 1234,
        }),
      ).to.be.revertedWith('CannotAdjustInvalidPosition');
      await expect(
        openPosition({
          ...validParams,
          positionId: 1000,
        }),
      ).to.be.revertedWith('CannotAdjustInvalidPosition');
    });
    it(`cannot adjust closed position`, async () => {
      await closePosition({ ...validParams, amount: toBN('1') });
      expect(await hre.f.c.optionToken.getPositionState(hre.f.positionIds[OptionType.LONG_CALL])).to.eq(
        PositionState.CLOSED,
      );
      await expect(
        openPosition({
          ...validParams,
          amount: toBN('1'),
        }),
      ).to.be.revertedWith('CannotAdjustInvalidPosition');
    });
  });

  describe('position tracking', async () => {
    beforeEach(allTradesFixture);
    it('gets all positions as expected', async () => {
      expect(await hre.f.c.optionToken.balanceOf(hre.f.deployer.address)).eq(5);
      let position: PositionWithOwnerStruct;

      for (const optionType of ALL_TYPES) {
        position = await hre.f.c.optionToken.getPositionWithOwner(hre.f.positionIds[optionType]);

        expect(position.owner).eq(hre.f.deployer.address);
        expect(position.strikeId).eq(hre.f.strike.strikeId);
        expect(position.optionType).eq(optionType);
        expect(position.amount).eq(DEFAULT_OPTIONS[optionType].amount);
        expect(position.state).eq(PositionState.ACTIVE);
        expect(position.collateral).to.eq((DEFAULT_OPTIONS[optionType] as any).setCollateralTo || 0);
      }
    });
    it('can assign closed status when closed', async () => {
      // close all user positions
      for (const optionType of ALL_TYPES) {
        await CLOSE_FUNCTIONS[optionType](hre.f.positionIds[optionType]);
        const position = await hre.f.c.optionToken.getOptionPosition(hre.f.positionIds[optionType]);
        expect(position.collateral).eq(0);
        expect(position.amount).eq(0);
        expect(position.state).eq(PositionState.CLOSED);
        expect(await hre.f.c.optionToken.canLiquidate(position, 0, 0, 0)).to.be.false;
      }
      expect((await hre.f.c.optionToken.getOwnerPositions(hre.f.deployer.address)).length).eq(0);
    });
  });
});
