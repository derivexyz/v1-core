import { BigNumber, Contract, ethers, Wallet } from 'ethers';
import {
  closePosition,
  expectHedgeEqualTo,
  forceUpdateHedgePosition,
  openPosition,
} from '../../scripts/util/integrationFunctions';
import { fromBN, OptionType, toBN, toBytes32 } from '../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../utils/assert';
import { DEFAULT_LIQUIDITY_POOL_PARAMS, DEFAULT_OPTION_MARKET_PARAMS, PricingType } from '../utils/defaultParams';
import { deployTestSystem, TestSystemContractsType } from '../utils/deployTestSystem';
import { restoreSnapshot, takeSnapshot } from '../utils/evm';
import { getLocalRealSynthetixContract } from '../utils/package/parseFiles';
import { changeRate, setDebtLimit } from '../utils/package/realSynthetixUtils';
import { seedTestSystem } from '../utils/seedTestSystem';
import { expect } from '../utils/testSetup';

describe('Integration tests - SNX', () => {
  let testSystem: TestSystemContractsType;
  let market: string;
  let deployer: Wallet;
  let snapId: number;
  let marketView: any;
  let preQuoteBal: number;
  let preBaseBal: number;

  before(async () => {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    provider.getGasPrice = async () => {
      return ethers.BigNumber.from('0');
    };
    provider.estimateGas = async () => {
      return ethers.BigNumber.from(15000000);
    };

    deployer = new ethers.Wallet(privateKey, provider);
    const exportAddresses = true;

    testSystem = await deployTestSystem(deployer, false, exportAddresses, {
      mockSNX: false,
      compileSNX: false,
      optionMarketParams: { ...DEFAULT_OPTION_MARKET_PARAMS, feePortionReserved: toBN('0.05') },
    });

    await seedTestSystem(deployer, testSystem);
    await testSystem.snx.delegateApprovals.approveAllDelegatePowers(testSystem.synthetixAdapter.address);
    market = 'sETH';
    marketView = await testSystem.optionMarketViewer.getMarket(testSystem.optionMarket.address);
  });

  beforeEach(async () => {
    snapId = await takeSnapshot();
    preQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
    preBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));
  });

  afterEach(async () => {
    await restoreSnapshot(snapId);
  });

  describe('setAddressResolver', async () => {
    it('can setAddressResolver', async () => {
      const addressResolver = await (await getLocalRealSynthetixContract(deployer, 'local', `AddressResolver`)).address;
      await testSystem.synthetixAdapter.setAddressResolver(addressResolver);
      const currentAddress = await testSystem.synthetixAdapter.addressResolver();
      expect(addressResolver).eq(currentAddress);
    });
  });

  describe('delegateApprovals', async () => {
    it('delegateApprovals set to snx contract', async () => {
      const setContract = await testSystem.synthetixAdapter.delegateApprovals();
      expect(setContract).eq(testSystem.snx.delegateApprovals.address);
    });
  });

  describe('exchanging quote for base', async () => {
    it('exchangeFromExactQuote', async () => {
      await testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, toBN('1000'));
      const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
      const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      expect(preQuoteBal - postQuoteBal).to.eq(1000);
      expect(postBaseBal - preBaseBal).to.eq(0.5665857776966732);
    });

    it('revert when not enough quote', async () => {
      const quoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      await expect(
        testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, quoteBal.add(1)),
      ).to.revertedWith('SafeMath: subtraction overflow');
    });

    it('exchangeToExactBase', async () => {
      await testSystem.synthetixAdapter.exchangeToExactBase(testSystem.optionMarket.address, toBN('1'));
      const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
      const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      expect(preQuoteBal - postQuoteBal).to.eq(1764.957820892334);
      expect(postBaseBal - preBaseBal).to.eq(1);
    });

    it('revert when not enough quote', async () => {
      const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(
        testSystem.optionMarket.address,
        PricingType.REFERENCE,
      );
      const quoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      const max = quoteBal.div(spotPrice);

      await expect(
        testSystem.synthetixAdapter.exchangeToExactBase(testSystem.optionMarket.address, toBN(max.toString())),
      ).to.revertedWith('SafeMath: subtraction overflow');
    });

    it('exchangeForExactBaseWithLimit', async () => {
      await testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
        testSystem.optionMarket.address,
        toBN('1'),
        toBN('1770'),
      );
      const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
      const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      expect(preQuoteBal - postQuoteBal).to.eq(1764.957820892334);
      expect(postBaseBal - preBaseBal).to.eq(1);
    });

    it('revert when not enough quote', async () => {
      await expect(
        testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
          testSystem.optionMarket.address,
          toBN('1'),
          toBN('1750'),
        ),
      ).to.revertedWith("reverted with custom error 'QuoteBaseExchangeExceedsLimit");
    });
  });

  describe('exchanging base for quote', async () => {
    it('exchangeFromExactBase', async () => {
      await testSystem.synthetixAdapter.exchangeFromExactBase(testSystem.optionMarket.address, toBN('10'));
      const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));
      const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
      expect(postBaseBal - preBaseBal).to.eq(-10);
      expect(postQuoteBal - preQuoteBal).to.eq(17193.671962738037);
    });

    it('revert when not enough base', async () => {
      await expect(
        testSystem.synthetixAdapter.exchangeFromExactBase(testSystem.optionMarket.address, toBN('20000')),
      ).to.revertedWith('SafeMath: subtraction overflow');
    });

    it('exchangeToExactQuote', async () => {
      await testSystem.synthetixAdapter.exchangeToExactQuote(testSystem.optionMarket.address, toBN('1000'));
      const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
      const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      expect(postQuoteBal - preQuoteBal).to.eq(1000);
      expect(preBaseBal - postBaseBal).to.eq(0.5816093282555812);
    });

    it('revert when not enough base', async () => {
      await expect(
        testSystem.synthetixAdapter.exchangeToExactQuote(testSystem.optionMarket.address, toBN('999999999')),
      ).to.revertedWith('SafeMath: subtraction overflow');
    });

    it('exchangeToExactQuoteWithLimit', async () => {
      await testSystem.synthetixAdapter.exchangeToExactQuoteWithLimit(
        testSystem.optionMarket.address,
        toBN('1000'),
        toBN('0.6'),
      );
      const postQuoteBal = +fromBN(await testSystem.snx.quoteAsset.balanceOf(deployer.address));
      const postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      expect(postQuoteBal - preQuoteBal).to.eq(1000);
      expect(preBaseBal - postBaseBal).to.eq(0.5816093282555812);
    });

    it('revert when base limit too high', async () => {
      await expect(
        testSystem.synthetixAdapter.exchangeToExactQuoteWithLimit(
          testSystem.optionMarket.address,
          toBN('1000'),
          toBN('0.5'),
        ),
      ).to.revertedWith("reverted with custom error 'BaseQuoteExchangeExceedsLimit");
    });
  });

  describe('variable fees', async () => {
    it('min ~0% fee vs 10% fee (max) base', async () => {
      // First set fees to ~0
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sETH')],
        [BigNumber.from(1)],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sUSD')],
        [BigNumber.from(1)],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

      const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(
        testSystem.optionMarket.address,
        PricingType.REFERENCE,
      );
      let preQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);

      // Try swapping with 0 fees
      await testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
        testSystem.optionMarket.address,
        toBN('1'),
        toBN('1760'),
      );

      let postQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      let postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      // Should cost the spot price of sETH
      assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), spotPrice);
      expect(postBaseBal - preBaseBal).to.eq(1);

      preQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      preBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      // Set fee to 10% and get new exchange params
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sETH')],
        [toBN('0.05')],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sUSD')],
        [toBN('0.05')],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

      await expect(
        testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
          testSystem.optionMarket.address,
          toBN('1'),
          toBN('1760'),
        ),
      ).to.revertedWith("reverted with custom error 'QuoteBaseExchangeExceedsLimit");

      // Now try to exchange for 10% less
      await testSystem.synthetixAdapter.exchangeToExactBaseWithLimit(
        testSystem.optionMarket.address,
        toBN('0.9'),
        toBN('1760'),
      );

      postQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      postBaseBal = +fromBN(await testSystem.snx.baseAsset.balanceOf(deployer.address));

      // 0.9 should cost spotPrice of eth (10% fee)
      assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), spotPrice);
      expect(postBaseBal - preBaseBal).to.eq(0.8999999999996362);
    });

    it('min ~0% fee vs 10% fee (max) quote', async () => {
      // First set fees to ~0
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sETH')],
        [BigNumber.from(1)],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sUSD')],
        [BigNumber.from(1)],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

      const spotPrice = await testSystem.synthetixAdapter.getSpotPriceForMarket(
        testSystem.optionMarket.address,
        PricingType.REFERENCE,
      );
      let preQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      let preBaseBal: BigNumber = await testSystem.snx.baseAsset.balanceOf(deployer.address);

      // Try swapping with 0 fees
      await testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, toBN('1000'));

      let postQuoteBal: BigNumber = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      let postBaseBal: BigNumber = await testSystem.snx.baseAsset.balanceOf(deployer.address);

      // Should receive (quote / spotPrice) sETH (no fees)
      assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), toBN('1000'));
      assertCloseToPercentage(postBaseBal.sub(preBaseBal), toBN('1000').mul(toBN('1')).div(spotPrice));

      preQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      preBaseBal = await testSystem.snx.baseAsset.balanceOf(deployer.address);

      // Set fee to 10% and get new exchange params
      // await (await getLocalRealSynthetixContract(deployer, 'local', `SystemSettings`) as Contract)
      //   .setExchangeFeeRateForSynths([toBytes32('sETH')], [toBN('0.1')]);
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sETH')],
        [toBN('0.05')],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sUSD')],
        [toBN('0.05')],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

      // Now try to exchange, expecting for 10% less sETH
      await testSystem.synthetixAdapter.exchangeFromExactQuote(testSystem.optionMarket.address, toBN('1000'));

      postQuoteBal = await testSystem.snx.quoteAsset.balanceOf(deployer.address);
      postBaseBal = await testSystem.snx.baseAsset.balanceOf(deployer.address);

      // Should receive 0.9 * (quote / spotPrice) sETH
      assertCloseToPercentage(preQuoteBal.sub(postQuoteBal), toBN('1000'));
      assertCloseToPercentage(postBaseBal.sub(preBaseBal), toBN('1000').mul(toBN('0.9')).div(spotPrice));
    });
  });

  describe('Hedging long calls', async () => {
    it('LONG CALL --> hedger should short and long on close', async () => {
      // Open LONG CALL --> hedger should short
      let positionId = await openPosition(testSystem, market, {
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });
      console.log('gets to here');
      await forceUpdateHedgePosition(testSystem);
      console.log('gets past the hedger');
      let expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      console.log('gets ot line 360');
      await expectHedgeEqualTo(testSystem, expectedHedge);

      // Open LONG CALL again --> hedger should short more
      positionId = await openPosition(testSystem, market, {
        positionId: positionId,
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });
      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      // Close half LONG CALL --> hedger should reduce short
      positionId = await closePosition(testSystem, market, {
        positionId: positionId,
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });

      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      // Close remaining LONG CALL --> hedger position should be 0
      await closePosition(testSystem, market, {
        positionId,
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });
      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);
    });
  });

  describe('Hedging short puts', async () => {
    it('Short puts --> hedger should long and short on close', async () => {
      // Open SHORT PUT --> hedger should long
      const positionId = await openPosition(testSystem, market, {
        amount: toBN('10'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        setCollateralTo: toBN('18000'),
      });
      await forceUpdateHedgePosition(testSystem);
      let expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      // hedger should long more
      await openPosition(testSystem, market, {
        positionId,
        amount: toBN('10'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        setCollateralTo: toBN('20000'),
      });
      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      // hedger should reduce long
      await closePosition(testSystem, market, {
        positionId: positionId,
        amount: toBN('10'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        setCollateralTo: toBN('18000'),
      });
      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      // Close SHORT PUT --> hedger position should be 0
      await closePosition(testSystem, market, {
        positionId,
        amount: toBN('10'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });
      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);
    });
  });

  describe('Valid rate tests', async () => {
    it('able to open/close/hedge positions with valid rate', async () => {
      // Open & close positions with valid rate
      const positionId = await openPosition(testSystem, market, {
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });

      await forceUpdateHedgePosition(testSystem);
      let expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      await closePosition(testSystem, market, {
        positionId,
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });

      await forceUpdateHedgePosition(testSystem);
      expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);
    });
  });

  describe('Rate and fee tests', async () => {
    it('unable to open and close positions with valid rate', async () => {
      const positionId = await openPosition(testSystem, market, {
        amount: toBN('10'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        setCollateralTo: toBN('18000'),
      });

      // Set rate to be stale (invalid)
      await (await getLocalRealSynthetixContract(deployer, 'local', `SystemSettings`)).setRateStalePeriod(0);

      // Invalid rate to hedge
      await expect(forceUpdateHedgePosition(testSystem)).to.revertedWith("reverted with custom error 'RateIsInvalid");

      // Invalid rate to open position
      await expect(
        openPosition(testSystem, market, {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        }),
      ).to.revertedWith("reverted with custom error 'RateIsInvalid");

      // Invalid rate to close position
      await expect(
        closePosition(testSystem, market, {
          positionId,
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        }),
      ).to.revertedWith("reverted with custom error 'RateIsInvalid");
    });

    it('snx spot feed too volatile', async () => {
      // open some options
      await openPosition(testSystem, market, {
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });

      // volatile price
      await changeRate(testSystem, toBN('1000'), 'sETH');

      // Invalid rate to open position
      await expect(
        openPosition(testSystem, market, {
          amount: toBN('10'),
          optionType: OptionType.LONG_CALL,
          strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        }),
      ).to.revertedWith('too volatile');

      // attempt position hedge
      await expect(testSystem.poolHedger.hedgeDelta()).to.revertedWith('too volatile');
    });

    it('_maybeExchange when fee > maxFeePaid', async () => {
      // set fees to 6%
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sETH')],
        [toBN('0.03')],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeFeeRateForSynths'](
        [toBytes32('sUSD')],
        [toBN('0.03')],
      );
      await (testSystem.snx.systemSettings as Contract)['setExchangeMaxDynamicFee'](BigNumber.from(1));

      // opens undercollateralized long
      await testSystem.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
      });
      await openPosition(testSystem, market, {
        amount: toBN('10'),
        optionType: OptionType.LONG_CALL,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });

      const fullCollatAmount = await testSystem.liquidityPool.lockedCollateral();
      const baseAmount = await testSystem.snx.baseAsset.balanceOf(testSystem.liquidityPool.address);
      expect(fullCollatAmount.base).to.be.gt(baseAmount);

      // _maybeExchange blocked as fees still high
      await testSystem.liquidityPool.exchangeBase();
      expect(baseAmount).to.eq(await testSystem.snx.baseAsset.balanceOf(testSystem.liquidityPool.address));

      // increase allowed fee and successfuly collateralize
      await testSystem.liquidityPool.setLiquidityPoolParameters({
        ...DEFAULT_LIQUIDITY_POOL_PARAMS,
      });
      await testSystem.liquidityPool.exchangeBase();
      expect(baseAmount).to.lt(await testSystem.snx.baseAsset.balanceOf(testSystem.liquidityPool.address));
    });
  });

  describe('Debt limit tests', async () => {
    it('able to close short if debt limit reached', async () => {
      const newDebt = toBN('0.000000000000000001');
      await setDebtLimit(testSystem, newDebt);
      const maxDebt = await (await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)).maxDebt();
      assertCloseToPercentage(maxDebt, newDebt);

      // Open SHORT PUT --> hedger should long
      const positionId = await openPosition(testSystem, market, {
        amount: toBN('100'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
        setCollateralTo: toBN('180000'),
      });
      await forceUpdateHedgePosition(testSystem);
      const expectedHedge = await testSystem.poolHedger.getCappedExpectedHedge();
      await expectHedgeEqualTo(testSystem, expectedHedge);

      await closePosition(testSystem, market, {
        positionId,
        amount: toBN('100'),
        optionType: OptionType.SHORT_PUT_QUOTE,
        strikeId: marketView.liveBoards[0].strikes[0].strikeId,
      });
      await forceUpdateHedgePosition(testSystem);
    });
  });

  describe('Hedger testing', async () => {
    it('is hedger deployed properly', async () => {
      const hedger = testSystem.poolHedger;
      const expectedHedge = hedger.getCappedExpectedHedge();
      console.log('expected Hedge', expectedHedge);
    });
  });
});
