import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { OptionType, toBN } from '../../../scripts/util/web3utils';
import {
  closeLongCall,
  closeLongPut,
  closeShortCallBase,
  closeShortCallQuote,
  closeShortPutQuote,
  forceCloseLongCall,
  forceCloseLongPut,
  forceCloseShortCallBase,
  forceCloseShortCallQuote,
  forceCloseShortPutQuote,
  openAllTrades,
  openDefaultLongCall,
  openDefaultLongPut,
  openDefaultShortCallBase,
  openDefaultShortCallQuote,
  openDefaultShortPutQuote,
} from '../../utils/contractHelpers';
import { DEFAULT_TRADE_LIMIT_PARAMS } from '../../utils/defaultParams';
import { fastForwardTo } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

async function checkDefaultIvAndSkew(expectedBaseIv: string, expectedSkew: string) {
  const boards = await hre.f.c.optionMarketViewer.getLiveBoards(hre.f.c.optionMarket.address);
  expect(boards[0].baseIv).eq(toBN(expectedBaseIv));
  expect(boards[0].strikes[0].skew).eq(toBN(expectedSkew));
}

describe('Cutoffs', async () => {
  // ensures slippage and reverts are functioning properly
  // actual pricing tested in optionGreekCache
  beforeEach(seedFixture);

  it('can only be called by optionMarket', async () => {
    const strikeInfo = await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId);

    await expect(
      hre.f.c.optionMarketPricer.updateCacheAndGetTradeResult(
        strikeInfo,
        hre.f.defaultTradeParametersStruct,
        hre.f.board.baseIv,
        hre.f.board.expiry,
      ),
    ).to.be.revertedWith('OnlyOptionMarket');
  });

  describe('slippage', async () => {
    let positions: BigNumberish[];
    beforeEach(async () => {
      positions = await openAllTrades();
    });

    it('normal close slip both iv and skew', async () => {
      // need to check iv and skew after each trade
      // need to test for long/short, call/puts, if the amm has more market exposure it wants to bring the iv down, we are more concerened whether it is a long or short than call and put
      await checkDefaultIvAndSkew('0.998', '0.8985');
      // Standard size of 5, iv moves by 0.2 points per option
      // skew of 0.75, so skew moves 0.15 points per option
      await closeLongCall(positions[OptionType.LONG_CALL]);
      await checkDefaultIvAndSkew('0.996', '0.8970');

      await closeLongPut(positions[OptionType.LONG_PUT]);
      await checkDefaultIvAndSkew('0.994', '0.8955');

      await closeShortCallBase(positions[OptionType.SHORT_CALL_BASE]);
      await checkDefaultIvAndSkew('0.996', '0.8970');

      await closeShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE]);
      await checkDefaultIvAndSkew('0.998', '0.8985');

      await closeShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE]);
      await checkDefaultIvAndSkew('1', '0.9');
    });

    it('force close only slip skew', async () => {
      // enable force closing anytime
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minForceCloseDelta: toBN('1'),
        // and bypasses the other chacks
        minVol: toBN('2'),
        maxVol: toBN('0.5'),
        minSkew: toBN('2'),
        maxSkew: toBN('0.5'),
        minBaseIV: toBN('2'),
        maxBaseIV: toBN('0.2'),
      });
      // need to check iv and skew after each trade
      // need to test for long/short, call/puts, if the amm has more market exposure it wants to bring the iv down, we are more concerened whether it is a long or short than call and put
      await checkDefaultIvAndSkew('0.998', '0.8985');
      // Standard size of 5, iv moves by 0.2 points per option
      // skew of 0.75, so skew moves 0.15 points per option
      await forceCloseLongCall(positions[OptionType.LONG_CALL]);
      await checkDefaultIvAndSkew('0.998', '0.8970');

      await forceCloseLongPut(positions[OptionType.LONG_PUT]);
      await checkDefaultIvAndSkew('0.998', '0.8955');

      await forceCloseShortCallBase(positions[OptionType.SHORT_CALL_BASE]);
      await checkDefaultIvAndSkew('0.998', '0.8970');

      await forceCloseShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE]);
      await checkDefaultIvAndSkew('0.998', '0.8985');

      await forceCloseShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE]);
      await checkDefaultIvAndSkew('0.998', '0.9');
    });

    it('reverts low/high skew trades', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minSkew: toBN('2'),
        maxSkew: toBN('0.5'),
      });

      await expect(closeLongCall(positions[OptionType.LONG_CALL])).revertedWith(
        'VolSkewOrBaseIvOutsideOfTradingBounds',
      );
      await expect(closeShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith(
        'VolSkewOrBaseIvOutsideOfTradingBounds',
      );

      await expect(openDefaultLongCall()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
      await expect(openDefaultShortPutQuote()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');

      if ((global as any).HEAVY_TESTS) {
        await expect(closeLongPut(positions[OptionType.LONG_PUT])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );
        await expect(closeShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );
        await expect(closeShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );

        await expect(openDefaultLongPut()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
        await expect(openDefaultShortCallBase()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
        await expect(openDefaultShortCallQuote()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
      }
    });

    it('reverts low/high baseIv trades', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minBaseIV: toBN('2'),
        maxBaseIV: toBN('0.5'),
      });

      await expect(closeLongCall(positions[OptionType.LONG_CALL])).revertedWith(
        'VolSkewOrBaseIvOutsideOfTradingBounds',
      );
      await expect(closeShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith(
        'VolSkewOrBaseIvOutsideOfTradingBounds',
      );

      await expect(openDefaultLongCall()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
      await expect(openDefaultShortPutQuote()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');

      if ((global as any).HEAVY_TESTS) {
        await expect(closeLongPut(positions[OptionType.LONG_PUT])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );
        await expect(closeShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );
        await expect(closeShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );

        await expect(openDefaultLongPut()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
        await expect(openDefaultShortCallBase()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
        await expect(openDefaultShortCallQuote()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
      }
    });

    it('reverts low/high vol trades', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minVol: toBN('2'),
        maxVol: toBN('0.5'),
      });

      await expect(closeLongCall(positions[OptionType.LONG_CALL])).revertedWith(
        'VolSkewOrBaseIvOutsideOfTradingBounds',
      );
      await expect(closeShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith(
        'VolSkewOrBaseIvOutsideOfTradingBounds',
      );

      await expect(openDefaultLongCall()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
      await expect(openDefaultShortPutQuote()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');

      if ((global as any).HEAVY_TESTS) {
        await expect(closeLongPut(positions[OptionType.LONG_PUT])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );
        await expect(closeShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );
        await expect(closeShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith(
          'VolSkewOrBaseIvOutsideOfTradingBounds',
        );

        await expect(openDefaultLongPut()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
        await expect(openDefaultShortCallBase()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
        await expect(openDefaultShortCallQuote()).revertedWith('VolSkewOrBaseIvOutsideOfTradingBounds');
      }
    });

    it('reverts outside of delta range', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minDelta: toBN('1'),
      });

      await expect(closeLongCall(positions[OptionType.LONG_CALL])).revertedWith('TradeDeltaOutOfRange');
      await expect(closeShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith('TradeDeltaOutOfRange');

      await expect(openDefaultLongCall()).revertedWith('TradeDeltaOutOfRange');
      await expect(openDefaultShortPutQuote()).revertedWith('TradeDeltaOutOfRange');

      if ((global as any).HEAVY_TESTS) {
        await expect(closeLongPut(positions[OptionType.LONG_PUT])).revertedWith('TradeDeltaOutOfRange');
        await expect(closeShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith('TradeDeltaOutOfRange');
        await expect(closeShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith('TradeDeltaOutOfRange');

        await expect(openDefaultLongPut()).revertedWith('TradeDeltaOutOfRange');
        await expect(openDefaultShortCallBase()).revertedWith('TradeDeltaOutOfRange');
        await expect(openDefaultShortCallQuote()).revertedWith('TradeDeltaOutOfRange');
      }
    });

    it('reverts trades past trading cutoff', async () => {
      await fastForwardTo(parseInt(hre.f.board.expiry.toString()) - 1000); // just before board expiry

      await expect(closeLongCall(positions[OptionType.LONG_CALL])).revertedWith('TradingCutoffReached');
      await expect(closeShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith('TradingCutoffReached');

      await expect(openDefaultLongCall()).revertedWith('TradingCutoffReached');
      await expect(openDefaultShortPutQuote()).revertedWith('TradingCutoffReached');

      if ((global as any).HEAVY_TESTS) {
        await expect(closeLongPut(positions[OptionType.LONG_PUT])).revertedWith('TradingCutoffReached');
        await expect(closeShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith('TradingCutoffReached');
        await expect(closeShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith('TradingCutoffReached');

        await expect(openDefaultLongPut()).revertedWith('TradingCutoffReached');
        await expect(openDefaultShortCallBase()).revertedWith('TradingCutoffReached');
        await expect(openDefaultShortCallQuote()).revertedWith('TradingCutoffReached');
      }
      // Can force close past cutoff
      await forceCloseLongCall(positions[OptionType.LONG_CALL]);
      await forceCloseLongPut(positions[OptionType.LONG_PUT]);
      await forceCloseShortCallBase(positions[OptionType.SHORT_CALL_BASE]);
      await forceCloseShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE]);
      await forceCloseShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE]);
    });

    it('reverts force close below absMinSkew', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        absMinSkew: toBN('2'),
        minSkew: toBN('2'),
        absMaxSkew: toBN('0.5'),
        maxSkew: toBN('0.5'),
      });

      await expect(forceCloseLongCall(positions[OptionType.LONG_CALL])).revertedWith('ForceCloseSkewOutOfRange');
      await expect(forceCloseShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith(
        'ForceCloseSkewOutOfRange',
      );
      if ((global as any).HEAVY_TESTS) {
        await expect(forceCloseLongPut(positions[OptionType.LONG_PUT])).revertedWith('ForceCloseSkewOutOfRange');
        await expect(forceCloseShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith(
          'ForceCloseSkewOutOfRange',
        );
        await expect(forceCloseShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith(
          'ForceCloseSkewOutOfRange',
        );
      }
    });

    it('reverts force close inside delta limits', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minForceCloseDelta: toBN('0'),
      });

      await expect(forceCloseLongCall(positions[OptionType.LONG_CALL])).revertedWith('ForceCloseDeltaOutOfRange');
      await expect(forceCloseShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith(
        'ForceCloseDeltaOutOfRange',
      );
      if ((global as any).HEAVY_TESTS) {
        await expect(forceCloseLongPut(positions[OptionType.LONG_PUT])).revertedWith('ForceCloseDeltaOutOfRange');
        await expect(forceCloseShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith(
          'ForceCloseDeltaOutOfRange',
        );
        await expect(forceCloseShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith(
          'ForceCloseDeltaOutOfRange',
        );
      }
    });

    it('reverts force close inside delta limits', async () => {
      await hre.f.c.optionMarketPricer.setTradeLimitParams({
        ...DEFAULT_TRADE_LIMIT_PARAMS,
        minForceCloseDelta: toBN('0'),
      });

      await expect(forceCloseLongCall(positions[OptionType.LONG_CALL])).revertedWith('ForceCloseDeltaOutOfRange');
      await expect(forceCloseShortPutQuote(positions[OptionType.SHORT_PUT_QUOTE])).revertedWith(
        'ForceCloseDeltaOutOfRange',
      );
      if ((global as any).HEAVY_TESTS) {
        await expect(forceCloseLongPut(positions[OptionType.LONG_PUT])).revertedWith('ForceCloseDeltaOutOfRange');
        await expect(forceCloseShortCallBase(positions[OptionType.SHORT_CALL_BASE])).revertedWith(
          'ForceCloseDeltaOutOfRange',
        );
        await expect(forceCloseShortCallQuote(positions[OptionType.SHORT_CALL_QUOTE])).revertedWith(
          'ForceCloseDeltaOutOfRange',
        );
      }
    });
  });

  it('caps trades at min/max abs skew', async () => {
    await hre.f.c.optionMarketPricer.setTradeLimitParams({
      ...DEFAULT_TRADE_LIMIT_PARAMS,
      absMaxSkew: toBN('0.8'),
      maxSkew: toBN('0.8'),
      capSkewsToAbs: true,
    });

    expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).skew).eq(toBN('0.9'));

    await openDefaultShortPutQuote();

    expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).skew).eq(toBN('0.8'));

    await hre.f.c.optionMarketPricer.setTradeLimitParams({
      ...DEFAULT_TRADE_LIMIT_PARAMS,
      absMinSkew: toBN('1.2'),
      minSkew: toBN('1.2'),
      capSkewsToAbs: true,
    });

    await openDefaultLongCall();

    expect((await hre.f.c.optionMarket.getStrike(hre.f.strike.strikeId)).skew).eq(toBN('1.2'));
  });
});
