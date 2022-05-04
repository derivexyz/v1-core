import { BigNumber } from 'ethers';
import * as _ from 'lodash';
import { currentTime, MONTH_SEC, OptionType, toBN, TradeDirection } from '../../../scripts/util/web3utils';
import { StrikeStruct } from '../../../typechain-types/OptionMarket';
import { TradeParametersStruct } from '../../../typechain-types/OptionToken';
import { DEFAULT_BASE_PRICE } from '../../utils/defaultParams';
import {
  deployGlobalTestContracts,
  deployMarketTestContracts,
  initGlobalTestSystem,
  initMarketTestSystem,
  TestSystemContractsType,
} from '../../utils/deployTestSystem';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('OptionGreekCache - Update Strike Exposure', () => {
  let c: TestSystemContractsType;
  let boardId: BigNumber;
  let strikeId: BigNumber;

  let strikeStruct: StrikeStruct;
  let tradeStruct: TradeParametersStruct;

  beforeEach(async () => {
    c = await deploySystemWithPricerOverride();

    const id = await createDefaultBoardWithOverrides(c, { strikePrices: ['1000'], skews: ['1'] });
    await c.optionGreekCache.updateBoardCachedGreeks(id);

    boardId = (await c.optionMarket.getLiveBoards())[0];
    strikeId = (await c.optionMarket.getBoardStrikes(boardId))[0];
    const liquidity = await c.liquidityPool.getLiquidity(DEFAULT_BASE_PRICE, c.snx.collateralShort.address);
    const exchangeParams = await c.synthetixAdapter.getExchangeParams(c.optionMarket.address);

    strikeStruct = {
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

    tradeStruct = {
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
  });

  it('succeeds if both callExposureDiff and putExposureDiff are 0', async () => {
    await c.optionGreekCache.updateStrikeExposureAndGetPrice(strikeStruct, tradeStruct, toBN('1'), toBN('1'), false);
    // Can update both
    await c.optionGreekCache.updateStrikeExposureAndGetPrice(
      { ...strikeStruct, longCall: 1, longPut: 1 },
      tradeStruct,
      toBN('1'),
      toBN('1'),
      false,
    );
  });

  it('correctly updates the call exposure of the strike, board and global caches', async () => {
    const currentStrikeCache = await c.optionGreekCache.getStrikeCache(strikeId);
    const currentBoardCache = await c.optionGreekCache.getOptionBoardCache(boardId);
    const currentGlobalCache = await c.optionGreekCache.getGlobalCache();

    await c.optionGreekCache.updateStrikeExposureAndGetPrice(
      { ...strikeStruct, longCall: toBN('1') },
      tradeStruct,
      toBN('1'),
      toBN('1'),
      false,
    );

    const updatedStrikeCache = await c.optionGreekCache.getStrikeCache(strikeId);
    const updatedBoardCache = await c.optionGreekCache.getOptionBoardCache(boardId);
    const updatedGlobalCache = await c.optionGreekCache.getGlobalCache();

    expect(updatedBoardCache.netGreeks.netStdVega).to.gt(currentBoardCache.netGreeks.netStdVega);
    expect(updatedGlobalCache.netGreeks.netStdVega).to.gt(currentGlobalCache.netGreeks.netStdVega);
    expect(updatedBoardCache.netGreeks.netDelta).to.gt(currentBoardCache.netGreeks.netDelta);
    expect(updatedGlobalCache.netGreeks.netDelta).to.gt(currentGlobalCache.netGreeks.netDelta);
    expect(updatedStrikeCache.callExposure).to.gt(currentStrikeCache.callExposure);
  });

  it('correctly updates the put exposure of the strike, board and global caches', async () => {
    const currentStrikeCache = await c.optionGreekCache.getStrikeCache(strikeId);
    const currentBoardCache = await c.optionGreekCache.getOptionBoardCache(boardId);
    const currentGlobalCache = await c.optionGreekCache.getGlobalCache();

    await c.optionGreekCache.updateStrikeExposureAndGetPrice(
      { ...strikeStruct, longPut: toBN('1') },
      tradeStruct,
      toBN('1'),
      toBN('1'),
      false,
    );

    const updatedStrikeCache = await c.optionGreekCache.getStrikeCache(strikeId);
    const updatedBoardCache = await c.optionGreekCache.getOptionBoardCache(boardId);
    const updatedGlobalCache = await c.optionGreekCache.getGlobalCache();

    expect(updatedBoardCache.netGreeks.netStdVega).to.gt(currentBoardCache.netGreeks.netStdVega);
    expect(updatedGlobalCache.netGreeks.netStdVega).to.gt(currentGlobalCache.netGreeks.netStdVega);
    expect(updatedBoardCache.netGreeks.netDelta).to.lt(currentBoardCache.netGreeks.netDelta);
    expect(updatedGlobalCache.netGreeks.netDelta).to.lt(currentGlobalCache.netGreeks.netDelta);

    expect(updatedStrikeCache.putExposure).to.gt(currentStrikeCache.putExposure);
  });
});

export async function deploySystemWithPricerOverride() {
  const globalSystem = await deployGlobalTestContracts(hre.f.deployer, false, {});
  const marketSystem = await deployMarketTestContracts(globalSystem, hre.f.deployer, 'sETH', false, {});
  const c = _.merge(globalSystem, marketSystem) as TestSystemContractsType;

  await initGlobalTestSystem(c, hre.f.deployer, {});
  await initMarketTestSystem('sETH', c, marketSystem, hre.f.deployer, { optionMarketPricer: hre.f.deployer.address });

  return c;
}
