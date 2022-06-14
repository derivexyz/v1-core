import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { beforeEach } from 'mocha';
import { DAY_SEC, OptionType, toBN, UNIT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { TestShortPoolHedger } from '../../../typechain-types';
import { LiquidityStructOutput } from '../../../typechain-types/LiquidityPool';
import { assertCloseToPercentage } from '../../utils/assert';
import {
  getLiquidity,
  getSpotPrice,
  mockPrice,
  openPositionWithOverrides,
  setNegativeExpectedHedge,
} from '../../utils/contractHelpers';
import {
  DEFAULT_BASE_PRICE,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_PRICING_PARAMS,
  DEFAULT_SHORT_BUFFER,
} from '../../utils/defaultParams';
import { TestSystemContractsType } from '../../utils/deployTestSystem';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides, seedBalanceAndApprovalFor } from '../../utils/seedTestSystem';
import { expect, hre } from '../../utils/testSetup';
import { fillLiquidityWithWithdrawal } from '../ShortCollateral/3_Reclaim';

// Unit test with external wrapper
// Top-Level: collateral to short ratios
// Sub-Level: target scenarios
//      desiredShort is zero:
//      desiredShort > shortBalance
//      desiredShort > shortBalance & freeLiquidity not enough:
//      desiredShort < shortBalance
//      desiredShort > shortBalance & freeLiquidity not enough:
//      freeLiquidity is zero:
// Some scenarios can double up for different collateral cases, some might not be required
describe('setShortTo', async () => {
  let testPoolHedger: TestShortPoolHedger;

  beforeEach(async () => {
    await seedFixture();
    testPoolHedger = (await (await ethers.getContractFactory('TestShortPoolHedger'))
      .connect(hre.f.signers[0])
      .deploy()) as TestShortPoolHedger;
    await testPoolHedger.init(
      hre.f.c.synthetixAdapter.address,
      hre.f.c.optionMarket.address,
      hre.f.c.optionGreekCache.address,
      hre.f.c.liquidityPool.address,
      hre.f.c.snx.quoteAsset.address,
      hre.f.c.snx.baseAsset.address,
    );
    await testPoolHedger.setPoolHedgerParams(DEFAULT_POOL_HEDGER_PARAMS);
    await testPoolHedger.setShortBuffer(DEFAULT_SHORT_BUFFER);

    await hre.f.c.liquidityPool.setPoolHedger(testPoolHedger.address);
    await testPoolHedger.openShortAccount();
    await testPoolHedger.hedgeDelta();
  });

  // for each "it" check
  //      expect(correct balanceOf LP)
  //      expect(correct balanceOf PoolHedger)
  //      expect(correct shortBalance/shortCollateral using getShortPosition)
  //      expect(correct currentHedgeDelta using getCurrentHedgedNetDelta())

  describe('from 0 : 0 (collateral : short)', async () => {
    it('desiredShort is zero: no change', async () => {
      await testPoolHedger.setShortToExt(await getSpotPrice(), 0, 0, 0);

      await expectShortChange(testPoolHedger, toBN('0'), toBN('0'));
    });
    it('desiredShort > shortBalance: increases short/collateral', async () => {
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('10'), toBN('5'), toBN('0'));

      const bufferCollat = await estimateBufferCollat(toBN('10'));
      await expectShortChange(testPoolHedger, toBN('5'), bufferCollat);
    });
    it('desiredShort > shortBalance & pendingLiquidity not enough & not enough to repay with collateral: reverts', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('1700'), toBN('100000'));

      // setShortTo
      // const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;
      await expect(
        testPoolHedger.setShortToExt(await getSpotPrice(), toBN('50'), toBN('10'), toBN('0')),
      ).to.revertedWith('reverted with panic code 0x11');

      const result = await testPoolHedger.getShortPosition();
      expect(result.shortBalance).to.eq(toBN('0'));
    });

    it('desiredShort > shortBalance & pendingLiquidity not enough: increases short to maxPossibleShort', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('1700'), toBN('100000'));

      // setShortTo
      const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('50'), toBN('0'), toBN('0'));

      const result = await testPoolHedger.getShortPosition();
      assertCloseToPercentage(result.shortBalance, toBN('1.02'), toBN('0.01'));
      assertCloseToPercentage(result.collateral, pendingLiq, toBN('0.01'));
    });

    it('freeLiquidity is zero but pendingLiq enough: fully executes hedges', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('10000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('100'), toBN('10000'));

      // setShortTo
      await fillLiquidityWithWithdrawal();
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('50'), toBN('0'), toBN('0'));

      const bufferCollat = await estimateBufferCollat(toBN('50'));
      await expectShortChange(testPoolHedger, toBN('50'), bufferCollat);
    });
  });

  describe('from 1 : 0 (collateral : short)', async () => {
    beforeEach(async () => {
      // setting collateral to 10,000 and short to 0
      await hre.f.c.snx.collateralShort.deposit(ZERO_ADDRESS, await testPoolHedger.shortId(), toBN('10000'));
      await expectShortChange(testPoolHedger, toBN('0'), toBN('10000'));
    });
    it('desiredShort is zero: removes all collateral', async () => {
      await testPoolHedger.setShortToExt(await getSpotPrice(), 0, 0, toBN('10000'));

      await expectShortChange(testPoolHedger, toBN('0'), toBN('0'));
    });
    it('desiredShort > shortBalance: increases short/decreases collateral', async () => {
      const bufferCollat = await estimateBufferCollat(toBN('1'));
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('1'), toBN('0'), toBN('10000'));
      await expectShortChange(testPoolHedger, toBN('1'), bufferCollat);
    });
    it('desiredShort > shortBalance: increases short/collateral', async () => {
      const bufferCollat = await estimateBufferCollat(toBN('50'));
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('50'), toBN('0'), toBN('10000'));
      await expectShortChange(testPoolHedger, toBN('50'), bufferCollat);
    });
    it('desiredShort > shortBalance & pendingLiquidity not enough: increases short to maxPossibleShort', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('1700'), toBN('100000'));
      const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;

      // perform hedge
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('10'), toBN('0'), toBN('10000'));
      const result = await testPoolHedger.getShortPosition();
      assertCloseToPercentage(result.shortBalance, toBN('3.8875'), toBN('0.01'));
      assertCloseToPercentage(result.collateral, pendingLiq.add(toBN('10000')), toBN('0.01'));
    });
  });

  describe('from 2 : 1 (collateral : short)', async () => {
    let initialShort: BigNumber;
    let initialCollat: BigNumber;
    beforeEach(async () => {
      await setNegativeExpectedHedge(toBN('10'), toBN('10000'));
      await testPoolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      initialShort = toBN('7.703301915886900000');
      initialCollat = toBN('26838.509861243190415706');
      await expectShortChange(testPoolHedger, initialShort, initialCollat);
    });
    it('desiredShort is zero: removes all collateral/short', async () => {
      await testPoolHedger.setShortToExt(await getSpotPrice(), 0, initialShort, initialCollat);
      await expectShortChange(testPoolHedger, toBN('0'), toBN('0'));
    });
    it('desiredShort > shortBalance: increases short/decreases collateral', async () => {
      // decrease short buffer
      await testPoolHedger.setShortBuffer(toBN('1'));

      await testPoolHedger.setShortToExt(
        await getSpotPrice(),
        initialShort.add(toBN('1')),
        initialShort,
        initialCollat,
      );
      await expectShortChange(testPoolHedger, initialShort.add(toBN('1')), toBN('15161.268'));
    });
    it('desiredShort > shortBalance: increases short/collateral', async () => {
      await testPoolHedger.setShortToExt(
        await getSpotPrice(),
        initialShort.add(toBN('1')),
        initialShort,
        initialCollat,
      );

      await expectShortChange(
        testPoolHedger,
        initialShort.add(toBN('1')),
        await estimateBufferCollat(initialShort.add(toBN('1'))),
      );
    });
    it('desiredShort > shortBalance & pendingLiq not enough: increases short to maxPossibleShort', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('100000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('1650'), toBN('100000'));

      const pendingLiq = (await getLiquidity()).pendingDeltaLiquidity;

      // perform hedge
      await testPoolHedger.setShortToExt(
        await getSpotPrice(),
        initialShort.add(toBN('20')),
        initialShort,
        initialCollat.add(toBN('10000')),
      );
      await expectShortChange(testPoolHedger, toBN('11.46'), initialCollat.add(pendingLiq));
    });
    it('desiredShort < shortBalance: decreases short/collateral', async () => {
      await testPoolHedger.setShortToExt(await getSpotPrice(), 0, initialShort, initialCollat);
      await expectShortChange(testPoolHedger, toBN('0'), toBN('0'));
    });
    it('freeLiquidity is zero but pendingLiq enough: fully executes hedges', async () => {
      // limit pendingLiquidity
      await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, undefined, toBN('10000'));
      await hre.f.c.optionMarketPricer.setPricingParams({
        ...DEFAULT_PRICING_PARAMS,
        standardSize: toBN('1000'),
        skewAdjustmentFactor: toBN('0.01'),
      });
      await setNegativeExpectedHedge(toBN('100'), toBN('10000'));

      // setShortTo
      await fillLiquidityWithWithdrawal();
      await testPoolHedger.setShortToExt(
        await getSpotPrice(),
        toBN('0').sub(await testPoolHedger.getCappedExpectedHedge()),
        initialShort,
        initialCollat,
      );

      const bufferCollat = await estimateBufferCollat(toBN('84.7363'));
      await expectShortChange(testPoolHedger, toBN('84.7363'), bufferCollat);
    });
  });

  describe('from 1.05 : 1 (collateral : short)', async () => {
    let initialShort: BigNumber;
    let initialCollat: BigNumber;
    beforeEach(async () => {
      await setNegativeExpectedHedge(toBN('10'), toBN('10000'));
      await testPoolHedger.hedgeDelta();
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      initialShort = toBN('7.703301915886900000');
      initialCollat = toBN('26838.509861243190415706');
      await expectShortChange(testPoolHedger, initialShort, initialCollat);

      // decrease short buffer
      await testPoolHedger.setShortBuffer(toBN('1.05'));
      await testPoolHedger.hedgeDelta();

      initialShort = (await testPoolHedger.getShortPosition()).shortBalance;
      initialCollat = (await testPoolHedger.getShortPosition()).collateral;
      await assertCloseToPercentage(
        initialCollat,
        initialShort
          .mul(await getSpotPrice())
          .mul(toBN('1.05'))
          .div(UNIT)
          .div(UNIT),
        toBN('0.01'),
      );
      await expectShortChange(testPoolHedger, initialShort, initialCollat);
    });

    it('revert short when 1:1 collateral and 100% withdrawal', async () => {
      // set buffer to exactly 1
      await fastForward(Number(DEFAULT_POOL_HEDGER_PARAMS.interactionDelay) + 1);
      await testPoolHedger.setShortBuffer(toBN('1'));
      await testPoolHedger.hedgeDelta();

      // expect revert due to snx fee rate
      await expect(
        testPoolHedger.setShortToExt(await getSpotPrice(), 0, initialShort, initialCollat),
      ).to.be.revertedWith('reverted with panic code 0x11');
    });

    it('desiredShort is zero: removes all collateral/short', async () => {
      // expect revert
      await testPoolHedger.setShortToExt(await getSpotPrice(), 0, initialShort, initialCollat);
      await expectShortChange(testPoolHedger, toBN('0'), toBN('0'));
    });

    it('desiredShort > shortBalance: increases short/collateral', async () => {
      // expect revert
      await testPoolHedger.setShortToExt(
        await getSpotPrice(),
        initialShort.add(toBN('10')),
        initialShort,
        initialCollat,
      );
      const bufferCollat = await estimateBufferCollat(initialShort.add(toBN('10')), toBN('1.05'));
      await expectShortChange(testPoolHedger, initialShort.add(toBN('10')), bufferCollat);
    });
    it('desiredShort < shortBalance: decreases short/collateral', async () => {
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('1'), initialShort, initialCollat);
      const buffer = await estimateBufferCollat(toBN('1'), toBN('1.05'));
      await expectShortChange(testPoolHedger, toBN('1'), buffer);
    });
    it('desiredShort < shortBalance: decreases short/increases collateral', async () => {
      await testPoolHedger.setShortBuffer(toBN('10'));
      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('1'), initialShort, initialCollat);
      const buffer = await estimateBufferCollat(toBN('1'), toBN('10'));
      await expectShortChange(testPoolHedger, toBN('1'), buffer);
      await expect(buffer).to.gt(initialCollat);
    });
    it('revert if spot moves up and not enough collateral to repay short', async () => {
      // limit pendingLiquidity
      await limitLiquidityWithSettlement(hre.f.c, 4, toBN('220'));

      // sudden price move in the wrong direction and short buffer increased due to volatile market
      // repay with collateral not possible as not enough funds in collateral
      // at this point collat ratio short position should be liquidated anyway
      await testPoolHedger.setShortBuffer(toBN('2'));
      await mockPrice('sETH', toBN('10000'));
      await expect(
        testPoolHedger.setShortToExt(await getSpotPrice(), toBN('5'), initialShort, initialCollat),
      ).revertedWith('reverted with panic code 0x11');
    });
    it('desiredShort = shortBalance, spot up, shortBuffer adjusted up: reduces short', async () => {
      // limit pendingLiquidity
      const liquidity = await limitLiquidityWithSettlement(hre.f.c, 4, toBN('255'));
      const pendingLiq = liquidity.pendingDeltaLiquidity;

      // sudden price move in the wrong direction and short buffer increased due to volatile market
      // expect short reduced to desiredShort but not to maxPossibleShort
      await testPoolHedger.setShortBuffer(toBN('1.5'));
      await mockPrice('sETH', toBN('2000'));

      await testPoolHedger.setShortToExt(await getSpotPrice(), toBN('7.5'), initialShort, initialCollat);

      const payment = initialShort.sub(toBN('7.5')).mul(toBN('2000')).div(UNIT);

      // since setShortTo is called separately, freeLiq > pendingLiq (only happens in tests)
      await expectShortChange(testPoolHedger, toBN('7.5'), pendingLiq.add(initialCollat).sub(payment));

      // requires one more setShortTo to reduce short to maxPossibleShort
      await testPoolHedger.setShortToExt(
        await getSpotPrice(),
        toBN('7.5'),
        toBN('7.5'),
        pendingLiq.add(initialCollat).sub(payment),
      );

      await expectShortChange(testPoolHedger, toBN('4.56'), toBN('7773.07'));
    });
  });
});

export async function expectShortChange(ph: TestShortPoolHedger, newShort: BigNumber, newCollateral: BigNumber) {
  const result = await ph.getShortPosition();
  assertCloseToPercentage(result.shortBalance, newShort, toBN('0.01'));
  assertCloseToPercentage(result.collateral, newCollateral, toBN('0.01'));
}

export async function estimateBufferCollat(short: BigNumber, buffer?: BigNumber) {
  return (buffer || DEFAULT_SHORT_BUFFER)
    .mul(short)
    .mul(await getSpotPrice())
    .div(UNIT)
    .div(UNIT);
}

export async function limitLiquidityWithSettlement(
  c: TestSystemContractsType,
  newStrikeId: number,
  amount?: BigNumber,
  returnPrice?: BigNumber,
): Promise<LiquidityStructOutput> {
  await seedBalanceAndApprovalFor(hre.f.deployer, hre.f.c, toBN('10000000'));
  await hre.f.c.optionMarketPricer.setPricingParams({
    ...DEFAULT_PRICING_PARAMS,
    standardSize: toBN('1000'),
    skewAdjustmentFactor: toBN('0.01'),
  });

  await createDefaultBoardWithOverrides(c, {
    expiresIn: DAY_SEC,
    strikePrices: ['1000'],
    skews: ['1'],
  });

  await mockPrice('sETH', toBN('1000'));
  await openPositionWithOverrides(c, {
    strikeId: newStrikeId,
    optionType: OptionType.LONG_CALL,
    amount: amount || toBN('500'),
  });

  await fastForward(DAY_SEC + 1);
  await mockPrice('sETH', toBN('2000'));
  await hre.f.c.optionMarket.settleExpiredBoard(2);

  // return to normal
  await hre.f.c.optionMarketPricer.setPricingParams(DEFAULT_PRICING_PARAMS);
  await mockPrice('sETH', returnPrice || DEFAULT_BASE_PRICE);

  return await getLiquidity();
}
