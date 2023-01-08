import { OptionType, PositionState, toBN } from '../../../../scripts/util/web3utils';
import {
  checkContractFundsGMX,
  wrapperAddShort,
  wrapperCloseShort,
  wrapperOpenShort,
  wrapperReduceShort,
} from '../../../utils/contractHelpers/wrapper';
import { allCurrenciesFixtureGMX } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('OptionMarketWrapper ETH->WETH SHORT CALL BASE trading tests', () => {
  beforeEach(async () => {
    // Deploying MOCK GMX with WETH
    await allCurrenciesFixtureGMX();
    // Burn all WETH base for the deployer
    await hre.f.gc.gmx.eth.burn(hre.f.deployer.address, await hre.f.gc.gmx.eth.balanceOf(hre.f.deployer.address));
  });
  afterEach(async () => {
    await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);
  });

  describe('Native ETH short opens', async () => {
    it('ETH using openShortParams - SHORT CALL BASE', async () => {
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);
      // Open short call for premium
      console.log(`Open short call for premium`);

      let positionId = await wrapperOpenShort(
        {
          optionType: OptionType.SHORT_CALL_BASE,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          collateral: 2,
        },
        toBN('2'),
        true,
      );

      let result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Adds to the position increasing collateral
      console.log(`Adds to the position increasing collateral`);
      positionId = await wrapperAddShort(
        {
          positionId,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          absoluteCollateral: 3,
        },
        toBN('3'),
        true,
      );

      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Adds to the position descreasing collateral
      console.log(`Adds to the position descreasing collateral`);
      positionId = await wrapperAddShort(
        {
          positionId,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          absoluteCollateral: 2,
        },
        toBN('0'),
        true,
      );

      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Adds to the position leaving collateral
      console.log(`Adds to the position leaving collateral`);
      positionId = await wrapperAddShort(
        {
          positionId,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          absoluteCollateral: 2,
        },
        toBN('0'),
        true,
      );

      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('4'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      // console.log(`Position collateral ${ result1.collateral }`)
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Removes from the position increasing collateral
      console.log(`Removes from the position increasing collateral`);
      positionId = await wrapperReduceShort(
        {
          positionId,
          inputAmount: 400,
          maxCost: 380,
          size: 1,
          absoluteCollateral: 5,
        },
        toBN('3'),
        true,
      );

      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('3'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      // console.log(`Position collateral ${ result1.collateral }`)
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Removes from the position decreasing collateral
      console.log(`Removes from the position decreasing collateral`);
      positionId = await wrapperReduceShort(
        {
          positionId,
          inputAmount: 400,
          maxCost: 380,
          size: 1,
          absoluteCollateral: 1,
        },
        toBN('0'),
        true,
      );

      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Removes from position leaving collateral the same
      console.log(`Removes from position leaving collateral the same`);
      positionId = await wrapperReduceShort(
        {
          positionId,
          inputAmount: 400,
          maxCost: 380,
          size: 1,
          absoluteCollateral: 1,
        },
        toBN('0'),
        true,
      );

      result1 = await hre.f.gc.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE); // 1 = ACTIVE
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.gc.optionMarketWrapper.address);

      // Close position fully
      console.log(`Close position fully`);
      positionId = await wrapperCloseShort(
        {
          positionId,
          inputAmount: 400,
          maxCost: 380,
        },
        toBN('0'),
        true,
      );

      await expect(hre.f.gc.optionToken.getPositionWithOwner(positionId)).revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });

    it('Eth + Weth used to open position', async () => {
      await hre.f.c.gmx.eth.mint(hre.f.deployer.address, toBN('1'));

      await expect(
        wrapperOpenShort(
          {
            optionType: OptionType.SHORT_CALL_BASE,
            minReceived: 240,
            inputAmount: 0,
            size: 1,
            collateral: 2,
          },
          toBN('0.9'),
        ),
      ).to.revertedWith('transfer amount exceeds balance');

      // Open with 1 ETH + 1 WETH
      let positionId = await wrapperOpenShort(
        {
          optionType: OptionType.SHORT_CALL_BASE,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          collateral: 2,
        },
        toBN('1'),
      );

      let result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('1'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.c.optionMarketWrapper.address);

      // Adds to the position increasing collateral with 0.5 ETH + 0.5 WETH
      await hre.f.c.gmx.eth.mint(hre.f.deployer.address, toBN('0.5'));
      console.log(`Adds to the position increasing collateral`);
      positionId = await wrapperAddShort(
        {
          positionId,
          minReceived: 240,
          inputAmount: 0,
          size: 1,
          absoluteCollateral: 3,
        },
        toBN('0.5'),
      );

      result1 = await hre.f.c.optionToken.getPositionWithOwner(positionId);
      expect(result1.strikeId).to.eq(hre.f.strike.strikeId);
      expect(result1.amount).to.eq(toBN('2'));
      expect(result1.state).to.eq(PositionState.ACTIVE);
      expect(result1.optionType).to.eq(OptionType.SHORT_CALL_BASE);
      await checkContractFundsGMX(hre.f.c.optionMarketWrapper.address);
    });
  });
});
