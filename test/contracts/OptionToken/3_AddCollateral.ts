// integration tests
import { BigNumberish } from '@ethersproject/bignumber';
import { MAX_UINT, MONTH_SEC, OptionType, toBN } from '../../../scripts/util/web3utils';
import { closePositionWithOverrides, openPositionWithOverrides } from '../../utils/contractHelpers';
import { DEFAULT_TRADE_LIMIT_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { mockPrice, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { expectLiquidatable } from './5_MinCollateral';

describe('OptionToken - AddCollateral', async () => {
  const shortTypes = [OptionType.SHORT_CALL_BASE, OptionType.SHORT_CALL_QUOTE, OptionType.SHORT_PUT_QUOTE];
  const liqPrices = [toBN('5000'), toBN('5000'), toBN('500')];

  const aboveMin: any = {
    SHORT_CALL_BASE: toBN('0.5'),
    SHORT_CALL_QUOTE: toBN('1000'),
    SHORT_PUT_QUOTE: toBN('750'),
  };

  const overflowCollat = [MAX_UINT.sub(toBN('1')), MAX_UINT.sub(toBN('2000')), MAX_UINT.sub(toBN('1500'))];
  const beyondBalanceCollat = [toBN('1001'), toBN('100001'), toBN('100001')];

  let DEFAULT_PARAM: any;
  let longPositionId: any;
  beforeEach(async () => {
    await seedFixture();
    await hre.f.c.optionMarketPricer.setTradeLimitParams({ ...DEFAULT_TRADE_LIMIT_PARAMS, minDelta: 0 });
    DEFAULT_PARAM = {
      positionId: 0,
      amount: toBN('1'),
      strikeId: hre.f.strike.strikeId,
    };

    await seedBalanceAndApprovalFor(hre.f.alice, hre.f.c, toBN('100000'), toBN('1000'));

    // open one long
    longPositionId = (
      await openPositionWithOverrides(hre.f.c, {
        ...DEFAULT_PARAM,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      })
    )[1];
  });

  shortTypes.forEach(async (shortType, i) => {
    describe('successful addition: ' + OptionType[shortType], async () => {
      it('adds collateral to non-owner position', async () => {
        const [, positionId] = await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          optionType: shortType,
          setCollateralTo: aboveMin[OptionType[shortType]],
        });

        const oldBal = await getTradedAsset(shortType).balanceOf(hre.f.alice.address);
        await hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(positionId, aboveMin[OptionType[shortType]]);

        const position = await hre.f.c.optionToken.getOptionPosition(positionId);
        expect(position.collateral).to.eq(aboveMin[OptionType[shortType]].mul(2));
        expect(position.amount).to.eq(toBN('1'));
        const newBal = await getTradedAsset(shortType).balanceOf(hre.f.alice.address);
        expect(oldBal.sub(newBal)).to.eq(aboveMin[OptionType[shortType]]);
      });

      it('adds collateral to liquidatable position', async () => {
        const [, positionId] = await openPositionWithOverrides(hre.f.c, {
          ...DEFAULT_PARAM,
          optionType: shortType,
          setCollateralTo: aboveMin[OptionType[shortType]],
        });

        await mockPrice(hre.f.c, liqPrices[i], 'sETH');
        await expectLiquidatable(positionId);

        const oldBal = await getTradedAsset(shortType).balanceOf(hre.f.alice.address);
        await hre.f.c.optionMarket
          .connect(hre.f.alice)
          .addCollateral(positionId, aboveMin[OptionType[shortType]].div(10));

        await expectLiquidatable(positionId);
        const position = await hre.f.c.optionToken.getOptionPosition(positionId);
        expect(position.collateral).to.eq(aboveMin[OptionType[shortType]].mul(11).div(10));
        expect(position.amount).to.eq(toBN('1'));
        const newBal = await getTradedAsset(shortType).balanceOf(hre.f.alice.address);
        expect(oldBal.sub(newBal)).to.eq(aboveMin[OptionType[shortType]].div(10));
      });
    });
  });

  shortTypes.forEach(async (shortType, i) => {
    let positionId: BigNumberish;
    beforeEach(async () => {
      [, positionId] = await openPositionWithOverrides(hre.f.c, {
        ...DEFAULT_PARAM,
        optionType: shortType,
        setCollateralTo: aboveMin[OptionType[shortType]],
      });
    });
    describe('general reverts: ' + OptionType[shortType], async () => {
      it('positionId zero', async () => {
        await expect(
          hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(0, aboveMin[OptionType[shortType]]),
        ).to.revertedWith('AddingCollateralToInvalidPosition');
      });

      it('not enough funds', async () => {
        await expect(
          hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(positionId, beyondBalanceCollat[i]),
        ).to.revertedWith('ERC20: transfer amount exceeds balance');
      });

      it('global pause', async () => {
        await hre.f.c.synthetixAdapter.setGlobalPaused(true);
        await expect(
          hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(positionId, beyondBalanceCollat[i]),
        ).to.revertedWith('AllMarketsPaused');
      });

      it('closed position', async () => {
        // fully close
        await hre.f.c.optionMarketPricer.setTradeLimitParams({
          ...DEFAULT_TRADE_LIMIT_PARAMS,
          absMaxSkew: toBN('9'),
          maxSkew: toBN('9'),
          maxVol: MAX_UINT,
          maxBaseIV: toBN('50'),
        });
        await closePositionWithOverrides(hre.f.c, {
          positionId: positionId,
          strikeId: hre.f.strike.strikeId,
          optionType: shortType,
          amount: toBN('1'),
        });

        await expect(
          hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(positionId, beyondBalanceCollat[i]),
        ).to.revertedWith('AddingCollateralToInvalidPosition');
      });

      it('settled position', async () => {
        // fully close
        await fastForward(MONTH_SEC);
        await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
        await hre.f.c.shortCollateral.settleOptions([positionId]);

        await expect(
          hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(positionId, beyondBalanceCollat[i]),
        ).to.revertedWith('AddingCollateralToInvalidPosition');
      });

      it('add to long position', async () => {
        await expect(
          hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(longPositionId, beyondBalanceCollat[i]),
        ).to.revertedWith('AddingCollateralToInvalidPosition');
      });
    });
  });

  // from IOSORO audit: https://gist.github.com/AshiqAmien/3929f6748b051707246494492001f789
  shortTypes.forEach(async (shortType, i) => {
    it('reverts if pendingCollateral overflows: ' + OptionType[shortType], async () => {
      const tradeAsset = getTradedAsset(shortType);

      // open other shorts that attacker will attempt to steal
      await openPositionWithOverrides(hre.f.c, {
        ...DEFAULT_PARAM,
        optionType: shortType,
        setCollateralTo: aboveMin[OptionType[shortType]].mul(100),
      });

      // STEP 1: open small short position
      const [, positionId] = await openPositionWithOverrides(hre.f.c, {
        ...DEFAULT_PARAM,
        optionType: shortType,
        setCollateralTo: aboveMin[OptionType[shortType]],
      });

      const oldAttackerBal = await tradeAsset.balanceOf(hre.f.alice.address);

      // STEP 2: attacker adds collateral to their position attempting to overflow casting of int(uint pendingCollateral) in routeUserFunds
      // amountCollateral + existingCollateral must be (1) < uint.max (2) > int.max (3) < balanceOf(shortCollateral.address)
      await expect(
        hre.f.c.optionMarket.connect(hre.f.alice).addCollateral(positionId, overflowCollat[i]),
      ).to.revertedWith("SafeCast: value doesn't fit in an int256");
      expect(await tradeAsset.balanceOf(hre.f.alice.address)).to.eq(oldAttackerBal);
    });
  });
});

export function getTradedAsset(optionType: OptionType) {
  let tradeAsset = hre.f.c.snx.quoteAsset;
  if (optionType == OptionType.SHORT_CALL_BASE) {
    tradeAsset = hre.f.c.snx.baseAsset;
  }
  return tradeAsset;
}
