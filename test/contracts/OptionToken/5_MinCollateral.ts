// integration tests
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { ContractTransaction } from '@ethersproject/contracts';
import {
  getEventArgs,
  MAX_UINT,
  OptionType,
  PositionState,
  toBN,
  TradeDirection,
  UNIT,
} from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  Balances,
  closePositionWithOverrides,
  getBalances,
  getSpotPrice,
  openPositionWithOverrides,
} from '../../utils/contractHelpers';
import { DEFAULT_TRADE_LIMIT_PARAMS } from '../../utils/defaultParams';
import { seedFixture } from '../../utils/fixture';
import { mockPrice, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionToken - MinCollateral', async () => {
  const shortTypes = [OptionType.SHORT_CALL_BASE, OptionType.SHORT_CALL_QUOTE, OptionType.SHORT_PUT_QUOTE];
  const belowMin: any = {
    SHORT_CALL_BASE: toBN('2'),
    SHORT_CALL_QUOTE: toBN('500'),
    SHORT_PUT_QUOTE: toBN('500'),
  };

  const aboveMin: any = {
    SHORT_CALL_BASE: toBN('5'),
    SHORT_CALL_QUOTE: toBN('7500'),
    SHORT_PUT_QUOTE: toBN('7500'),
  };

  let DEFAULT_PARAM: any;
  beforeEach(async () => {
    await seedFixture();
    await hre.f.c.optionMarketPricer.setTradeLimitParams({ ...DEFAULT_TRADE_LIMIT_PARAMS, minDelta: toBN('0') });
    DEFAULT_PARAM = {
      positionId: 0,
      amount: toBN('10'),
      strikeId: hre.f.strike.strikeId,
    };
  });

  describe('new position', async () => {
    shortTypes.forEach(async shortType => {
      it('reverts if not enough collateral to cover minCollateral: ' + OptionType[shortType], async () => {
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            optionType: shortType,
            setCollateralTo: belowMin[OptionType[shortType]],
          }),
        ).revertedWith('AdjustmentResultsInMinimumCollateralNotBeingMet');
      });
    });
  });

  describe('adjust collateral', async () => {
    beforeEach(async () => {
      await mockPrice(hre.f.c, toBN('1500'), 'sETH');
      for (let i = 0; i < 3; i++) {
        await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          optionType: shortTypes[i],
          setCollateralTo: aboveMin[OptionType[shortTypes[i]]],
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount,
          PositionState.ACTIVE,
          aboveMin[OptionType[shortTypes[i]]],
        );
      }
    });

    it('add amount: add collateral when > minCollat', async () => {
      for (let i = 0; i < 3; i++) {
        const oldBal = await getBalances();
        const [tx] = await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: DEFAULT_PARAM.amount,
          setCollateralTo: aboveMin[OptionType[shortTypes[i]]].mul(2),
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount.mul(2),
          PositionState.ACTIVE,
          aboveMin[OptionType[shortTypes[i]]].mul(2),
        );
        await expectBalChange(aboveMin[OptionType[shortTypes[i]]], shortTypes[i], tx, 'Trade', oldBal);
      }
    });

    it('add amount: add collateral to liquidatable position when > minCollat', async () => {
      const prices = ['5000', '5000', '500'];
      const minCollat = ['15.04', '90284', '21945'];

      for (let i = 0; i < 3; i++) {
        await mockPrice(hre.f.c, toBN(prices[i]), 'sETH');
        assertCloseToPercentage(await getMinCollateral(i + 1, DEFAULT_PARAM.amount), toBN(minCollat[i]), toBN('0.01'));
        await expectLiquidatable(i + 1);
        const oldBal = await getBalances();
        const newCollat = toBN(minCollat[i]).mul(toBN('1.2')).div(UNIT);
        const [tx] = await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: DEFAULT_PARAM.amount,
          setCollateralTo: newCollat,
        });
        await expectPosition(i + 1, shortTypes[i], DEFAULT_PARAM.amount.mul(2), PositionState.ACTIVE, newCollat);
        await expectBalChange(newCollat.sub(aboveMin[OptionType[shortTypes[i]]]), shortTypes[i], tx, 'Trade', oldBal);
      }
    });

    it('add amount: reverts add collateral when < minCollat', async () => {
      const prices = ['5000', '5000', '500'];
      const minCollat = ['15.04', '90284', '21945'];

      for (let i = 0; i < 3; i++) {
        await mockPrice(hre.f.c, toBN(prices[i]), 'sETH');
        await expectLiquidatable(i + 1);
        await expect(
          openPositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: i + 1,
            optionType: shortTypes[i],
            amount: DEFAULT_PARAM.amount,
            setCollateralTo: toBN(minCollat[i]).mul(toBN('0.8')).div(UNIT),
          }),
        ).to.revertedWith('AdjustmentResultsInMinimumCollateralNotBeingMet');
      }
    });

    it('reduce amount: add collateral when > minCollat', async () => {
      for (let i = 0; i < 3; i++) {
        const oldBal = await getBalances();
        const tx = await closePositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: DEFAULT_PARAM.amount.div(2),
          setCollateralTo: aboveMin[OptionType[shortTypes[i]]].mul(2),
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount.div(2),
          PositionState.ACTIVE,
          aboveMin[OptionType[shortTypes[i]]].mul(2),
        );
        await expectBalChange(aboveMin[OptionType[shortTypes[i]]], shortTypes[i], tx, 'Trade', oldBal);
      }
    });

    it('reduce amount: reverts add collateral when < minCollat', async () => {
      const prices = ['10000', '10000', '50'];

      for (let i = 0; i < 3; i++) {
        await mockPrice(hre.f.c, toBN(prices[i]), 'sETH');
        await expectLiquidatable(i + 1);
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: i + 1,
            optionType: shortTypes[i],
            amount: DEFAULT_PARAM.amount.mul(toBN('0.9').div(UNIT)),
            setCollateralTo: aboveMin[OptionType[shortTypes[i]]].mul(toBN('1.10').div(UNIT)), // 10% increase in collat
          }),
        ).to.revertedWith('AdjustmentResultsInMinimumCollateralNotBeingMet');
      }
    });

    it('same amount: add collateral with both open/close() when > minCollat', async () => {
      for (let i = 0; i < 3; i++) {
        const oldBal = await getBalances();
        // add with open
        const [txOpen] = await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: 0,
          setCollateralTo: aboveMin[OptionType[shortTypes[i]]].mul(2),
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount,
          PositionState.ACTIVE,
          aboveMin[OptionType[shortTypes[i]]].mul(2),
        );
        await expectBalChange(aboveMin[OptionType[shortTypes[i]]], shortTypes[i], txOpen, 'Trade', oldBal);

        // add with close
        const txClose = await closePositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: 0,
          setCollateralTo: aboveMin[OptionType[shortTypes[i]]].mul(3),
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount,
          PositionState.ACTIVE,
          aboveMin[OptionType[shortTypes[i]]].mul(3),
        );
        await expectBalChange(aboveMin[OptionType[shortTypes[i]]].mul(2), shortTypes[i], txClose, 'Trade', oldBal);
      }
    });

    it('same amount: reduce collateral with both open/close() when > minCollat', async () => {
      let existingCollat;
      for (let i = 0; i < 3; i++) {
        existingCollat = aboveMin[OptionType[shortTypes[i]]];
        await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: 0,
          setCollateralTo: existingCollat.sub(existingCollat.div(10)), // 10% reduction
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount,
          PositionState.ACTIVE,
          existingCollat.sub(existingCollat.div(10)),
        );

        await closePositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: 0,
          setCollateralTo: existingCollat.sub(existingCollat.div(20)),
        });
        await expectPosition(
          i + 1,
          shortTypes[i],
          DEFAULT_PARAM.amount,
          PositionState.ACTIVE,
          existingCollat.sub(existingCollat.div(20)),
        );
      }
    });
  });

  describe('full close', async () => {
    beforeEach(async () => {
      await mockPrice(hre.f.c, toBN('1500'), 'sETH');
      for (let i = 0; i < 3; i++) {
        await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          optionType: shortTypes[i],
          setCollateralTo: aboveMin[OptionType[shortTypes[i]]],
        });
      }
    });
    it('full close with MAX_UINT final collat', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: i + 1,
            optionType: shortTypes[i],
            amount: DEFAULT_PARAM.amount,
            setCollateralTo: MAX_UINT,
          }),
        ).revertedWith('FullyClosingWithNonZeroSetCollateral');
      }
    });

    it('reverts full close with MAX_UINT final collat when insolvent', async () => {
      const prices = ['5000', '5000', '500'];
      for (let i = 0; i < 3; i++) {
        await mockPrice(hre.f.c, toBN(prices[i]), 'sETH');
        await expectLiquidatable(i + 1);
        expect(
          isInsolvent(
            aboveMin[OptionType[shortTypes[i]]],
            toBN('1500'),
            toBN(prices[i]),
            DEFAULT_PARAM.amount,
            shortTypes[i],
          ),
        ).to.eq(true);
        await expect(
          closePositionWithOverrides(hre.f.c, {
            ...DEFAULT_PARAM,
            positionId: i + 1,
            optionType: shortTypes[i],
            amount: DEFAULT_PARAM.amount,
            setCollateralTo: MAX_UINT,
          }),
        ).revertedWith('FullyClosingWithNonZeroSetCollateral');
      }
    });

    it('full close with 0 final collat when liquidatable', async () => {
      const prices = ['2500', '2250', '1000'];

      for (let i = 0; i < 3; i++) {
        await mockPrice(hre.f.c, toBN(prices[i]), 'sETH');
        await expectLiquidatable(i + 1);
        expect(
          isInsolvent(
            aboveMin[OptionType[shortTypes[i]]],
            toBN('1500'),
            toBN(prices[i]),
            DEFAULT_PARAM.amount,
            shortTypes[i],
          ),
        ).to.eq(false);
        const oldBal = await getBalances();
        const tx = await closePositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: DEFAULT_PARAM.amount,
          setCollateralTo: 0,
        });
        await expectPosition(i + 1, shortTypes[i], toBN('0'), PositionState.CLOSED, toBN('0'));
        await expectBalChange(toBN('0').sub(aboveMin[OptionType[shortTypes[i]]]), shortTypes[i], tx, 'Trade', oldBal);
      }
    });

    it('full close with 0 final collat when insolvent', async () => {
      // open two positions with plenty of collat to prefent sc out of funds
      await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c, toBN('1000000'), toBN('10000'));
      await openPositionWithOverrides(
        hre.f.c,
        {
          ...DEFAULT_PARAM,
          optionType: OptionType.SHORT_CALL_QUOTE,
          setCollateralTo: toBN('100000'),
        },
        hre.f.alice,
      );
      await openPositionWithOverrides(
        hre.f.c,
        {
          ...DEFAULT_PARAM,
          optionType: OptionType.SHORT_CALL_BASE,
          setCollateralTo: toBN('500'),
        },
        hre.f.alice,
      );

      const prices = ['5000', '5000', '500'];
      for (let i = 0; i < 3; i++) {
        await mockPrice(hre.f.c, toBN(prices[i]), 'sETH');
        await expectLiquidatable(i + 1);

        expect(
          isInsolvent(
            aboveMin[OptionType[shortTypes[i]]],
            toBN('1500'),
            toBN(prices[i]),
            DEFAULT_PARAM.amount,
            shortTypes[i],
          ),
        ).to.eq(true);
        const oldBal = await getBalances();
        const tx = await closePositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          positionId: i + 1,
          optionType: shortTypes[i],
          amount: DEFAULT_PARAM.amount,
          setCollateralTo: 0,
        });
        await expectPosition(i + 1, shortTypes[i], toBN('0'), PositionState.CLOSED, toBN('0'));
        await expectBalChange(toBN('0').sub(aboveMin[OptionType[shortTypes[i]]]), shortTypes[i], tx, 'Trade', oldBal);
      }
    });
  });
});

export async function expectPosition(
  positionId: BigNumberish,
  optionType: OptionType,
  amount: BigNumber,
  state: PositionState,
  finalCollateral: BigNumber,
) {
  let position;
  try {
    position = await hre.f.c.optionToken.getPositionWithOwner(positionId);
    expect(position.owner).eq(hre.f.deployer.address);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ==
        "VM Exception while processing transaction: reverted with reason string 'ERC721: owner query for nonexistent token'"
      ) {
        position = await hre.f.c.optionToken.getOptionPosition(positionId);
      } else {
        console.log(error.message);
        throw error;
      }
    } else {
      throw error;
    }
  }
  expect(position.strikeId).eq(hre.f.strike.strikeId);
  expect(position.optionType).eq(optionType);
  expect(position.amount).eq(amount);
  expect(position.state).eq(state);
  expect(position.collateral).to.eq(finalCollateral);
}

export async function expectLiquidatable(positionId: BigNumberish) {
  const position = await hre.f.c.optionToken.getOptionPosition(positionId);
  const [strike, expiry] = await hre.f.c.optionMarket.getStrikeAndExpiry(hre.f.strike.strikeId);
  expect(await hre.f.c.optionToken.canLiquidate(position, expiry, strike, await getSpotPrice())).to.eq(true);
}

export async function getMinCollateral(positionId: BigNumberish, amountChange: BigNumber) {
  const position = await hre.f.c.optionToken.getOptionPosition(positionId);
  const [strike, expiry] = await hre.f.c.optionMarket.getStrikeAndExpiry(hre.f.strike.strikeId);
  return await hre.f.c.optionGreekCache.getMinCollateral(
    position.optionType,
    strike,
    expiry,
    await getSpotPrice(),
    position.amount.add(amountChange),
  );
}

export function isInsolvent(
  collat: BigNumber,
  strike: BigNumber,
  spot: BigNumber,
  amount: BigNumber,
  optionType: OptionType,
) {
  let loss;
  if (optionType == OptionType.SHORT_CALL_BASE || optionType == OptionType.SHORT_CALL_QUOTE) {
    loss = spot.gt(strike) ? spot.sub(strike) : toBN('0');
  } else {
    loss = strike.gt(spot) ? strike.sub(spot) : toBN('0');
  }

  if (optionType == OptionType.SHORT_CALL_BASE) {
    collat = collat.mul(spot).div(UNIT);
  }

  return (collat.lt(amount.mul(loss).div(UNIT)));
}

async function expectBalChange(
  addedCollateral: BigNumber,
  optionType: OptionType,
  tx: ContractTransaction,
  event: string,
  oldBalances: Balances,
) {
  const newBalances: Balances = await getBalances();
  const args = await getEventArgs(await tx.wait(), event);
  const premium =
    TradeDirection.OPEN == args.trade.tradeDirection ? toBN('0').sub(args.trade.totalCost) : args.trade.totalCost;

  // account for base...
  if (optionType != OptionType.SHORT_CALL_BASE) {
    expect(oldBalances.quote.sub(newBalances.quote)).to.eq(addedCollateral.add(premium));
  } else {
    expect(oldBalances.base.sub(newBalances.base)).to.eq(addedCollateral);
    expect(oldBalances.quote.sub(newBalances.quote)).to.eq(premium);
  }
}
