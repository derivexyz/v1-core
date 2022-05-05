// integration tests
import { BigNumber, BigNumberish, ContractReceipt } from 'ethers';
import { getEventArgs, OptionType, PositionState, toBN, UNIT } from '../../../scripts/util/web3utils';
import { TradeEvent } from '../../../typechain-types/OptionMarket';
import { LiquidationFeesStruct } from '../../../typechain-types/OptionToken';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  Balances,
  DEFAULT_SHORT_CALL_BASE,
  DEFAULT_SHORT_CALL_QUOTE,
  DEFAULT_SHORT_PUT_QUOTE,
  getBalances,
  getSpotPrice,
  openDefaultShortCallBase,
  openDefaultShortCallQuote,
  openDefaultShortPutQuote,
  resetMinCollateralParameters,
} from '../../utils/contractHelpers';
import { DEFAULT_BASE_PRICE, DEFAULT_PARTIAL_COLLAT_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { mockPrice } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

type LiquidationBalances = {
  sender: Balances;
  recipient: Balances;
  lp: Balances;
  om: Balances;
};

describe('Liquidation', () => {
  beforeEach(seedFixture);

  it('can only be called for liquidatable positions', async () => {
    const positionId = await openDefaultShortCallBase();
    await expect(hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.deployer.address)).revertedWith(
      'PositionNotLiquidatable',
    );
  });

  it.skip('force closing insolvent position');

  describe('liquidatePosition', () => {
    const types = ['SHORT CALL QUOTE', 'SHORT CALL BASE', 'SHORT PUT QUOTE'];
    const defaults = [DEFAULT_SHORT_CALL_QUOTE, DEFAULT_SHORT_CALL_BASE, DEFAULT_SHORT_PUT_QUOTE];
    const isQuote = [true, false, true];
    const openTypes = [openDefaultShortCallQuote, openDefaultShortCallBase, openDefaultShortPutQuote];
    const prices = [toBN('10000'), toBN('10000'), toBN('500')];
    const insolvencies = [toBN('7907.21'), toBN('3974.41'), toBN('40.1')];

    types.forEach(async (type, i) => {
      it(`calculates fees, sets state and routes funds when solvent: ${type}`, async () => {
        const positionId = await openTypes[i]();
        const oldBalances = await getAllBalances();

        await resetMinCollateralParameters({
          minStaticQuoteCollateral: defaults[i].setCollateralTo.add(toBN('0.01')),
          minStaticBaseCollateral: defaults[i].setCollateralTo.add(toBN('0.01')),
        });
        const tx = await hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.alice.address);
        const newBalances = await getAllBalances();

        const liquidationEvent = getLiquidationEvent(await tx.wait());
        expect(liquidationEvent.liquidation.insolventAmount).eq(0);
        expect(sumLiquidation(liquidationEvent.liquidation)).eq(defaults[i].setCollateralTo);
        expect(await hre.f.c.optionToken.getPositionState(positionId)).eq(PositionState.LIQUIDATED);

        await expectRoutedFunds(oldBalances, newBalances, liquidationEvent, isQuote[i]);
      });

      it(`calculates fees, sets state and routes funds when insolvent: ${type}`, async () => {
        const positionId = await openTypes[i]();
        const oldBalances = await getAllBalances();

        await mockPrice(hre.f.c, prices[i], 'sETH');
        const tx = await hre.f.c.optionMarket.liquidatePosition(positionId, hre.f.alice.address);
        const newBalances = await getAllBalances();

        const liquidationEvent = getLiquidationEvent(await tx.wait());
        assertCloseToPercentage(liquidationEvent.liquidation.insolventAmount, insolvencies[i], toBN('0.01'));

        expect(liquidationEvent.liquidation.insolventAmount)
          .to.eq(await hre.f.c.liquidityPool.liquidationInsolventAmount())
          .to.gt(0);
        expect(
          sumLiquidationFees(liquidationEvent.liquidation)
            .add(liquidationEvent.liquidation.returnCollateral)
            .add(liquidationEvent.liquidation.lpPremiums),
        ).to.eq(defaults[i].setCollateralTo);

        expect(await hre.f.c.optionToken.getPositionState(positionId)).eq(PositionState.LIQUIDATED);

        await expectRoutedFunds(oldBalances, newBalances, liquidationEvent, isQuote[i]);
      });
    });
  });

  describe('canLiquidate', () => {
    const canLiquidateOverride = async (overrides?: any) => {
      return await hre.f.c.optionToken.canLiquidate(
        {
          positionId: 0, // ignored
          strikeId: 0, // ignored
          optionType: OptionType.SHORT_CALL_QUOTE,
          amount: DEFAULT_SHORT_CALL_QUOTE.amount,
          collateral: DEFAULT_SHORT_CALL_QUOTE.setCollateralTo,
          state: PositionState.ACTIVE,
          ...(overrides || {}),
        },
        hre.f.board.expiry,
        hre.f.strike.strikePrice,
        DEFAULT_BASE_PRICE,
      );
    };

    it('Returns false if position cannot be liquidated', async () => {
      await resetMinCollateralParameters({
        minStaticQuoteCollateral: DEFAULT_SHORT_CALL_QUOTE.setCollateralTo.add(toBN('0.01')),
      });

      // Can liquidate if there isn't enough collateral
      expect(await canLiquidateOverride()).true;

      // If the position isn't a short
      expect(await canLiquidateOverride({ optionType: OptionType.LONG_CALL })).false;
      expect(await canLiquidateOverride({ optionType: OptionType.LONG_PUT })).false;

      // If the position isn't active
      expect(await canLiquidateOverride({ state: PositionState.EMPTY })).false;
      expect(await canLiquidateOverride({ state: PositionState.SETTLED })).false;
      expect(await canLiquidateOverride({ state: PositionState.CLOSED })).false;
      expect(await canLiquidateOverride({ state: PositionState.LIQUIDATED })).false;
      expect(await canLiquidateOverride({ state: PositionState.MERGED })).false;

      // If min collateral is covered (even exactly)
      expect(
        await canLiquidateOverride({
          collateral: DEFAULT_SHORT_CALL_QUOTE.setCollateralTo.add(toBN('0.01')),
        }),
      ).false;
    });
  });

  describe('getLiquidationFees', async () => {
    const getLiquidationFees = async (
      gwavPremium: BigNumberish,
      userCollateral: BigNumberish,
      convertedMinLiquidationFee: BigNumberish,
      insolvencyMultiplier: BigNumberish,
    ) => {
      return await hre.f.c.optionToken.getLiquidationFees(
        gwavPremium,
        userCollateral,
        convertedMinLiquidationFee,
        insolvencyMultiplier,
      );
    };

    const updateFeeRatiosAndGetFees = async (liquidatorFeeRatio: BigNumberish, smFeeRatio: BigNumberish) => {
      await hre.f.c.optionToken.setPartialCollateralParams({
        ...DEFAULT_PARTIAL_COLLAT_PARAMS,
        liquidatorFeeRatio,
        smFeeRatio,
      });
      return await getLiquidationFees(0, toBN('1000'), toBN('1000'), toBN('1'));
    };

    it('tests the 5 main cases', async () => {
      let liquidationFees = await getLiquidationFees(0, 0, 0, 0);
      expect(sumLiquidation(liquidationFees)).to.eq(0);
      // userPositionCollat >= minOwed:
      // 1. minFee < collatPortion
      liquidationFees = await getLiquidationFees(toBN('1000'), toBN('5000'), toBN('200'), toBN('1'));
      expect(liquidationFees.returnCollateral).to.eq(toBN('3200'));
      expect(liquidationFees.lpPremiums).to.eq(toBN('1000'));
      expect(liquidationFees.insolventAmount).to.eq(0);
      // 20% of remaining collateral (4000 * 0.2 == 800) (800 > 200)
      expect(sumLiquidationFees(liquidationFees)).to.eq(toBN('800'));

      // 2. min > collat portion
      liquidationFees = await getLiquidationFees(toBN('1500'), toBN('5000'), toBN('1000'), toBN('1'));
      // collateral fee = 800
      expect(liquidationFees.returnCollateral).to.eq(toBN('2500'));
      expect(liquidationFees.lpPremiums).to.eq(toBN('1500'));
      expect(liquidationFees.insolventAmount).to.eq(0);
      // More than 20% of remaining collateral (1000 > 800)
      expect(sumLiquidationFees(liquidationFees)).to.eq(toBN('1000'));

      // Insolvency:
      // 3. insolvency where there is enough to cover optionPrice but not minFee
      liquidationFees = await getLiquidationFees(toBN('3000'), toBN('3500'), toBN('700'), toBN('1'));
      expect(liquidationFees.returnCollateral).to.eq(0);
      expect(liquidationFees.lpPremiums).to.eq(toBN('2800')); // 3000 - 200
      expect(liquidationFees.insolventAmount).to.eq(toBN('200'));
      expect(sumLiquidationFees(liquidationFees)).to.eq(toBN('700'));
      // 4. insolvency where there is not enough to cover optionPrice but enough for minFee
      liquidationFees = await getLiquidationFees(toBN('3000'), toBN('2800'), toBN('700'), toBN('1'));
      expect(liquidationFees.returnCollateral).to.eq(0);
      expect(liquidationFees.lpPremiums).to.eq(toBN('2100')); // 2800 - 700
      expect(liquidationFees.insolventAmount).to.eq(toBN('900')); // 3000 - (2800 - 700)
      expect(sumLiquidationFees(liquidationFees)).to.eq(toBN('700'));
      // 5. insolvency where there is not enough to cover minFee
      liquidationFees = await getLiquidationFees(toBN('1000'), toBN('2000'), toBN('3500'), toBN('1'));
      expect(liquidationFees.returnCollateral).to.eq(0);
      expect(liquidationFees.lpPremiums).to.eq(0);
      expect(liquidationFees.insolventAmount).to.eq(toBN('1000')); // total premium owed
      expect(sumLiquidationFees(liquidationFees)).to.eq(toBN('2000')); // there is no insolvency for excess fees

      // Extra: insolvency is multiplied by the insolvency multipler
      liquidationFees = await getLiquidationFees(toBN('1000'), toBN('2000'), toBN('3500'), toBN('3.5'));
      expect(liquidationFees.insolventAmount).to.eq(toBN('3500')); // total premium owed
    });

    it('splits fees according to parameters', async () => {
      // Split between all
      let liquidationFees = await updateFeeRatiosAndGetFees(toBN('0.2'), toBN('0.3'));
      expect(liquidationFees.liquidatorFee).eq(toBN('200'));
      expect(liquidationFees.smFee).eq(toBN('300'));
      expect(liquidationFees.lpFee).eq(toBN('500'));

      // 100% to each party
      liquidationFees = await updateFeeRatiosAndGetFees(0, 0);
      expect(liquidationFees.liquidatorFee).eq(0);
      expect(liquidationFees.smFee).eq(0);
      expect(liquidationFees.lpFee).eq(toBN('1000'));

      liquidationFees = await updateFeeRatiosAndGetFees(toBN('1'), 0);
      expect(liquidationFees.liquidatorFee).eq(toBN('1000'));
      expect(liquidationFees.smFee).eq(0);
      expect(liquidationFees.lpFee).eq(0);

      liquidationFees = await updateFeeRatiosAndGetFees(0, toBN('1'));
      expect(liquidationFees.liquidatorFee).eq(0);
      expect(liquidationFees.smFee).eq(toBN('1000'));
      expect(liquidationFees.lpFee).eq(0);

      // split between 2
      liquidationFees = await updateFeeRatiosAndGetFees(toBN('0.6'), toBN('0.4'));
      expect(liquidationFees.liquidatorFee).eq(toBN('600'));
      expect(liquidationFees.smFee).eq(toBN('400'));
      expect(liquidationFees.lpFee).eq(0);

      liquidationFees = await updateFeeRatiosAndGetFees(0, toBN('0.6'));
      expect(liquidationFees.liquidatorFee).eq(0);
      expect(liquidationFees.smFee).eq(toBN('600'));
      expect(liquidationFees.lpFee).eq(toBN('400'));

      liquidationFees = await updateFeeRatiosAndGetFees(toBN('0.6'), 0);
      expect(liquidationFees.liquidatorFee).eq(toBN('600'));
      expect(liquidationFees.smFee).eq(0);
      expect(liquidationFees.lpFee).eq(toBN('400'));
    });
  });
});

function sumLiquidation(liquidationFees: LiquidationFeesStruct) {
  return sumLiquidationFees(liquidationFees)
    .add(liquidationFees.returnCollateral)
    .add(liquidationFees.lpPremiums)
    .add(liquidationFees.insolventAmount);
}

function sumLiquidationFees(liquidationFees: LiquidationFeesStruct) {
  return BigNumber.from(liquidationFees.smFee).add(liquidationFees.liquidatorFee).add(liquidationFees.lpFee);
}

function getLiquidationEvent(txReceipt: ContractReceipt): TradeEvent['args'] {
  return getEventArgs(txReceipt, 'Trade');
}

async function getAllBalances(): Promise<LiquidationBalances> {
  return {
    sender: await getBalances(hre.f.deployer.address),
    recipient: await getBalances(hre.f.alice.address),
    lp: await getBalances(hre.f.c.liquidityPool.address),
    om: await getBalances(hre.f.c.optionMarket.address),
  };
}

async function expectRoutedFunds(
  oldBalances: LiquidationBalances,
  newBalances: LiquidationBalances,
  event: any,
  isQuote: boolean,
) {
  const spotPrice = await getSpotPrice();

  if (isQuote) {
    expect(oldBalances.sender.quote.add(event.liquidation.returnCollateral)).to.eq(newBalances.sender.quote);
    expect(oldBalances.recipient.quote.add(event.liquidation.liquidatorFee)).to.eq(newBalances.recipient.quote);

    expect(oldBalances.lp.quote.add(event.liquidation.lpPremiums).add(event.liquidation.lpFee)).to.eq(
      newBalances.lp.quote,
    );
    expect(oldBalances.om.quote.add(event.liquidation.smFee)).to.eq(newBalances.om.quote);
  } else {
    expect(oldBalances.sender.base.add(event.liquidation.returnCollateral)).to.eq(newBalances.sender.base);
    expect(oldBalances.recipient.base.add(event.liquidation.liquidatorFee)).to.eq(newBalances.recipient.base);

    const premiumAndFee = event.liquidation.lpPremiums.add(event.liquidation.lpFee).mul(spotPrice).div(UNIT);
    const smFee = event.liquidation.smFee.mul(spotPrice).div(UNIT);

    // should fail because of exchange fees
    expect(oldBalances.lp.quote.add(premiumAndFee)).to.not.eq(newBalances.lp.quote);
    expect(oldBalances.om.quote.add(smFee)).to.not.eq(newBalances.om.quote);

    // account for exchange fees
    assertCloseToPercentage(oldBalances.lp.quote.add(premiumAndFee), newBalances.lp.quote, toBN('0.01'));

    assertCloseToPercentage(oldBalances.om.quote.add(smFee), newBalances.om.quote, toBN('0.01'));
  }
}
