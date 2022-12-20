import { BigNumber } from 'ethers';
import { MONTH_SEC, toBN, UNIT, WEEK_SEC } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../../utils/assert';
import { openLongCallAndGetLiquidity, openLongPutAndGetLiquidity, setETHPrice } from '../../utils/contractHelpers';
import { fastForward } from '../../utils/evm';
import { seedFixture } from '../../utils/fixture';
import { expect, hre } from '../../utils/testSetup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const initialBalance = toBN('100000');

describe('Contract adjustment events', async () => {
  beforeEach(async () => {
    await seedFixture();
    await hre.f.c.snx.quoteAsset.mint(hre.f.alice.address, initialBalance);
    await hre.f.c.snx.quoteAsset.connect(hre.f.alice).approve(hre.f.c.liquidityPool.address, initialBalance);
    // await createBoard({ expiresIn: MONTH_SEC * 2 });
  });

  describe('No contract adjustment - LiquidityPool solvent', async () => {
    it('payouts out long call positions with no adjustments', async () => {
      const ethOpenPrice = '2000';
      const ethClosePrice = '2100';
      const openSize = '1';

      await setETHPrice(toBN(ethOpenPrice));
      let liquidity = await hre.f.c.liquidityPool.getLiquidity();
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long calls and calculate cost of options
      let oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const [, afterOpenLiquidity] = await openLongCallAndGetLiquidity(toBN(openSize));

      // Reserved collat liquidity should equal ETH price x size x callCollatScalingFactor
      const lpParams = await hre.f.c.liquidityPool.getLpParams();
      expect(afterOpenLiquidity.reservedCollatLiquidity).to.eq(
        toBN(ethOpenPrice).mul(toBN(openSize)).mul(lpParams.callCollatScalingFactor).div(UNIT).div(UNIT),
      );

      // Pump ETH and fast forwards to settle
      await setETHPrice(toBN(ethClosePrice));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      await depositLiquidity(toBN('1000'), true);

      // Check long scale factor
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      const longScaleFactor = await hre.f.c.optionMarket.scaledLongsForBoard(1);
      expect(liquidity.reservedCollatLiquidity).to.eq(0);
      expect(longScaleFactor).to.eq(toBN('1'));

      // Settle options and calculate profit
      oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await hre.f.c.shortCollateral.settleOptions([1]);

      const afterBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const profit = afterBalance.sub(oldBalance);

      // Profit should be (ETH close price - ETH open price) x amount of options
      expect(profit).to.eq(toBN(ethClosePrice).sub(toBN(ethOpenPrice)).mul(openSize));
    });

    it('payouts out long put positions with no adjustments', async () => {
      const ethOpenPrice = '2000';
      const ethClosePrice = '200';
      const openSize = '10';
      const strikePrice = (await hre.f.c.optionMarket.getStrike(2)).strikePrice;
      // await setETHPrice(ethOpenPrice);
      await setETHPrice(toBN(ethOpenPrice));
      let liquidity = await hre.f.c.liquidityPool.getLiquidity();
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long calls and calculate cost of options
      let oldBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const [, afterOpenLiquidity] = await openLongPutAndGetLiquidity(toBN(openSize));

      // Reserved collat liquidity should equal ETH price x size x callCollatScalingFactor
      const lpParams = await hre.f.c.liquidityPool.getLpParams();
      expect(afterOpenLiquidity.reservedCollatLiquidity).to.eq(
        strikePrice.mul(toBN(openSize)).mul(lpParams.putCollatScalingFactor).div(UNIT).div(UNIT),
      );

      // Fast forward and settle board
      await setETHPrice(toBN(ethClosePrice));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      await fastForward(MONTH_SEC + 1);

      // Check long scale factor
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);
      await depositLiquidity(toBN('1000'), true);

      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      const longScaleFactor = await hre.f.c.optionMarket.scaledLongsForBoard(1);
      expect(liquidity.reservedCollatLiquidity).to.eq(0);
      expect(longScaleFactor).to.eq(toBN('1'));

      // Settle options and calculate profit
      oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await hre.f.c.shortCollateral.settleOptions([1]);
      const afterBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const profit = afterBalance.sub(oldBalance);

      // Profit should be (ETH close price - ETH open price) x amount of options
      expect(profit).to.eq(strikePrice.sub(toBN(ethClosePrice)).mul(openSize));
    });
  });

  describe('Contract adjustment - LiquidityPool insolvent', async () => {
    it('payouts out long call positions with adjustments', async () => {
      const ethOpenPrice = '2000';
      const ethClosePrice = '20000';
      const openSize = '100';

      await setETHPrice(toBN(ethOpenPrice));

      let liquidity = await hre.f.c.liquidityPool.getLiquidity();
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long calls and calculate cost of options
      let oldBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const [, afterOpenLiquidity] = await openLongCallAndGetLiquidity(toBN(openSize));

      // Reserved collat liquidity should equal ETH price x size x callCollatScalingFactor
      const lpParams = await hre.f.c.liquidityPool.getLpParams();
      expect(afterOpenLiquidity.reservedCollatLiquidity).to.eq(
        toBN(ethOpenPrice).mul(toBN(openSize)).mul(lpParams.callCollatScalingFactor).div(UNIT).div(UNIT),
      );

      // Fast forward and settle board
      await setETHPrice(toBN(ethClosePrice));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      // Check that we cannot process deposit due to CB
      await depositLiquidity(toBN('1000'), false);

      // Check long scale factor in a contract adjustment event
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      const longScaleFactor = await hre.f.c.optionMarket.scaledLongsForBoard(1);
      expect(liquidity.reservedCollatLiquidity).to.eq(0);
      assertCloseToPercentage(longScaleFactor, toBN('0.266'), toBN('0.01'));

      // Settle options and calculate profit
      oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await hre.f.c.shortCollateral.settleOptions([1]);

      const afterBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const profit = afterBalance.sub(oldBalance);

      // Profit should be(ETH close price - ETH open price) x amount of options
      const profitWithNoAdjustment = toBN(ethClosePrice).sub(toBN(ethOpenPrice)).mul(openSize);
      expect(profit).to.eq(profitWithNoAdjustment.mul(longScaleFactor).div(UNIT));
    });

    it('payouts out long call positions with smaller adjustments', async () => {
      const ethOpenPrice = '2000';
      const ethClosePrice = '7000';
      const openSize = '100';

      await setETHPrice(toBN(ethOpenPrice));
      let liquidity = await hre.f.c.liquidityPool.getLiquidity();
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long calls and calculate cost of options
      let oldBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const [, afterOpenLiquidity] = await openLongCallAndGetLiquidity(toBN(openSize));

      // Reserved collat liquidity should equal ETH price x size x callCollatScalingFactor
      const lpParams = await hre.f.c.liquidityPool.getLpParams();
      expect(afterOpenLiquidity.reservedCollatLiquidity).to.eq(
        toBN(ethOpenPrice).mul(toBN(openSize)).mul(lpParams.callCollatScalingFactor).div(UNIT).div(UNIT),
      );

      // Fast forward and settle board
      await setETHPrice(toBN(ethClosePrice));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);
      await fastForward(MONTH_SEC + 1);
      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      // Check that we cannot process deposit due to CB
      await depositLiquidity(toBN('1000'), false);

      // Check long scale factor in a contract adjustment event
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      const longScaleFactor = await hre.f.c.optionMarket.scaledLongsForBoard(1);
      expect(liquidity.reservedCollatLiquidity).to.eq(0);
      await assertCloseToPercentage(longScaleFactor, toBN('0.957'), toBN('0.01'));

      // Settle options and calculate profit
      oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await hre.f.c.shortCollateral.settleOptions([1]);

      const afterBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const profit = afterBalance.sub(oldBalance);

      // Profit should be(ETH close price - ETH open price) x amount of options
      const profitWithNoAdjustment = toBN(ethClosePrice).sub(toBN(ethOpenPrice)).mul(openSize);
      expect(profit).to.eq(profitWithNoAdjustment.mul(longScaleFactor).div(UNIT));
    });

    it('payouts out long put positions with adjustments', async () => {
      const ethOpenPrice = '3300';
      const ethClosePrice = '3';
      const openSize = '200';
      const strikePrice = (await hre.f.c.optionMarket.getStrike(3)).strikePrice;

      await setETHPrice(toBN(ethOpenPrice));
      let liquidity = await hre.f.c.liquidityPool.getLiquidity();
      expect(liquidity.reservedCollatLiquidity).to.eq(0);

      // Open long calls and calculate cost of options
      let oldBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await openLongPutAndGetLiquidity(toBN(openSize), 3);

      liquidity = await hre.f.c.liquidityPool.getLiquidity();

      // In this scenario everything is reserved for delta liquidity...
      expect(await hre.f.c.snx.quoteAsset.balanceOf(hre.f.c.liquidityPool.address)).to.eq(
        liquidity.pendingDeltaLiquidity,
      );

      await setETHPrice(toBN(ethClosePrice));
      await hre.f.c.optionGreekCache.updateBoardCachedGreeks(1);

      // Fast forward and settle board
      await fastForward(MONTH_SEC + 1);

      await hre.f.c.optionMarket.settleExpiredBoard(hre.f.board.boardId);

      // Check that we cannot process deposit due to CB
      await depositLiquidity(toBN('1000'), false);
      liquidity = await hre.f.c.liquidityPool.getLiquidity();
      const longScaleFactor = await hre.f.c.optionMarket.scaledLongsForBoard(1);
      expect(liquidity.reservedCollatLiquidity).to.eq(0);
      assertCloseToPercentage(longScaleFactor, toBN('0.998'), toBN('0.01'));

      // Settle options and calculate profit
      oldBalance = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      await hre.f.c.shortCollateral.settleOptions([1]);

      const afterBalance: any = await hre.f.c.snx.quoteAsset.balanceOf(hre.f.deployer.address);
      const profit = afterBalance.sub(oldBalance);

      // Profit should be (ETH close price - ETH open price) x amount of options
      expect(profit).to.eq(
        strikePrice.sub(toBN(ethClosePrice)).mul(longScaleFactor).div(UNIT).mul(toBN(openSize)).div(UNIT),
      );
    });
  });
});

export async function depositLiquidity(amount: BigNumber, canDeposit: boolean) {
  await hre.f.c.liquidityPool.connect(hre.f.alice).initiateDeposit(hre.f.alice.address, amount);
  await fastForward(WEEK_SEC + 1);
  if (canDeposit) {
    await hre.f.c.liquidityPool.processDepositQueue(1);
  } else {
    // In a contract adjustment process deposit will not work
    const before = await hre.f.c.liquidityPool.totalQueuedDeposits();
    await hre.f.c.liquidityPool.processDepositQueue(1);
    const after = await hre.f.c.liquidityPool.totalQueuedDeposits();
    expect(before).to.eq(after);
  }
}

export async function expectDeposit(
  queuedDepositVal: BigNumber,
  depositAmount: BigNumber,
  beneficiary: SignerWithAddress,
) {
  await hre.f.c.liquidityPool.processDepositQueue(1);
  const userBal = await hre.f.c.liquidityToken.balanceOf(beneficiary.address);
  const tokenPrice = await hre.f.c.liquidityPool.getTokenPrice();
  // Amount of LP tokens should be
  await assertCloseToPercentage(userBal.mul(tokenPrice).div(UNIT), depositAmount, toBN('0.01'));
}
