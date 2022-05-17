import { OptionType, PositionState, toBN } from '../../../../scripts/util/web3utils';
import {
  checkContractFunds,
  STABLE_IDS,
  wrapperAddShort,
  wrapperCloseShort,
  wrapperOpenShort,
  wrapperReduceShort,
} from '../../../utils/contractHelpers/wrapper';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

//  ----- Test outline -----
// 1. Opens a short call with DAI/USDC/sUSD for premium
// 2. Adds to the position increasing collateral
// 3. Adds to the position decreasing collateral
// 4. Adds to the position leaving collateral the same
// 5. Removes from the position increasing collateral
// 6. Removes from the position decreasing collateral
// 7. Removes from the position leaving collateral the same
// 8. Closes position fully

describe('OptionMarketWrapper SHORT CALL BASE trading tests', () => {
  beforeEach(allCurrenciesFixture);
  afterEach(async () => {
    await checkContractFunds(hre.f.c.optionMarketWrapper.address);
  });

  describe('DAI short opens', async () => {
    it('DAI using openShortParams - SHORT CALL BASE', async () => {
      // Open short call for premium
      let positionId = await wrapperOpenShort({
        token: STABLE_IDS.DAI,
        optionType: OptionType.SHORT_CALL_BASE,
        minReceived: 240,
        inputAmount: 0,
        size: 1,
        collateral: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Adds to the position increasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 240,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Adds to the position descreasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 240,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);
      // Adds to the position leaving collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 240,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Removes from the position increasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Removes from the position decreasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Removes from position leaving collateral the same
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Close position fully
      positionId = await wrapperCloseShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 400,
        maxCost: 380,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });

  describe('USDC short opens', async () => {
    it('USDC using openShortParams - SHORT CALL BASE', async () => {
      // Open short call for premium
      let positionId = await wrapperOpenShort({
        token: STABLE_IDS.USDC,
        optionType: OptionType.SHORT_CALL_BASE,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        collateral: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Adds to the position increasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Adds to the position descreasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Adds to the position leaving collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Removes from the position increasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Removes from the position decreasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Removes from position leaving collateral the same
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);
      await checkContractFunds(hre.f.c.optionMarketWrapper.address);

      // Close position fully
      positionId = await wrapperCloseShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 400,
        maxCost: 380,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });

  describe('sUSD short opens', async () => {
    it('sUSD using openShortParams - SHORT CALL BASE', async () => {
      // Open short call for premium
      let positionId = await wrapperOpenShort({
        optionType: OptionType.SHORT_CALL_BASE,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        collateral: 1,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position increasing collateral
      positionId = await wrapperAddShort({
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position descresing collateral
      positionId = await wrapperAddShort({
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position leaving collateral
      positionId = await wrapperAddShort({
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position increasing collateral
      positionId = await wrapperReduceShort({
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral
      positionId = await wrapperReduceShort({
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from position leaving collateral the same
      positionId = await wrapperReduceShort({
        positionId,
        inputAmount: 400,
        maxCost: 380,
        size: 1,
        absoluteCollateral: 1,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      // Close position fully
      positionId = await wrapperCloseShort({
        positionId,
        inputAmount: 400,
        maxCost: 380,
      });

      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
});
