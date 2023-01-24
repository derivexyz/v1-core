import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { ContractTransaction } from '@ethersproject/contracts';
import {
  CONVERTUSDC,
  CONVERTWBTC,
  getEventArgs,
  MONTH_SEC,
  OptionType,
  PositionState,
  toBN,
} from '../../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../../utils/assert';
import {
  ALL_TYPES,
  closePosition,
  closePositionWithOverrides,
  compareTradeResults,
  duplicateOrders,
  openPosition,
  openPositionWithOverrides,
  orderWithCumulativeResults,
} from '../../../utils/contractHelpers';
import { getRoutedFunds6dp } from '../../../utils/contractHelpers/fees';
import { fastForward, mineBlock, restoreSnapshot, takeSnapshot } from '../../../utils/evm';
import { seedFixtureUSDCwBTC } from '../../../utils/fixture';
import { createDefaultBoardWithOverrides, mockPrice } from '../../../utils/seedTestSystem';
import { expect, hre } from '../../../utils/testSetup';

describe('USDC_quote - Successful Open', async () => {
  const collaterals = [toBN('0'), toBN('0'), toBN('1'), toBN('1500'), toBN('1500')];
  const amount = toBN('0.0001');
  let DEFAULT_PARAM: {
    optionType: OptionType;
    strikeId: BigNumberish;
    amount: BigNumber;
    setCollateralTo?: BigNumber;
  };
  let oldUserQuoteBal: BigNumber;
  let oldUserBaseBal: BigNumber;
  let oldOMBalance: BigNumber;

  beforeEach(async () => {
    await seedFixtureUSDCwBTC();
    oldUserQuoteBal = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
    oldUserBaseBal = await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address);
    oldOMBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
  });

  ALL_TYPES.forEach(async optionType => {
    // let optionType = OptionType.SHORT_CALL_QUOTE;
    describe('trade: ' + OptionType[optionType], async () => {
      ['0.0001', '1000'].forEach(async price => {
        it('opens and settles 0.0001 amount @ base price: ' + price, async () => {
          await createDefaultBoardWithOverrides(hre.f.c, { strikePrices: [price, price, price] });
          await mockPrice(hre.f.c, toBN(price), 'sETH');

          const oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
          const [, positionId] = await openPositionWithOverrides(hre.f.c, {
            optionType: optionType,
            strikeId: 4,
            amount: amount,
            setCollateralTo: collaterals[optionType],
          });

          const newBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);

          // expect correct balance changes and token minting
          if (optionType == OptionType.LONG_CALL || optionType == OptionType.LONG_PUT) {
            if (price == '0.0001') {
              expect(oldBalance.sub(newBalance)).to.eq(2); // small amount rounded up to 1 for optionCost and fee
            } else {
              expect(oldBalance.sub(newBalance)).to.gt(0);
            }
            // expect(oldBalance.sub(newBalance)).to.lt(1000); // variance fee more for `amount` vs 1e-18
          } else {
            if (price == '0.0001') {
              if (optionType == OptionType.SHORT_CALL_BASE) {
                expect(oldBalance.sub(newBalance)).to.eq(0);
              } else {
                assertCloseToPercentage(oldBalance.sub(newBalance), collaterals[optionType].div(CONVERTUSDC));
              }
            } else {
              if (optionType == OptionType.SHORT_CALL_BASE) {
                expect(oldBalance.sub(newBalance)).to.lt(0); // gets some premium
              } else {
                // gets some premium ignoring collateral
                expect(oldBalance.sub(newBalance)).to.gt(collaterals[optionType].sub(toBN('1')).div(CONVERTUSDC));
              }
            }
          }
          await expectActiveAndAmount(positionId, amount);

          // settle amount = 1
          await fastForward(MONTH_SEC);
          await hre.f.c.optionMarket.settleExpiredBoard(2);
          await hre.f.c.snx.quoteAsset.transfer(hre.f.c.shortCollateral.address, 1);
          await hre.f.c.shortCollateral.settleOptions([1]);
        });
      });

      it('allows opening more of 0 amount', async () => {
        const [tx, positionId] = await openPositionWithOverrides(hre.f.c, {
          optionType: optionType,
          strikeId: hre.f.strike.strikeId,
          amount: toBN('1'),
          setCollateralTo: collaterals[optionType],
        });
        await openPositionWithOverrides(hre.f.c, {
          positionId,
          optionType: optionType,
          strikeId: hre.f.strike.strikeId,
          amount: 0,
          setCollateralTo: collaterals[optionType],
        });

        await expectRoutedFundsOnOpen6dp(
          tx,
          hre.f.deployer.address,
          oldUserQuoteBal,
          oldOMBalance,
          collaterals[optionType],
          optionType,
        );
        await expectActiveAndAmount(positionId, toBN('1'));
        if (optionType == OptionType.SHORT_CALL_BASE) {
          expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address)).to.eq(
            oldUserBaseBal.sub(collaterals[optionType].div(CONVERTWBTC)),
          );
        }
      });
      it('add amount', async () => {
        const [firstTx, id] = await openPositionWithOverrides(hre.f.c, {
          strikeId: hre.f.strike.strikeId,
          optionType: optionType,
          amount: toBN('1'),
          setCollateralTo: collaterals[optionType],
        });

        await expectActiveAndAmount(id, toBN('1'));
        await expectRoutedFundsOnOpen6dp(
          firstTx,
          hre.f.deployer.address,
          oldUserQuoteBal,
          oldOMBalance,
          collaterals[optionType],
          optionType,
        );
        const interimUserBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
        const interimOMBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);

        // adding amount
        const [secondTx] = await openPositionWithOverrides(hre.f.c, {
          positionId: id,
          strikeId: hre.f.strike.strikeId,
          optionType: optionType,
          amount: toBN('10'),
          setCollateralTo: collaterals[optionType].mul(11),
        });

        await expectRoutedFundsOnOpen6dp(
          secondTx,
          hre.f.deployer.address,
          interimUserBalance,
          interimOMBalance,
          collaterals[optionType].mul(10),
          optionType,
        );
        await expectActiveAndAmount(id, toBN('11'));
        if (optionType == OptionType.SHORT_CALL_BASE) {
          expect(await hre.f.c.snx.baseAsset.balanceOf(hre.f.deployer.address)).to.eq(
            oldUserBaseBal.sub(collaterals[optionType].mul(11).div(CONVERTWBTC)),
          );
        }
      });
      it('charges same cost for 3 iterations and 3 orders', async () => {
        // open 30 options with 3 separate orders
        await mineBlock();
        const snapshot = await takeSnapshot();
        const duplicateOrderResult = await duplicateOrders(
          3,
          optionType,
          hre.f.strike.strikeId,
          toBN('10'),
          collaterals[optionType].mul(30),
        );
        await restoreSnapshot(snapshot);

        // open 30 options with one order but 3 iterations
        const iteratedOrderResult = await orderWithCumulativeResults(
          3,
          optionType,
          hre.f.strike.strikeId,
          toBN('30'),
          collaterals[optionType].mul(30),
        );
        compareTradeResults(duplicateOrderResult, iteratedOrderResult);
      });
      it('cannot be adjusted by another user', async () => {
        const [, positionId] = await openPositionWithOverrides(hre.f.c, {
          optionType: optionType,
          strikeId: hre.f.strike.strikeId,
          amount: toBN('1'),
          setCollateralTo: collaterals[optionType],
        });
        await expect(
          closePositionWithOverrides(
            hre.f.c,
            {
              positionId: positionId,
              optionType: optionType,
              strikeId: hre.f.strike.strikeId,
              amount: toBN('1'),
              setCollateralTo: collaterals[optionType].mul(2),
            },
            hre.f.alice,
          ),
        ).revertedWith('OnlyOwnerCanAdjustPosition');
      });
      it('opens exact amount even if iterations would cause a rounding problem', async () => {
        const [tx, pos] = await openPosition({
          amount: toBN('1'),
          iterations: 3,
          optionType,
          setCollateralTo: collaterals[optionType],
        });
        let tradeEvent = getEventArgs(await tx.wait(), 'Trade');
        expect(tradeEvent.tradeResults[0].amount).eq('333333333333333333');
        expect(tradeEvent.tradeResults[1].amount).eq('333333333333333333');
        // Remainder gets added to last iteration
        expect(tradeEvent.tradeResults[2].amount).eq('333333333333333334');

        const closeTx = await closePosition({
          positionId: pos,
          amount: toBN('1'),
          optionType,
          iterations: 3,
        });
        tradeEvent = getEventArgs(await closeTx.wait(), 'Trade');
        expect(tradeEvent.tradeResults[0].amount).eq('333333333333333333');
        expect(tradeEvent.tradeResults[1].amount).eq('333333333333333333');
        // Remainder gets added to last iteration
        expect(tradeEvent.tradeResults[2].amount).eq('333333333333333334');
      });

      it('fails on an invalid strike id', async () => {
        await expect(
          openPosition({
            amount: toBN('1'),
            optionType,
            strikeId: 69420,
          }),
        ).revertedWith('InvalidStrikeId');
      });
    });
  });
});

export async function expectActiveAndAmount(positionId: BigNumberish, amount: BigNumber) {
  const position = await hre.f.c.optionToken.getOptionPosition(positionId);
  expect(position.state).to.eq(PositionState.ACTIVE);
  expect(position.amount).to.eq(amount);
}

export async function expectRoutedFundsOnOpen6dp(
  tx: ContractTransaction,
  user: string,
  oldUserQuoteBal: BigNumber,
  oldOMBalance: BigNumber,
  collateral: BigNumber,
  optionType: OptionType,
) {
  const newUserBalance = await hre.f.c.snx.quoteAsset.balanceOf(user);
  const newOMBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.optionMarket.address);
  const funds = await getRoutedFunds6dp(tx);
  collateral = collateral.div(CONVERTUSDC);

  if (optionType == OptionType.SHORT_CALL_QUOTE || optionType == OptionType.SHORT_PUT_QUOTE) {
    expect(oldUserQuoteBal.sub(collateral).add(funds.userDiff)).to.eq(newUserBalance);
  } else if (optionType == OptionType.SHORT_CALL_BASE) {
    expect(oldUserQuoteBal.add(funds.userDiff)).to.eq(newUserBalance);
  } else {
    assertCloseToPercentage(oldUserQuoteBal.sub(funds.userDiff), newUserBalance);
  }
  // expect(newOMBalance.sub(oldOMBalance)).to.eq(funds.optionMarketDiff);
  assertCloseToPercentage(newOMBalance.sub(oldOMBalance), funds.optionMarketDiff);
}
