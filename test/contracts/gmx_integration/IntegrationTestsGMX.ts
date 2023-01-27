import { ethers } from 'hardhat';
import {
  getEvent,
  getEventArgs,
  OptionType,
  toBytes32,
  toBN,
  ZERO_ADDRESS,
  MAX_UINT,
  fromBN,
} from '../../../scripts/util/web3utils';
import {
  DEFAULT_OPTION_MARKET_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
  DEFAULT_GMX_POOL_HEDGER_PARAMS,
  PricingType,
  DEFAULT_GMX_ADAPTER_PARAMS,
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
import { getSpotPrice } from '../../utils/contractHelpers';

// section for GMX tests to work in
describe('Integration Tests - GMX', () => {
  let c: TestSystemContractsTypeGMX;
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

    c = (await deployGMXTestSystem(deployer as any as SignerWithAddress, false, true, {
      useGMX: true,
      compileGMX: false,
      optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') },
    })) as TestSystemContractsTypeGMX;

    await c.gmx.fastPriceFeed.connect(tokenManager).setPriceDataInterval(600);

    await seedTestSystemGMX(deployer, c);

    ethAddr = c.gmx.eth.address;
    vaultAddr = c.gmx.vault.address;
    usdcAddr = c.gmx.USDC.address;
    // marketView = await c.optionMarketViewer.getMarket(c.optionMarket.address);

    // adding more collat to vault
    await c.gmx.eth.mint(vaultAddr, toBN('1000'));
    await c.gmx.vault.directPoolDeposit(ethAddr);

    await c.gmx.USDC.mint(vaultAddr, toBN('1000000'));
    await c.gmx.vault.directPoolDeposit(usdcAddr);
    // await c.gmx.vault.buyUSDG(ethAddr, await deployer.getAddress());
    // await c.gmx.vault.buyUSDG(usdcAddr, await deployer.getAddress());

    await c.gmx.btc.mint(vaultAddr, toBN('100', 8));
    await c.gmx.vault.directPoolDeposit(c.gmx.btc.address);

    await c.gmx.eth.mint(deployer.address, toBN('101'));
    await c.gmx.USDC.mint(deployer.address, toBN('100001'));
    //
    await c.futuresPoolHedger.setPoolHedgerParams({
      ...DEFAULT_POOL_HEDGER_PARAMS,
      interactionDelay: 4,
    });
  });

  describe('GMX Pool Hedger', () => {
    let snapId: number;

    beforeEach(async () => {
      snapId = await takeSnapshot();
      // preQuoteBal = +fromBN(await c.gmx.USDC.balanceOf(deployer.address));
      // preBaseBal = +fromBN(await c.gmx.eth.balanceOf(deployer.address));
    });

    afterEach(async () => {
      await restoreSnapshot(snapId);
    });

    // test hedge function behavior when user trade against the AMM
    describe('GMX hedger hedge tests based on user positions', () => {
      it('Hedge long from zero', async () => {
        const positionId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        const hedgingTx = await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        const receipt = await hedgingTx.wait();
        expect(getEvent(receipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');

        const argsRet = getEventArgs(receipt, 'PositionUpdated');
        expect(argsRet.isIncrease).to.be.true;

        // Before the position update is executed, the hedger has value since there is collateral pending in the GMX
        // router contract.
        const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
        expect(currentValue).eq(await c.gmx.USDC.balanceOf(c.gmx.positionRouter.address));

        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'InteractionDelayNotExpired',
        );
        await fastForward(4);
        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );

        let pendingKey = await c.futuresPoolHedger.pendingOrderKey();

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        const totalValue = await c.futuresPoolHedger.getAllPositionsValue();

        // totalValue 7554.688269809002202055
        assertCloseToPercentage(totalValue, toBN('7555'), toBN('0.01'));

        const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);

        // the pool is hedged, should not need pending delta liquidity
        const { pendingDeltaLiquidity, usedDeltaLiquidity } = await c.futuresPoolHedger.getHedgingLiquidity(spot);

        // liquidity is the same as position value
        assertCloseToPercentage(usedDeltaLiquidity, toBN('7555'), toBN('0.01'));

        expect(pendingDeltaLiquidity).eq(0);

        const positions = await c.futuresPoolHedger.getPositions();
        expect(positions.isLong).to.be.true;
        const expectedNetDelta = (await c.optionGreekCache.getGlobalCache()).netGreeks.netDelta;
        expect(await c.futuresPoolHedger.getCappedExpectedHedge()).eq(expectedNetDelta);
        assertCloseToPercentage(positions.longPosition.size, expectedNetDelta.mul(spot).div(toBN('1')));
        assertCloseToPercentage(
          positions.longPosition.collateral,
          expectedNetDelta.mul(spot).div(DEFAULT_GMX_POOL_HEDGER_PARAMS.targetLeverage),
        );

        await fastForward(4);
        await c.futuresPoolHedger.hedgeDelta({ value: toBN('0.01') }); // does nothing
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        await closePosition(c, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();

        expect(await c.gmx.eth.balanceOf(c.futuresPoolHedger.address)).eq(0);
        expect(await c.gmx.USDC.balanceOf(c.futuresPoolHedger.address)).eq(0);

        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'InteractionDelayNotExpired',
        );

        await fastForward(4);
        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );

        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        await closePosition(c, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());
      });

      it('Hedge from long to short', async () => {
        // Setup: Create net long position for hedger
        //user long call against the pool, we open long to hedge
        const longPositionId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        const receipt = await (await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).wait();
        expect(getEvent(receipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');
        expect(getEvent(receipt, 'OrderPosted').event).to.be.eq('OrderPosted');
        expect(getEventArgs(receipt, 'OrderPosted').positionKey).to.be.eq(await c.futuresPoolHedger.pendingOrderKey());
        expect(getEventArgs(receipt, 'OrderPosted').isIncrease).to.be.true;
        expect(getEventArgs(receipt, 'OrderPosted').isLong).to.be.true;

        const argsRet = getEventArgs(receipt, 'PositionUpdated');
        expect(argsRet.isIncrease).to.be.true;

        let pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        const position = await c.futuresPoolHedger.getPositions();
        expect(position.isLong).to.be.true;

        // ===== Setup Finished =====

        // user close long
        await closePosition(c, 'sETH', {
          positionId: longPositionId,
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: 0,
        });
        // create another short
        const shortPosId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });

        // ---> first hedgeDelta: after pool is net short: create order to decrease long position.
        let shortReceipt = await (
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })
        ).wait();
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;
        expect(getEvent(shortReceipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');
        expect(getEventArgs(shortReceipt, 'PositionUpdated').isIncrease).to.be.false;

        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        // After pending order got executed
        const positionAfterExec = await c.futuresPoolHedger.getPositions();
        expect(positionAfterExec.shortPosition.size).eq(0);
        expect(positionAfterExec.longPosition.size).eq(0);
        expect(positionAfterExec.amountOpen).eq(0);

        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        // // ---> second hedgeDelta: create order to increase short position
        shortReceipt = await (await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).wait(); // error
        expect(getEvent(shortReceipt, 'PositionUpdated').event).to.be.eq('PositionUpdated');
        expect(getEventArgs(shortReceipt, 'PositionUpdated').isIncrease).to.be.true;
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        const positionAfterHedge2 = await c.futuresPoolHedger.getPositions();
        expect(positionAfterHedge2.shortPosition.size).eq(0);
        expect(positionAfterHedge2.amountOpen).eq(0);

        // After pending order got executed
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();

        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        const positionAfterExec2 = await c.futuresPoolHedger.getPositions();
        expect(positionAfterExec2.shortPosition.size.gt(0)).is.true;
        expect(positionAfterExec2.amountOpen.eq(1)).is.true;

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        // user close the short position. AMM back to delta neutral
        await closePosition(c, 'sETH', {
          positionId: shortPosId,
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: 0,
        });

        const expectedHedge = await c.futuresPoolHedger.getCappedExpectedHedge();
        expect(expectedHedge).eq(0);
      });

      it('Hedge short from zero', async () => {
        const positionId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        let pendingKey = await c.futuresPoolHedger.pendingOrderKey();

        await fastForward(4);
        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        // user close half of the position

        await closePosition(c, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('5'),
        });

        // create decrease order to reduce short position
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        const hasPendingDecrease = await c.futuresPoolHedger.hasPendingDecrease();
        expect(hasPendingDecrease).to.be.true;

        pendingKey = await c.futuresPoolHedger.pendingOrderKey();

        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'InteractionDelayNotExpired',
        );

        await fastForward(4);
        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'PositionRequestPending',
        );

        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        await closePosition(c, 'sETH', {
          positionId,
          amount: toBN('5'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: 0,
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());
      });

      it('Hedge from short to long', async () => {
        const shortPositionId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        let pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await fastForward(4);
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        // ======= user close the entire short, open long ====== /
        await closePosition(c, 'sETH', {
          positionId: shortPositionId,
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: 0,
        });

        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        // ========= First hedge call: remove short ========== //
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;

        pendingKey = await c.futuresPoolHedger.pendingOrderKey();

        await fastForward(4);

        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(hedged).eq(0);

        // ========= Second hedge call: create long ========== //

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        const positionAfterExec2 = await c.futuresPoolHedger.getPositions();

        expect(positionAfterExec2.longPosition.size.gt(0)).is.true;
        expect(positionAfterExec2.amountOpen.eq(1)).is.true;

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
      });

      it('Case: need to hedge from zero to long, but needed amount change before execution', async () => {
        // Setup: Create net long position for hedger
        // user long call against the pool, we open long to hedge
        const longPositionId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        // ===== Setup Finished, with a pending order =====
        const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);

        const hedgingStatusBefore = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(hedgingStatusBefore.pendingDeltaLiquidity.isZero()).to.be.false; // still need liquidity: trade has not gone through
        expect(hedgingStatusBefore.usedDeltaLiquidity).gt(0); // position not updated yet, but collateral is pending

        // user close long
        await closePosition(c, 'sETH', {
          positionId: longPositionId,
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: 0,
        });

        // check the state now

        const hedgingStatusAfterTrade = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(hedgingStatusAfterTrade.pendingDeltaLiquidity).eq(0); // seems like we're balanced again!
        expect(hedgingStatusAfterTrade.usedDeltaLiquidity).gt(0); // position is updated
        expect(hedgingStatusAfterTrade.usedDeltaLiquidity.eq(hedgingStatusBefore.usedDeltaLiquidity)).to.be.true;

        // ==== Update: execute increase order

        const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        const hedgingStatusAfterHedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);

        // liquidity used is higher than amount needed to hedge (0). pendingDeltaLiquidity is zero
        expect(hedgingStatusAfterHedge.pendingDeltaLiquidity).eq(0);

        expect(hedgingStatusAfterTrade.usedDeltaLiquidity).gt(0);
        expect(hedgingStatusAfterTrade.usedDeltaLiquidity.eq(hedgingStatusBefore.usedDeltaLiquidity)).to.be.true;

        // ==== Update: hedge again =====
        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;
      });
    });

    // test hedge function behavior when price changes
    describe('GMX hedger hedge tests based on price changes', () => {
      it('Scenario A): AMM is net short', async () => {
        ////////
        // user creates long position
        await setPrice(c, '1500', c.gmx.eth, c.gmx.ethPriceFeed);

        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });
        await fastForward(4);

        ////////
        // hedger should go long
        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        let pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
        expect(leverageInfo.isLong).to.be.true;

        ////////
        // if spot price increases, hedger needs to long more
        let oldNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        let oldTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        await setPrice(c, '1800', c.gmx.eth, c.gmx.ethPriceFeed);

        await c.optionGreekCache.updateBoardCachedGreeks(1);

        let newNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();

        // price increases: our hedged delta exposure decrease because size / spot decrease
        expect(newNetDelta.lt(oldNetDelta)).to.be.true;

        let spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
        let hedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);

        expect(hedge.usedDeltaLiquidity);
        expect(hedge.pendingDeltaLiquidity).gt(0);

        let newTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        expect(newTarget.gt(oldTarget)).to.be.true;

        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        let newHedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(newHedge.pendingDeltaLiquidity).eq(0);

        ////////
        // if spot price decreases, hedger needs to long less
        oldNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();

        oldTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        await setPrice(c, '1200', c.gmx.eth, c.gmx.ethPriceFeed);
        await c.optionGreekCache.updateBoardCachedGreeks(1);

        newNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(newNetDelta.gt(oldNetDelta)).to.be.true;

        spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
        hedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);

        // don't need to add more.
        expect(hedge.pendingDeltaLiquidity).eq(0);

        newTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        expect(newTarget.lt(oldTarget)).to.be.true;

        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;

        newHedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(newHedge.pendingDeltaLiquidity).eq(0);
      });

      it('Scenario B): AMM is net long', async () => {
        ////////
        // user creates short position
        await setPrice(c, '1500', c.gmx.eth, c.gmx.ethPriceFeed);

        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.SHORT_CALL_BASE,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });
        await fastForward(4);

        ////////
        // hedger should go short
        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        let pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
        expect(leverageInfo.isLong).to.be.false;

        ////////
        // if spot price increases, hedger need to increase short
        let oldNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        let oldTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        await setPrice(c, '1800', c.gmx.eth, c.gmx.ethPriceFeed);

        await c.optionGreekCache.updateBoardCachedGreeks(1);

        let newNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();

        // price increases: our hedged delta exposure increase because size / spot increase (negative)
        expect(newNetDelta.gt(oldNetDelta)).to.be.true;

        let spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
        let hedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);

        expect(hedge.usedDeltaLiquidity);
        expect(hedge.pendingDeltaLiquidity).gt(0); // not sure

        let newTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        expect(newTarget.lt(oldTarget)).to.be.true; // need to go more negative

        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        let newHedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(newHedge.pendingDeltaLiquidity).eq(0);

        ////////
        // if spot price decreases
        oldNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();

        oldTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        await setPrice(c, '1300', c.gmx.eth, c.gmx.ethPriceFeed);
        await c.optionGreekCache.updateBoardCachedGreeks(1);

        // net delta decreased to a more negative number
        newNetDelta = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(newNetDelta.lt(0)).to.be.true;
        expect(newNetDelta.lt(oldNetDelta)).to.be.true;

        spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
        hedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);

        // don't need to add more.
        expect(hedge.pendingDeltaLiquidity).eq(0);

        newTarget = await c.futuresPoolHedger.getCappedExpectedHedge();

        expect(newTarget.lt(0)).to.be.true;
        expect(newTarget.gt(oldTarget)).to.be.true; // less negative

        await fastForward(4);
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;
        pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;

        newHedge = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(newHedge.pendingDeltaLiquidity).eq(0);
      });
    });

    describe('Edge cases', () => {
      describe('Large price movements when attempting to hedge', async () => {
        it('Edge Case: Large price movement after order submitted', async () => {
          const amount = toBN('10');
          await openPosition(c, 'sETH', {
            amount: amount,
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });

          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          await setPrice(c, '2500', c.gmx.eth, c.gmx.ethPriceFeed);
          expect(await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, PricingType.MAX_PRICE)).to.be.eq(
            toBN('2500'),
          );
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          await c.gmx.positionRouter.connect(deployer).executeIncreasePositions(1, deployer.address);

          // const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, PricingType.MAX_PRICE);
          // expected Hedge is 556 plus a load of trailing.

          expect(await c.gmx.USDC.balanceOf(c.futuresPoolHedger.address)).to.eq(0);
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        });

        it('Edge Case: no callback leaves funds in hedger', async () => {
          const amount = toBN('10');
          await openPosition(c, 'sETH', {
            amount: amount,
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });

          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

          await setPrice(c, '2500', c.gmx.eth, c.gmx.ethPriceFeed);
          expect(await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, PricingType.MAX_PRICE)).to.be.eq(
            toBN('2500'),
          );
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;

          await c.gmx.positionRouter.connect(deployer).setCallbackGasLimit(0);
          await c.gmx.positionRouter.connect(deployer).executeIncreasePositions(1, deployer.address);

          expect(await c.gmx.USDC.balanceOf(c.futuresPoolHedger.address)).to.be.gt(0);
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          await c.futuresPoolHedger.sendAllFundsToLP();
          expect(await c.gmx.USDC.balanceOf(c.futuresPoolHedger.address)).to.eq(0);
        });
      });
      it('cancel increase order', async () => {
        ////////
        // Create a pending increase order
        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;

        ////////
        // cannot cancel a new order
        await expect(c.futuresPoolHedger.connect(deployer).cancelPendingOrder()).revertedWith(
          'CancellationDelayNotPassed',
        );

        await c.futuresPoolHedger.setFuturesPoolHedgerParams({
          ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
          minCancelDelay: 0,
        });

        ////////
        // cancellation failure
        await c.gmx.positionRouter.setDelayValues(10, 0, 100000);
        await c.gmx.positionRouter.setPositionKeeper(c.futuresPoolHedger.address, true);
        await expect(c.futuresPoolHedger.cancelPendingOrder()).revertedWith('OrderCancellationFailure');
        await c.gmx.positionRouter.setPositionKeeper(c.futuresPoolHedger.address, false);

        ////////
        // can cancel a normal order after delay
        await fastForward(2000);
        const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
        const receipt = await (await c.futuresPoolHedger.connect(deployer).cancelPendingOrder()).wait();
        expect(getEvent(receipt, 'OrderCanceled').event).to.be.eq('OrderCanceled');
        expect(getEventArgs(receipt, 'OrderCanceled').pendingOrderKey).to.be.eq(pendingKey);

        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;

        // can hedge again
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
      });
      it('cancel decrease order', async () => {
        ////////
        // Create a pending decrease order
        const positionId = await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });

        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        const key = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

        await fastForward(200);

        await closePosition(c, 'sETH', {
          positionId,
          amount: toBN('6'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;

        ////////
        // cannot cancel a new normal order
        await expect(c.futuresPoolHedger.connect(deployer).cancelPendingOrder()).revertedWith(
          'CancellationDelayNotPassed',
        );

        await c.futuresPoolHedger.setFuturesPoolHedgerParams({
          ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
          minCancelDelay: 0,
        });

        ////////
        // cancellation failure
        await c.gmx.positionRouter.setDelayValues(10, 0, 100000);
        await c.gmx.positionRouter.setPositionKeeper(c.futuresPoolHedger.address, true);
        await expect(c.futuresPoolHedger.cancelPendingOrder()).revertedWith('OrderCancellationFailure');
        await c.gmx.positionRouter.setDelayValues(1, 1, 100000);

        ////////
        // can cancel a normal order after delay
        await fastForward(2000);
        await c.futuresPoolHedger.connect(deployer).cancelPendingOrder();
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;

        // can hedge again
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
      });
      it('update leverage', async () => {
        const targetLeverageOverride = toBN('5');

        ////////
        // Create a net long hedge

        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        let key = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

        ////////
        // increase target leverage
        let receipt = await (
          await c.futuresPoolHedger.connect(deployer).setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            targetLeverage: targetLeverageOverride,
          })
        ).wait();
        expect(receipt.events).to.have.length(1);
        expect(getEvent(receipt, 'FuturesPoolHedgerParamsSet').event).to.be.eq('FuturesPoolHedgerParamsSet');
        expect(getEventArgs(receipt, 'FuturesPoolHedgerParamsSet').futuresPoolHedgerParams.targetLeverage).to.be.eq(
          targetLeverageOverride,
        );

        ////////
        // collateral delta should be negative (decrease collateral)
        let leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
        expect(leverageInfo.collateralDelta.lt(0)).to.be.true;

        ////////
        // call update collateral should decrease position
        receipt = await (await c.futuresPoolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') })).wait();
        expect(getEvent(receipt, 'CollateralOrderPosted').event).to.be.eq('CollateralOrderPosted');
        // hedger is long
        expect(getEventArgs(receipt, 'CollateralOrderPosted').isLong).to.be.true;
        expect(getEventArgs(receipt, 'CollateralOrderPosted').collateralDelta).to.be.lt(0);
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;
        key = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(key, await deployer.getAddress());

        const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
        const positions = await c.futuresPoolHedger.getPositions();
        expect(positions.isLong).to.be.true;
        const expectedNetDelta = (await c.optionGreekCache.getGlobalCache()).netGreeks.netDelta;
        expect(await c.futuresPoolHedger.getCappedExpectedHedge()).eq(expectedNetDelta);
        assertCloseToPercentage(positions.longPosition.size, expectedNetDelta.mul(spot).div(toBN('1')));
        assertCloseToPercentage(
          positions.longPosition.collateral,
          expectedNetDelta.mul(spot).div(targetLeverageOverride),
        );

        leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();

        expect(leverageInfo.collateralDelta).eq(0);

        ////////
        // call update collateral again should do nothing
        leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
        expect(leverageInfo.needUpdate).to.be.false;
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
      });
      it('GMX liquidation', async () => {
        ////////
        // Update pool parameter and create net long position

        await setPrice(c, '1500', c.gmx.eth, c.gmx.ethPriceFeed);

        await c.futuresPoolHedger.connect(deployer).setFuturesPoolHedgerParams({
          ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
          targetLeverage: toBN('10'),
        });

        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        let key = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

        ////////
        // price change and our position got liquidated
        await setPrice(c, '800', c.gmx.eth, c.gmx.ethPriceFeed);

        await c.gmx.vault.connect(deployer).liquidatePosition(
          c.futuresPoolHedger.address,
          await c.futuresPoolHedger.baseAsset(), // collateral
          await c.futuresPoolHedger.baseAsset(), // index
          true,
          deployer.address,
        );

        ////////
        // hedged delta is 0
        let hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(hedged).eq(0);

        ////////
        // position is empty
        const pos = await c.futuresPoolHedger.getPositions();
        expect(pos.amountOpen).eq(0);

        ////////
        // can hedge again
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        key = await c.futuresPoolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

        hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(hedged).gt(0);
      });
      describe('deactivate hedger', () => {
        it('close a net long position on hedger', async () => {
          ////////
          // Create a net long hedge

          await openPosition(c, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
            setCollateralTo: toBN('10'),
          });
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          let key = await c.futuresPoolHedger.pendingOrderKey();
          await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

          ////////
          // set cap to 0
          await c.futuresPoolHedger.connect(deployer).setPoolHedgerParams({
            ...DEFAULT_POOL_HEDGER_PARAMS,
            hedgeCap: 0,
          });

          ////////
          // call hedgeDelta should close all position
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          key = await c.futuresPoolHedger.pendingOrderKey();
          await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(key, await deployer.getAddress());

          ////////
          // hedged delta and capped expected are both 0
          expect(await c.futuresPoolHedger.getCurrentHedgedNetDelta()).eq(0);
          expect(await c.futuresPoolHedger.getCappedExpectedHedge()).eq(0);

          ////////
          // position is empty
          const pos = await c.futuresPoolHedger.getPositions();
          expect(pos.amountOpen).eq(0);

          ////////
          // pending liquidity becomes 0
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);

          // the pool is hedged, should not need pending delta liquidity
          const { pendingDeltaLiquidity, usedDeltaLiquidity } = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(usedDeltaLiquidity).eq(0);
          expect(pendingDeltaLiquidity).eq(0);
        });

        it('close a net short position on hedger', async () => {
          ////////
          // Create a net short hedge

          await openPosition(c, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_PUT,
            strikeId: 1,
          });
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          let key = await c.futuresPoolHedger.pendingOrderKey();
          await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

          ////////
          // set cap to 0
          await c.futuresPoolHedger.connect(deployer).setPoolHedgerParams({
            ...DEFAULT_POOL_HEDGER_PARAMS,
            hedgeCap: 0,
          });

          ////////
          // call hedgeDelta should close all position
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          key = await c.futuresPoolHedger.pendingOrderKey();
          await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(key, await deployer.getAddress());

          ////////
          // hedged delta and capped expected are both 0
          expect(await c.futuresPoolHedger.getCurrentHedgedNetDelta()).eq(0);
          expect(await c.futuresPoolHedger.getCappedExpectedHedge()).eq(0);

          ////////
          // position is empty
          const pos = await c.futuresPoolHedger.getPositions();
          expect(pos.amountOpen).eq(0);
        });
      });
      // un-comment after unifying tokens
      it.skip('no liquidity from liquidity pool', async () => {
        ////////
        // Create a net long hedge
        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
          setCollateralTo: toBN('10'),
        });

        ////////
        // burn quote from liquidity pool
        const balance = await c.gmx.USDC.balanceOf(c.liquidityPool.address);
        await c.gmx.USDC.connect(deployer).burn(c.liquidityPool.address, balance);

        ////////
        // cannot hedge
        await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        await expect(c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') })).revertedWith(
          'NoQuoteReceivedFromLP',
        );
        // })
      });

      async function openLong(amount: string) {
        await c.gmx.USDC.approve(c.gmx.router.address, MAX_UINT);
        await c.gmx.eth.approve(c.gmx.router.address, MAX_UINT);
        const tx = await c.gmx.positionRouter.createIncreasePosition(
          [usdcAddr, ethAddr],
          ethAddr,
          toBN(amount).div(2), // 2x leverage
          0,
          toBN(amount, 30),
          true,
          MAX_UINT,
          await c.gmx.positionRouter.minExecutionFee(),
          ethers.utils.randomBytes(32),
          ethers.constants.AddressZero,
          { value: await c.gmx.positionRouter.minExecutionFee() },
        );
        const key = await c.gmx.positionRouter.getRequestKey(
          deployer.address,
          getEventArgs(await tx.wait(), 'CreateIncreasePosition').index,
        );
        await c.gmx.positionRouter.executeIncreasePosition(key, deployer.address);
      }

      async function openShort(amount: string) {
        await c.gmx.USDC.approve(c.gmx.router.address, MAX_UINT);
        await c.gmx.eth.approve(c.gmx.router.address, MAX_UINT);
        const tx = await c.gmx.positionRouter.createIncreasePosition(
          [usdcAddr],
          ethAddr,
          toBN(amount).div(2), // 2x leverage
          0,
          toBN(amount, 30),
          false,
          0,
          await c.gmx.positionRouter.minExecutionFee(),
          ethers.utils.randomBytes(32),
          ethers.constants.AddressZero,
          { value: await c.gmx.positionRouter.minExecutionFee() },
        );
        const key = await c.gmx.positionRouter.getRequestKey(
          deployer.address,
          getEventArgs(await tx.wait(), 'CreateIncreasePosition').index,
        );
        await c.gmx.positionRouter.executeIncreasePosition(key, deployer.address);
      }

      it('getRemainingLongLiquidityDollars', async () => {
        const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, PricingType.MIN_PRICE);
        expect(spot).eq(toBN('1500'));
        // spot at 1500, so open 100 longs worth
        await openLong('150000');
        const guaranteedUSD = await c.gmx.vault.guaranteedUsd(c.gmx.eth.address);
        assertCloseToPercentage(guaranteedUSD, toBN('150000', 30).div(2), toBN('0.01'));

        // 1.5M in long liquidity
        // 150000 used
        assertCloseToPercentage(
          await c.futuresPoolHedger.getRemainingLongLiquidityDollars(spot),
          toBN('1500000').sub(toBN('150000')),
        );

        {
          // Very low long size - means 0 is available after the trade
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [toBN('1', 30)], [0]);
          expect(await c.futuresPoolHedger.getRemainingLongLiquidityDollars(spot)).eq(0);
        }

        {
          // long size equal to "guaranteedUSD" - means 0 remaining
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [guaranteedUSD], [0]);
          expect(await c.futuresPoolHedger.getRemainingLongLiquidityDollars(spot)).eq(0);
        }

        {
          // add 1 extra unit (30dp in gmx) to max global size
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [guaranteedUSD.add(toBN('1', 30))], [0]);
          // as this value is in dollars, there is 1 dollar remaining:
          expect(await c.futuresPoolHedger.getRemainingLongLiquidityDollars(spot)).eq(toBN('1'));
        }

        {
          // guaranteedUSD < maxGlobalLongSize. remainingDollars < remainingCappedDollars
          // Basically: cap < total available
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [toBN('1000000', 30)], [0]);

          // If cap is 150M, remaining liquidity is 150M minus the 100 longs previously opened BUT ADDING the collateral
          assertCloseToPercentage(
            await c.futuresPoolHedger.getRemainingLongLiquidityDollars(spot),
            toBN('1000000').sub(spot.mul(100).div(2)),
          );
        }

        {
          // maxGlobalLongSize < guaranteedUSD. remainingDollars < remainingCappedDollars
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [toBN('10000000', 30)], [0]);
          // This time we only look at the pool liquidity disregarding the added collateral
          assertCloseToPercentage(
            await c.futuresPoolHedger.getRemainingLongLiquidityDollars(spot),
            toBN('1500000').sub(toBN('150000')),
          );
        }
      });

      it('getRemainingShortLiquidityDollars', async () => {
        const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, PricingType.MIN_PRICE);
        expect(spot).eq(toBN('1500'));
        await openShort('150000');
        const globalShortSizes = await c.gmx.vault.globalShortSizes(c.gmx.eth.address);
        expect(globalShortSizes).eq(toBN('150000', 30));

        // Short side starts with 1M liquidity
        // 150k is used
        expect(await c.futuresPoolHedger.getRemainingShortLiquidityDollars()).eq(toBN('850000'));

        {
          // Very low long size - means 0 is available after the trade
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [toBN('1', 30)]);
          expect(await c.futuresPoolHedger.getRemainingShortLiquidityDollars()).eq(0);
        }

        {
          // long size equal to "guaranteedUSD" - means 0 remaining
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [globalShortSizes]);
          expect(await c.futuresPoolHedger.getRemainingShortLiquidityDollars()).eq(0);
        }

        {
          // add 1 extra unit (30dp in gmx) to max global size
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [globalShortSizes.add(toBN('1', 30))]);
          // as this value is in dollars, there is 1 dollar remaining:
          expect(await c.futuresPoolHedger.getRemainingShortLiquidityDollars()).eq(toBN('1'));
        }

        {
          // globalShortSizes < maxGlobalShortSize. remainingDollars < remainingCappedDollars
          // Basically: cap < total available
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [toBN('500000', 30)]);

          // If cap is 150M, remaining liquidity is 150M minus the 100 longs previously opened NOT ADDING the collateral
          assertCloseToPercentage(
            await c.futuresPoolHedger.getRemainingShortLiquidityDollars(),
            toBN('500000').sub(spot.mul(100)),
          );
        }

        {
          // maxGlobalShortSize < globalShortSizes. remainingDollars < remainingCappedDollars
          await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [toBN('10000000', 30)]);
          // This time we only look at the pool liquidity disregarding the added collateral
          assertCloseToPercentage(await c.futuresPoolHedger.getRemainingShortLiquidityDollars(), toBN('850000'));
        }
      });

      it('caps longs based on remaining GMX liquidity', async () => {
        await increaseDeltaExposure(c, 5);
        await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [toBN('1000', 30)], [0]);
        await expect(await c.futuresPoolHedger.canHedge(0, false, 0)).false;
        await expect(await c.futuresPoolHedger.canHedge(0, true, 0)).true;
        await executeIncreaseHedge(c);

        const hedgerState = await c.futuresPoolHedger.getHedgerState();

        expect(hedgerState.currentPositions.longPosition.size).eq(toBN('1000'));
        // 1.1 target leverage
        assertCloseToPercentage(hedgerState.currentPositions.longPosition.collateral, toBN('1000').mul(10).div(11));

        // set interactionDelay to 1 so we can hedge again
        await c.futuresPoolHedger.setPoolHedgerParams({
          ...DEFAULT_POOL_HEDGER_PARAMS,
          interactionDelay: 1,
        });

        // Now if we increase the cap and hedge again, it will open more
        await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [toBN('2000', 30)], [0]);
        await executeIncreaseHedge(c);

        const hedgerState2 = await c.futuresPoolHedger.getHedgerState();

        // the longSize is buffered by the amount of collateral posted to the pool so we can actually open up to 2900ish
        assertCloseToPercentage(hedgerState2.currentPositions.longPosition.size, toBN('2909'));
        // 1.1 target leverage - but because of fees this ends up slightly over collateralised.
        assertCloseToPercentage(
          hedgerState2.currentPositions.longPosition.collateral,
          toBN('2909').mul(10).div(11),
          toBN('0.05'),
        );
      });

      it('caps shorts based on remaining GMX liquidity', async () => {
        await reduceDeltaExposure(c, 5);
        await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [toBN('1000', 30)]);
        await expect(await c.futuresPoolHedger.canHedge(0, true, 0)).false;
        await expect(await c.futuresPoolHedger.canHedge(0, false, 0)).true;
        await executeIncreaseHedge(c);

        const hedgerState = await c.futuresPoolHedger.getHedgerState();

        expect(hedgerState.currentPositions.shortPosition.size).eq(toBN('1000'));
        // 1.1 target leverage
        assertCloseToPercentage(hedgerState.currentPositions.shortPosition.collateral, toBN('1000').mul(10).div(11));

        // set interactionDelay to 1 so we can hedge again
        await c.futuresPoolHedger.setPoolHedgerParams({
          ...DEFAULT_POOL_HEDGER_PARAMS,
          interactionDelay: 1,
        });

        await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [toBN('2000', 30)]);
        await executeIncreaseHedge(c);

        const hedgerState2 = await c.futuresPoolHedger.getHedgerState();

        // the longSize is buffered by the amount of collateral posted to the pool so we can actually open up to 2900ish
        assertCloseToPercentage(hedgerState2.currentPositions.shortPosition.size, toBN('2000'));
        // 1.1 target leverage - but because of fees this ends up slightly over collateralised.
        assertCloseToPercentage(
          hedgerState2.currentPositions.shortPosition.collateral,
          toBN('2000').mul(10).div(11),
          toBN('0.05'),
        );

        const lastInteraction = await c.futuresPoolHedger.lastInteraction();

        await c.gmx.positionRouter.setMaxGlobalSizes([c.gmx.eth.address], [0], [toBN('1000', 30)]);
        await c.futuresPoolHedger.hedgeDelta();

        // last interaction not updated
        expect(await c.futuresPoolHedger.lastInteraction()).eq(lastInteraction);
      });

      describe('canHedge', () => {
        it('skips if vaultLiquidityCheck is disabled', async () => {
          await c.futuresPoolHedger.setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            vaultLiquidityCheckEnabled: false,
          });
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;
          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;
        });
        it('if the pool has negative net delta (hedger going long)', async () => {
          await c.futuresPoolHedger.setPoolHedgerParams({
            ...DEFAULT_POOL_HEDGER_PARAMS,
            interactionDelay: 0,
          });
          await increaseDeltaExposure(c, 2);
          await executeIncreaseHedge(c);

          expect(await c.futuresPoolHedger.getCappedExpectedHedge()).gt(0);
          expect(await c.futuresPoolHedger.getCurrentHedgedNetDelta()).gt(0);

          await increaseDeltaExposure(c);

          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;

          await c.futuresPoolHedger.setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            marketDepthBuffer: toBN('1000'), // require 1000x more room in the vault than the hedge we want
          });

          // Check if a trade which drops the pool delta (i.e. opening a long call) is blocked
          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.false;
          // but the opposite should go through
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;

          await reduceDeltaExposure(c);

          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.false;
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;

          await reduceDeltaExposure(c, 4);

          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;
        });
        it('if the pool has positive net delta (hedger going short)', async () => {
          await c.futuresPoolHedger.setPoolHedgerParams({
            ...DEFAULT_POOL_HEDGER_PARAMS,
            interactionDelay: 0,
          });
          await reduceDeltaExposure(c, 2);
          await executeIncreaseHedge(c);

          expect(await c.futuresPoolHedger.getCappedExpectedHedge()).lt(0);
          expect(await c.futuresPoolHedger.getCurrentHedgedNetDelta()).lt(0);

          await reduceDeltaExposure(c, 2);

          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;

          await c.futuresPoolHedger.setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            marketDepthBuffer: toBN('700'), // require 700x more room in the vault than the hedge we want
          });

          // Check if a trade which increases the pool delta (i.e. opening a long put) is blocked
          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.false;
          // but the opposite should go through
          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;

          await increaseDeltaExposure(c);

          expect(await c.futuresPoolHedger.getCappedExpectedHedge()).lt(0);
          expect(await c.futuresPoolHedger.getCurrentHedgedNetDelta()).lt(0);

          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.false;
          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;

          await increaseDeltaExposure(c, 4);

          expect(await c.futuresPoolHedger.canHedge(0, true, 0)).to.be.true;
          expect(await c.futuresPoolHedger.canHedge(0, false, 0)).to.be.true;
        });
      });
    });

    describe('GMX Integration Environment Test', () => {
      it('vault can accept and close trades', async () => {
        await c.gmx.USDC.connect(deployer).approve(vaultAddr, ethers.constants.MaxUint256);
        await c.gmx.USDC.connect(deployer).approve(c.gmx.positionRouter.address, ethers.constants.MaxUint256);
        await c.gmx.USDC.connect(deployer).approve(c.gmx.router.address, ethers.constants.MaxUint256);

        const amount = toBN('900'); // 900 usd of exposure
        const sizeDelta = '1000' + '0'.repeat(30);
        const upperPriceLimit = '1600' + '0'.repeat(30);
        const lowerPriceLimit = '1400' + '0'.repeat(30);

        await c.gmx.positionRouter.createIncreasePosition(
          [usdcAddr, ethAddr],
          ethAddr,
          amount,
          0,
          sizeDelta,
          true,
          upperPriceLimit,
          await c.gmx.positionRouter.minExecutionFee(),
          ethers.utils.randomBytes(32),
          ethers.constants.AddressZero,
          { value: await c.gmx.positionRouter.minExecutionFee() },
        );

        let key = await c.gmx.positionRouter.getRequestKey(deployer.address, 1);

        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(key, await deployer.getAddress());

        expect(
          (await c.gmx.reader.getPositions(vaultAddr, await deployer.getAddress(), [ethAddr], [ethAddr], [true]))[0],
        ).to.be.equal(sizeDelta);

        await c.gmx.positionRouter.createDecreasePosition(
          [ethAddr, usdcAddr],
          ethAddr,
          amount,
          sizeDelta,
          true,
          deployer.address,
          lowerPriceLimit,
          0,
          await c.gmx.positionRouter.minExecutionFee(),
          false,
          ethers.constants.AddressZero,
          { value: await c.gmx.positionRouter.minExecutionFee() },
        );

        key = await c.gmx.positionRouter.getRequestKey(deployer.address, 1);
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(key, await deployer.getAddress());
        expect(
          (await c.gmx.reader.getPositions(vaultAddr, await deployer.getAddress(), [ethAddr], [ethAddr], [true]))[0],
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
        await c.futuresPoolHedger.connect(deployer).setReferralCode(newCode);

        expect((await c.futuresPoolHedger.referralCode()) === newCode).to.be.true;
      });
      it('can send trapped quote to pool', async () => {
        // mint some quote to hedger
        const amount = toBN('100');
        await c.gmx.eth.mint(c.futuresPoolHedger.address, amount);
        const liquidityPoolEthBefore = await c.gmx.eth.balanceOf(c.liquidityPool.address);

        const receipt = await (await c.futuresPoolHedger.connect(random).sendAllFundsToLP()).wait();

        expect(getEvent(receipt, 'BaseReturnedToLP').event).to.be.eq('BaseReturnedToLP');

        expect(getEventArgs(receipt, 'BaseReturnedToLP').amountBase).to.be.eq(amount);

        const liquidityPoolEthAfter = await c.gmx.eth.balanceOf(c.liquidityPool.address);
        expect(liquidityPoolEthAfter.sub(liquidityPoolEthBefore).eq(amount)).to.be.true;
        expect((await c.gmx.eth.balanceOf(c.futuresPoolHedger.address)).eq(0)).to.be.true;

        // mint some base to hedger
        await c.gmx.USDC.mint(c.futuresPoolHedger.address, amount);
        const liquidityPoolQuoteBefore = await c.gmx.USDC.balanceOf(c.liquidityPool.address);

        await c.futuresPoolHedger.connect(random).sendAllFundsToLP();

        const liquidityPoolQuoteAfter = await c.gmx.USDC.balanceOf(c.liquidityPool.address);
        expect(liquidityPoolQuoteAfter.sub(liquidityPoolQuoteBefore).eq(amount)).to.be.true;
        expect((await c.gmx.USDC.balanceOf(c.futuresPoolHedger.address)).eq(0)).to.be.true;
      });
      it('can recover eth', async () => {
        await c.futuresPoolHedger.connect(deployer).recoverEth(random.address);
        expect((await ethers.provider.getBalance(c.futuresPoolHedger.address)).eq(0)).to.be.true;
      });
      it('only gmx can callCallback function', async () => {
        await expect(
          c.futuresPoolHedger.connect(random).gmxPositionCallback(ethers.utils.randomBytes(32), true, true),
        ).to.be.revertedWith('GMXFuturesPoolHedger: only GMX keeper can trigger callback');
      });
      it('can update position router', async () => {
        expect(await c.futuresPoolHedger.positionRouter()).not.eq(ZERO_ADDRESS);
        await c.futuresPoolHedger.setPositionRouter(ZERO_ADDRESS);
        expect(await c.futuresPoolHedger.positionRouter()).eq(ZERO_ADDRESS);
      });
      it('reverts for invalid parameters', async () => {
        await expect(
          c.futuresPoolHedger.setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            targetLeverage: toBN('1'),
          }),
        ).to.be.revertedWith('InvalidFuturesPoolHedgerParams');
        await expect(
          c.futuresPoolHedger.setFuturesPoolHedgerParams({
            ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
            maxLeverage: toBN('1'),
          }),
        ).to.be.revertedWith('InvalidFuturesPoolHedgerParams');
      });

      it('reverts in sendAllFundsToLP', async () => {
        // for the weth swapping logic
        await c.gmx.btc.mint(c.futuresPoolHedger.address, toBN('3', 8));

        await c.gmx.btc.setForceFail(true);
        await expect(c.futuresPoolHedger.sendAllFundsToLP()).revertedWith('AssetTransferFailed');
        await c.gmx.btc.setForceFail(false);

        const tx = await c.futuresPoolHedger.sendAllFundsToLP();
        const args = getEventArgs(await tx.wait(), 'WETHSold');
        expect(args.amountWeth).eq(toBN('3', 8));
        expect(args.quoteReceived).lt(toBN('60000')).gt(toBN('55000'));

        await c.gmx.USDC.mint(c.futuresPoolHedger.address, toBN('1'));
        await c.gmx.eth.mint(c.futuresPoolHedger.address, toBN('2'));

        await c.gmx.eth.setForceFail(true);
        await expect(c.futuresPoolHedger.sendAllFundsToLP()).revertedWith('AssetTransferFailed');
        await c.gmx.eth.setForceFail(false);

        await c.gmx.USDC.setForceFail(true);
        await expect(c.futuresPoolHedger.sendAllFundsToLP()).revertedWith('AssetTransferFailed');
        await c.gmx.USDC.setForceFail(false);
      });

      it('recoverFunds', async () => {
        const testToken = await (await ethers.getContractFactory('TestERC20Fail')).deploy('t', 't');
        await testToken.mint(c.futuresPoolHedger.address, toBN('100'));

        await c.gmx.btc.mint(c.futuresPoolHedger.address, toBN('3', 8));
        await c.gmx.USDC.mint(c.futuresPoolHedger.address, toBN('1'));
        await c.gmx.eth.mint(c.futuresPoolHedger.address, toBN('2'));

        await c.futuresPoolHedger.recoverFunds(testToken.address, deployer.address);
        expect(await testToken.balanceOf(deployer.address)).eq(toBN('100'));
        expect(await testToken.balanceOf(c.futuresPoolHedger.address)).eq(0);

        await expect(c.futuresPoolHedger.recoverFunds(c.gmx.btc.address, deployer.address)).revertedWith(
          'CannotRecoverRestrictedToken',
        );
        await expect(c.futuresPoolHedger.recoverFunds(c.gmx.eth.address, deployer.address)).revertedWith(
          'CannotRecoverRestrictedToken',
        );
        await expect(c.futuresPoolHedger.recoverFunds(c.gmx.USDC.address, deployer.address)).revertedWith(
          'CannotRecoverRestrictedToken',
        );
      });
      it('can get the full state', async () => {
        expect((await c.futuresPoolHedger.getHedgerState()).referralCode).eq(toBytes32('LYRA'));
        expect((await c.GMXAdapter.getAdapterState(c.optionMarket.address)).clPrice).gt(0);
      });
    });

    describe('GMX Pool Hedger hard to reach states', () => {
      // Following are tests that our hedger has both long and short position opened.
      // Which should never happen in real life

      let poolHedger: TestGMXFuturesPoolHedger;
      const emptyPosition = {
        size: toBN('0'),
        collateral: toBN('0'),
        averagePrice: 0,
        entryFundingRate: 0,
        unrealisedPnl: 0,
        lastIncreasedTime: 0,
        isLong: true,
      };

      beforeEach('create a TestGMXFuturesPoolHedger entity', async () => {
        poolHedger = (await ((await ethers.getContractFactory('TestGMXFuturesPoolHedger')) as ContractFactory)
          .connect(deployer)
          .deploy()) as TestGMXFuturesPoolHedger;

        await poolHedger
          .connect(deployer)
          .init(
            c.liquidityPool.address,
            c.optionMarket.address,
            c.optionGreekCache.address,
            c.GMXAdapter.address,
            c.gmx.positionRouter.address,
            c.gmx.router.address,
            c.gmx.USDC.address,
            c.gmx.eth.address,
            c.gmx.eth.address,
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
        await c.liquidityPool.setPoolHedger(poolHedger.address);
      });

      it('wont exchange weth if it matches baseAsset', async () => {
        await c.gmx.eth.mint(poolHedger.address, toBN('1'));
        const tx = await poolHedger.sendAllFundsToLP();
        const args = getEventArgs(await tx.wait(), 'BaseReturnedToLP');
        expect(args.amountBase).eq(toBN('1'));
      });

      it("have unexpected short position when we're supposed to be long", async () => {
        ////////
        // user buy long call and we hedged
        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: 1,
        });
        await fastForward(4);
        await poolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        let pendingKey = await poolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        ////////
        // create a short position from hedger
        let pos = await poolHedger.getPositions();
        const size = toBN('5000');
        const collat = toBN('3600');

        await poolHedger.testIncreasePosition(pos.shortPosition, false, size, collat, { value: toBN('0.01') });
        pendingKey = await poolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        ////////
        // amount open is 2
        pos = await poolHedger.getPositions();
        expect(pos.amountOpen.eq(2)).to.be.true;

        ////////
        // calling hedge delta should close the short position
        await fastForward(20);
        await poolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        pendingKey = await poolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        pos = await poolHedger.getPositions();
        expect(pos.shortPosition.size).eq(0);
      });

      it("have unexpected long position when we're supposed to be short", async () => {
        ////////
        // user create buy long put and hedge
        await openPosition(c, 'sETH', {
          amount: toBN('10'),
          optionType: OptionType.LONG_PUT,
          strikeId: 1,
        });
        await fastForward(4);
        await poolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });

        let pendingKey = await poolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        ////////
        // create a long position from hedger
        let pos = await poolHedger.getPositions();
        const size = toBN('5000');
        const collat = toBN('3600');

        await poolHedger.testIncreasePosition(pos.longPosition, true, size, collat, { value: toBN('0.01') });
        pendingKey = await poolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());

        ////////
        // amount open is 2
        pos = await poolHedger.getPositions();
        expect(pos.amountOpen.eq(2)).to.be.true;

        ////////
        // calling update collateral should close the long position
        await fastForward(20);

        await poolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') });

        // reverts if called consecutively
        await expect(poolHedger.updateCollateral()).revertedWith('PositionRequestPending');

        pendingKey = await poolHedger.pendingOrderKey();
        await c.gmx.positionRouter.connect(deployer).executeDecreasePosition(pendingKey, await deployer.getAddress());

        pos = await poolHedger.getPositions();
        expect(pos.longPosition.size).eq(0);

        // skips update if no need to update
        await poolHedger.updateCollateral({ value: toBN('0.01') });
        expect(await poolHedger.pendingOrderKey()).eq(toBytes32(''));
      });

      it('fails for various reasons with low LP liquidity', async () => {
        await c.gmx.USDC.burn(c.liquidityPool.address, await c.gmx.USDC.balanceOf(c.liquidityPool.address));

        await expect(poolHedger.testIncreasePosition(emptyPosition, true, toBN('110'), toBN('100'))).revertedWith(
          'NoQuoteReceivedFromLP',
        );

        await c.gmx.USDC.mint(c.liquidityPool.address, toBN('10'));

        // With too little liquidity returned,
        await expect(poolHedger.testIncreasePosition(emptyPosition, true, toBN('110'), toBN('100'))).revertedWith(
          'MaxLeverageThresholdCrossed',
        );

        await c.gmx.USDC.mint(c.liquidityPool.address, toBN('1000'));

        // with enough liquidity, passes fine
        await poolHedger.testIncreasePosition(emptyPosition, true, toBN('110'), toBN('100'), { value: toBN('0.01') });
      });

      it('gets swap fee for shorts', async () => {
        // for shorts the fee is always 0
        expect(await poolHedger.getSwapFeeBP(false, true, toBN('1000'))).eq(0);
      });

      it('insolvent longs', async () => {
        // with enough liquidity, passes fine
        await poolHedger.testIncreasePosition(
          emptyPosition,
          true,
          toBN('500'), // 5x leverage
          toBN('100'),
          { value: toBN('0.01') },
        );
        await c.gmx.positionRouter.executeIncreasePosition(await poolHedger.pendingOrderKey(), deployer.address);

        await setPrice(c, '500', c.gmx.eth, c.gmx.ethPriceFeed);

        expect(await poolHedger.getAllPositionsValue()).eq(0);

        const pos = await poolHedger.getPositions();

        await poolHedger.testDecreasePosition(
          pos.longPosition,
          true,
          toBN('500'), // 5x leverage
          toBN('100'),
          false,
          { value: toBN('0.01') },
        );
      });

      it('cap collateralDelta when closing', async () => {
        // with enough liquidity, passes fine
        await poolHedger.testIncreasePosition(
          emptyPosition,
          true,
          toBN('500'), // 5x leverage
          toBN('100'),
          { value: toBN('0.01') },
        );
        await c.gmx.positionRouter.executeIncreasePosition(await poolHedger.pendingOrderKey(), deployer.address);

        const pos = await poolHedger.getPositions();

        // works fine
        await poolHedger.testDecreasePosition(pos.longPosition, true, 0, toBN('200'), false, { value: toBN('0.01') });

        assertCloseToPercentage(
          (await c.gmx.positionRouter.decreasePositionRequests(await poolHedger.pendingOrderKey())).collateralDelta,
          toBN('100', 30),
        );
      });

      it('insolvent short', async () => {
        // with enough liquidity, passes fine
        await poolHedger.testIncreasePosition(
          emptyPosition,
          false,
          toBN('500'), // 5x leverage
          toBN('100'),
          { value: toBN('0.01') },
        );
        await c.gmx.positionRouter.executeIncreasePosition(await poolHedger.pendingOrderKey(), deployer.address);

        await setPrice(c, '5000', c.gmx.eth, c.gmx.ethPriceFeed);

        expect(await poolHedger.getAllPositionsValue()).eq(0);
      });
    });

    describe('GMX ExchangeAdapter', async () => {
      beforeEach('setups', async () => {
        // approve
        await c.gmx.USDC.connect(deployer).approve(c.GMXAdapter.address, ethers.constants.MaxUint256);
        await c.gmx.eth.connect(deployer).approve(c.GMXAdapter.address, ethers.constants.MaxUint256);
      });

      describe('quote to base with default decimals', async () => {
        it('get exact base with limit', async () => {
          const ethBefore = await c.gmx.eth.balanceOf(deployer.address);

          // get exactly 1 eth. spend at most 1600?
          await c.GMXAdapter.exchangeToExactBaseWithLimit(c.optionMarket.address, toBN('1'), toBN('1600'));

          const ethAfter = await c.gmx.eth.balanceOf(deployer.address);

          assertCloseToPercentage(ethAfter.sub(ethBefore), toBN('1'), toBN('0.013')); // 1.3 percent error range
        });

        it('revert if limit is reached', async () => {
          await expect(
            c.GMXAdapter.exchangeToExactBaseWithLimit(c.optionMarket.address, toBN('1'), toBN('1500')),
          ).revertedWith('InsufficientSwap');
        });

        it('sell base for quote', async () => {
          await c.GMXAdapter.setMarketPricingParams(c.optionMarket.address, {
            ...DEFAULT_GMX_ADAPTER_PARAMS,
            staticSwapFeeEstimate: toBN('1.02'),
          });
          const ethBefore = await c.gmx.eth.balanceOf(deployer.address);
          // sell exactly 1 eth.
          await c.GMXAdapter.exchangeFromExactBase(c.optionMarket.address, toBN('1'));

          const ethAfter = await c.gmx.eth.balanceOf(deployer.address);
          expect(ethBefore.sub(ethAfter).eq(toBN('1'))).to.be.true;
        });
      });
    });
  });

  describe('GMX hedger state breakdown', () => {
    let snapshotId: number;
    let snapshotDefault: number;

    before(async () => {
      snapshotId = await takeSnapshot();
      snapshotDefault = await takeSnapshot();
    });

    it('default state', () => {
      it('hedged delta should return 0', async () => {
        const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
        expect(hedged).eq(0);
      });
      it('positions should be empty', async () => {
        const positions = await c.futuresPoolHedger.getPositions();
        expect(positions.amountOpen).eq(0);
      });
      it('position value should be 0', async () => {
        const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
        expect(currentValue).eq(0);
      });
      it('used and pending liquidity should be 0', async () => {
        const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);

        const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
        expect(hedging.pendingDeltaLiquidity).eq(0);
        expect(hedging.usedDeltaLiquidity).eq(0);
      });
      it('pending order should be null', async () => {
        expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
        expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
      });
      it('default leverage should be 0', async () => {
        const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
        expect(leverageInfo.leverage).eq(0);
        expect(leverageInfo.isLong).to.be.false;
      });
    });

    describe('scenario A): user open long call', () => {
      let longPositionId: BigNumberish;
      describe('after user open long call, before hedge', () => {
        before('open position', async () => {
          longPositionId = await openPosition(c, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_CALL,
            strikeId: 1,
          });
        });
        it('hedged delta should return 0', async () => {
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged).eq(0);
        });
        it('positions should be empty', async () => {
          const positions = await c.futuresPoolHedger.getPositions();
          expect(positions.amountOpen).eq(0);
        });
        it('position value should be 0', async () => {
          const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
          expect(currentValue).eq(0);
        });
        it('pending hedging liquidity should not be 0', async () => {
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
          const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false;
          expect(hedging.usedDeltaLiquidity).eq(0);
        });
        it('pending order should be null', async () => {
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });
        it('current leverage should be 0', async () => {
          const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.leverage).eq(0);
          expect(leverageInfo.isLong).to.be.false;
        });
      });

      describe('after hedgeDelta is called  ', () => {
        before('call hedge', async () => {
          await fastForward(4);
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        });
        it('hedged delta should return 0', async () => {
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged).eq(0);
        });
        it('positions should be empty', async () => {
          const positions = await c.futuresPoolHedger.getPositions();
          expect(positions.amountOpen).eq(0);
        });
        it('position value should be gt 0 (equal to collateralDelta)', async () => {
          const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
          expect(currentValue).gt(0);
        });
        it('used hedging liquidity should be updated', async () => {
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
          const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false; // trade have not gone through
          expect(hedging.usedDeltaLiquidity).gt(0);
        });
        it('pending increase should be true', async () => {
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });
        it('current leverage should be 0', async () => {
          const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.leverage).eq(0);
          expect(leverageInfo.isLong).to.be.false;
        });
      });

      describe('after hedge order is executed', () => {
        before('execute', async () => {
          const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
          await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());
        });
        it('hedged delta should return positive number', async () => {
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged.isZero()).to.be.false;
        });
        it('positions should be long', async () => {
          const positions = await c.futuresPoolHedger.getPositions();
          expect(positions.amountOpen.eq(1)).to.be.true;
          expect(positions.isLong).to.be.true;
          expect(positions.longPosition.unrealisedPnl).eq(0);
        });
        it('position value should be positive', async () => {
          const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
          assertCloseToPercentage(currentValue, toBN('7550'), toBN('0.005')); // 0.5 percent tolerance
        });

        it('used hedging liquidity should be updated', async () => {
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
          const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity).eq(0);
          expect(hedging.usedDeltaLiquidity).gt(0);
        });

        it('pending order should be null', async () => {
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });

        it('current leverage should be 1.1', async () => {
          const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
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
            await setPrice(c, '1800', c.gmx.eth, c.gmx.ethPriceFeed);
            await c.optionGreekCache.updateBoardCachedGreeks(1);
          });
          it('hedged delta should return positive number', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.false;
          });

          it('positions should be long', async () => {
            const positions = await c.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.eq(1)).to.be.true;
            expect(positions.isLong).to.be.true;
            // has unrealised (+) profit
            expect(positions.longPosition.unrealisedPnl).gt(0);
          });
          it('position value should be positive', async () => {
            const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
            assertCloseToPercentage(currentValue, toBN('9220'), toBN('0.005')); // 0.5 percent tolerance
          });

          it('used hedging liquidity should change', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            //  need to hedge again, because delta of call changed
            expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false;
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('pending order should be null', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be the same, should not decrease collateral', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
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
            await setPrice(c, '1300', c.gmx.eth, c.gmx.ethPriceFeed);
            await c.optionGreekCache.updateBoardCachedGreeks(1);
          });
          it('hedged delta should return positive number', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged).gt(0);
          });

          it('positions should be long', async () => {
            const positions = await c.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.eq(1)).to.be.true;
            expect(positions.isLong).to.be.true;
            // has unrealised loss
            expect(positions.longPosition.unrealisedPnl.lt(0)).to.be.true;
          });
          it('position value should still decreased to ~6443', async () => {
            const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
            assertCloseToPercentage(currentValue, toBN('6443'), toBN('0.005')); // 0.5 percent tolerance
          });

          it('used hedging liquidity should change', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            //  pending liquidity is 0, because we can reduce hedged amount.
            expect(hedging.pendingDeltaLiquidity).eq(0);
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('pending order should be null', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be higher, shouldUpdate should be true', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            assertCloseToPercentage(leverageInfo.leverage, toBN('1.29'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.true;
            expect(leverageInfo.needUpdate).to.be.true;

            // need to add collateral
            expect(leverageInfo.collateralDelta).gt(0);
          });
        });

        describe('after update collateral', () => {
          before('call update collateral', async () => {
            await c.futuresPoolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') });
          });
          it('hedged delta should remains the same', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.false;
          });

          it('should have pending order to increase collateral', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should still be lower than target (not reflected yet). Should hedge should be false', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.isLong).to.be.true;
            expect(leverageInfo.needUpdate).to.be.false;
          });
        });

        describe('after collateral adjustment order is executed ', () => {
          before('execute increase order', async () => {
            const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
            await c.gmx.positionRouter
              .connect(deployer)
              .executeIncreasePosition(pendingKey, await deployer.getAddress());
          });
          it('hedged delta should remains the same', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.isZero()).to.be.false;
          });

          it('hedging liquidity should be the same', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            //  need to hedge again, because delta of call changed
            expect(hedging.pendingDeltaLiquidity).eq(0);
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('should have no pending order', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be back to target', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();

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
            await setPrice(c, '1300', c.gmx.eth, c.gmx.ethPriceFeed);

            await closePosition(c, 'sETH', {
              positionId: longPositionId,
              amount: toBN('10'),
              optionType: OptionType.LONG_CALL,
              strikeId: 1,
            });

            await c.optionGreekCache.updateBoardCachedGreeks(1);
          });
          it('hedged delta should return positive number', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged).gt(0);

            const target = await c.futuresPoolHedger.getCappedExpectedHedge();
            expect(target).eq(0);
          });

          it('positions should be long', async () => {
            const positions = await c.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.eq(1)).to.be.true;
            expect(positions.isLong).to.be.true;
            // has unrealised loss
            expect(positions.longPosition.unrealisedPnl.lt(0)).to.be.true;
          });

          it('current leverage should be higher, shouldUpdate should be true', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            assertCloseToPercentage(leverageInfo.leverage, toBN('1.29'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.true;
            expect(leverageInfo.needUpdate).to.be.true;

            // need to add collateral
            expect(leverageInfo.collateralDelta).gt(0);
          });
        });

        describe('after hedge delta', () => {
          it('call hedge delta', async () => {
            await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
          });
          it('should have pending order to decrease collateral', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.true;
          });

          it('current leverage should still be lower than target (not reflected yet). Should hedge should be false', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.isLong).to.be.true;
            expect(leverageInfo.needUpdate).to.be.false;
          });
        });

        describe('after hedge order is executed ', () => {
          before('execute decrease order', async () => {
            const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
            await c.gmx.positionRouter
              .connect(deployer)
              .executeDecreasePosition(pendingKey, await deployer.getAddress());
          });
          it('hedged delta is now 0', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged).eq(0);
          });

          it('hedging liquidity should be 0', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            //  need to hedge again, because delta of call changed
            expect(hedging.pendingDeltaLiquidity).eq(0);
            expect(hedging.usedDeltaLiquidity).eq(0);
          });

          it('should have no pending order', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage is 0', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            expect(leverageInfo.leverage).eq(0);
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
          await openPosition(c, 'sETH', {
            amount: toBN('10'),
            optionType: OptionType.LONG_PUT,
            strikeId: 1,
          });
        });
        it('hedged delta should return 0', async () => {
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged).eq(0);
        });
        it('target delta should be negative', async () => {
          const target = await c.futuresPoolHedger.getCappedExpectedHedge();
          expect(target.lt(0)).to.be.true;
        });
        it('positions should be empty', async () => {
          const positions = await c.futuresPoolHedger.getPositions();
          expect(positions.amountOpen).eq(0);
        });
        it('position value should be 0', async () => {
          const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
          expect(currentValue).eq(0);
        });
        it('pending hedging liquidity should not be 0', async () => {
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
          const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity).gt(0);
          expect(hedging.usedDeltaLiquidity).eq(0);
        });
        it('pending order should be null', async () => {
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });
        it('current leverage should be 0', async () => {
          const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.leverage).eq(0);
          expect(leverageInfo.isLong).to.be.false;
        });
      });

      describe('after hedgeDelta is called', () => {
        before('call hedge', async () => {
          await fastForward(4);
          await c.futuresPoolHedger.connect(deployer).hedgeDelta({ value: toBN('0.01') });
        });
        it('hedged delta should return 0', async () => {
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged).eq(0);
        });
        it('positions should be empty', async () => {
          const positions = await c.futuresPoolHedger.getPositions();
          expect(positions.amountOpen).eq(0);
        });
        it('position value should be greater than 0', async () => {
          const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
          expect(currentValue).gt(0);
        });
        it('used hedging liquidity should be updated', async () => {
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
          const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity).gt(0); // trade have not gone through
          expect(hedging.usedDeltaLiquidity).gt(0);
        });
        it('pending increase should be true', async () => {
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true; // increase short!
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });
        it('current leverage should be 0', async () => {
          const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
          expect(leverageInfo.leverage).eq(0);
          expect(leverageInfo.isLong).to.be.false;
        });
      });

      describe('after GMX execution on hedge order', () => {
        before('execute', async () => {
          const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
          await c.gmx.positionRouter.connect(deployer).executeIncreasePosition(pendingKey, await deployer.getAddress());
        });
        it('hedged delta should return negative number', async () => {
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          expect(hedged.lt(0)).to.be.true;
        });
        it('positions should be short', async () => {
          const positions = await c.futuresPoolHedger.getPositions();
          expect(positions.amountOpen.eq(1)).to.be.true;
          expect(positions.isLong).to.be.false;
          expect(positions.longPosition.unrealisedPnl).eq(0);
        });
        it('position value should be positive', async () => {
          const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
          assertCloseToPercentage(currentValue, toBN('6058'), toBN('0.005')); // 0.5 percent tolerance
        });
        it('used hedging liquidity should be updated', async () => {
          const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
          const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);
          expect(hedging.pendingDeltaLiquidity).eq(0);
          expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
        });
        it('pending order should be null', async () => {
          expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
          expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
        });
        it('current leverage should be 1.1', async () => {
          const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
          assertCloseToPercentage(leverageInfo.leverage, toBN('1.1'), toBN('0.005')); // 0.5 percent tolerance
          expect(leverageInfo.isLong).to.be.false;
        });
        it('expected hedge should match hedged', async () => {
          // need to decrease position, because delta need to hedge is lower
          const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
          const expected = await c.futuresPoolHedger.getCappedExpectedHedge();
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
            await setPrice(c, '1800', c.gmx.eth, c.gmx.ethPriceFeed);
            await c.optionGreekCache.updateBoardCachedGreeks(1);
          });
          it('hedged delta should return negative number', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.lt(0)).to.be.true;
            expect(hedged.gt(hedgedAfterUserOpen)).to.be.true; // abs(hedged) is lower than before
          });

          it('positions should be short, with negative profit', async () => {
            const positions = await c.futuresPoolHedger.getPositions();
            expect(positions.amountOpen.eq(1)).to.be.true;
            expect(positions.isLong).to.be.false;
            // has unrealised (-) profit
            expect(positions.shortPosition.unrealisedPnl.lt(0)).to.be.true;
          });
          it('position value should be positive', async () => {
            const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
            // loss!
            assertCloseToPercentage(currentValue, toBN('4725'), toBN('0.005')); // 0.5 percent tolerance
          });

          it('abs(expectedHedge) and abs(hedged) should both, but expected is higher', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            const expected = await c.futuresPoolHedger.getCappedExpectedHedge();
            expect(hedged.lt(0)).to.be.true;
            expect(hedged.gt(hedgedAfterUserOpen)).to.be.true;

            expect(expected.lt(0)).to.be.true;
            expect(expected.gt(hedgedAfterUserOpen)).to.be.true;

            // abs(expected) should be lower than abs(hedged), because the put get far OTM
            expect(expected.gt(hedged)).to.be.true;
          });

          it('used hedging liquidity should change', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            // we want to decrease our short position
            expect(hedging.pendingDeltaLiquidity).eq(0);
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('pending order should be null', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be higher, updateCollateral should increase collateral', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            assertCloseToPercentage(leverageInfo.leverage, toBN('1.41'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.false;
            expect(leverageInfo.collateralDelta).gt(0);
            expect(leverageInfo.needUpdate).to.be.true;
          });
        });

        describe('after update collateral (add collateral)', () => {
          before('call update collateral', async () => {
            await c.futuresPoolHedger.connect(deployer).updateCollateral({ value: toBN('0.01') });
          });

          it('should have pending order to decrease collateral', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.true;
          });

          it('current leverage should still be higher than 1.1', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
            assertCloseToPercentage(leverageInfo.leverage, toBN('1.41'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.false;

            expect(leverageInfo.needUpdate).to.be.false; // we have pending update!
          });
        });

        describe('after collateral adjustment order is executed ', () => {
          before('execute increase order', async () => {
            const pendingKey = await c.futuresPoolHedger.pendingOrderKey();
            await c.gmx.positionRouter
              .connect(deployer)
              .executeIncreasePosition(pendingKey, await deployer.getAddress());
          });

          it('hedging liquidity should be the same', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            //  still need to hedge again, because delta of put is not updated
            expect(hedging.pendingDeltaLiquidity).eq(0);
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('should have no pending order', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be closer to target.', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();

            assertCloseToPercentage(leverageInfo.leverage, toBN('1.25'), toBN('0.005')); // 0.5 percent tolerance
            expect(leverageInfo.isLong).to.be.false;

            const pos = await c.futuresPoolHedger.getPositions();
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
            await setPrice(c, '1300', c.gmx.eth, c.gmx.ethPriceFeed);
            await c.optionGreekCache.updateBoardCachedGreeks(1);
          });
          it('hedged delta should be negative, abs(hedged) is higher ', async () => {
            const hedged = await c.futuresPoolHedger.getCurrentHedgedNetDelta();
            expect(hedged.lt(0)).to.be.true;
            expect(hedged.lt(hedgedAfterUserOpen)).to.be.true;
          });

          it('position value should increase to ~6947', async () => {
            const currentValue = await c.futuresPoolHedger.getAllPositionsValue();
            assertCloseToPercentage(currentValue, toBN('6947'), toBN('0.005')); // 0.5 percent tolerance
          });

          it('used hedging liquidity should change (need to hedge)', async () => {
            const spot = await c.GMXAdapter.getSpotPriceForMarket(c.optionMarket.address, 2);
            const hedging = await c.futuresPoolHedger.getHedgingLiquidity(spot);

            //  pending liquidity is 0, because we can reduce hedged amount.
            expect(hedging.pendingDeltaLiquidity.isZero()).to.be.false;
            expect(hedging.usedDeltaLiquidity.isZero()).to.be.false;
          });

          it('pending order should be null', async () => {
            expect(await c.futuresPoolHedger.hasPendingIncrease()).to.be.false;
            expect(await c.futuresPoolHedger.hasPendingDecrease()).to.be.false;
          });

          it('current leverage should be the same, ignoring the profit', async () => {
            const leverageInfo = await c.futuresPoolHedger.getCurrentLeverage();
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
  });
});

async function increaseDeltaExposure(c: TestSystemContractsTypeGMX, multiplier: number = 1) {
  await openPosition(c, 'sETH', {
    amount: toBN('10').mul(multiplier),
    optionType: OptionType.LONG_CALL,
    strikeId: 1,
    setCollateralTo: toBN('10'),
  });
}

async function reduceDeltaExposure(c: TestSystemContractsTypeGMX, multiplier: number = 1) {
  await openPosition(c, 'sETH', {
    amount: toBN('10').mul(multiplier),
    optionType: OptionType.LONG_PUT,
    strikeId: 1,
    setCollateralTo: toBN('10'),
  });
}

async function executeIncreaseHedge(c: TestSystemContractsTypeGMX) {
  await c.futuresPoolHedger.hedgeDelta({ value: toBN('0.01') });
  await c.gmx.positionRouter.executeIncreasePosition(
    await c.futuresPoolHedger.pendingOrderKey(),
    await c.futuresPoolHedger.signer.getAddress(),
  );
}
