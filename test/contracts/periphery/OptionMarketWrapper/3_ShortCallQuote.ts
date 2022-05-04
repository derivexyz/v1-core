import { fromBN, OptionType, PositionState, toBN } from '../../../../scripts/util/web3utils';
import {
  STABLE_IDS,
  wrapperAddShort,
  wrapperCloseShort,
  wrapperOpenShort,
  wrapperReduceShort,
} from '../../../utils/contractHelpers/wrapper';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

// ----- Test outline -----
// 1. Opens a short call quote with DAI/USDC/sUSD for premium
// 2. Adds to the position increasing collateral (user sends more)
// 3. Adds to the position decreasing collateral (user receives some)
// 4. Adds to the position increasing collateral but covered by option price (user sends nothing)
// 5. Removes from the position increasing collateral (user sends more)
// 6. Removes from the position decreasing collateral (user receives some)
// 7. Removes from the position decreasing collateral but covered by option price (user receives nothing)
// 8. Closes position fully

describe('OptionMarketWrapper SHORT CALL QUOTE trading tests', async () => {
  beforeEach(allCurrenciesFixture);

  describe('DAI short opens', async () => {
    const spotPrice = 1750;
    it('DAI using openShortParams - SHORT CALL QUOTE', async () => {
      // Open short call for premium
      let positionId = await wrapperOpenShort({
        token: STABLE_IDS.DAI,
        optionType: OptionType.SHORT_CALL_QUOTE,
        minReceived: 220,
        inputAmount: spotPrice,
        size: 1,
        collateral: spotPrice,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // // Adds to the position increasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 220,
        inputAmount: spotPrice * 2,
        size: 1,
        absoluteCollateral: spotPrice * 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      let balbefore = +fromBN(await hre.f.DAI.balanceOf(hre.f.deployer.address));
      console.log(`balance before ${balbefore}`);
      // Adds to the position decreasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: spotPrice * 2,
      });
      let balAfter = +fromBN(await hre.f.DAI.balanceOf(hre.f.deployer.address));
      console.log(`balance after  ${balAfter}`);
      console.log(`difference     ${balbefore - balAfter}`);

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      balbefore = +fromBN(await hre.f.DAI.balanceOf(hre.f.deployer.address));
      console.log(`balance before ${balbefore}`);
      // Adds to the position increasing collateral but covered by option price (user sends nothing)
      positionId = await wrapperAddShort({
        token: STABLE_IDS.DAI,
        positionId,
        minReceived: 0,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: spotPrice * 2 + 200,
      });
      balAfter = +fromBN(await hre.f.DAI.balanceOf(hre.f.deployer.address));
      console.log(`balance after  ${balAfter}`);
      console.log(`difference     ${balbefore - balAfter}`);

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position increasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: spotPrice * 3,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice * 4,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 0,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice * 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral but covered by option price
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 0,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Close position fully
      positionId = await wrapperCloseShort({
        token: STABLE_IDS.DAI,
        positionId,
        inputAmount: 351,
        maxCost: 380,
      });
      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });

  describe('USDC short opens', async () => {
    const spotPrice = 1750;
    it('USDC using openShortParams - SHORT CALL QUOTE', async () => {
      // Open short call for premium
      let positionId = await wrapperOpenShort({
        token: STABLE_IDS.USDC,
        optionType: OptionType.SHORT_CALL_QUOTE,
        minReceived: 220,
        inputAmount: spotPrice,
        size: 1,
        collateral: spotPrice,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position increasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 220,
        inputAmount: spotPrice * 2,
        size: 1,
        absoluteCollateral: spotPrice * 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position descresing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: spotPrice * 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position increasing collateral but covered by option price (user sends nothing)
      positionId = await wrapperAddShort({
        token: STABLE_IDS.USDC,
        positionId,
        minReceived: 0,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: spotPrice * 2 + 200,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position increasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: spotPrice * 3,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice * 4,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 0,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice * 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral but covered by option price
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 0,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Close position fully
      positionId = await wrapperCloseShort({
        token: STABLE_IDS.USDC,
        positionId,
        inputAmount: 351,
        maxCost: 380,
      });
      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });

  describe('sUSD short opens', async () => {
    const spotPrice = 1750;
    it('sUSD using openShortParams - SHORT CALL QUOTE', async () => {
      // Open short call for premium
      let positionId = await wrapperOpenShort({
        token: STABLE_IDS.sUSD,
        optionType: OptionType.SHORT_CALL_QUOTE,
        minReceived: 220,
        inputAmount: spotPrice,
        size: 1,
        collateral: spotPrice,
      });

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position increasing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.sUSD,
        positionId,
        minReceived: 220,
        inputAmount: spotPrice * 2,
        size: 1,
        absoluteCollateral: spotPrice * 3,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position descresing collateral
      positionId = await wrapperAddShort({
        token: STABLE_IDS.sUSD,
        positionId,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: spotPrice * 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Adds to the position increasing collateral but covered by option price (user sends nothing)
      positionId = await wrapperAddShort({
        token: STABLE_IDS.sUSD,
        positionId,
        minReceived: 0,
        inputAmount: 0,
        size: 1,
        absoluteCollateral: spotPrice * 2 + 200,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position increasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.sUSD,
        positionId,
        inputAmount: spotPrice * 3,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice * 4,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.sUSD,
        positionId,
        inputAmount: 0,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice * 2,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Removes from the position decreasing collateral but covered by option price
      positionId = await wrapperReduceShort({
        token: STABLE_IDS.sUSD,
        positionId,
        inputAmount: 0,
        maxCost: 380,
        size: 1,
        absoluteCollateral: spotPrice,
      });

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_QUOTE);
      console.log(`Position collateral ${result1.collateral}`);

      // Close position fully
      positionId = await wrapperCloseShort({
        token: STABLE_IDS.sUSD,
        positionId,
        inputAmount: 351,
        maxCost: 380,
      });
      await expect(hre.f.c.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
});
