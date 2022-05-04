import { BigNumberish } from 'ethers';
import { DEFAULT_MIN_COLLATERAL_PARAMS } from '../defaultParams';
import { hre } from '../testSetup';

export async function resetMinCollateralParameters(overrides?: {
  minStaticQuoteCollateral?: BigNumberish;
  minStaticBaseCollateral?: BigNumberish;
  shockVolA?: BigNumberish;
  shockVolPointA?: BigNumberish;
  shockVolB?: BigNumberish;
  shockVolPointB?: BigNumberish;
  callSpotPriceShock?: BigNumberish;
  putSpotPriceShock?: BigNumberish;
}) {
  await hre.f.c.optionGreekCache.setMinCollateralParameters({
    ...DEFAULT_MIN_COLLATERAL_PARAMS,
    ...(overrides || {}),
  });
}
