import { ethers } from 'hardhat';
import { beforeEach } from 'mocha';
import {
  currentTime,
  DAY_SEC,
  fromBN,
  HOUR_SEC,
  OptionType,
  toBN,
  UNIT,
  WEEK_SEC,
} from '../../../scripts/util/web3utils';
import { TestBlackScholes } from '../../../typechain-types';
import { BlackScholesInputsStruct } from '../../../typechain-types/BlackScholes';
import { assertCloseToPercentage } from '../../utils/assert';
import { getSpotPrice, openPosition } from '../../utils/contractHelpers';
import { DEFAULT_RATE_AND_CARRY } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { mockPrice } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';

describe('GWAV Oracle', async () => {
  let testBlackScholes: TestBlackScholes;

  beforeEach(seedFixture);

  beforeEach(async () => {
    testBlackScholes = (await (
      await ethers.getContractFactory('TestBlackScholes', {
        libraries: {
          BlackScholes: hre.f.c.blackScholes.address,
        },
      })
    )
      .connect(hre.f.deployer)
      .deploy()) as TestBlackScholes;

    await openPosition({
      strikeId: 1,
      optionType: OptionType.LONG_CALL,
      amount: toBN('10'),
    });
  });
  it('skew/iv/vol GWAV returns same val as greekCache', async () => {
    await compareVolsWithGreekCache(HOUR_SEC);

    await fastForward(HOUR_SEC);
    await compareVolsWithGreekCache(HOUR_SEC);

    await mockPrice(hre.f.c, toBN('3000'), 'sETH');
    await compareVolsWithGreekCache(HOUR_SEC);

    await fastForward(HOUR_SEC);
    await compareVolsWithGreekCache(HOUR_SEC);

    await fastForward(WEEK_SEC);
    await compareVolsWithGreekCache(DAY_SEC);
  });

  it('delta/vega GWAV returns same val as greekCache', async () => {
    await compareDeltaVegaWithGreekCache(DAY_SEC, testBlackScholes);

    await fastForward(DAY_SEC);
    await compareDeltaVegaWithGreekCache(DAY_SEC, testBlackScholes);

    await mockPrice(hre.f.c, toBN('1000'), 'sETH');
    await compareDeltaVegaWithGreekCache(DAY_SEC, testBlackScholes);

    await fastForward(DAY_SEC);
    await compareDeltaVegaWithGreekCache(DAY_SEC, testBlackScholes);

    await fastForward(HOUR_SEC);
    await compareDeltaVegaWithGreekCache(WEEK_SEC, testBlackScholes);
  });

  it('can get call/put gwav prices', async () => {
    let [call, put] = await hre.f.c.GWAVOracle.optionPriceGWAV(1, DAY_SEC);
    expect(+(+fromBN(call)).toFixed(1)).to.eq(313.6);
    expect(+(+fromBN(put)).toFixed(1)).to.eq(65.9);

    await fastForward(WEEK_SEC);

    [call, put] = await hre.f.c.GWAVOracle.optionPriceGWAV(1, WEEK_SEC);
    expect(+(+fromBN(call)).toFixed(1)).to.eq(299.4);
    expect(+(+fromBN(put)).toFixed(1)).to.eq(53.1);
  });
});

export async function compareVolsWithGreekCache(secondsAgo: number) {
  const ivGWAV = await hre.f.c.GWAVOracle.ivGWAV(1, secondsAgo);
  const skewGWAV = await hre.f.c.GWAVOracle.skewGWAV(1, secondsAgo);
  const volGWAV = await hre.f.c.GWAVOracle.volGWAV(1, secondsAgo);

  const cacheIv = await hre.f.c.optionGreekCache.getIvGWAV(1, secondsAgo);
  const cacheSkew = await hre.f.c.optionGreekCache.getSkewGWAV(1, secondsAgo);
  expect(ivGWAV).to.be.eq(cacheIv);
  expect(skewGWAV).to.be.eq(cacheSkew);
  expect(volGWAV).to.be.eq(ivGWAV.mul(skewGWAV).div(UNIT));
}

export async function compareDeltaVegaWithGreekCache(secondsAgo: number, blackScholes: TestBlackScholes) {
  const cacheIv = await hre.f.c.optionGreekCache.getIvGWAV(1, secondsAgo);
  const cacheSkew = await hre.f.c.optionGreekCache.getSkewGWAV(1, secondsAgo);

  const callDeltaGWAV = await hre.f.c.GWAVOracle.deltaGWAV(1, secondsAgo);
  const vegaGWAV = await hre.f.c.GWAVOracle.vegaGWAV(1, secondsAgo);

  const [strike, board] = await hre.f.c.optionMarket.getStrikeAndBoard(1);
  const spotPrice = await getSpotPrice();
  const bsInput: BlackScholesInputsStruct = {
    timeToExpirySec: board.expiry.sub(await currentTime()),
    volatilityDecimal: cacheIv.mul(cacheSkew).div(UNIT),
    spotDecimal: spotPrice,
    strikePriceDecimal: strike.strikePrice,
    rateDecimal: DEFAULT_RATE_AND_CARRY,
  };
  const [callDeltaReal] = await blackScholes.delta_pub(bsInput);
  const vegaReal = await blackScholes.vega_pub(bsInput);

  assertCloseToPercentage(callDeltaGWAV, callDeltaReal, toBN('0.001'));
  assertCloseToPercentage(vegaGWAV, vegaReal, toBN('0.001'));
}
