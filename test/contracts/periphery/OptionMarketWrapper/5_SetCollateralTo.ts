import { getEventArgs, OptionType, PositionState, toBN } from '../../../../scripts/util/web3utils';
import { STABLE_IDS, wrapperOpenShort } from '../../../utils/contractHelpers/wrapper';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('OptionMarketWrapper viewer function tests', () => {
  beforeEach(allCurrenciesFixture);

  describe('Changing collateral', async () => {
    it('DAI adding/removing collateral', async () => {
      const positionId = await wrapperOpenShort({
        token: STABLE_IDS.DAI,
        optionType: OptionType.SHORT_CALL_BASE,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        collateral: 1,
      });

      const result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      let details1 = await hre.f.c.optionMarketWrapper.setCollateralWrapper(0, positionId, toBN('1.5'));
      let event = getEventArgs(await details1.wait(), 'SetCollateralTo');
      console.log(`Set collateral to ${event}`);

      details1 = await hre.f.c.optionMarketWrapper.setCollateralWrapper(0, positionId, toBN('0.5'));
      event = getEventArgs(await details1.wait(), 'SetCollateralTo');
      console.log(`Set collateral to ${event}`);
    });
  });

  describe('Changing collateral', async () => {
    it('sUSD adding/removing collateral', async () => {
      const positionId = await wrapperOpenShort({
        optionType: OptionType.SHORT_CALL_BASE,
        minReceived: 220,
        inputAmount: 0,
        size: 1,
        collateral: 1,
      });

      const result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      console.log(`Position collateral ${result1.collateral}`);

      let details1 = await hre.f.c.optionMarketWrapper.setCollateralWrapper(0, positionId, toBN('1.5'));
      let event = getEventArgs(await details1.wait(), 'SetCollateralTo');
      console.log(`Set collateral to ${event}`);

      details1 = await hre.f.c.optionMarketWrapper.setCollateralWrapper(0, positionId, toBN('0.5'));
      event = getEventArgs(await details1.wait(), 'SetCollateralTo');
      console.log(`Set collateral to ${event}`);
    });
  });
});
