import { getEventArgs, toBN, ZERO_ADDRESS } from '../../../../scripts/util/web3utils';
import { OptionMarketContractsStruct } from '../../../../typechain-types/OptionMarketWrapper';
import { assertCloseToPercentage } from '../../../utils/assert';
import { STABLE_IDS, wrapperOpenLong } from '../../../utils/contractHelpers/wrapper';
import { addNewMarketSystem, TestSystemContractsType } from '../../../utils/deployTestSystem';
import { allCurrenciesFixture } from '../../../utils/fixture';
import { expect, hre } from '../../../utils/testSetup';

describe('OptionMarketWrapper viewer / misc function tests', () => {
  beforeEach(allCurrenciesFixture);

  describe('Viewer function tests', async () => {
    it('getMarketAndStableId', async () => {
      const [stables, markets] = await hre.f.c.optionMarketWrapper.getBalancesAndAllowances(hre.f.deployer.address);

      expect(stables[0].id).to.eq(0);
      expect(stables[0].token).to.eq(hre.f.c.snx.quoteAsset.address);
      expect(stables[1].id).to.eq(1);
      expect(stables[1].token).to.eq(hre.f.DAI.address);
      expect(stables[1].balance).to.eq(toBN('100000'));
      expect(stables[2].id).to.eq(2);
      expect(stables[2].token).to.eq(hre.f.USDC.address);
      expect(stables[2].balance).to.eq(100000 * 1e6);

      expect(markets[0].id).to.eq(0);
      expect(markets[0].market).to.eq(hre.f.c.optionMarket.address);
      expect(markets[0].token).to.eq(hre.f.c.snx.baseAsset.address);
    });
  });

  describe('Misc function tests', async () => {
    it('quoteCurveSwap', async () => {
      const DAI = await hre.f.DAI;
      const USDC = await hre.f.USDC;
      const sUSD = await hre.f.c.snx.quoteAsset;

      const DAITosUSD = await hre.f.c.optionMarketWrapper.quoteCurveSwap(DAI.address, sUSD.address, toBN('1000'));
      const sUSDToDAI = await hre.f.c.optionMarketWrapper.quoteCurveSwap(sUSD.address, DAI.address, toBN('1000'));
      assertCloseToPercentage(DAITosUSD.amountOut, toBN('989'));
      assertCloseToPercentage(sUSDToDAI.amountOut, toBN('1011'));

      const USDCTosUSD = await hre.f.c.optionMarketWrapper.quoteCurveSwap(USDC.address, sUSD.address, 1000);
      const sUSDToUSDC = await hre.f.c.optionMarketWrapper.quoteCurveSwap(sUSD.address, USDC.address, toBN('1000'));
      expect(USDCTosUSD.amountOut).to.eq(989108910891089);
      expect(sUSDToUSDC.amountOut).to.eq(1011011011);
    });

    it('unsupported token for swap', async () => {
      await expect(
        hre.f.c.optionMarketWrapper.quoteCurveSwap(hre.f.deployer.address, hre.f.c.snx.quoteAsset.address, 1000),
      ).revertedWith('UnsupportedToken');
    });
  });

  describe('Removing stable/market test', async () => {
    it('invalid stable Id ', async () => {
      await expect(hre.f.c.optionMarketWrapper.removeCurveStable(4)).revertedWith('RemovingInvalidId');
    });

    it('valid stable Id ', async () => {
      // First check the stable ID is valid
      let id = await hre.f.c.optionMarketWrapper.idToERC(0);
      expect(id).to.eq(hre.f.c.snx.quoteAsset.address);

      // Remove the ID
      await hre.f.c.optionMarketWrapper.removeCurveStable(0);
      id = await hre.f.c.optionMarketWrapper.idToERC(0);
      expect(id).to.eq(ZERO_ADDRESS);
    });
  });

  it('add duplicate stable', async () => {
    await expect(hre.f.c.optionMarketWrapper.addCurveStable(hre.f.c.snx.quoteAsset.address, 0)).to.be.revertedWith(
      'DuplicateEntry',
    );
  });

  it('revert add if stable not approved', async () => {
    await hre.f.c.snx.quoteAsset.setForceFail(true);
    await expect(hre.f.c.optionMarketWrapper.addCurveStable(hre.f.c.snx.quoteAsset.address, 0)).to.be.revertedWith(
      'ApprovalFailure',
    );

    await hre.f.c.snx.quoteAsset.setForceFail(false);
    await hre.f.c.snx.quoteAsset.setMaxApprovalFail(true);
    await expect(hre.f.c.optionMarketWrapper.addCurveStable(hre.f.c.snx.quoteAsset.address, 0)).to.be.revertedWith(
      'ApprovalFailure',
    );
  });

  it('getMarketAndErcIds', async () => {
    const [markets, ercs] = await hre.f.c.optionMarketWrapper.getMarketAndErcIds();
    expect(await hre.f.c.optionMarketWrapper.idToMarket(markets[0])).to.eq(hre.f.c.optionMarket.address);
    expect(await hre.f.c.optionMarketWrapper.idToERC(ercs[0])).to.eq(hre.f.c.snx.quoteAsset.address);
    expect(await hre.f.c.optionMarketWrapper.idToERC(ercs[1])).to.eq(hre.f.DAI.address);
    expect(await hre.f.c.optionMarketWrapper.idToERC(ercs[2])).to.eq(hre.f.USDC.address);
  });

  it('adds new market', async () => {
    const linkMarket: TestSystemContractsType = await addNewMarketSystem(hre.f.deployer, hre.f.c, 'sLINK', false, {
      marketId: '1',
    });
    const [markets] = await hre.f.c.optionMarketWrapper.getMarketAndErcIds();
    expect(await hre.f.c.optionMarketWrapper.idToMarket(markets[1])).to.eq(linkMarket.optionMarket.address);
  });

  it('add duplicate market', async () => {
    const omContracts: OptionMarketContractsStruct = {
      quoteAsset: hre.f.c.snx.quoteAsset.address,
      baseAsset: hre.f.c.snx.quoteAsset.address,
      optionToken: hre.f.c.optionToken.address,
      liquidityPool: hre.f.c.liquidityPool.address,
      liquidityToken: hre.f.c.liquidityToken.address,
    };
    await expect(
      hre.f.c.optionMarketWrapper.addMarket(hre.f.c.optionMarket.address, 0, omContracts),
    ).to.be.revertedWith('DuplicateEntry');
  });

  it('invalid market Id ', async () => {
    await expect(hre.f.c.optionMarketWrapper.removeMarket(4)).revertedWith('RemovingInvalidId');
  });

  it('valid market Id ', async () => {
    // First check the stable ID is valid
    let id = await hre.f.c.optionMarketWrapper.idToMarket(0);
    expect(id).to.eq(hre.f.c.optionMarket.address);

    // Remove the ID
    await hre.f.c.optionMarketWrapper.removeMarket(0);
    id = await hre.f.c.optionMarketWrapper.idToMarket(0);
    expect(id).to.eq(ZERO_ADDRESS);
  });

  describe('External open / close', async () => {
    it('external open ', async () => {
      const params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 0,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };

      const tx = await hre.f.c.optionMarketWrapper.openPosition(params);
      const event = getEventArgs(await tx.wait(), 'PositionTraded');
      expect(event.isLong).to.eq(true);
      expect(event.isOpen).to.eq(true);
      expect(event.amount).to.eq(toBN('1'));
    });

    it('external close', async () => {
      let params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 0,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };
      await hre.f.c.optionMarketWrapper.openPosition(params);

      params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 6,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };

      const tx = await hre.f.c.optionMarketWrapper.closePosition(params);
      const event = getEventArgs(await tx.wait(), 'PositionTraded');
      expect(event.isOpen).to.eq(false);
      expect(event.amount).to.eq(toBN('1'));
    });

    it('external force close', async () => {
      let params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 0,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };
      await hre.f.c.optionMarketWrapper.openPosition(params);

      params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 6,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };

      const tx = await hre.f.c.optionMarketWrapper.forceClosePosition(params);
      const event = getEventArgs(await tx.wait(), 'PositionTraded');
      expect(event.isOpen).to.eq(false);
      expect(event.amount).to.eq(toBN('1'));
    });
  });

  describe('open / close with tracked fees', async () => {
    it('track fees', async () => {
      let params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 0,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };

      let tx = await hre.f.c.optionMarketWrapper.openPosition(params);
      let openEvent = getEventArgs(await tx.wait(), 'PositionTraded');
      const openFees = await hre.f.c.basicFeeCounter.totalFeesPerMarket(
        hre.f.c.optionMarket.address,
        hre.f.deployer.address,
      );

      // Tracked fees should equal the opened position fees
      assertCloseToPercentage(openEvent.totalFee, openFees);

      params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 6,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };

      tx = await hre.f.c.optionMarketWrapper.closePosition(params);
      let closeEvent = getEventArgs(await tx.wait(), 'PositionTraded');
      const totalFees = await hre.f.c.basicFeeCounter.totalFeesPerMarket(
        hre.f.c.optionMarket.address,
        hre.f.deployer.address,
      );

      // Tracked fees should equal the fees paid for opening and closing
      assertCloseToPercentage(openEvent.totalFee.add(closeEvent.totalFee), totalFees);
    });
  });

  describe('updateContractParams', async () => {
    it('no trading rewards', async () => {
      // Update trading rewards contract to ZERO ADDRESS
      await hre.f.c.optionMarketWrapper.updateContractParams(
        hre.f.c.testCurve.address,
        hre.f.c.synthetixAdapter.address,
        ZERO_ADDRESS,
        toBN('0.98'),
      );

      const params = {
        optionMarket: await hre.f.c.optionMarketWrapper.idToMarket(0),
        strikeId: 1,
        positionId: 0,
        iterations: 1,
        setCollateralTo: 0,
        currentCollateral: 0,
        optionType: 0,
        amount: toBN('1'),
        minCost: 0,
        maxCost: toBN('350'),
        inputAmount: toBN('350'),
        inputAsset: await hre.f.c.optionMarketWrapper.idToERC(0),
      };
      await hre.f.c.optionMarketWrapper.openPosition(params);
      const openFees = await hre.f.c.basicFeeCounter.totalFeesPerMarket(
        hre.f.c.optionMarket.address,
        hre.f.deployer.address,
      );

      expect(openFees).to.eq(0);
    });
  });

  it('reverts if transfer failed', async () => {
    await hre.f.c.snx.quoteAsset.setForceFail(true);
    await expect(
      wrapperOpenLong({
        token: STABLE_IDS.sUSD,
        isCall: true,
        maxCost: 375,
        inputAmount: 400,
        size: 1,
      }),
    ).to.revertedWith('AssetTransferFailed');
  });
});
