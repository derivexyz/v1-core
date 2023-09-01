import { fromBN, MAX_UINT, OptionType, toBN, toBytes32, WEEK_SEC } from '../../scripts/util/web3utils';
import { restoreSnapshot, send, takeSnapshot } from '../utils/evm';
import { DeploymentParams, DeploymentType } from '../../scripts/util';
import {
  callExternalFunction,
  callLyraFunction,
  executeExternalFunction,
  executeLyraFunction,
  getExternalContract,
  getLyraContract,
  openPosition,
} from '../../scripts/util/transactions';
import { ethers } from 'hardhat';
import { loadParams } from '../../scripts/util/parseFiles';
import { BigNumber } from 'ethers';
import { deploySNXContracts } from '../../scripts/deploy/deploySNXContracts';
import { createBoards, generateBoardParamsFor } from '../../scripts/seed/createBoards';
import { getCurrentTimestamp } from 'hardhat/internal/hardhat-network/provider/utils/getCurrentTimestamp';
import { PricingType } from '../utils/defaultParams';
import { writeExternalsSync } from './util/writeExternals';
import { deployMockPyth, setSUSDBalance, setUSDCBalance } from './util/cannonHelpers';
import { MarketViewStruct } from '../../typechain-types/OptionMarketViewer';
import axios from 'axios';
import { MockPyth } from '../../typechain-types';
import { expect } from 'chai';

// To run these tests:
// Write files to local directory so addresses and ABIs can be read:
// $ cannon --fork https://mainnet.optimism.io inspect synthetix:2 --chain-id 10 --write-deployments ./cannon-deployment
//
// Run the forked deployment via cannon:
// $ cannon --fork https://mainnet.optimism.io synthetix:2
//
// Run the test with:
// $ npx hardhat test test/integration/snxPerpIntegration.ts --network local
//
// Note: would recommend not running using the public endpoint... Use infura/alchemy

const FRESH_DEPLOY = true;

describe('Integration tests - SNX', () => {
  const market = 'ETH';
  let impersonateAddress: string;
  let deploymentParams: DeploymentParams;
  let snapId: number;
  let pyth: MockPyth;

  before(async () => {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    impersonateAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    // add ETH
    await send(
      'hardhat_setBalance',
      [impersonateAddress, '0x1' + '0'.repeat(18)], // ~400 ETH
    );

    await send('hardhat_impersonateAccount', [impersonateAddress]);
    const deployer: any = await provider.getSigner(impersonateAddress);

    deploymentParams = { network: 'local', deployer, deploymentType: DeploymentType.SNXCannon, provider };

    if (FRESH_DEPLOY) {
      writeExternalsSync();
      await setSUSDBalance(deploymentParams, impersonateAddress, toBN('1000000'));
      await setUSDCBalance(deploymentParams, impersonateAddress, toBN('10000000', 6));
      const params = loadParams(deploymentParams);
      await deploySNXContracts(deploymentParams, params);
      pyth = await deployMockPyth(deploymentParams);
    }
  });

  beforeEach(async () => {
    snapId = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snapId);
  });

  it('Base test -> hedge short -> hedge short', async () => {
    try {
      // deploymentParams: DeploymentParams,
      //   boards: { BaseIv: string; Expiry: number; Skews: string[]; Strikes: string[] }[],
      //   market: string,
      const spotPrice: BigNumber = await callLyraFunction(
        deploymentParams,
        'ExchangeAdapter',
        'getSpotPriceForMarket',
        [getLyraContract(deploymentParams, 'OptionMarket', market).address, PricingType.REFERENCE],
      );
      await executeExternalFunction(deploymentParams, 'USDC', 'approve', [
        getLyraContract(deploymentParams, 'LiquidityPool', market).address,
        MAX_UINT,
      ]);
      await executeLyraFunction(
        deploymentParams,
        'LiquidityPool',
        'initiateDeposit',
        [impersonateAddress, toBN('1000000', 6)],
        market,
      );
      await createBoards(
        deploymentParams,
        [generateBoardParamsFor(+fromBN(spotPrice), getCurrentTimestamp(), 7, WEEK_SEC * 2)],
        market,
      );

      const marketView: MarketViewStruct = await callLyraFunction(deploymentParams, 'OptionMarketViewer', 'getMarket', [
        getLyraContract(deploymentParams, 'OptionMarket', market).address,
      ]);

      await executeExternalFunction(deploymentParams, 'USDC', 'approve', [
        getLyraContract(deploymentParams, 'OptionMarket', market).address,
        MAX_UINT,
      ]);

      await openPosition(deploymentParams, market, {
        strikeId: marketView.liveBoards[0].strikes[3].strikeId,
        optionType: OptionType.LONG_PUT,
        amount: toBN('100'),
        setCollateralTo: 0,
      });

      // const hedgingLiquidity = await executeLyraFunction(deploymentParams, 'SNXPerpsV2PoolHedger', 'getHedgingLiquidity', [], market);
      // console.log('hedgingLiquidity', hedgingLiquidity);
      // console.log('market view', marketView);
      // expect(hedgingLiquidity).eq(toBN('100').mul(spotPrice));

      await executeLyraFunction(deploymentParams, 'SNXPerpsV2PoolHedger', 'hedgeDelta', [], market);

      const perpContract = await getExternalContract(
        deploymentParams,
        'PerpsV2ProxyETHPERP',
        'PerpsV2OffchainDelayedOrderETHPERP',
      );

      await perpContract.executeOffchainDelayedOrder(
        getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', market).address,
        [await getPriceFeedData(deploymentParams, pyth)],
        { value: toBN('0.1') },
      );

      await openPosition(deploymentParams, market, {
        strikeId: marketView.liveBoards[0].strikes[3].strikeId,
        optionType: OptionType.LONG_PUT,
        amount: toBN('2'),
        setCollateralTo: 0,
      });

      await executeLyraFunction(deploymentParams, 'SNXPerpsV2PoolHedger', 'hedgeDelta', [], market);

      await perpContract.executeOffchainDelayedOrder(
        getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', market).address,
        [await getPriceFeedData(deploymentParams, pyth)],
        { value: toBN('0.1') },
      );

      //update collateral on hedger
      await executeLyraFunction(deploymentParams, 'SNXPerpsV2PoolHedger', 'updateCollateral', [], market);
    } catch (e) {
      console.log(e);
    }
  });

  it('Open long position and try and hedge against SNX', async () => {
    const spotPrice: BigNumber = await callLyraFunction(deploymentParams, 'ExchangeAdapter', 'getSpotPriceForMarket', [
      getLyraContract(deploymentParams, 'OptionMarket', market).address,
      PricingType.REFERENCE,
    ]);

    await executeExternalFunction(deploymentParams, 'USDC', 'approve', [
      getLyraContract(deploymentParams, 'LiquidityPool', market).address,
      MAX_UINT,
    ]);
    await executeLyraFunction(
      deploymentParams,
      'LiquidityPool',
      'initiateDeposit',
      [impersonateAddress, toBN('1000000', 6)],
      market,
    );

    await createBoards(
      deploymentParams,
      [generateBoardParamsFor(+fromBN(spotPrice), getCurrentTimestamp(), 7, WEEK_SEC * 2)],
      market,
    );

    const marketView: MarketViewStruct = await callLyraFunction(deploymentParams, 'OptionMarketViewer', 'getMarket', [
      getLyraContract(deploymentParams, 'OptionMarket', market).address,
    ]);

    await executeExternalFunction(deploymentParams, 'USDC', 'approve', [
      getLyraContract(deploymentParams, 'OptionMarket', market).address,
      MAX_UINT,
    ]);

    console.log('market view', marketView);

    await openPosition(deploymentParams, market, {
      strikeId: marketView.liveBoards[0].strikes[2].strikeId,
      optionType: OptionType.LONG_CALL,
      amount: toBN('10'),
      setCollateralTo: 0,
    });

    await executeLyraFunction(deploymentParams, 'SNXPerpsV2PoolHedger', 'hedgeDelta', [], market);

    const perpContract = await getExternalContract(
      deploymentParams,
      'PerpsV2ProxyETHPERP',
      'PerpsV2OffchainDelayedOrderETHPERP',
    );
    await perpContract.executeOffchainDelayedOrder(
      getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', market).address,
      [await getPriceFeedData(deploymentParams, pyth)],
      { value: toBN('0.1') },
    );

    await openPosition(deploymentParams, market, {
      strikeId: marketView.liveBoards[0].strikes[3].strikeId,
      optionType: OptionType.LONG_CALL,
      amount: toBN('20'),
      setCollateralTo: 0,
    });
  });

  it.skip('Open short position and try and hedge against SNX', async () => {
    // const spotPrice: BigNumber = await callLyraFunction(deploymentParams, 'ExchangeAdapter', 'getSpotPriceForMarket', [
    //   getLyraContract(deploymentParams, 'OptionMarket', market).address,
    //   PricingType.REFERENCE,
    // ]);
    // await executeExternalFunction(deploymentParams, 'USDC', 'approve', [
    //   getLyraContract(deploymentParams, 'LiquidityPool', market).address,
    //   MAX_UINT,
    // ]);
    // await executeLyraFunction(
    //   deploymentParams,
    //   'LiquidityPool',
    //   'initiateDeposit',
    //   [impersonateAddress, toBN('1000000', 6)],
    //   market,
    // );
    // await createBoards(
    //   deploymentParams,
    //   [generateBoardParamsFor(+fromBN(spotPrice), getCurrentTimestamp(), 7, WEEK_SEC * 2)],
    //   market,
    // );

    const marketView: MarketViewStruct = await callLyraFunction(deploymentParams, 'OptionMarketViewer', 'getMarket', [
      getLyraContract(deploymentParams, 'OptionMarket', market).address,
    ]);
    console.log('market view', marketView);

    await executeExternalFunction(deploymentParams, 'USDC', 'approve', [
      getLyraContract(deploymentParams, 'OptionMarket', market).address,
      MAX_UINT,
    ]);

    await openPosition(deploymentParams, market, {
      strikeId: marketView.liveBoards[0].strikes[3].strikeId,
      optionType: OptionType.LONG_PUT,
      amount: toBN('20'),
      setCollateralTo: 0,
    });

    await executeLyraFunction(deploymentParams, 'SNXPerpsV2PoolHedger', 'hedgeDelta', [], market);

    const perpContract = await getExternalContract(
      deploymentParams,
      'PerpsV2ProxyETHPERP',
      'PerpsV2OffchainDelayedOrderETHPERP',
    );
    await perpContract.executeOffchainDelayedOrder(
      getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', market).address,
      [await getPriceFeedData(deploymentParams, pyth)],
      { value: toBN('0.1') },
    );

    await openPosition(deploymentParams, market, {
      strikeId: marketView.liveBoards[0].strikes[3].strikeId,
      optionType: OptionType.LONG_PUT,
      amount: toBN('20'),
      setCollateralTo: 0,
    });
  });

  it('sending base to lp then calling exchange base to initiate uniswap swap', async () => {
    // await send(
    //   'hardhat_setBalance',
    //   [
    //     getLyraContract(deploymentParams,'LiquidityPool', market).address,
    //     '0x1' + '0'.repeat(18)
    //   ], // ~400 ETH
    // );

    // approve swap router
    await executeLyraFunction(deploymentParams, 'ExchangeAdapter', 'approveRouter', [
      getExternalContract(deploymentParams, 'WETH', 'WETH').address,
    ]);

    // deposit eth to weth
    await getExternalContract(deploymentParams, 'WETH', 'WETH').deposit({ value: toBN('10') });

    // transfer weth
    await getExternalContract(deploymentParams, 'WETH', 'WETH').transfer(
      getLyraContract(deploymentParams, 'LiquidityPool', market).address,
      toBN('10'),
    );

    expect(
      await getExternalContract(deploymentParams, 'WETH', 'WETH').balanceOf(
        getLyraContract(deploymentParams, 'LiquidityPool', market).address,
      ),
    ).to.be.eq(toBN('10'));

    const wethBalance = await getExternalContract(deploymentParams, 'WETH', 'WETH').balanceOf(
      getLyraContract(deploymentParams, 'LiquidityPool', market).address,
    );
    console.log('eth balance', wethBalance);

    // approve uniswap

    await executeLyraFunction(deploymentParams, 'LiquidityPool', 'exchangeBase', [], market);

    const curEthBalance = await getLyraContract(deploymentParams, 'LiquidityPool', market).provider.getBalance(
      getLyraContract(deploymentParams, 'LiquidityPool', market).address,
    );

    expect(curEthBalance).to.be.eq(0);
  });

});

async function getPriceFeedData(deploymentParams: DeploymentParams, pyth: MockPyth) {
  const feedId = await callExternalFunction(deploymentParams, 'PerpsV2ExchangeRate', 'offchainPriceFeedId', [
    toBytes32('sETH'),
  ]);
  const timestamp = ((await deploymentParams.provider?.getBlock('latest')) || { timestamp: 0 }).timestamp;

  // end point from chainlink docs.
  const priceChainlink = (await axios.get('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD')).data;
  const priceChainlinkFormatted = toBN(priceChainlink.USD.toString()).div(1e12);
  console.log('priceChainlinkFormatted', priceChainlinkFormatted.toString());

  return await pyth.createPriceFeedUpdateData(feedId, priceChainlinkFormatted, '1000000', -6, 0, 0, timestamp + 20);
}

// TODO: remove before push
// async function setPriceFeed(deploymentParams: deploymentParams, pyth: MockPyth, price: BigNumberish) {
//   const feedId = await callExternalFunction(deploymentParams, 'PerpsV2ExchangeRate', 'offchainPriceFeedId', [toBytes32('sETH')]);
//   const timestamp = ((await deploymentParams.provider?.getBlock('latest')) || {timestamp: 0}).timestamp

//   const priceFormatted = price.div(1e12);

//   return await pyth.createPriceFeedUpdateData(
//     feedId,
//     price,
//     "1000000",
//     -6,
//     0,
//     0,
//     timestamp + 20
//   )

//   return await pyth.createPriceFeedUpdateData(
//     feedId,
//     priceFormatted,
//     "1000000",
//     -6,
//     0,
//     0,
//     timestamp + 20
//   );
// }
