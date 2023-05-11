import { DEFAULT_GOV_LIQUIDITY_POOL_BOUNDS, DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS } from '../../utils/defaultParams';
import { DAY_SEC, MAX_UINT, toBN } from '../../../scripts/util/web3utils';
import { allCurrenciesFixtureGMX } from '../../utils/fixture';
import { compareStruct, deployGovernanceWrappers, GovernanceWrappersTypeGMX } from './utils';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('OptionMarketPricerGovernanceWrapper', () => {
  let govWrap: GovernanceWrappersTypeGMX;
  let RC: SignerWithAddress;
  beforeEach(async () => {
    await allCurrenciesFixtureGMX();
    govWrap = await deployGovernanceWrappers(hre.f.gc, hre.f.deployer);
    RC = hre.f.alice;
    await govWrap.optionMarketPricerGov.setRiskCouncil(RC.address);
    await govWrap.optionMarketPricerGov.setOptionMarketPricerBounds(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS);
  });

  ///////////
  // Admin //
  ///////////

  it('should be able to set risk council', async () => {
    expect(await govWrap.optionMarketPricerGov.riskCouncil()).eq(hre.f.alice.address);
  });

  it('should NOT be able to set option market pricer again', async () => {
    await expect(govWrap.optionMarketPricerGov.setOptionMarketPricer(hre.f.gc.optionMarketPricer.address)).revertedWith(
      'OMPGW_OptionMarketPricerAlreadySet',
    );
  });

  it('should be able to forceChangeOwner', async () => {
    expect(await hre.f.gc.optionMarketPricer.owner()).eq(govWrap.optionMarketPricerGov.address);
    await govWrap.optionMarketPricerGov.forceChangeOwner(
      await govWrap.optionMarketPricerGov.optionMarketPricer(),
      RC.address,
    );
    expect(await hre.f.gc.optionMarketPricer.owner()).eq(govWrap.optionMarketPricerGov.address);
    expect(await hre.f.gc.optionMarketPricer.nominatedOwner()).eq(RC.address);
    await hre.f.gc.optionMarketPricer.connect(RC).acceptOwnership();
    expect(await hre.f.gc.optionMarketPricer.owner()).eq(RC.address);
  });

  ////////////
  // Params //
  ////////////

  it('can set pricing parameters', async () => {
    await govWrap.optionMarketPricerGov.setPricingParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxPricingParams);
    // can set to min and max
    await govWrap.optionMarketPricerGov
      .connect(RC)
      .setPricingParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minPricingParams);
    await govWrap.optionMarketPricerGov
      .connect(RC)
      .setPricingParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxPricingParams);
    await expect(
      govWrap.optionMarketPricerGov
        .connect(hre.f.signers[3])
        .setPricingParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxPricingParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.optionMarketPricer.getPricingParams(),
      DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxPricingParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.optionMarketPricerGov.connect(RC).setPricingParams({
        ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minPricingParams,
        standardSize: 0,
      }),
    ).revertedWith('OMPGW_PricingParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.optionMarketPricerGov.connect(RC).setPricingParams({
        ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxPricingParams,
        standardSize: MAX_UINT,
      }),
    ).revertedWith('OMPGW_PricingParamsOutOfBounds');

    // owner can bypass
    await govWrap.optionMarketPricerGov.setPricingParams({
      ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxPricingParams,
      standardSize: MAX_UINT,
    });
  });

  it('can set trade limit parameters', async () => {
    await govWrap.optionMarketPricerGov.setTradeLimitParams(
      DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxTradeLimitParams,
    );
    await govWrap.optionMarketPricerGov
      .connect(RC)
      .setTradeLimitParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minTradeLimitParams);
    await govWrap.optionMarketPricerGov
      .connect(RC)
      .setTradeLimitParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxTradeLimitParams);

    await expect(
      govWrap.optionMarketPricerGov
        .connect(hre.f.signers[3])
        .setTradeLimitParams(DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minTradeLimitParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(
      await hre.f.gc.optionGreekCache.getForceCloseParams(),
      DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxTradeLimitParams,
    );

    // reverts if lower than min
    await expect(
      govWrap.optionMarketPricerGov.connect(RC).setTradeLimitParams({
        ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minTradeLimitParams,
        tradingCutoff: DAY_SEC / 10,
      }),
    ).revertedWith('OMPGW_TradeLimitParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.optionMarketPricerGov.connect(RC).setTradeLimitParams({
        ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxTradeLimitParams,
        maxSkew: MAX_UINT,
      }),
    ).revertedWith('OMPGW_TradeLimitParamsOutOfBounds');

    // owner can bypass bounds
    await govWrap.optionMarketPricerGov.setTradeLimitParams({
      ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minTradeLimitParams,
      tradingCutoff: DAY_SEC / 10,
    });
  });

  it('can set variance fee', async () => {
    const testBounds = {
      ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS,
      minVarianceFeeParams: {
        ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.minVarianceFeeParams,
        forceCloseVarianceFeeCoefficient: toBN('0.01'),
      },
      maxVarianceFeeParams: {
        ...DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxVarianceFeeParams,
        forceCloseVarianceFeeCoefficient: toBN('99'),
      },
    };
    await govWrap.optionMarketPricerGov.setOptionMarketPricerBounds(testBounds);
    await govWrap.optionMarketPricerGov.setVarianceFeeParams(
      DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS.maxVarianceFeeParams,
    );
    await govWrap.optionMarketPricerGov.connect(RC).setVarianceFeeParams(testBounds.minVarianceFeeParams);
    await govWrap.optionMarketPricerGov.connect(RC).setVarianceFeeParams(testBounds.maxVarianceFeeParams);

    await expect(
      govWrap.optionMarketPricerGov.connect(hre.f.signers[3]).setVarianceFeeParams(testBounds.minVarianceFeeParams),
    ).revertedWith('BGW_OnlyOwnerOrRiskCouncil');

    compareStruct(await hre.f.gc.optionGreekCache.getMinCollatParams(), testBounds.maxVarianceFeeParams);

    // reverts if lower than min
    await expect(
      govWrap.optionMarketPricerGov.connect(RC).setVarianceFeeParams({
        ...testBounds.minVarianceFeeParams,
        forceCloseVarianceFeeCoefficient: toBN('0.0001'),
      }),
    ).revertedWith('OMPGW_VarianceFeeParamsOutOfBounds');

    // reverts if higher than max
    await expect(
      govWrap.optionMarketPricerGov.connect(RC).setVarianceFeeParams({
        ...testBounds.maxVarianceFeeParams,
        forceCloseVarianceFeeCoefficient: toBN('100'),
      }),
    ).revertedWith('OMPGW_VarianceFeeParamsOutOfBounds');

    // owner can bypass bounds
    await govWrap.optionMarketPricerGov.setVarianceFeeParams({
      ...testBounds.minVarianceFeeParams,
      forceCloseVarianceFeeCoefficient: toBN('0.0001'),
    });
  });

  it('should be able to get option market pricer bounds', async () => {
    compareStruct(
      await govWrap.optionMarketPricerGov.getOptionMarketPricerBounds(),
      DEFAULT_GOV_OPTION_MARKET_PRICER_BOUNDS,
    );
  });
});
