import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  currentTime,
  DAY_SEC,
  getTxTimestamp,
  HOUR_SEC,
  MONTH_SEC,
  OptionType,
  toBN,
  WEEK_SEC,
} from '../../../scripts/util/web3utils';
import {
  closePosition,
  closePositionWithOverrides,
  fillLiquidityWithLongPut,
  getLiquidity,
  openDefaultLongCall,
  openLongPutAndGetLiquidity,
  openPosition,
  setETHPrice,
} from '../../utils/contractHelpers';
import { DEFAULT_CB_PARAMS, DEFAULT_LIQUIDITY_POOL_PARAMS } from '../../utils/defaultParams';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { createDefaultBoardWithOverrides } from '../../utils/seedTestSystem';
import { hre } from '../../utils/testSetup';
import {
  initiateDepositAndWithdrawAndFastForward,
  relaxTradeLimits,
  revertProcessDepositAndWithdraw,
} from './8_VarianceCB';

const manualIvVarianceCBThreshold: BigNumber = toBN('0.01');
const manualSkewVarianceCBThreshold: BigNumber = toBN('0.05');
const manualIvVarianceCBTimeout = DAY_SEC;
const manualSkewVarianceCBTimeout = WEEK_SEC;
const manualBoardSettlementTimeout = HOUR_SEC;
const manualLiquidityTimeout = MONTH_SEC;
const manualContractAdjustmentTimeout = MONTH_SEC * 2;

const guardianDelay: number = WEEK_SEC;
let guardian: SignerWithAddress;

describe('Guardian, Settle Board and Combo Circuit Breakers', async () => {
  // integration tests
  describe('guardian sent', async () => {
    beforeEach(async () => {
      await seedFixture();
      guardian = hre.f.alice;
      await relaxTradeLimits();

      await setGuardianParams(guardianDelay, guardian.address);
      await openPosition({ optionType: OptionType.LONG_CALL, amount: toBN('0.01') });
    });

    it('blocks bypass: min delay not passed & guardian delay not expired', async () => {
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.signers[0].address, toBN('10000'));
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, toBN('20000'));

      await revertProcessDepositAndWithdraw(hre.f.signers[0], hre.f.signers[0]); // ensures dep/with not processed
      await revertProcessDepositAndWithdraw(hre.f.signers[0], guardian); // ensures dep/with not processed
    });

    it('blocks bypass: CB triggered & guardian delay not expired', async () => {
      await setGuardianParams(2 * Number(DEFAULT_LIQUIDITY_POOL_PARAMS.depositDelay), guardian.address);
      await initiateDepositAndWithdrawAndFastForward();
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);

      // confirm CB turned on
      await openPosition({
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('60'),
        setCollateralTo: toBN('80000'),
      });
      console.log(`Current time ${await currentTime()}`);
      expect(await currentTime()).lt(await hre.f.c.liquidityPool.CBTimestamp());
      await revertProcessDepositAndWithdraw(hre.f.signers[0], hre.f.signers[0]); // ensures dep/with not processed

      // revert guardian bypass since CB triggered and guardianDelay not passed
      await revertProcessDepositAndWithdraw(hre.f.signers[0], guardian); // ensures dep/with not processed
    });

    it('allows bypass: if minDelay and CB not expired but guardianDelay expired', async () => {
      await setGuardianParams(DAY_SEC, guardian.address);
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.signers[0].address, toBN('10000'));
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, toBN('20000'));
      await fastForward(DAY_SEC + 1);

      // confirm CB + minDelay turned on
      await openPosition({
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('120'),
        setCollateralTo: toBN('160000'),
      });
      await revertProcessDepositAndWithdraw(hre.f.signers[0], hre.f.signers[0]); // ensures dep/with not processed
      expect(await currentTime()).lt(await hre.f.c.liquidityPool.CBTimestamp());

      // allows deposit/withdraw using guardian bypass
      await successfullyProcessDepositAndWithdraw(hre.f.signers[0], guardian);
    });

    it('allows bypass: if minDelay, CB not expired, board is stale & guardianDelay==0', async () => {
      await setGuardianParams(0, guardian.address);
      await hre.f.c.liquidityPool.initiateDeposit(hre.f.signers[0].address, toBN('10000'));
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.signers[0].address, toBN('20000'));
      await fastForward(WEEK_SEC);

      // confirm CB + minDelay turned on
      await openPosition({
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('60'),
        setCollateralTo: toBN('80000'),
      });
      await revertProcessDepositAndWithdraw(hre.f.signers[0], hre.f.signers[0], false); // ensures dep/with not processed
      expect(await currentTime()).lt(await hre.f.c.liquidityPool.CBTimestamp());

      await fastForward(WEEK_SEC);

      // allows deposit/withdraw using guardian bypass
      expect(await hre.f.c.optionGreekCache.isBoardCacheStale(hre.f.board.boardId)).to.be.eq(true);
      await successfullyProcessDepositAndWithdraw(hre.f.signers[0], guardian);
    });
  });

  describe('board settlement circuit breaker', async () => {
    beforeEach(async () => {
      await seedFixture();
      await setManualParams();
      await relaxTradeLimits();
    });

    it('CB Timestamp increased on board settlement', async () => {
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
      await fastForward(MONTH_SEC + 1);
      const txResponse = await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      const currentTimestamp = await getTxTimestamp(txResponse);
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualBoardSettlementTimeout + currentTimestamp);
    });

    it('does not increase if longer CB already triggered', async () => {
      // trigger IV/skew CB
      await fastForward(MONTH_SEC - DAY_SEC);
      await openPosition({
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('60'),
        setCollateralTo: toBN('80000'),
      });
      const triggerTime = await currentTime();
      await fastForward(DAY_SEC + 1);

      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + triggerTime);

      // CB does not increase
      const txResponse = await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      const currentTimestamp = await getTxTimestamp(txResponse);
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + triggerTime);
      expect(await hre.f.c.liquidityPool.CBTimestamp()).gt(manualBoardSettlementTimeout + currentTimestamp);
    });

    it('reverts deposit/withdraw right after board settlement', async () => {
      await openPosition({
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      await fastForward(MONTH_SEC + 1);
      expect(await hre.f.c.liquidityPool.CBTimestamp()).lt(await currentTime());
    });
  });

  describe('multiple CBs firing', async () => {
    beforeEach(async () => {
      await seedFixture();
      await relaxTradeLimits();
      await setManualParams();

      await createDefaultBoardWithOverrides(hre.f.c, { expiresIn: HOUR_SEC });
    });

    it('bypasses CB updates if no open options (except settlement)', async () => {
      await seedFixture();
      await hre.f.c.liquidityPool.setCircuitBreakerParameters({
        ...DEFAULT_CB_PARAMS,
        skewVarianceCBThreshold: toBN('0.001'),
      });
      // fire CB by opening trade
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(0);
      const positionId = await openDefaultLongCall();
      const CBTime = await hre.f.c.liquidityPool.CBTimestamp();
      expect(await hre.f.c.liquidityPool.CBTimestamp()).not.eq(0);
      await fastForward(HOUR_SEC);

      // CB does not trigger as usedCollat == 0 && optionVal == 0
      await closePositionWithOverrides(hre.f.c, {
        positionId,
        strikeId: hre.f.strike.strikeId,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      expect(CBTime).eq(await hre.f.c.liquidityPool.CBTimestamp());
    });

    it('trigger all CBs: longest to shortest', async () => {
      // Trigger Liquidity CB and free up some liquidity for next actions
      const [, liquidity] = await fillLiquidityWithLongPut();
      const liquidityTimestamp = await currentTime();
      expect(liquidity.freeLiquidity).to.eq(0);
      await closePosition({
        positionId: 1,
        strikeId: 2,
        iterations: 5,
        optionType: OptionType.LONG_PUT,
        amount: toBN('150'),
      });
      expect((await getLiquidity()).freeLiquidity).to.gt(toBN('150000'));

      // Trigger Iv + Skew CB + confirm CB not moved
      await fastForward(HOUR_SEC);
      await openPosition({
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('40'),
        setCollateralTo: toBN('60000'),
      });
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualLiquidityTimeout + liquidityTimestamp);

      // Trigger settleBoard CB + confirm CB not moved
      await fastForward(HOUR_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(2);
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualLiquidityTimeout + liquidityTimestamp);
    });

    it('trigger all CBs: shortest to longest', async () => {
      await hre.f.c.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
        putCollatScalingFactor: toBN('0.1'),
      });

      // Trigger settleBoard CB + confirm CB not moved
      await fastForward(HOUR_SEC);
      await hre.f.c.optionMarket.settleExpiredBoard(2);
      const boardSettlementTimestamp = await currentTime();
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualBoardSettlementTimeout + boardSettlementTimestamp);

      // Trigger Skew CB + confirm CB not moved
      await fastForward(HOUR_SEC);
      await openPosition({
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('40'),
        setCollateralTo: toBN('60000'),
      });
      const skewCBTimestamp = await currentTime();
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualSkewVarianceCBTimeout + skewCBTimestamp);

      // Trigger Liquidity CB and free up some liquidity for next actions
      await openLongPutAndGetLiquidity(toBN('500'));
      const liquidityTimestamp = await currentTime();
      expect((await getLiquidity()).freeLiquidity).to.eq(0);
      expect(await hre.f.c.liquidityPool.CBTimestamp()).eq(manualLiquidityTimeout + liquidityTimestamp);
      let expectedCB = boardSettlementTimestamp + manualLiquidityTimeout + HOUR_SEC;
      expect(await hre.f.c.liquidityPool.CBTimestamp()).to.be.within(expectedCB - 5, expectedCB + 5);

      // Trigger contract adjustment event and make longer than liquidity CB
      await setETHPrice(toBN('100'));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      await hre.f.c.liquidityPool.initiateWithdraw(hre.f.deployer.address, toBN('1000'));
      await hre.f.c.liquidityPool.processWithdrawalQueue(1); // trigger contractAdjustment CB
      const contractAdjustmentTimestamp = await currentTime();
      expect((await getLiquidity()).longScaleFactor).to.lt(toBN('1'));
      expectedCB = manualContractAdjustmentTimeout + contractAdjustmentTimestamp;
      expect(await hre.f.c.liquidityPool.CBTimestamp()).to.be.within(expectedCB - 5, expectedCB + 5);
    });
  });
});

export async function setGuardianParams(delay: number, guardianAddress: string) {
  await hre.f.c.liquidityPool.setLiquidityPoolParameters({
    ...DEFAULT_LIQUIDITY_POOL_PARAMS,
    ...MANUAL_PARAMS,
    guardianDelay: delay,
    guardianMultisig: guardianAddress,
  });
}

export async function setManualParams() {
  await hre.f.c.liquidityPool.setCircuitBreakerParameters({
    ...DEFAULT_CB_PARAMS,
    ...MANUAL_PARAMS,
  });
}

export const MANUAL_PARAMS = {
  ivVarianceCBThreshold: manualIvVarianceCBThreshold,
  skewVarianceCBThreshold: manualSkewVarianceCBThreshold,
  ivVarianceCBTimeout: manualIvVarianceCBTimeout,
  skewVarianceCBTimeout: manualSkewVarianceCBTimeout,
  boardSettlementCBTimeout: manualBoardSettlementTimeout,
  liquidityCBTimeout: manualLiquidityTimeout, // set high to be obvious if accidentally triggered
  contractAdjustmentCBTimeout: manualContractAdjustmentTimeout,
};

export async function successfullyProcessDepositAndWithdraw(
  balanceAccount?: SignerWithAddress,
  callerAccount?: SignerWithAddress,
) {
  await hre.f.c.optionGreekCache.updateBoardCachedGreeks(hre.f.board.boardId);
  const quoteBal = await hre.f.c.snx.quoteAsset.balanceOf((balanceAccount || hre.f.signers[0]).address);
  const lpBal = await hre.f.c.liquidityToken.balanceOf((balanceAccount || hre.f.signers[0]).address);

  await hre.f.c.liquidityPool.connect(callerAccount || hre.f.signers[0]).processDepositQueue(2);
  await hre.f.c.liquidityPool.connect(callerAccount || hre.f.signers[0]).processWithdrawalQueue(2);

  expect(quoteBal).to.not.eq(await hre.f.c.snx.quoteAsset.balanceOf((balanceAccount || hre.f.signers[0]).address));
  expect(lpBal).to.not.eq(await hre.f.c.liquidityToken.balanceOf((balanceAccount || hre.f.signers[0]).address));
}
