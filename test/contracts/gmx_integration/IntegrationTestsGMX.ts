import { ethers } from 'hardhat';
import { getEvent, getEventArgs, OptionType, toBytes32, toBN } from '../../../scripts/util/web3utils';
import {
  DEFAULT_OPTION_MARKET_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_GMX_POOL_HEDGER_PARAMS,
  PricingType,
} from '../../utils/defaultParams';
import { deployGMXTestSystem, TestSystemContractsTypeGMX } from '../../utils/deployTestSystemGMX';
import { fastForward, restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { expect } from 'chai';
import { openPosition, closePosition } from '../../../scripts/util/integrationFunctions';

import { BigNumber, BigNumberish, ContractFactory, Signer, Wallet } from 'ethers';
import { seedTestSystemGMX, setPrice } from '../../utils/seedTestSystemGMX';
import { assertCloseToPercentage } from '../../utils/assert';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TestGMXFuturesPoolHedger } from '../../../typechain-types';

// section for GMX tests to work in
describe('Integration Tests - GMX', () => {
  let testSystem: TestSystemContractsTypeGMX;
  let deployer: Wallet;
  let tokenManager: Signer;
  let ethAddr: string;
  let usdcAddr: string;
  let vaultAddr: string;

  before(async () => {
    const provider = ethers.provider;

    [, , tokenManager] = await ethers.getSigners();

    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    deployer = new ethers.Wallet(privateKey, provider);

    testSystem = (await deployGMXTestSystem(deployer as any as SignerWithAddress, false, true, {
      useGMX: true,
      compileGMX: false,
      optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') },
    })) as TestSystemContractsTypeGMX;

    await testSystem.gmx.fastPriceFeed.connect(tokenManager).setPriceDataInterval(600);

    await seedTestSystemGMX(deployer, testSystem);

    ethAddr = testSystem.gmx.eth.address;
    vaultAddr = testSystem.gmx.vault.address;
    usdcAddr = testSystem.gmx.USDC.address;
    // marketView = await testSystem.optionMarketViewer.getMarket(testSystem.optionMarket.address);

    // adding more collat to vault
    await testSystem.gmx.eth.mint(vaultAddr, toBN('1000'));
    await testSystem.gmx.USDC.mint(vaultAddr, toBN('1000000'));
    await testSystem.gmx.vault.buyUSDG(ethAddr, await deployer.getAddress());
    await testSystem.gmx.vault.buyUSDG(usdcAddr, await deployer.getAddress());

    await testSystem.gmx.eth.mint(deployer.address, toBN('101'));
    await testSystem.gmx.USDC.mint(deployer.address, toBN('100001'));
    //
    await testSystem.futuresPoolHedger.setPoolHedgerParams({
      ...DEFAULT_POOL_HEDGER_PARAMS,
      interactionDelay: 4,
    });
  });

  describe('GMX Pool Hedger', () => {
    // test hedge function behavior when user trade against the AMM
    describe('GMX hedger hedge tests based on user positions', () => {
      let snapId: number;
      beforeEach(async () => {
        snapId = await takeSnapshot();
        // preQuoteBal = +fromBN(await testSystem.gmx.USDC.balanceOf(deployer.address));
        // preBaseBal = +fromBN(await testSystem.gmx.eth.balanceOf(deployer.address));
      });

      afterEach(async () => {
        await restoreSnapshot(snapId);
      });

      it('Hedge long from zero', async () => {
        const positionId = await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        const hedgingTx = await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        const receipt = await hedgingTx.wait();
        expect(getEvent(receipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');

        const argsRet = getEventArgs(receipt, 'PositionUpdated');
        expect(argsRet.isIncrease).to.be.true;

        const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
        expect(currentValue.isZero()).to.be.true;

        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'InteractionDelayNotExpired',
        );
        await fastForward(4);
        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );

        let pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        const totalValue = await testSystem.futuresPoolHedger.getAllPositionsValue();

        // totalValue 7554.688269809002202055
        assertCloseToPercentage(totalValue, toBN('7555'), toBN('0.01'));

        const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);

        // the pool is hedged, should not need pending delta liquidity
        const { pendingDeltaLiquidity, usedDeltaLiquidity } = await testSystem.futuresPoolHedger.getHedgingLiquidity(
          spot,
        );

        // liquidity is the same as position value
        assertCloseToPercentage(usedDeltaLiquidity, toBN('7555'), toBN('0.01'));

        expect(pendingDeltaLiquidity.isZero()).to.be.true;

        await fastForward(4);
        await testSystem.futuresPoolHedger.hedgeDelta({ value: toBN('0.01') }); // does nothing
        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        await closePosition(testSystem, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();

        expect((await testSystem.gmx.eth.balanceOf(testSystem.futuresPoolHedger.address)).isZero()).to.be.true;
        expect((await testSystem.gmx.USDC.balanceOf(testSystem.futuresPoolHedger.address)).isZero()).to.be.true;

        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'InteractionDelayNotExpired',
        );

        await fastForward(4);
        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );

        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());

        await closePosition(testSystem, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());
        // console.log(await testSystem.futuresPoolHedger.getHedgingLiquidity(spot));
      });

      it('Hedge from long to short', async () => {
        // Setup: Create net long position for hedger
        //user long call against the pool, we open long to hedge
        const longPositionId = await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        const receipt = await (
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })
        ).wait();
        expect(getEvent(receipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');
        expect(getEvent(receipt, 'OrderPosted').event).to.be.eq('OrderPosted');
        expect(getEventArgs(receipt, 'OrderPosted').positionKey).to.be.eq(
          await testSystem.futuresPoolHedger.pendingOrderKey(),
        );
        expect(getEventArgs(receipt, 'OrderPosted').isIncrease).to.be.true;
        expect(getEventArgs(receipt, 'OrderPosted').isLong).to.be.true;

        const argsRet = getEventArgs(receipt, 'PositionUpdated');
        expect(argsRet.isIncrease).to.be.true;

        let pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        const position = await testSystem.futuresPoolHedger.getPositions();
        expect(position.isLong).to.be.true;

        // ===== Setup Finished =====

        // user close long
        await closePosition(testSystem, 'sETH', {
          positionId: longPositionId,
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: 0,
        });
        // create another short
        const shortPosId = await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });

        // ---> first hedgeDelta: after pool is net short: create order to decrease long position.
        let shortReceipt = await (
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })
        ).wait();
        expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
        expect(getEvent(shortReceipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');
        expect(getEventArgs(shortReceipt, 'PositionUpdated').isIncrease).to.be.false;

        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());

        // After pending order got executed
        const positionAfterExec = await testSystem.futuresPoolHedger.getPositions();
        expect(positionAfterExec.shortPosition.size.isZero()).to.be.true;
        expect(positionAfterExec.longPosition.size.isZero()).to.be.true;
        expect(positionAfterExec.amountOpen.isZero()).to.be.true;

        expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        // // ---> second hedgeDelta: create order to increase short position
        shortReceipt = await (
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })
        ).wait(); // error
        expect(getEvent(shortReceipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');
        expect(getEventArgs(shortReceipt, 'PositionUpdated').isIncrease).to.be.true;
        expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        const positionAfterHedge2 = await testSystem.futuresPoolHedger.getPositions();
        expect(positionAfterHedge2.shortPosition.size.isZero()).to.be.true;
        expect(positionAfterHedge2.amountOpen.isZero()).to.be.true;

        // After pending order got executed
        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();

        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        const positionAfterExec2 = await testSystem.futuresPoolHedger.getPositions();
        expect(positionAfterExec2.shortPosition.size.gt(0)).is.true;
        expect(positionAfterExec2.amountOpen.eq(1)).is.true;

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        // user close the short position. AMM back to delta neutral
        await closePosition(testSystem, 'sETH', {
          positionId: shortPosId,
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: 0,
        });

        const expectedHedge = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
        expect(expectedHedge.isZero()).to.be.true;
      });

      it('Hedge short from zero', async () => {
        const positionId = await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });

        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        let pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();

        await fastForward(4);
        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        // user close half of the position

        await closePosition(testSystem, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('5'),
        });

        // create decrease order to reduce short position
        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        const hasPendingDecrease = await testSystem.futuresPoolHedger.hasPendingDecrease();
        expect(hasPendingDecrease).to.be.true;

        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();

        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'InteractionDelayNotExpired',
        );

        await fastForward(4);
        await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );

        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());

        await closePosition(testSystem, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: 0,
        });

        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());
      });

      it('Hedge from short to long', async () => {
        const shortPositionId = await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });
        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        let pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await fastForward(4);
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        // ======= user close the entire short, open long ====== /
        await closePosition(testSystem, 'sETH', {
          positionId: shortPositionId,
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('0'),
        });

        await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        // ========= First hedge call: remove short ========== //
        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;

        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();

        await fastForward(4);

        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());

        const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(hedged.isZero()).to.be.true;

        // ========= Second hedge call: create long ========== //

        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        const positionAfterExec2 = await testSystem.futuresPoolHedger.getPositions();

        expect(positionAfterExec2.longPosition.size.gt(0)).is.true;
        expect(positionAfterExec2.amountOpen.eq(1)).is.true;

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
      });

      it('Case: need to hedge from zero to long, but needed amount change before execution', async () => {
        // Setup: Create net long position for hedger
        // user long call against the pool, we open long to hedge
        const longPositionId = await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        // ===== Setup Finished, with a pending order =====
        const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);

        const hedgingStatusBefore = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(hedgingStatusBefore.pendingDeltaLiquidity.isZero()).to.be.false; // still need liquidity: trade has not gone through
        expect(hedgingStatusBefore.usedDeltaLiquidity.isZero()).to.be.true; // position not updated yet

        // user close long
        await closePosition(testSystem, 'sETH', {
          positionId: longPositionId,
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: 0,
        });

        // check the state now

        const hedgingStatusAfterTrade = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(hedgingStatusAfterTrade.pendingDeltaLiquidity.isZero()).to.be.true; // seems like we're balanced again!
        expect(hedgingStatusAfterTrade.usedDeltaLiquidity.isZero()).to.be.true; // position is updated
        expect(hedgingStatusAfterTrade.usedDeltaLiquidity.eq(hedgingStatusBefore.usedDeltaLiquidity)).to.be.true;

        // ==== Update: execute increase order

        const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());

        const hedgingStatusAfterHedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

        // liquidity used is higher than amount needed to hedge (0). pendingDeltaLiquidity is zero
        expect(hedgingStatusAfterHedge.pendingDeltaLiquidity.isZero()).to.be.true;

        expect(hedgingStatusAfterTrade.usedDeltaLiquidity.isZero()).to.be.true;
        expect(hedgingStatusAfterTrade.usedDeltaLiquidity.eq(hedgingStatusBefore.usedDeltaLiquidity)).to.be.true;

        // ==== Update: hedge again =====
        await fastForward(4);
        await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
      });
    });

    // test hedge function behavior when price changes
    describe('GMX hedger hedge tests based on price changes', () => {
      let snapId: number;
      describe('Scenario A): AMM is net short', async () => {
        before('user creates long position', async () => {
          await setPrice(testSystem, '1500', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);

          snapId = await takeSnapshot();

          await openPosition(testSystem, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
          });
          await fastForward(4);
        });

        it('hedger should go long', async () => {
          await fastForward(4);
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(pendingKey, await deployer.getAddress());

          const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.isLong).to.be.true;
        });

        it('if spot price increases, hedger needs to long more', async () => {
          const oldNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          const oldTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          await setPrice(testSystem, '1800', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);

          await testSystem.optionGreekCache.updateBoardCachedGreeks(1);

          const newNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();

          // price increases: our hedged delta exposure decrease because size / spot decrease
          expect(newNetDelta.lt(oldNetDelta)).to.be.true;

          const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
          const hedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

          expect(hedge.usedDeltaLiquidity);
          expect(hedge.pendingDeltaLiquidity.gt(0)).to.be.true;

          const newTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          expect(newTarget.gt(oldTarget)).to.be.true;

          await fastForward(4);
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(pendingKey, await deployer.getAddress());

          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

          const newHedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(newHedge.pendingDeltaLiquidity.isZero()).to.be.true;
        });

        it('if spot price decreases, hedger needs to long less', async () => {
          const oldNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();

          const oldTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          await setPrice(testSystem, '1300', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
          await testSystem.optionGreekCache.updateBoardCachedGreeks(1);

          const newNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(newNetDelta.gt(oldNetDelta)).to.be.true;

          const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
          const hedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

          // don't need to add more.
          expect(hedge.pendingDeltaLiquidity.isZero()).to.be.true;

          const newTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          expect(newTarget.lt(oldTarget)).to.be.true;

          await fastForward(4);
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeDecreasePosition(pendingKey, await deployer.getAddress());

          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;

          const newHedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(newHedge.pendingDeltaLiquidity.isZero()).to.be.true;
        });

        after('restore', async () => {
          await restoreSnapshot(snapId);
        });
      });

      describe('Scenario B): AMM is net long', async () => {
        before('user creates short position', async () => {
          await setPrice(testSystem, '1500', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
          snapId = await takeSnapshot();

          await openPosition(testSystem, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.SHORT_CALL_BASE,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });
          await fastForward(4);
        });

        it('hedger should go short', async () => {
          await fastForward(4);
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(pendingKey, await deployer.getAddress());

          const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.isLong).to.be.false;
        });

        it('if spot price increases, hedger need to increase short', async () => {
          const oldNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          const oldTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          await setPrice(testSystem, '1800', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);

          await testSystem.optionGreekCache.updateBoardCachedGreeks(1);

          const newNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();

          // price increases: our hedged delta exposure increase because size / spot increase (negative)
          expect(newNetDelta.gt(oldNetDelta)).to.be.true;

          const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
          const hedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

          expect(hedge.usedDeltaLiquidity);
          expect(hedge.pendingDeltaLiquidity.gt(0)).to.be.true; // not sure

          const newTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          expect(newTarget.lt(oldTarget)).to.be.true; // need to go more negative

          await fastForward(4);
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(pendingKey, await deployer.getAddress());

          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

          const newHedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(newHedge.pendingDeltaLiquidity.isZero()).to.be.true;
        });

        it('if spot price decreases', async () => {
          const oldNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();

          const oldTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          await setPrice(testSystem, '1300', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
          await testSystem.optionGreekCache.updateBoardCachedGreeks(1);

          // net delta decreased to a more negative number
          const newNetDelta = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(newNetDelta.lt(0)).to.be.true;
          expect(newNetDelta.lt(oldNetDelta)).to.be.true;

          const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
          const hedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

          // don't need to add more.
          expect(hedge.pendingDeltaLiquidity.isZero()).to.be.true;

          const newTarget = await testSystem.futuresPoolHedger.getCappedExpectedHedge();

          expect(newTarget.lt(0)).to.be.true;
          expect(newTarget.gt(oldTarget)).to.be.true; // less negative

          await fastForward(4);
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeDecreasePosition(pendingKey, await deployer.getAddress());

          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;

          const newHedge = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(newHedge.pendingDeltaLiquidity.isZero()).to.be.true;
        });

        after('restore to initial price', async () => {
          await restoreSnapshot(snapId);
        });
      });
    });

    describe('Edge cases', () => {
      describe('Large price movements when attempting to hedge', async () => {
        let snapId: number;
        before(async () => {
          snapId = await takeSnapshot();
        });
        it('Edge Case: Large price movement after order submitted', async () => {
          const amount = toBN('10');
          await openPosition(testSystem, 'sETH', {
            amount: amount,
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });

          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          await setPrice(testSystem, '2500', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
          expect(
            await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, PricingType.MAX),
          ).to.be.eq(toBN('2500'));
          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          await testSystem.gmx.positionRouter.connect(deployer).executeIncreasePositions(1, deployer.address);

          // const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, PricingType.MAX);
          // expected Hedge is 556 plus a load of trailing.

          expect(await testSystem.gmx.USDC.balanceOf(testSystem.futuresPoolHedger.address)).to.be.gt(toBN('0'));
          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        });

        after(async () => {
          await restoreSnapshot(snapId);
        });
      });
      describe('cancel increase order', () => {
        let snapId: number;
        before('Create a pending increase order', async () => {
          snapId = await takeSnapshot();

          await openPosition(testSystem, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
          });

          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
        });
        it('cannot cancel a new order', async () => {
          await expect(testSystem.futuresPoolHedger.connect(deployer).cancelPendingOrder()).revertedWith(
            'CancellationDelayNotPassed',
          );
        });

        it('can cancel a normal order after delay', async () => {
          await fastForward(2000);
          const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
          const receipt = await (await testSystem.futuresPoolHedger.connect(deployer).cancelPendingOrder()).wait();
          expect(getEvent(receipt, 'OrderCanceled').event).to.be.eq('OrderCanceled');
          expect(getEventArgs(receipt, 'OrderCanceled').pendingOrderKey).to.be.eq(pendingKey);

          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;

          // can hedge again
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        });

        after('restore snapshot', async () => {
          await restoreSnapshot(snapId);
        });
      });
      describe('cancel decrease order', () => {
        let snapId: number;
        before('Create a pending decrease order', async () => {
          snapId = await takeSnapshot();

          const positionId = await openPosition(testSystem, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });

          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          const key = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(key, await deployer.getAddress());

          await fastForward(200);

          await closePosition(testSystem, 'sETH', {
            positionId,
            amount: toBN('6'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
          });
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
        });
        it('cannot cancel a new normal order', async () => {
          await expect(testSystem.futuresPoolHedger.connect(deployer).cancelPendingOrder()).revertedWith(
            'CancellationDelayNotPassed',
          );
        });
        it('can cancel a normal order after delay', async () => {
          await fastForward(2000);
          await testSystem.futuresPoolHedger.connect(deployer).cancelPendingOrder();
          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;

          // can hedge again
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        });

        after('restore snapshot', async () => {
          await restoreSnapshot(snapId);
        });
      });
      describe('update leverage', () => {
        let snapId: number;
        before('Create a net long hedge', async () => {
          snapId = await takeSnapshot();

          await openPosition(testSystem, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          const key = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(key, await deployer.getAddress());
        });

        before('increase target leverage', async () => {
          const targetLeverageOverride = toBN('5');
          const receipt = await (
            await testSystem.futuresPoolHedger.connect(deployer).setFuturesPoolHedgerParams({
              ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
              targetLeverage: targetLeverageOverride,
            })
          ).wait();
          expect(receipt.events).to.have.length(1);
          expect(getEvent(receipt, 'MaxLeverageSet').event).to.be.eq('MaxLeverageSet');
          expect(getEventArgs(receipt, 'MaxLeverageSet').targetLeverage).to.be.eq(targetLeverageOverride);
        });

        it('collateral delta should be negative (decrease collateral)', async () => {
          const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.collateralDelta.lt(0)).to.be.true;
        });

        it('call update collateral should decrease position', async () => {
          const receipt = await (
            await testSystem.futuresPoolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') })
          ).wait();
          expect(getEvent(receipt, 'CollateralOrderPosted').event).to.be.eq('CollateralOrderPosted');
          // hedger is long
          expect(getEventArgs(receipt, 'CollateralOrderPosted').isLong).to.be.true;
          expect(getEventArgs(receipt, 'CollateralOrderPosted').collateralDelta).to.be.lt(toBN('0'));
          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
          const key = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeDecreasePosition(key, await deployer.getAddress());

          const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.collateralDelta.isZero()).to.be.true;
        });

        it('call update collateral again should do nothing', async () => {
          const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.needUpdate).to.be.false;
          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });

        after('restore snapshot ', async () => {
          await restoreSnapshot(snapId);
        });
      });
      describe('GMX liquidation', () => {
        let snapId: number;

        before('Update pool parameter and create net long position', async () => {
          snapId = await takeSnapshot();

          await setPrice(testSystem, '1500', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);

          await testSystem.futuresPoolHedger.connect(deployer).setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            targetLeverage: toBN('10'),
          });

          await openPosition(testSystem, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          const key = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(key, await deployer.getAddress());
        });

        before('price change and our position got liquidated', async () => {
          await setPrice(testSystem, '800', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);

          await testSystem.gmx.vault.connect(deployer).liquidatePosition(
            testSystem.futuresPoolHedger.address,
            await testSystem.futuresPoolHedger.baseAsset(), // collateral
            await testSystem.futuresPoolHedger.baseAsset(), // index
            true,
            deployer.address,
          );
        });
        it('hedged delta is 0', async () => {
          const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged.isZero()).to.be.true;
        });
        it('position is empty', async () => {
          const pos = await testSystem.futuresPoolHedger.getPositions();
          expect(pos.amountOpen.isZero()).to.be.true;
        });
        it('can hedge again', async () => {
          await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          const key = await testSystem.futuresPoolHedger.pendingOrderKey();
          await testSystem.gmx.positionRouter
            .connect(deployer)
            .executeIncreasePosition(key, await deployer.getAddress());

          const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged.gt(0)).to.be.true;
        });
        after('restore snapshot', async () => {
          await restoreSnapshot(snapId);
        });
      });
      describe('deactivate hedger', () => {
        let snapId: number;
        describe('close a net long position on hedger', () => {
          before('Create a net long hedge', async () => {
            snapId = await takeSnapshot();

            await openPosition(testSystem, 'sETH', {
              amount: toBN('10'),
              optionType: OptionType.LONG_CALL,
              strikeId: 1,
              setCollateralTo: toBN('10'),
            });
            await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
            const key = await testSystem.futuresPoolHedger.pendingOrderKey();
            await testSystem.gmx.positionRouter
              .connect(deployer)
              .executeIncreasePosition(key, await deployer.getAddress());
          });

          before('set cap to 0', async () => {
            await testSystem.futuresPoolHedger.connect(deployer).setPoolHedgerParams({
              ...DEFAULT_POOL_HEDGER_PARAMS,
              hedgeCap: toBN('0'),
            });
          });

          it('call hedgeDelta should close all position', async () => {
            await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
            const key = await testSystem.futuresPoolHedger.pendingOrderKey();
            await testSystem.gmx.positionRouter
              .connect(deployer)
              .executeDecreasePosition(key, await deployer.getAddress());
          });

          it('hedged delta and capped expected are both 0', async () => {
            expect((await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta()).isZero()).to.be.true;
            expect((await testSystem.futuresPoolHedger.getCappedExpectedHedge()).isZero()).to.be.true;
          });
          it('position is empty', async () => {
            const pos = await testSystem.futuresPoolHedger.getPositions();
            expect(pos.amountOpen.isZero()).to.be.true;
          });

          it('pending liquidity becomes 0', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);

            // the pool is hedged, should not need pending delta liquidity
            const { pendingDeltaLiquidity, usedDeltaLiquidity } =
              await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(usedDeltaLiquidity.isZero()).to.be.true;
            expect(pendingDeltaLiquidity.isZero()).to.be.true;
          });

          after('restore snapshot', async () => {
            await restoreSnapshot(snapId);
          });
        });
        describe('close a net short position on hedger', () => {
          before('Create a net short hedge', async () => {
            snapId = await takeSnapshot();

            await openPosition(testSystem, 'sETH', {
              amount: toBN('10'),
              optionType: OptionType.LONG_PUT,
              strikeId: 1,
            });
            await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
            const key = await testSystem.futuresPoolHedger.pendingOrderKey();
            await testSystem.gmx.positionRouter
              .connect(deployer)
              .executeIncreasePosition(key, await deployer.getAddress());
          });

          before('set cap to 0', async () => {
            await testSystem.futuresPoolHedger.connect(deployer).setPoolHedgerParams({
              ...DEFAULT_POOL_HEDGER_PARAMS,
              hedgeCap: toBN('0'),
            });
          });

          it('call hedgeDelta should close all position', async () => {
            await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
            const key = await testSystem.futuresPoolHedger.pendingOrderKey();
            await testSystem.gmx.positionRouter
              .connect(deployer)
              .executeDecreasePosition(key, await deployer.getAddress());
          });

          it('hedged delta and capped expected are both 0', async () => {
            expect((await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta()).isZero()).to.be.true;
            expect((await testSystem.futuresPoolHedger.getCappedExpectedHedge()).isZero()).to.be.true;
          });
          it('position is empty', async () => {
            const pos = await testSystem.futuresPoolHedger.getPositions();
            expect(pos.amountOpen.isZero()).to.be.true;
          });

          after('restore snapshot', async () => {
            await restoreSnapshot(snapId);
          });
        });
      });
      //   // un-comment after unifying tokens
      //   describe('no liquidity from liquidity pool', () => {
      //     let snapId: number;

      //     before('Create a net long hedge', async () => {
      //       snapId = await takeSnapshot();
      //       await openPosition(testSystem, 'sETH', {
      //         amount: toBN('10'),
      //         optionType: OptionType.LONG_CALL,
      //         strikeId: 1,
      //         setCollateralTo: toBN('10'),
      //       });
      //     });

      //     before('burn quote from liquidity pool', async () => {
      //       const balance = await testSystem.gmx.USDC.balanceOf(testSystem.liquidityPool.address)
      //       await testSystem.gmx.USDC.connect(deployer).burn(testSystem.liquidityPool.address, balance);
      //     });

      //     it('cannot hedge', async () => {
      //       await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({value: toBN('0.01')});
      //       await expect(testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({value: toBN('0.01')})).revertedWith('NoQuoteReceivedFromLP');
      //     })

      //     after('restore snapshot for liquidity pool', async () => {
      //       await restoreSnapshot(snapId);
      //     });
      //   });
    });

    describe('GMX hedger state breakdown', () => {
      let snapshotId: number;

      let snapshotDefault: number;

      before('store state', async () => {
        snapshotId = await takeSnapshot();
        snapshotDefault = await takeSnapshot();
      });

      describe('default state', () => {
        it('hedged delta should return 0', async () => {
          const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged.isZero()).to.be.true;
        });
        it('positions should be empty', async () => {
          const positions = await testSystem.futuresPoolHedger.getPositions();
          expect(positions.amountOpen.isZero()).to.be.true;
        });
        it('position value should be 0', async () => {
          const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
          expect(currentValue.isZero()).to.be.true;
        });
        it('used and pending liquidity should be 0', async () => {
          const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);

          const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
          expect(hedging.usedDeltaLiquidity.isZero()).to.be.true;
        });
        it('pending order should be null', async () => {
          expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });
        it('default leverage should be 0', async () => {
          const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.leverage.isZero()).to.be.true;
          expect(leverageInfo.isLong).to.be.false;
        });
      });

      describe('scenario A): user open long call', () => {
        let longPositionId: BigNumberish;
        describe('after user open long call, before hedge', () => {
          before('open position', async () => {
            longPositionId = await openPosition(testSystem, 'sETH', {
              amount: toBN('10'),
              optionType: OptionType.LONG_CALL,
              strikeId: 1,
            });
          });
          it('hedged delta should return 0', async () => {
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.true;
          });
          it('positions should be empty', async () => {
            const positions = await testSystem.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.isZero()).to.be.true;
          });
          it('position value should be 0', async () => {
            const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
            expect(currentValue.isZero()).to.be.true;
          });
          it('pending hedging liquidity should not be 0', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
            const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false;
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.true;
          });
          it('pending order should be null', async () => {
            expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });
          it('current leverage should be 0', async () => {
            const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.leverage.isZero()).to.be.true;
            expect(leverageInfo.isLong).to.be.false;
          });
        });

        describe('after hedgeDelta is called  ', () => {
          before('call hedge', async () => {
            await fastForward(4);
            await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          });
          it('hedged delta should return 0', async () => {
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.true;
          });
          it('positions should be empty', async () => {
            const positions = await testSystem.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.isZero()).to.be.true;
          });
          it('position value should be 0', async () => {
            const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
            expect(currentValue.isZero()).to.be.true;
          });
          it('used hedging liquidity should be updated', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
            const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false; // trade have not gone through
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.true;
          });
          it('pending increase should be true', async () => {
            expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
            expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });
          it('current leverage should be 0', async () => {
            const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.leverage.isZero()).to.be.true;
            expect(leverageInfo.isLong).to.be.false;
          });
        });

        describe('after hedge order is executed', () => {
          before('execute', async () => {
            const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
            await testSystem.gmx.positionRouter
              .connect(deployer)
              .executeIncreasePosition(pendingKey, await deployer.getAddress());
          });
          it('hedged delta should return positive number', async () => {
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.false;
          });
          it('positions should be long', async () => {
            const positions = await testSystem.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.eq(1)).to.be.true;
            expect(positions.isLong).to.be.true;
            expect(positions.longPosition.unrealisedPnl.isZero()).to.be.true;
          });
          it('position value should be positive', async () => {
            const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
            assertCloseToPercentage(currentValue, toBN('7550'), toBN('0.005')); // 0.5 percent tolerance
          });

          it('used hedging liquidity should be updated', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
            const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('pending order should be null', async () => {
            expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be 1.1', async () => {
            const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
            assertCloseToPercentage(leverageInfo.leverage, toBN('1.1'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.true;
          });
        });

        describe('update collateral scenario A.1) price increases, update collateral will not remove collateral', () => {
          before('execute: update price', async () => {
            // take a snapshot before price change
            snapshotId = await takeSnapshot();
          });
          after('restore snapshot', async () => {
            await restoreSnapshot(snapshotId);
          });
          describe('after price raise', () => {
            before('execute: update price', async () => {
              // take a snapshot before price change
              snapshotId = await takeSnapshot();
              await setPrice(testSystem, '1800', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
              await testSystem.optionGreekCache.updateBoardCachedGreeks(1);
            });
            it('hedged delta should return positive number', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.isZero()).to.be.false;
            });

            it('positions should be long', async () => {
              const positions = await testSystem.futuresPoolHedger.getPositions();
              expect(positions.amountOpen.eq(1)).to.be.true;
              expect(positions.isLong).to.be.true;
              // has unrealised (+) profit
              expect(positions.longPosition.unrealisedPnl.gt(0)).to.be.true;
            });
            it('position value should be positive', async () => {
              const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
              assertCloseToPercentage(currentValue, toBN('9220'), toBN('0.005')); // 0.5 percent tolerance
            });

            it('used hedging liquidity should change', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              //  need to hedge again, because delta of call changed
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
            });

            it('pending order should be null', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should be the same, should not decrease collateral', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.1'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.true;
            });
          });
        });

        describe('update collateral scenario A.2) price decreases, update collateral will add collateral ', () => {
          before('snapshot', async () => {
            // take a snapshot before price change
            snapshotId = await takeSnapshot();
          });
          after('restore snapshot', async () => {
            await restoreSnapshot(snapshotId);
          });

          describe('after price decrease', () => {
            before('execute: update price', async () => {
              // take a snapshot before price change
              snapshotId = await takeSnapshot();
              await setPrice(testSystem, '1300', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
              await testSystem.optionGreekCache.updateBoardCachedGreeks(1);
            });
            it('hedged delta should return positive number', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.gt(0)).to.be.true;
            });

            it('positions should be long', async () => {
              const positions = await testSystem.futuresPoolHedger.getPositions();
              expect(positions.amountOpen.eq(1)).to.be.true;
              expect(positions.isLong).to.be.true;
              // has unrealised loss
              expect(positions.longPosition.unrealisedPnl.lt(0)).to.be.true;
            });
            it('position value should still decreased to ~6443', async () => {
              const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
              assertCloseToPercentage(currentValue, toBN('6443'), toBN('0.005')); // 0.5 percent tolerance
            });

            it('used hedging liquidity should change', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              //  pending liquidity is 0, because we can reduce hedged amount.
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
            });

            it('pending order should be null', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should be higher, shouldUpdate should be true', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.29'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.true;
              expect(leverageInfo.needUpdate).to.be.true;

              // need to add collateral
              expect(leverageInfo.collateralDelta.gt(0)).to.be.true;
            });
          });

          describe('after update collateral', () => {
            before('call update collateral', async () => {
              await testSystem.futuresPoolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') });
            });
            it('hedged delta should remains the same', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.isZero()).to.be.false;
            });

            it('should have pending order to increase collateral', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should still be lower than target (not reflected yet). Should hedge should be false', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              expect(leverageInfo.isLong).to.be.true;
              expect(leverageInfo.needUpdate).to.be.false;
            });
          });

          describe('after collateral adjustment order is executed ', () => {
            before('execute increase order', async () => {
              const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
              await testSystem.gmx.positionRouter
                .connect(deployer)
                .executeIncreasePosition(pendingKey, await deployer.getAddress());
            });
            it('hedged delta should remains the same', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.isZero()).to.be.false;
            });

            it('hedging liquidity should be the same', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              //  need to hedge again, because delta of call changed
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
            });

            it('should have no pending order', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should be back to target', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();

              // slightly higher than 1.1 here because we post less collateral into the position, while there are outstanding loss (-pnl)
              // due to restriction on position.collateral < position.size
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.15'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.true;
            });
          });
        });

        describe('hedgeDelta in scenario A.3) price decreases, but user closes position. Need to close position ', () => {
          before('snapshot', async () => {
            // take a snapshot before price change
            snapshotId = await takeSnapshot();
          });
          after('restore snapshot', async () => {
            await restoreSnapshot(snapshotId);
          });

          describe('after price decrease', () => {
            before('execute: update price, user close position', async () => {
              // take a snapshot before price change
              snapshotId = await takeSnapshot();
              await setPrice(testSystem, '1300', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);

              await closePosition(testSystem, 'sETH', {
                positionId: longPositionId,
                amount: toBN('10'),
                optionType: OptionType.LONG_CALL,
                strikeId: 1,
              });

              await testSystem.optionGreekCache.updateBoardCachedGreeks(1);
            });
            it('hedged delta should return positive number', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.gt(0)).to.be.true;

              const target = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
              expect(target.isZero()).to.be.true;
            });

            it('positions should be long', async () => {
              const positions = await testSystem.futuresPoolHedger.getPositions();
              expect(positions.amountOpen.eq(1)).to.be.true;
              expect(positions.isLong).to.be.true;
              // has unrealised loss
              expect(positions.longPosition.unrealisedPnl.lt(0)).to.be.true;
            });

            it('current leverage should be higher, shouldUpdate should be true', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.29'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.true;
              expect(leverageInfo.needUpdate).to.be.true;

              // need to add collateral
              expect(leverageInfo.collateralDelta.gt(0)).to.be.true;
            });
          });

          describe('after hedge delta', () => {
            it('call hedge delta', async () => {
              await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
            });
            it('should have pending order to decrease collateral', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.true;
            });

            it('current leverage should still be lower than target (not reflected yet). Should hedge should be false', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              expect(leverageInfo.isLong).to.be.true;
              expect(leverageInfo.needUpdate).to.be.false;
            });
          });

          describe('after hedge order is executed ', () => {
            before('execute decrease order', async () => {
              const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
              await testSystem.gmx.positionRouter
                .connect(deployer)
                .executeDecreasePosition(pendingKey, await deployer.getAddress());
            });
            it('hedged delta is now 0', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.isZero()).to.be.true;
            });

            it('hedging liquidity should be 0', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              //  need to hedge again, because delta of call changed
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.true;
            });

            it('should have no pending order', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage is 0', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              expect(leverageInfo.leverage.isZero()).to.be.true;
              expect(leverageInfo.needUpdate).to.be.false;
            });
          });
        });
      });

      describe('scenario B): user open long put', () => {
        let hedgedAfterUserOpen: BigNumber;
        before('restore default', async () => {
          await restoreSnapshot(snapshotDefault);
        });
        describe('after user open long put, before hedge', () => {
          before('open position', async () => {
            await openPosition(testSystem, 'sETH', {
              amount: toBN('10'),
              optionType: OptionType.LONG_PUT,
              strikeId: 1,
            });
          });
          it('hedged delta should return 0', async () => {
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.true;
          });
          it('target delta should be negative', async () => {
            const target = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
            expect(target.lt(0)).to.be.true;
          });
          it('positions should be empty', async () => {
            const positions = await testSystem.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.isZero()).to.be.true;
          });
          it('position value should be 0', async () => {
            const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
            expect(currentValue.isZero()).to.be.true;
          });
          it('pending hedging liquidity should not be 0', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
            const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(hedging.pendingDeltaLiquidity.gt(0)).to.be.true;
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.true;
          });
          it('pending order should be null', async () => {
            expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });
          it('current leverage should be 0', async () => {
            const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.leverage.isZero()).to.be.true;
            expect(leverageInfo.isLong).to.be.false;
          });
        });

        describe('after hedgeDelta is called  ', () => {
          before('call hedge', async () => {
            await fastForward(4);
            await testSystem.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          });
          it('hedged delta should return 0', async () => {
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.true;
          });
          it('positions should be empty', async () => {
            const positions = await testSystem.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.isZero()).to.be.true;
          });
          it('position value should be 0', async () => {
            const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
            expect(currentValue.isZero()).to.be.true;
          });
          it('used hedging liquidity should be updated', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
            const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(hedging.pendingDeltaLiquidity.gt(0)).to.be.true; // trade have not gone through
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.true;
          });
          it('pending increase should be true', async () => {
            expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true; // increase short!
            expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });
          it('current leverage should be 0', async () => {
            const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.leverage.isZero()).to.be.true;
            expect(leverageInfo.isLong).to.be.false;
          });
        });

        describe('after GMX execution on hedge order', () => {
          before('execute', async () => {
            const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
            await testSystem.gmx.positionRouter
              .connect(deployer)
              .executeIncreasePosition(pendingKey, await deployer.getAddress());
          });
          it('hedged delta should return negative number', async () => {
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.lt(0)).to.be.true;
          });
          it('positions should be short', async () => {
            const positions = await testSystem.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.eq(1)).to.be.true;
            expect(positions.isLong).to.be.false;
            expect(positions.longPosition.unrealisedPnl.isZero()).to.be.true;
          });
          it('position value should be positive', async () => {
            const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
            assertCloseToPercentage(currentValue, toBN('6058'), toBN('0.005')); // 0.5 percent tolerance
          });
          it('used hedging liquidity should be updated', async () => {
            const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
            const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);
            expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });
          it('pending order should be null', async () => {
            expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });
          it('current leverage should be 1.1', async () => {
            const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
            assertCloseToPercentage(leverageInfo.leverage, toBN('1.1'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.false;
          });
          it('expected hedge should match hedged', async () => {
            // need to decrease position, because delta need to hedge is lower
            const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
            const expected = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
            expect(hedged.eq(expected)).to.be.true;

            hedgedAfterUserOpen = hedged;
          });
        });

        describe('update collateral: scenario B.1) price increases', () => {
          // delta to hedge should decrease
          before('snapshot', async () => {
            // take a snapshot before price change
            snapshotId = await takeSnapshot();
          });
          after('restore snapshot', async () => {
            await restoreSnapshot(snapshotId);
          });

          describe('after price raises', () => {
            before('execute: update price', async () => {
              // take a snapshot before price change
              snapshotId = await takeSnapshot();
              await setPrice(testSystem, '1800', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
              await testSystem.optionGreekCache.updateBoardCachedGreeks(1);
            });
            it('hedged delta should return negative number', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.lt(0)).to.be.true;
              expect(hedged.gt(hedgedAfterUserOpen)).to.be.true; // abs(hedged) is lower than before
            });

            it('positions should be short, with negative profit', async () => {
              const positions = await testSystem.futuresPoolHedger.getPositions();
              expect(positions.amountOpen.eq(1)).to.be.true;
              expect(positions.isLong).to.be.false;
              // has unrealised (-) profit
              expect(positions.shortPosition.unrealisedPnl.lt(0)).to.be.true;
            });
            it('position value should be positive', async () => {
              const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
              // loss!
              assertCloseToPercentage(currentValue, toBN('4725'), toBN('0.005')); // 0.5 percent tolerance
            });

            it('abs(expectedHedge) and abs(hedged) should both, but expected is higher', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              const expected = await testSystem.futuresPoolHedger.getCappedExpectedHedge();
              expect(hedged.lt(0)).to.be.true;
              expect(hedged.gt(hedgedAfterUserOpen)).to.be.true;

              expect(expected.lt(0)).to.be.true;
              expect(expected.gt(hedgedAfterUserOpen)).to.be.true;

              // abs(expected) should be lower than abs(hedged), because the put get far OTM
              expect(expected.gt(hedged)).to.be.true;
            });

            it('used hedging liquidity should change', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              // we want to decrease our short position
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
            });

            it('pending order should be null', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should be higher, updateCollateral should increase collateral', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.41'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.false;
              expect(leverageInfo.collateralDelta.gt(0)).to.be.true;
              expect(leverageInfo.needUpdate).to.be.true;
            });
          });

          describe('after update collateral (add collateral)', () => {
            before('call update collateral', async () => {
              await testSystem.futuresPoolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') });
            });

            it('should have pending order to decrease collateral', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.true;
            });

            it('current leverage should still be higher than 1.1', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.41'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.false;

              expect(leverageInfo.needUpdate).to.be.false; // we have pending update!
            });
          });

          describe('after collateral adjustment order is executed ', () => {
            before('execute increase order', async () => {
              const pendingKey = await testSystem.futuresPoolHedger.pendingOrderKey();
              await testSystem.gmx.positionRouter
                .connect(deployer)
                .executeIncreasePosition(pendingKey, await deployer.getAddress());
            });

            it('hedging liquidity should be the same', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              //  still need to hedge again, because delta of put is not updated
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.true;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
            });

            it('should have no pending order', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should be closer to target.', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();

              assertCloseToPercentage(leverageInfo.leverage, toBN('1.25'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.false;

              const pos = await testSystem.futuresPoolHedger.getPositions();
              expect(pos.shortPosition.size.eq(pos.shortPosition.collateral)).to.be.true;
              // collateral is already same with size, can't add more
              expect(leverageInfo.needUpdate).to.be.false;
            });
          });
        });

        describe('update collateral: scenario B.2) price decreases ', () => {
          before('snapshot', async () => {
            // take a snapshot before price change
            snapshotId = await takeSnapshot();
          });

          describe('after price decrease', () => {
            before('execute: update price', async () => {
              // take a snapshot before price change
              snapshotId = await takeSnapshot();
              await setPrice(testSystem, '1300', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed);
              await testSystem.optionGreekCache.updateBoardCachedGreeks(1);
            });
            it('hedged delta should be negative, abs(hedged) is higher ', async () => {
              const hedged = await testSystem.futuresPoolHedger.getCurrentHedgedNetDelta();
              expect(hedged.lt(0)).to.be.true;
              expect(hedged.lt(hedgedAfterUserOpen)).to.be.true;
            });

            it('position value should increase to ~6947', async () => {
              const currentValue = await testSystem.futuresPoolHedger.getAllPositionsValue();
              assertCloseToPercentage(currentValue, toBN('6947'), toBN('0.005')); // 0.5 percent tolerance
            });

            it('used hedging liquidity should change (need to hedge)', async () => {
              const spot = await testSystem.GMXAdapter.getSpotPriceForMarket(testSystem.optionMarket.address, 2);
              const hedging = await testSystem.futuresPoolHedger.getHedgingLiquidity(spot);

              //  pending liquidity is 0, because we can reduce hedged amount.
              expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false;
              expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
            });

            it('pending order should be null', async () => {
              expect(await testSystem.futuresPoolHedger.hasPendingIncrease()).to.be.false;
              expect(await testSystem.futuresPoolHedger.hasPendingDecrease()).to.be.false;
            });

            it('current leverage should be the same, ignoring the profit', async () => {
              const leverageInfo = await testSystem.futuresPoolHedger.getCurrentLeverage();
              assertCloseToPercentage(leverageInfo.leverage, toBN('1.1'), toBN('0.005')); // 0.5 percent tolerance
              expect(leverageInfo.isLong).to.be.false;
              expect(leverageInfo.needUpdate).to.be.false;
            });
          });

          after('restore snapshot', async () => {
            await restoreSnapshot(snapshotId);
          });
        });
      });

      after('restore snapshot', async () => {
        await restoreSnapshot(snapshotDefault);
      });
    });

    describe('GMX Integration Environment Test', () => {
      // console.log('test system ', Object.keys(testSystem));
      it('vault can accept and close trades', async () => {
        await testSystem.gmx.USDC.connect(deployer).approve(vaultAddr, ethers.constants.MaxUint256);
        await testSystem.gmx.USDC.connect(deployer).approve(
          testSystem.gmx.positionRouter.address,
          ethers.constants.MaxUint256,
        );
        await testSystem.gmx.USDC.connect(deployer).approve(testSystem.gmx.router.address, ethers.constants.MaxUint256);

        const amount = toBN('900'); // 900 usd of exposure
        // const key = await testSystem.gmx.vault.connect(deployer).increasePosition((await deployer.getAddress()), ethAddr, ethAddr, amount, true);
        // console.log('key', key);
        const sizeDelta = '1000' + '0'.repeat(30);
        const upperPriceLimit = '1600' + '0'.repeat(30);
        const lowerPriceLimit = '1400' + '0'.repeat(30);

        await testSystem.gmx.positionRouter.createIncreasePosition(
          [usdcAddr, ethAddr],
          ethAddr,
          amount,
          0,
          sizeDelta,
          true,
          upperPriceLimit,
          await testSystem.gmx.positionRouter.minExecutionFee(),
          ethers.utils.randomBytes(32),
          ethers.constants.AddressZero,
          { value: await testSystem.gmx.positionRouter.minExecutionFee() },
        );

        let key = await testSystem.gmx.positionRouter.getRequestKey(deployer.address, 1);

        // console.log('vault info', await testSystem.gmx.vault.)

        // console.log(await testSystem.gmx.reader.getPositions(vaultAddr, await deployer.getAddress(), [usdcAddr], [ethAddr], [true]));
        await testSystem.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

        expect(
          (
            await testSystem.gmx.reader.getPositions(
              vaultAddr,
              await deployer.getAddress(),
              [ethAddr],
              [ethAddr],
              [true],
            )
          )[0],
        ).to.be.equal(sizeDelta);

        await testSystem.gmx.positionRouter.createDecreasePosition(
          [ethAddr, usdcAddr],
          ethAddr,
          amount,
          sizeDelta,
          true,
          deployer.address,
          lowerPriceLimit,
          0,
          await testSystem.gmx.positionRouter.minExecutionFee(),
          false,
          ethers.constants.AddressZero,
          { value: await testSystem.gmx.positionRouter.minExecutionFee() },
        );

        key = await testSystem.gmx.positionRouter.getRequestKey(deployer.address, 1);
        await testSystem.gmx.positionRouter.connect(deployer).executeDecreasePosition(key, await deployer.getAddress());
        expect(
          (
            await testSystem.gmx.reader.getPositions(
              vaultAddr,
              await deployer.getAddress(),
              [ethAddr],
              [ethAddr],
              [true],
            )
          )[0],
        ).to.be.equal(0);
      });
    });

    // misc function tests aim for full coverage
    describe('misc', () => {
      let random: SignerWithAddress;
      before('setup random address', async () => {
        [, , , random] = await ethers.getSigners();
      });
      it('can set referral code', async () => {
        const newCode = toBytes32('new code');
        await testSystem.futuresPoolHedger.connect(deployer).setReferralCode(newCode);

        expect((await testSystem.futuresPoolHedger.referralCode()) === newCode).to.be.true;
      });
      it('can send trapped quote to pool', async () => {
        // mint some quote to hedger
        const amount = toBN('100');
        await testSystem.gmx.eth.mint(testSystem.futuresPoolHedger.address, amount);
        const liquidityPoolEthBefore = await testSystem.gmx.eth.balanceOf(testSystem.liquidityPool.address);

        const receipt = await (await testSystem.futuresPoolHedger.connect(random).sendAllFundsToLP()).wait();

        expect(getEvent(receipt, 'BaseReturnedToLP').event).to.be.eq('BaseReturnedToLP');

        expect(getEventArgs(receipt, 'BaseReturnedToLP').amountBase).to.be.eq(amount);

        const liquidityPoolEthAfter = await testSystem.gmx.eth.balanceOf(testSystem.liquidityPool.address);
        expect(liquidityPoolEthAfter.sub(liquidityPoolEthBefore).eq(amount)).to.be.true;
        expect((await testSystem.gmx.eth.balanceOf(testSystem.futuresPoolHedger.address)).eq(0)).to.be.true;

        // mint some base to hedger
        await testSystem.gmx.USDC.mint(testSystem.futuresPoolHedger.address, amount);
        const liquidityPoolQuoteBefore = await testSystem.gmx.USDC.balanceOf(testSystem.liquidityPool.address);

        await testSystem.futuresPoolHedger.connect(random).sendAllFundsToLP();

        const liquidityPoolQuoteAfter = await testSystem.gmx.USDC.balanceOf(testSystem.liquidityPool.address);
        expect(liquidityPoolQuoteAfter.sub(liquidityPoolQuoteBefore).eq(amount)).to.be.true;
        expect((await testSystem.gmx.USDC.balanceOf(testSystem.futuresPoolHedger.address)).eq(0)).to.be.true;
      });
      it('can recover eth', async () => {
        await testSystem.futuresPoolHedger.connect(deployer).recoverEth(random.address);
        expect((await ethers.provider.getBalance(testSystem.futuresPoolHedger.address)).eq(0)).to.be.true;
      });
      it('only gmx can callCallback function', async () => {
        await expect(
          testSystem.futuresPoolHedger.connect(random).gmxPositionCallback(ethers.utils.randomBytes(32), true, true),
        ).to.be.revertedWith('GMXFuturesPoolHedger: only GMX keeper can trigger callback');
      });
    });
  });

  // Following are tests that our hedger has both long and short position opened.
  // Which should never happen in real life
  describe('GMX Pool Hedger unreachable states', () => {
    let snapId: number;
    let poolHedger: TestGMXFuturesPoolHedger;
    before(async () => {
      snapId = await takeSnapshot();
    });

    before('create a TestGMXFuturesPoolHedger entity', async () => {
      poolHedger = (await ((await ethers.getContractFactory('TestGMXFuturesPoolHedger')) as ContractFactory)
        .connect(deployer)
        .deploy()) as TestGMXFuturesPoolHedger;

      await poolHedger
        .connect(deployer)
        .init(
          testSystem.liquidityPool.address,
          testSystem.optionMarket.address,
          testSystem.optionGreekCache.address,
          testSystem.GMXAdapter.address,
          testSystem.gmx.positionRouter.address,
          testSystem.gmx.router.address,
          testSystem.gmx.USDC.address,
          testSystem.gmx.eth.address,
        );

      await poolHedger.connect(deployer).setFuturesPoolHedgerParams({
        ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
        targetLeverage: toBN('1.5'),
      });

      await poolHedger.connect(deployer).setPoolHedgerParams({
        ...DEFAULT_POOL_HEDGER_PARAMS,
        interactionDelay: 4,
      });

      // update liquidity pool to use the new hedger
      await testSystem.liquidityPool.setPoolHedger(poolHedger.address);
    });

    describe("have unexpected short position when we're supposed to be long", () => {
      let snapIdLocal: number;
      before(async () => {
        snapIdLocal = await takeSnapshot();
      });
      before('user buy long call and we hedged', async () => {
        await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });
        await fastForward(4);
        await poolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        const pendingKey = await poolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());
      });
      before('create a short position from hedger', async () => {
        const pos = await poolHedger.getPositions();
        const size = toBN('5000');
        const collat = toBN('3600');

        await poolHedger.testIncreasePosition(pos.shortPosition, false, size, collat, { value: toBN('0.01') });
        const pendingKey = await poolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());
      });
      it('amount open is 2', async () => {
        const pos = await poolHedger.getPositions();
        expect(pos.amountOpen.eq(2)).to.be.true;
      });
      it('calling hedge delta should close the short position', async () => {
        await fastForward(20);
        await poolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        const pendingKey = await poolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());

        const pos = await poolHedger.getPositions();
        expect(pos.shortPosition.size.isZero()).to.be.true;
      });
      after('restore state', async () => {
        await restoreSnapshot(snapIdLocal);
      });
    });

    describe("have unexpected long position when we're supposed to be short", () => {
      let snapIdLocal: number;
      before(async () => {
        snapIdLocal = await takeSnapshot();
      });
      before('user create buy long put and we hedged', async () => {
        await openPosition(testSystem, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_PUT,
          strikeId: 1,
        });
        await fastForward(4);
        await poolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        const pendingKey = await poolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());
      });
      before('create a long position from hedger', async () => {
        const pos = await poolHedger.getPositions();
        const size = toBN('5000');
        const collat = toBN('3600');

        await poolHedger.testIncreasePosition(pos.longPosition, true, size, collat, { value: toBN('0.01') });
        const pendingKey = await poolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeIncreasePosition(pendingKey, await deployer.getAddress());
      });
      it('amount open is 2', async () => {
        const pos = await poolHedger.getPositions();
        expect(pos.amountOpen.eq(2)).to.be.true;
      });
      it('calling update collateral should close the long position', async () => {
        await fastForward(20);
        await poolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') });
        const pendingKey = await poolHedger.pendingOrderKey();
        await testSystem.gmx.positionRouter
          .connect(deployer)
          .executeDecreasePosition(pendingKey, await deployer.getAddress());

        const pos = await poolHedger.getPositions();
        expect(pos.longPosition.size.isZero()).to.be.true;
      });
      after('restore state', async () => {
        await restoreSnapshot(snapIdLocal);
      });
    });

    after('restore state', async () => {
      await restoreSnapshot(snapId);
    });
  });

  describe('GMX ExchangeAdapter', async () => {
    before('setups', async () => {
      // approve
      await testSystem.gmx.USDC.connect(deployer).approve(testSystem.GMXAdapter.address, ethers.constants.MaxUint256);
      await testSystem.gmx.eth.connect(deployer).approve(testSystem.GMXAdapter.address, ethers.constants.MaxUint256);
    });

    describe('quote to base with default decimals', async () => {
      it('get exact base with limit', async () => {
        const ethBefore = await testSystem.gmx.eth.balanceOf(deployer.address);

        // get exactly 1 eth. spend at most 1600?
        await testSystem.GMXAdapter.exchangeToExactBaseWithLimit(
          testSystem.optionMarket.address,
          toBN('1'),
          toBN('1600'),
        );

        const ethAfter = await testSystem.gmx.eth.balanceOf(deployer.address);

        assertCloseToPercentage(ethAfter.sub(ethBefore), toBN('1'), toBN('0.013')); // 1.3 percent error range
      });

      it('revert if limit is reached', async () => {
        await expect(
          testSystem.GMXAdapter.exchangeToExactBaseWithLimit(testSystem.optionMarket.address, toBN('1'), toBN('1500')),
        ).revertedWith('InsufficientSwap');
      });

      it('sell base for quote', async () => {
        await testSystem.GMXAdapter.setMinReturnPercent(testSystem.optionMarket.address, toBN('0.98'));
        const ethBefore = await testSystem.gmx.eth.balanceOf(deployer.address);
        // sell exactly 1 eth.
        await testSystem.GMXAdapter.exchangeFromExactBase(testSystem.optionMarket.address, toBN('1'));

        const ethAfter = await testSystem.gmx.eth.balanceOf(deployer.address);
        expect(ethBefore.sub(ethAfter).eq(toBN('1'))).to.be.true;
      });
    });
  });
});

// describe("GMX Integration with USDC(6dp)", async () => {
//   let testSystem: TestSystemContractsTypeGMX;
//   let deployer: Wallet;
//   let tokenManager: Signer;
//   // let preQuoteBal: number;
//   // let preBaseBal: number;
//   let ethAddr: string;
//   let usdcAddr: string;
//   let vaultAddr: string;

//   before(async () => {
//     const provider = ethers.provider;

//     [, , tokenManager] = await ethers.getSigners();

//     const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

//     deployer = new ethers.Wallet(privateKey, provider);

//     testSystem = (await deployGMXTestSystem(deployer as any as SignerWithAddress, false, true, {
//       useGMX: true,
//       compileGMX: false,
//       optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') },
//       usdcDecimals: 6,
//       btcDecimals: 8
//     })) as TestSystemContractsTypeGMX;

//     await testSystem.gmx.fastPriceFeed.connect(tokenManager).setPriceDataInterval(600);

//     await seedTestSystemGMX(deployer, testSystem);

//     ethAddr = testSystem.gmx.eth.address;
//     vaultAddr = testSystem.gmx.vault.address;
//     usdcAddr = testSystem.gmx.USDC.address;
//     // marketView = await testSystem.optionMarketViewer.getMarket(testSystem.optionMarket.address);

//     // adding more collat to vault
//     await testSystem.gmx.eth.mint(vaultAddr, toBN('1000'));
//     await testSystem.gmx.USDC.mint(vaultAddr, toBN('1000000'));
//     await testSystem.gmx.vault.buyUSDG(ethAddr, await deployer.getAddress());
//     await testSystem.gmx.vault.buyUSDG(usdcAddr, await deployer.getAddress());

//     await testSystem.gmx.eth.mint(deployer.address,  toBN('101'));
//     await testSystem.gmx.USDC.mint(deployer.address, toBN('100001'));
//     //
//     await testSystem.futuresPoolHedger.setPoolHedgerParams({
//       ...DEFAULT_POOL_HEDGER_PARAMS,
//       interactionDelay: 4,
//     });
//   });

//   // test the adaptor with new option market, in which quote asset is USDC2 with 6 decimals
//   describe('exchange for USDC2 (with 6 decimals)', async() => {
//     before('setup', async() => {
//       await testSystem.gmx.USDC.mint(vaultAddr, toBN('1'));
//       await testSystem.gmx.vault.buyUSDG(testSystem.gmx.USDC.address, await deployer.getAddress());

//       await testSystem.gmx.USDC.mint(deployer.address, toBN('1'));
//     })
//     it ('get exact base with limit', async () => {
//       const ethBefore = await testSystem.gmx.eth.balanceOf(deployer.address)
//       const usdcBefore = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       // get exactly 1 eth. spend at most 1600?
//       await testSystem.GMXAdapter.exchangeToExactBaseWithLimit(testSystem.optionMarket.address, toBN('1'), toBN('1600'));

//       const ethAfter = await testSystem.gmx.eth.balanceOf(deployer.address)
//       const usdcAfter = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       const maxSpentUSDC2 = ethers.utils.parseUnits('1600', 6)
//       expect(usdcBefore.sub(usdcAfter).lt(maxSpentUSDC2)).to.be.true

//       assertCloseToPercentage(ethAfter.sub(ethBefore), toBN('1'), toBN('0.013')) // 1.3 percent error range
//     })

//     it ('sell base for quote', async () => {
//       await testSystem.GMXAdapter.setMinReturnPercent(testSystem.optionMarket.address, toBN('0.98'))
//       const ethBefore = await testSystem.gmx.eth.balanceOf(deployer.address)
//       const usdcBefore = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       // sell exactly 1 eth.
//       await testSystem.GMXAdapter.exchangeFromExactBase(testSystem.optionMarket.address, toBN('1'));

//       const ethAfter = await testSystem.gmx.eth.balanceOf(deployer.address)
//       const usdcAfter = await testSystem.gmx.USDC.balanceOf(deployer.address)
//       expect(ethBefore.sub(ethAfter).eq(toBN('1'))).to.be.true

//       assertCloseToPercentage(usdcAfter.sub(usdcBefore), ethers.utils.parseUnits('1500', 6), toBN('0.015')) // 1.5 percent error range
//       expect(ethBefore.sub(ethAfter).eq(toBN('1'))).to.be.true
//     })
//   })

//   describe('exchange for BTC2 <> USDC2', async() => {

//     let btcOptionMarket: OptionMarket

//     before('deploy option market with USDC2 & BTC', async() => {
//       btcOptionMarket = (await ((await ethers.getContractFactory('OptionMarket')) as ContractFactory)
//         .connect(deployer)
//         .deploy()) as OptionMarket;

//       await btcOptionMarket
//         .connect(deployer)
//         .init(
//           testSystem.GMXAdapter.address,
//           testSystem.liquidityPool.address,
//           testSystem.optionMarketPricer.address,
//           testSystem.optionGreekCache.address,
//           testSystem.shortCollateral.address,
//           testSystem.optionToken.address,
//           testSystem.gmx.USDC.address,
//           testSystem.gmx.btc.address,
//         );

//       await testSystem.GMXAdapter.setMinReturnPercent(btcOptionMarket.address, toBN('1.0'));
//       await testSystem.GMXAdapter.setStaticSwapFeeEstimate(btcOptionMarket.address, toBN('1.015'));
//       await testSystem.GMXAdapter.setPriceVarianceCBPercent(btcOptionMarket.address, toBN('0.015'));
//     })
//     before('setup', async() => {
//       await testSystem.gmx.USDC.mint(vaultAddr, toBN('10'));
//       await testSystem.gmx.vault.buyUSDG(testSystem.gmx.USDC.address, await deployer.getAddress());
//       await testSystem.gmx.btc.mint(vaultAddr, toBN('1'));
//       await testSystem.gmx.vault.buyUSDG(testSystem.gmx.btc.address, await deployer.getAddress());

//       await testSystem.gmx.USDC.mint(deployer.address, toBN('100'));
//       await testSystem.gmx.btc.mint(deployer.address, toBN('1'));
//     })
//     it ('get exact base with limit', async () => {
//       const btcBefore = await testSystem.gmx.btc.balanceOf(deployer.address)
//       const usdcBefore = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       // get exactly 1 btc. spend at most 1600?
//       await testSystem.GMXAdapter.exchangeToExactBaseWithLimit(btcOptionMarket.address, toBN('1'), toBN('20100'));

//       const btcAfter = await testSystem.gmx.btc.balanceOf(deployer.address)
//       const usdcAfter = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       const maxSpentUSDC2 = ethers.utils.parseUnits('20100', 6)
//       expect(usdcBefore.sub(usdcAfter).lte(maxSpentUSDC2)).to.be.true

//       assertCloseToPercentage(btcAfter.sub(btcBefore), ethers.utils.parseUnits('1', 8), toBN('0.013')) // 1.3 percent error range
//     })

//     it ('sell base for quote', async () => {
//       await testSystem.GMXAdapter.setMinReturnPercent(btcOptionMarket.address, toBN('0.98'))
//       const btcBefore = await testSystem.gmx.btc.balanceOf(deployer.address)
//       const usdcBefore = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       // sell exactly 1 eth.
//       await testSystem.GMXAdapter.exchangeFromExactBase(btcOptionMarket.address, toBN('1'));

//       const btcAfter = await testSystem.gmx.btc.balanceOf(deployer.address)
//       const usdcAfter = await testSystem.gmx.USDC.balanceOf(deployer.address)

//       expect(btcBefore.sub(btcAfter).eq(ethers.utils.parseUnits('1', 8))).to.be.true

//       assertCloseToPercentage(usdcAfter.sub(usdcBefore), ethers.utils.parseUnits('20001', 6), toBN('0.015')) // 1.5 percent error range

//     })
//   })
// })
