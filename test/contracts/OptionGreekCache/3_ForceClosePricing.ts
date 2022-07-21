import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import {
  currentTime,
  MONTH_SEC,
  OptionType,
  toBN,
  TradeDirection,
  UNIT,
  WEEK_SEC,
} from '../../../scripts/util/web3utils';
import { TestBlackScholes } from '../../../typechain-types';
import { ExchangeParamsStruct, LiquidityStruct } from '../../../typechain-types/LiquidityPool';
import { StrikeStruct } from '../../../typechain-types/OptionGreekCache';
import { TradeParametersStruct } from '../../../typechain-types/OptionToken';
import { ALL_TYPES, getSpotPrice } from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_BOARD_PARAMS,
  DEFAULT_FORCE_CLOSE_PARAMS,
  DEFAULT_GREEK_CACHE_PARAMS,
} from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides, mockPrice } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionGreekCache - Pricing', () => {
  let boardId: BigNumber;
  let strikeId: BigNumber;
  let strikeStruct: StrikeStruct;
  let tradeStruct: TradeParametersStruct;
  let testBlackScholes: TestBlackScholes;

  describe('getPriceForForceClose', () => {
    beforeEach(async () => {
      await seedFixture();
      testBlackScholes = await deployTestBS();

      const id = await createDefaultBoardWithOverrides(hre.f.c, { strikePrices: ['1000'], skews: ['1'] });
      await mockPrice(hre.f.c, toBN('1000'), 'sETH');
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(id);

      boardId = id;
      strikeId = (await hre.f.c.optionMarket.getBoardStrikes(boardId))[0];

      const liquidity = await hre.f.c.liquidityPool.getLiquidity(DEFAULT_BASE_PRICE);
      const exchangeParams = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);

      [strikeStruct, tradeStruct] = await getDefaults(strikeId, boardId, exchangeParams, liquidity);
    });

    const preCutoffVolShock = [
      DEFAULT_FORCE_CLOSE_PARAMS.longVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.shortVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.shortVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.longVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.shortVolShock,
    ];
    const postCutoffVolShock = [
      DEFAULT_FORCE_CLOSE_PARAMS.longPostCutoffVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.shortPostCutoffVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.shortPostCutoffVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.longPostCutoffVolShock,
      DEFAULT_FORCE_CLOSE_PARAMS.shortPostCutoffVolShock,
    ];

    const isCall = [true, true, true, false, false];

    const isBuy = [false, true, true, false, true];
    const nonOverrideVol = [toBN('1.5'), toBN('0.5'), toBN('0.5'), toBN('1.5'), toBN('0.5')];
    const overrideVol = [toBN('0.5'), toBN('1.5'), toBN('1.5'), toBN('0.5'), toBN('1.5')];
    const OTM = [toBN('0'), toBN('1'), toBN('1'), toBN('0'), toBN('100000')];
    const ITM = [toBN('0'), toBN('1000000'), toBN('1000000'), toBN('0'), toBN('1')];

    ALL_TYPES.forEach(async (optionType, i) => {
      describe(`calculates optionPrice and forceCloseVol: ${OptionType[optionType]}`, async () => {
        it('on close: pre cutoff', async () => {
          const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
            {
              ...tradeStruct,
              isBuy: isBuy[i],
              tradeDirection: TradeDirection.CLOSE,
              optionType: optionType,
            },
            strikeStruct,
            tradeStruct.expiry,
            nonOverrideVol[i],
            false,
          );

          const expectedVol = (await getGWAVVol(boardId, strikeId)).mul(preCutoffVolShock[i]).div(UNIT);
          expect(expectedVol).to.eq(forceCloseVol);

          const expectedPrice = await calcPriceWithParity(
            testBlackScholes,
            expectedVol,
            strikeStruct,
            isBuy[i],
            isCall[i],
            true,
          );
          expect(expectedPrice).to.eq(price);
        });
        it('on close: post cutoff', async () => {
          const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
            {
              ...tradeStruct,
              isBuy: isBuy[i],
              tradeDirection: TradeDirection.CLOSE,
              optionType: optionType,
            },
            strikeStruct,
            tradeStruct.expiry,
            nonOverrideVol[i],
            true,
          );

          const expectedVol = (await getGWAVVol(boardId, strikeId)).mul(postCutoffVolShock[i]).div(UNIT);
          expect(expectedVol).to.eq(forceCloseVol);

          const expectedPrice = await calcPriceWithParity(
            testBlackScholes,
            expectedVol,
            strikeStruct,
            isBuy[i],
            isCall[i],
            true,
          );
          expect(expectedPrice).to.eq(price);
        });

        it('on close: override vol with new vol', async () => {
          const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
            {
              ...tradeStruct,
              isBuy: isBuy[i],
              tradeDirection: TradeDirection.CLOSE,
              optionType: optionType,
            },
            strikeStruct,
            tradeStruct.expiry,
            overrideVol[i],
            false,
          );

          const expectedVol = overrideVol[i].mul(preCutoffVolShock[i]).div(UNIT);
          expect(expectedVol).to.eq(forceCloseVol);

          const expectedPrice = await calcPriceWithParity(
            testBlackScholes,
            expectedVol,
            strikeStruct,
            isBuy[i],
            isCall[i],
            true,
          );
          expect(expectedPrice).to.eq(price);
        });
        it('on close: extreme ITM (override price with shocked parity)', async () => {
          if (isBuy[i]) {
            await mockPrice(hre.f.c, ITM[i], 'sETH');
            const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
              {
                ...tradeStruct,
                isBuy: isBuy[i],
                tradeDirection: TradeDirection.CLOSE,
                optionType: optionType,
                exchangeParams: await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address),
              },
              strikeStruct,
              tradeStruct.expiry,
              nonOverrideVol[i],
              false,
            );

            const expectedVol = (await getGWAVVol(boardId, strikeId)).mul(preCutoffVolShock[i]).div(UNIT);
            expect(expectedVol).to.eq(forceCloseVol);

            const expectedPrice = await calcPriceWithParity(
              testBlackScholes,
              expectedVol,
              strikeStruct,
              isBuy[i],
              isCall[i],
              true,
            );
            expect(expectedPrice).to.eq(price);
          }
        });

        it('on close: extreme OTM (override price with shocked parity)', async () => {
          if (isBuy[i]) {
            await mockPrice(hre.f.c, OTM[i], 'sETH');
            await fastForward(2 * WEEK_SEC);
            const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
              {
                ...tradeStruct,
                isBuy: isBuy[i],
                tradeDirection: TradeDirection.CLOSE,
                optionType: optionType,
                exchangeParams: await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address),
              },
              strikeStruct,
              tradeStruct.expiry,
              nonOverrideVol[i],
              false,
            );

            const expectedVol = (await getGWAVVol(boardId, strikeId)).mul(preCutoffVolShock[i]).div(UNIT);
            expect(expectedVol).to.eq(forceCloseVol);

            const expectedPrice = await calcPriceWithParity(
              testBlackScholes,
              expectedVol,
              strikeStruct,
              isBuy[i],
              isCall[i],
              true,
            );
            expect(expectedPrice).to.eq(price);
          }
        });

        it('on liquidation: pre cutoff', async () => {
          if (isBuy[i]) {
            const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
              {
                ...tradeStruct,
                isBuy: isBuy[i],
                tradeDirection: TradeDirection.LIQUIDATE,
                optionType: optionType,
              },
              strikeStruct,
              tradeStruct.expiry,
              overrideVol[i], // should not override during liquidation
              false,
            );

            const expectedVol = (await getGWAVVol(boardId, strikeId))
              .mul(DEFAULT_FORCE_CLOSE_PARAMS.liquidateVolShock)
              .div(UNIT);
            expect(expectedVol).to.eq(forceCloseVol);

            const expectedPrice = await calcPriceWithParity(
              testBlackScholes,
              expectedVol,
              strikeStruct,
              isBuy[i],
              isCall[i],
              true,
            );
            expect(expectedPrice).to.eq(price);
          }
        });

        it('on liquidation: post cutoff', async () => {
          if (isBuy[i]) {
            const [price, forceCloseVol] = await hre.f.c.optionGreekCache.getPriceForForceClose(
              {
                ...tradeStruct,
                isBuy: isBuy[i],
                tradeDirection: TradeDirection.LIQUIDATE,
                optionType: optionType,
              },
              strikeStruct,
              tradeStruct.expiry,
              overrideVol[i], // should not override during liquidation
              true,
            );

            const expectedVol = (await getGWAVVol(boardId, strikeId))
              .mul(DEFAULT_FORCE_CLOSE_PARAMS.liquidatePostCutoffVolShock)
              .div(UNIT);
            expect(expectedVol).to.eq(forceCloseVol);

            const expectedPrice = await calcPriceWithParity(
              testBlackScholes,
              expectedVol,
              strikeStruct,
              isBuy[i],
              isCall[i],
              true,
            );
            expect(expectedPrice).to.eq(price);
          }
        });
      });
    });
  });
});

async function getGWAVVol(boardId: BigNumberish, strikeId: BigNumberish) {
  const ivGWAV = await hre.f.c.optionGreekCache.getIvGWAV(boardId, DEFAULT_GREEK_CACHE_PARAMS.varianceIvGWAVPeriod);
  const skewGWAV = await hre.f.c.optionGreekCache.getSkewGWAV(
    strikeId,
    DEFAULT_GREEK_CACHE_PARAMS.varianceSkewGWAVPeriod,
  );

  return ivGWAV.mul(skewGWAV).div(UNIT);
}

async function calcPriceWithParity(
  testBlackScholes: TestBlackScholes,
  vol: BigNumber,
  strike: StrikeStruct,
  isBuy: boolean,
  isCall: boolean,
  isClose: boolean,
) {
  const premiums = await testBlackScholes.optionPrices_pub({
    rateDecimal: DEFAULT_GREEK_CACHE_PARAMS.rateAndCarry,
    spotDecimal: await getSpotPrice(),
    strikePriceDecimal: strike.strikePrice,
    timeToExpirySec: DEFAULT_BOARD_PARAMS.expiresIn,
    volatilityDecimal: vol,
  });

  let purePremium;
  let diff;
  if (isCall) {
    purePremium = premiums[0];
    diff = (await getSpotPrice()).sub(strike.strikePrice);
  } else {
    purePremium = premiums[1];
    diff = (strike.strikePrice as BigNumber).sub(await getSpotPrice()) as BigNumber;
  }
  let parity = diff.gt(0) ? diff : toBN('0');

  if (isBuy) {
    parity = await addToParity(parity, isClose);

    if (purePremium.gt(parity)) {
      return purePremium;
    } else {
      console.log('overridden with minPrice');
      return parity;
    }
  } else {
    return purePremium;
  }
}

async function addToParity(parity: BigNumber, isClose: boolean) {
  if (isClose) {
    return parity.add((await getSpotPrice()).mul(DEFAULT_FORCE_CLOSE_PARAMS.shortSpotMin).div(UNIT));
  } else {
    return parity.add((await getSpotPrice()).mul(DEFAULT_FORCE_CLOSE_PARAMS.liquidateSpotMin).div(UNIT));
  }
}

async function getDefaults(
  strikeId: BigNumberish,
  boardId: BigNumberish,
  exchangeParams: ExchangeParamsStruct,
  liquidity: LiquidityStruct,
): Promise<[StrikeStruct, TradeParametersStruct]> {
  const strikeStruct = {
    id: strikeId,
    strikePrice: toBN('1000'),
    skew: toBN('1'),
    longCall: 0,
    shortCallQuote: 0,
    shortCallBase: 0,
    longPut: 0,
    shortPut: 0,
    boardId: boardId,
  };

  const tradeStruct = {
    amount: toBN('1'),
    exchangeParams,
    expiry: (await currentTime()) + MONTH_SEC,
    isBuy: true,
    liquidity,
    strikePrice: toBN('1000'),
    tradeDirection: TradeDirection.OPEN,
    optionType: OptionType.LONG_CALL,
    isForceClose: false,
  };

  return [strikeStruct, tradeStruct];
}

export async function deployTestBS() {
  const blackScholes = await (await ethers.getContractFactory('BlackScholes')).connect(hre.f.deployer).deploy();
  const testBlackScholes = (await (
    await ethers.getContractFactory('TestBlackScholes', {
      libraries: {
        BlackScholes: blackScholes.address,
      },
    })
  )
    .connect(hre.f.deployer)
    .deploy()) as TestBlackScholes;
  return testBlackScholes;
}
