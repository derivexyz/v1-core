import { OptionType, PositionState, toBN } from '../../../../scripts/util/web3utils';
import {
  STABLE_IDS,
  wrapperAddLong,
  wrapperCloseLong,
  wrapperOpenLong,
  wrapperReduceLong,
} from '../../../utils/contractHelpers/wrapper';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

//  ----- Test outline -----
// 1. Opens a long call/put with DAI/USDC/sUSD
// 2. Adds to the position
// 3. Removes from the position
// 4. Closes position fully

describe('OptionMarketWrapper LONG CALL/PUT trading tests', () => {
  beforeEach(allCurrenciesFixture);

  describe('DAI long opens', async () => {
    it('DAI using openLongParams - LONG CALL', async () => {
      // Open long call
      let positionId = await wrapperOpenLong({
        token: STABLE_IDS.DAI,
        isCall: true,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Add to position
      positionId = await wrapperAddLong({
        token: STABLE_IDS.DAI,
        positionId,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);

      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Remove from position
      positionId = await wrapperReduceLong({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 260,
        inputAmount: 0,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Close position fully
      positionId = await wrapperCloseLong({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 260,
        inputAmount: 0,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });

    it('DAI using openLongParams - LONG PUT', async () => {
      // Open long put
      let positionId = await wrapperOpenLong({
        token: STABLE_IDS.DAI,
        isCall: false,
        maxCost: 120,
        inputAmount: 130,
        size: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Add to position
      positionId = await wrapperAddLong({
        token: STABLE_IDS.DAI,
        positionId,
        maxCost: 120,
        inputAmount: 130,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Remove from position
      positionId = await wrapperReduceLong({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 15,
        inputAmount: 0,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Close position fully
      positionId = await wrapperCloseLong({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 10,
        inputAmount: 0,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });

  describe('USDC long opens', async () => {
    it('USDC using openLongParams - LONG CALL', async () => {
      // Open long call
      let positionId = await wrapperOpenLong({
        token: STABLE_IDS.USDC,
        isCall: true,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Add to position
      positionId = await wrapperAddLong({
        token: STABLE_IDS.USDC,
        positionId,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);

      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Remove from position
      positionId = await wrapperReduceLong({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 240,
        inputAmount: 0,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Close position fully
      positionId = await wrapperCloseLong({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 260,
        inputAmount: 0,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });

    it('USDC using openLongParams - LONG PUT', async () => {
      // Open long put
      let positionId = await wrapperOpenLong({
        token: STABLE_IDS.USDC,
        isCall: false,
        maxCost: 120,
        inputAmount: 130,
        size: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Add to position
      positionId = await wrapperAddLong({
        token: STABLE_IDS.USDC,
        positionId,
        maxCost: 120,
        inputAmount: 130,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Remove from position
      positionId = await wrapperReduceLong({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 15,
        inputAmount: 0,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Close position fully
      positionId = await wrapperCloseLong({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 10,
        inputAmount: 0,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });

  describe('sUSD long opens', async () => {
    it('sUSD using openLongParams - LONG CALL', async () => {
      // Open long call
      let positionId = await wrapperOpenLong({
        isCall: true,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Add to position
      positionId = await wrapperAddLong({
        positionId,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);

      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Remove from position
      positionId = await wrapperReduceLong({
        positionId,
        minReceived: 260,
        inputAmount: 0,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.LONG_CALL);

      // Close position fully
      positionId = await wrapperCloseLong({
        positionId,
        minReceived: 260,
        inputAmount: 0,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });

    it('sUSD using openLongParams - LONG PUT', async () => {
      // Open long put
      let positionId = await wrapperOpenLong({
        isCall: false,
        maxCost: 120,
        inputAmount: 125,
        size: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Add to position
      positionId = await wrapperAddLong({
        positionId,
        maxCost: 120,
        inputAmount: 125,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Remove from position
      positionId = await wrapperReduceLong({
        positionId,
        minReceived: 15,
        inputAmount: 0,
        size: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.LONG_PUT);

      // Close position fully
      positionId = await wrapperCloseLong({
        positionId,
        minReceived: 10,
        inputAmount: 0,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
});
