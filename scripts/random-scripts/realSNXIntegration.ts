/* eslint-disable no-case-declarations */
import { BigNumber } from 'ethers';
import { Contract } from 'ethers';
import { Signer } from 'ethers';
import chalk from 'chalk';
import { ethers, upgrades } from 'hardhat';
import {
  DEFAULT_LIQUIDITY_POOL_PARAMS,
  DEFAULT_MIN_COLLATERAL_PARAMS,
  DEFAULT_POOL_HEDGER_PARAMS,
} from '../../test/utils/defaultParams';
import { OptionPositionStruct } from '../../typechain-types/OptionToken';
import { hedgeDelta } from '../seed/hedgeDelta';
import { DeploymentType,  getSelectedNetwork } from '../util';
import { loadEnv } from '../util/parseFiles';
import {
  closePosition,
  deployContract,
  execute,
  getLyraContract,
  getExternalContract,
  openPosition,
  sleep,
} from '../util/transactions';
import { etherscanVerification } from '../util/verification';
import {
  currentTime,
  getEventArgs,
  MAX_UINT,
  MONTH_SEC,
  OptionType,
  toBN,
  UNIT,
  ZERO_ADDRESS,
} from '../util/web3utils';
import {getAltSigner, getDeployer} from "../util/providers";

export const ROUTINE_LP_PARAMS = {
  ...DEFAULT_LIQUIDITY_POOL_PARAMS,
  depositDelay: 600,
  withdrawalDelay: 600,
  guardianDelay: 1,
  liquidityCBTimeout: 900,
  ivVarianceCBTimeout: 900,
  skewVarianceCBTimeout: 900,
  guardianMultisig: ZERO_ADDRESS,
  boardSettlementCBTimeout: 900,
};

// run seedReal with default.json params before running routines
// example: ROUTINE=GET_sETH yarn hardhat run scripts/integration/kovanRealSNX.ts --network kovan-ovm
async function main() {
  console.log(`Setup...`);
  // load environment
  const network = getSelectedNetwork();
  const envVars = loadEnv(network);
  const deployer = await getDeployer(envVars);

  // const deploymentParams = { network, deployer, mockSnx: false, realPricing: false };
  const deploymentParams = { network, deployer, deploymentType: DeploymentType.SNX };

  // load contracts
  const snxAdapter = getLyraContract(deploymentParams, 'SynthetixAdapter');
  const optionMarket = getLyraContract(deploymentParams, 'OptionMarket', 'sETH');
  const optionGreekCache = getLyraContract(deploymentParams, 'OptionGreekCache', 'sETH');
  const liquidityPool = getLyraContract(deploymentParams, 'LiquidityPool', 'sETH');
  const poolHedger = getLyraContract(deploymentParams, 'SNXPerpsV2PoolHedger', 'sETH');
  const liquidityToken = getLyraContract(deploymentParams, 'LiquidityToken', 'sETH');
  const optionToken = getLyraContract(deploymentParams, 'OptionToken', 'sETH');
  const shortCollateral = getLyraContract(deploymentParams, 'ShortCollateral', 'sETH');
  const delegateApprovals = getExternalContract(deploymentParams, 'DelegateApprovals');
  const addressResolver = getExternalContract(deploymentParams, 'AddressResolver');
  const quoteAsset = getExternalContract(deploymentParams, 'ProxyERC20sUSD');
  const baseAsset = getExternalContract(deploymentParams, 'ProxysETH');

  await execute(quoteAsset, 'approve', [optionMarket.address, MAX_UINT]);
  await execute(baseAsset, 'approve', [optionMarket.address, MAX_UINT]);
  await execute(quoteAsset, 'approve', [liquidityPool.address, MAX_UINT]);
  console.log(chalk.red('deployer quote balance', await quoteAsset.balanceOf(deployer.address)));
  console.log(chalk.red('allowance', await quoteAsset.allowance(deployer.address, optionMarket.address)));

  let positionIds;
  let positionId;
  let lpTokens;
  switch (process.env.ROUTINE) {
    case 'TRADING':
      console.log(`Open/Close...`);
      positionIds = await openAllLongShort(deploymentParams, 'sETH');
      await modifyAllLongShort(deploymentParams, 'sETH', optionToken, positionIds);
      await fullCloseAllLongShorts(deploymentParams, 'sETH', optionToken, positionIds);
      break;

    case 'LIQUIDATIONS':
      console.log(`Liquidations...`);
      await revertAndSucceedLiquidation(deploymentParams, 'sETH', optionGreekCache, snxAdapter, optionMarket);
      break;

    case 'HEDGE':
      console.log(`Hedge delta...`);
      await updateAllBoards(optionMarket, optionGreekCache);
      // hedge new open
      positionIds = await openAllLongShort(deploymentParams, 'sETH');
      await hedgeDelta(deploymentParams, 'sETH');
      // attempt failed hedger swap
      await revertedPoolHedgerSwap(liquidityPool, ZERO_ADDRESS);
      // hedge post full close
      await fullCloseAllLongShorts(deploymentParams, 'sETH', optionToken, positionIds);
      await hedgeDelta(deploymentParams, 'sETH');
      // TODO: (1) swapout with valid hedger and rehedge
      break;

    case 'MAYBE_EXCHANGE':
      console.log(`liquidityPool.exchangingBase...`);
      await updateAllBoards(optionMarket, optionGreekCache);
      // set exchange rate to super low and ensure not locking base
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
          maxFeePaid: toBN('0'),
        },
      ]);
      // open long call
      positionId = await openPosition(deploymentParams, 'sETH', {
        strikeId: 7,
        amount: toBN('2'),
        optionType: OptionType.LONG_CALL,
      });
      // reset fee threshold to allow exchange
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
        },
      ]);
      await execute(liquidityPool, 'exchangeBase', []);
      // close position
      await closePosition(deploymentParams, 'sETH', {
        positionId: positionId,
        strikeId: 7,
        amount: toBN('2'),
        optionType: OptionType.LONG_CALL,
      });
      break;

    case 'FORCE_SETTLE':
      console.log(`Force Settle...`);
      await openTradesAndForceSettleBoard(deploymentParams, 'sETH', optionMarket, shortCollateral);
      break;

    case 'DEPOSIT':
      console.log(`Depositing...`);
      await execute(liquidityPool, 'setLiquidityPoolParameters', [ROUTINE_LP_PARAMS]);
      await updateAllBoards(optionMarket, optionGreekCache);

      // Initiate deposit
      await execute(liquidityPool, 'initiateDeposit', [deploymentParams.deployer.address, toBN('1000')]);
      await attemptProcess(liquidityPool, true, false);

      // reduce delay (assumes no open positions on market)
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
          depositDelay: 60,
        },
      ]);
      await sleep(100000); // 100 seconds
      await attemptProcess(liquidityPool, true, true);

      // reset params
      await execute(liquidityPool, 'setLiquidityPoolParameters', [ROUTINE_LP_PARAMS]);
      break;

    case 'WITHDRAW':
      console.log(`Withdrawing...`);
      await updateAllBoards(optionMarket, optionGreekCache);

      // initiate withdrawal > tokens
      try {
        await execute(liquidityPool, 'initiateWithdraw', [deploymentParams.deployer.address, toBN('1000000000')]);
        console.log(chalk.red('Expected failed withdraw'));
      } catch (e) {
        console.log(chalk.green('Reverted as expected:'));
        console.log(chalk.grey((e as any).message));
      }
      break;

    case 'CB':
      console.log('Triggering circuit breakers...');
      await updateAllBoards(optionMarket, optionGreekCache);

      // Trigger variance CB
      await execute(liquidityPool, 'initiateWithdraw', [deploymentParams.deployer.address, toBN('1000')]);
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
          guardianMultisig: ZERO_ADDRESS,
          skewVarianceCBThreshold: toBN('0'),
        },
      ]);
      console.log(chalk.gray(`Old CB Timestamp: ${await liquidityPool['CBTimestamp']()}`));
      positionId = await openPosition(deploymentParams, 'sETH', {
        strikeId: 7,
        amount: toBN('0.05'),
        optionType: OptionType.LONG_CALL,
      });
      console.log(chalk.grey(`Opened position with id: ${positionId}`));
      await updateAllBoards(optionMarket, optionGreekCache);
      await execute(liquidityPool, 'updateCBs', []); // trigger CB
      await sleep(60000); // 60 seconds for provider to refresh
      console.log(chalk.gray(`New CB Timestamp: ${await liquidityPool['CBTimestamp']()}`));

      // Failed attempt at processing
      await attemptProcess(liquidityPool, false, false);

      // Pass with guardian bypass
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
          guardianMultisig: deploymentParams.deployer.address,
          skewVarianceCBThreshold: toBN('0'),
        },
      ]);
      await attemptProcess(liquidityPool, false, true);
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
        },
      ]);

      // close final position
      await closePosition(deploymentParams, 'sETH', {
        strikeId: 7,
        amount: toBN('0.05'),
        positionId: positionId,
        optionType: OptionType.LONG_CALL,
      });
      break;

    case 'INSOLVENCY':
      // TODO: hard to test with fake prices...
      break;

    case 'SWAP_ADAPTER':
      const originalExchangeParams = await snxAdapter.getExchangeParams(optionMarket.address);
      const alternate = await getAltSigner(envVars);
      const adapterV1Factory = async (signer: Signer) => {
        return (await ethers.getContractFactory('SynthetixAdapter')).connect(signer);
      };
      const adapterV2Factory = async (signer: Signer) => {
        return (await ethers.getContractFactory('TestSynthetixAdapterV2')).connect(signer);
      };

      console.log('Block swapping by non-owner...');
      await upgrades.upgradeProxy(snxAdapter.address, await adapterV2Factory(alternate)); // silent revert
      await sleep(60000);
      const snxAddress = await snxAdapter.synthetix();
      console.log(chalk.gray('Latest snxAddress', snxAddress));
      if (snxAddress === ZERO_ADDRESS) {
        throw new Error('Expected to revert with: Ownable: caller is not the owner');
      } else {
        console.log(chalk.green(`Upgrade succesfully blocked`));
      }

      console.log('transfer ownership and upgrade...');
      await upgrades.upgradeProxy(snxAdapter.address, await adapterV2Factory(deployer));
      await execute(snxAdapter, 'setAddressResolver', [addressResolver.address]);
      await execute(snxAdapter, 'updateSynthetixAddresses', []);
      console.log(chalk.green(`Successfully swapped adapter`));

      console.log('confirm 10x spot price (wait 1 min)...');
      // TestSynthetixAdapterV2 multiplies spot price by 10 in V2 implementation
      await sleep(60000);
      await isExchangeParamsChanged(snxAdapter, optionMarket, originalExchangeParams, true);

      console.log('transfer ownership back to original adaper...');
      await upgrades.upgradeProxy(snxAdapter.address, await adapterV1Factory(deployer));
      await execute(snxAdapter, 'setAddressResolver', [addressResolver.address]);
      await execute(snxAdapter, 'updateSynthetixAddresses', []);
      console.log(chalk.green(`Successfully swapped back to original`));

      console.log('confirm normal spot price (wait 1 min)...');
      await sleep(60000);
      await isExchangeParamsChanged(snxAdapter, optionMarket, originalExchangeParams, false);

      break;

    case 'SWAP_HEDGER':
      const longCall = await openPosition(deploymentParams, 'sETH', {
        strikeId: 6,
        optionType: OptionType.LONG_CALL,
        amount: toBN('1'),
      });
      console.log(`Opened long call with id: ${longCall}`);
      console.log('-'.repeat(10));

      await execute(poolHedger, 'setPoolHedgerParams', [
        {
          ...DEFAULT_POOL_HEDGER_PARAMS,
          interactionDelay: 1,
        },
      ]);
      await updateAllBoards(optionMarket, optionGreekCache);
      await hedgeDelta(deploymentParams, 'sETH');
      await sleep(30000);
      if (!(await isDeltaUsed(liquidityPool))) {
        throw new Error('Pool hedger not hedging');
      }

      const poolHedgerV2 = await deployContract('ShortPoolHedger', deployer);
      // const poolHedgerV2 = await ethers.getContractAt("PoolHedger", "0xCe6d1269a48C0EE76039baC745B96Ff226DB0c5B", deployer)
      await execute(poolHedgerV2, 'init', [
        snxAdapter.address,
        optionMarket.address,
        optionGreekCache.address,
        liquidityPool.address,
        quoteAsset.address,
        baseAsset.address,
      ]);
      console.log(`PoolHedgerV2 deployed to: ${poolHedgerV2.address}`);
      console.log('-'.repeat(10));

      console.log('swap out to v2 even with balance...');
      await execute(liquidityPool, 'setPoolHedger', [poolHedgerV2.address]);
      await execute(poolHedgerV2, 'openShortAccount', []);
      await execute(poolHedgerV2, 'hedgeDelta', []);

      console.log('ensure v2 hedged again...');
      await sleep(30000);
      if (
        (await isHedgerActive(poolHedgerV2)) &&
        (await isDeltaUsed(liquidityPool)) &&
        (await isPoolHedgerAddressSwapped(liquidityPool, poolHedgerV2.address))
      ) {
        console.log(chalk.green(`Successfully swapped to v2`));
      } else {
        throw new Error('New poolHedger not swapping');
      }
      console.log('-'.repeat(10));

      console.log('swap back to original poolHedger...');
      await execute(poolHedgerV2, 'setPoolHedgerParams', [
        {
          ...DEFAULT_POOL_HEDGER_PARAMS,
          hedgeCap: 0,
        },
      ]);
      await execute(poolHedgerV2, 'hedgeDelta', []);
      await execute(liquidityPool, 'setPoolHedger', [poolHedger.address]);

      console.log('return all funds from original poolHedger...');
      await execute(poolHedger, 'setPoolHedgerParams', [
        {
          ...DEFAULT_POOL_HEDGER_PARAMS,
          interactionDelay: 1,
          hedgeCap: 0,
        },
      ]);

      await sleep(30000);
      const lpOldBalance = await quoteAsset.balanceOf(liquidityPool.address);
      await hedgeDelta(deploymentParams, 'sETH');
      await sleep(30000);
      const lpNewBalance = await quoteAsset.balanceOf(liquidityPool.address);
      if (lpNewBalance.gt(lpOldBalance)) {
        console.log(chalk.green(`Successfully pulled all funds`));
      } else {
        throw new Error('Not able to retreive funds');
      }

      console.log('rehedge with original poolHedger...');
      await execute(poolHedger, 'setPoolHedgerParams', [
        {
          ...DEFAULT_POOL_HEDGER_PARAMS,
          interactionDelay: 1,
        },
      ]);
      await hedgeDelta(deploymentParams, 'sETH');
      await sleep(30000);

      // rehedge with new poolHedger
      if ((await isDeltaUsed(liquidityPool)) && (await isPoolHedgerAddressSwapped(liquidityPool, poolHedger.address))) {
        console.log(chalk.green(`Successfully swapped back to original`));
      } else {
        throw new Error('New poolHedger failed to swap');
      }

      console.log('closing out position and resetting params');
      await execute(poolHedger, 'setPoolHedgerParams', [
        {
          ...DEFAULT_POOL_HEDGER_PARAMS,
        },
      ]);
      await closePosition(deploymentParams, 'sETH', {
        optionType: OptionType.LONG_CALL,
        strikeId: 6,
        positionId: longCall,
        amount: toBN('1'),
      });
      break;

    case 'EMERGENCY_WITHDRAW':
      console.log('100% withdraw...');
      await updateAllBoards(optionMarket, optionGreekCache);

      // open some options and hedge
      positionId = await openPosition(deploymentParams, 'sETH', {
        strikeId: 7,
        optionType: OptionType.SHORT_CALL_QUOTE,
        amount: toBN('5'),
        setCollateralTo: toBN('10000'),
      });
      await hedgeDelta(deploymentParams, 'sETH');

      // Force settle all boards
      await execute(liquidityPool, 'setLiquidityPoolParameters', [
        {
          ...ROUTINE_LP_PARAMS,
          boardSettlementCBTimeout: 1,
        },
      ]); // reduce settlement timeout to 1 sec
      await forceSettleAllBoards(optionMarket);

      // Auto-withdraw should fail as some funds locked in hedger
      lpTokens = await liquidityToken['balanceOf'](deploymentParams.deployer.address);
      await sleep(60000); // 60 seconds for provider to refresh
      if ((await optionMarket['getNumLiveBoards']()).eq(0)) {
        try {
          await execute(liquidityPool, 'initiateWithdraw', [deploymentParams.deployer.address, lpTokens]);
          console.log(chalk.red('Expected failed withdraw'));
        } catch (e) {
          console.log(chalk.green('Reverted as expected:'));
          console.log(chalk.grey((e as any).message));
        }
      } else {
        throw new Error('Force settle failed...');
      }

      // Clear out hedger and fully withdraw
      await hedgeDelta(deploymentParams, 'sETH');
      await execute(liquidityPool, 'initiateWithdraw', [deploymentParams.deployer.address, lpTokens]);

      // settle options at the very end
      await execute(shortCollateral, 'settleOptions', [[positionId]]);
      console.log(chalk.green(`Seettled all options: ${positionIds}`));
      break;

    case 'EXCHANGE_SYNTH':
      console.log('Swapping sUSD to sETH...');
      await execute(delegateApprovals, 'approveExchangeOnBehalf', [snxAdapter.address]);
      await execute(snxAdapter, 'exchangeFromExactQuote', [optionMarket.address, toBN('4900')]);
      break;

    case 'ETHERSCAN':
      console.log('Verifying contract again on etherscan...');
      await etherscanVerification(optionGreekCache.address, []);

      break;

    case 'MISC':
      console.log('Miscellaneous routine...');
      // console.log("LIQUIDITY", await liquidityPool["getLiquidityParams"]())
      // console.log("CB TIMESTAMP", await liquidityPool["CBTimestamp"]())

      // express deposit/withdrawal
      // await execute(quoteAsset, "approve", [liquidityPool.address, MAX_UINT])
      // await execute(liquidityPool, "initiateDeposit", [deploymentParams.deployer.address, toBN("10000")])
      // await execute(liquidityPool, "setLiquidityPoolParameters", [{
      //   ...ROUTINE_LP_PARAMS,
      //   guardianMultisig: deploymentParams.deployer.address}])
      // await attemptProcess(liquidityPool, true, true);
      // await execute(liquidityPool, 'setLiquidityPoolParameters', [
      //   {
      //     ...ROUTINE_LP_PARAMS,
      //   },
      // ]);

      // await hedgeDelta(deploymentParams, "sETH")
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

export async function openAllLongShort(deploymentParams: any, market: string, strikeId?: number) {
  // 3 month, 2350 strike
  const longCall = await openPosition(deploymentParams, market, {
    strikeId: strikeId || 7,
    optionType: OptionType.LONG_CALL,
    amount: toBN('0.1'),
  });
  console.log(`Opened long call with id: ${longCall}`);
  console.log('-'.repeat(10));

  // 1 month, 2250 strike
  const longPut = await openPosition(deploymentParams, market, {
    strikeId: strikeId || 33,
    optionType: OptionType.LONG_PUT,
    amount: toBN('0.1'),
  });
  console.log(`Opened long put with id: ${longPut}`);
  console.log('-'.repeat(10));

  // 2 month, 2100 strike
  const shortCallBase = await openPosition(deploymentParams, market, {
    strikeId: strikeId || 19,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: toBN('0.1'),
    setCollateralTo: toBN('0.08'),
  });
  console.log(`Opened short call base with id: ${shortCallBase}`);
  console.log('-'.repeat(10));

  // 2 month, 2100 strike
  const shortCallQuote = await openPosition(deploymentParams, market, {
    strikeId: strikeId || 19,
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('0.1'),
    setCollateralTo: toBN('200'),
  });
  console.log(`Opened short call quote with id: ${shortCallQuote}`);
  console.log('-'.repeat(10));

  // 2 week, 2050
  const shortPut = await openPosition(deploymentParams, market, {
    strikeId: strikeId || 45,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: toBN('0.1'),
    setCollateralTo: toBN('200'),
  });
  console.log(`Opened short call quote with id: ${shortPut}`);
  console.log('-'.repeat(10));

  return [longCall, longPut, shortCallBase, shortCallQuote, shortPut];
}

export async function modifyAllLongShort(
  deploymentParams: any,
  market: string,
  optionToken: Contract,
  positionIds: number[],
) {
  const positions = (await optionToken['getOptionPositions'](positionIds)) as OptionPositionStruct[];

  // // Add to long call
  await openPosition(deploymentParams, market, {
    strikeId: positions[0].strikeId,
    optionType: OptionType.LONG_CALL,
    amount: toBN('0.05'),
    positionId: positions[0].positionId,
  });
  console.log(`Modified long call with id: ${positions[0].positionId}`);
  console.log('-'.repeat(10));

  // subtract from long put
  await closePosition(deploymentParams, market, {
    strikeId: positions[1].strikeId,
    optionType: OptionType.LONG_PUT,
    amount: toBN('0.05'),
    positionId: positions[1].positionId,
  });
  console.log(`Modified long put with id: ${positions[1].positionId}`);
  console.log('-'.repeat(10));

  // Remove 0.05 amount but add 0.92 -> should allow overcollateralized position
  await closePosition(deploymentParams, market, {
    strikeId: positions[2].strikeId,
    optionType: OptionType.SHORT_CALL_BASE,
    amount: toBN('0.05'),
    positionId: positions[2].positionId,
    setCollateralTo: toBN('1'),
  });
  console.log(`Modified short call base with id: ${positions[2].positionId}`);
  console.log('-'.repeat(10));

  // Add 0.05 amount but remove 1250 collat -> should revert as undercollateralized
  try {
    await openPosition(deploymentParams, market, {
      strikeId: positions[3].strikeId,
      optionType: OptionType.SHORT_CALL_QUOTE,
      amount: toBN('0.05'),
      positionId: positions[3].positionId,
      setCollateralTo: toBN('25'),
    });
    throw new Error('Expected to revert with AdjustmentResultsInMinimumCollateralNotBeingMet');
  } catch (e) {
    console.log(chalk.green(`Reverted as expected with:`));
    console.log(chalk.gray((e as any).message));
    console.log('-'.repeat(10));
  }

  // Add 0.05 amount but remove 1250 collat -> should revert as undercollateralized
  try {
    await openPosition(deploymentParams, market, {
      strikeId: positions[4].strikeId,
      optionType: OptionType.SHORT_PUT_QUOTE,
      amount: toBN('0.05'),
      positionId: positions[4].positionId,
      setCollateralTo: toBN('25'),
    });
    throw new Error('Expected to revert with AdjustmentResultsInMinimumCollateralNotBeingMet');
  } catch (e) {
    console.log(chalk.green(`Reverted as expected with:`));
    console.log(chalk.gray((e as any).message));
    console.log('-'.repeat(10));
  }

  // Add 0.05 amount and add 250 collat -> should succeed
  await openPosition(deploymentParams, market, {
    strikeId: positions[4].strikeId,
    optionType: OptionType.SHORT_PUT_QUOTE,
    amount: toBN('0.05'),
    positionId: positions[4].positionId,
    setCollateralTo: toBN('500'),
  });
  console.log(`Modified short put with id: ${positions[4].positionId}`);
  console.log('-'.repeat(10));
}

export async function fullCloseAllLongShorts(
  deploymentParams: any,
  market: string,
  optionToken: Contract,
  positions: number[],
) {
  for (let i = 0; i < positions.length; i++) {
    const positionId = positions[i];
    const oldPosition = (await optionToken['getOptionPosition'](positionId)) as OptionPositionStruct;
    console.log(chalk.grey(`Got positionId ${positionId} from OptionToken`));

    await closePosition(deploymentParams, market, {
      optionType: oldPosition.optionType as OptionType,
      strikeId: oldPosition.strikeId,
      positionId: oldPosition.positionId,
      amount: oldPosition.amount,
    });

    console.log(chalk.green(`Fully closed positionId ${positionId}`));
  }
}

export async function revertAndSucceedLiquidation(
  deploymentParams: any,
  market: string,
  optionGreekCache: Contract,
  snxAdapter: Contract,
  optionMarket: Contract,
) {
  // get minCollat estimate
  const spotPrice = await snxAdapter['getSpotPriceForMarket'](optionMarket.address);
  console.log(chalk.grey(`Got spotPrice: ${spotPrice}!`));
  const minCollat = (await optionGreekCache['getMinCollateral'](
    OptionType.SHORT_CALL_QUOTE,
    toBN('2100'),
    1656918000,
    spotPrice,
    toBN('0.1'),
  )) as BigNumber;
  if (minCollat == undefined) throw new Error('did not get min collat');
  console.log(chalk.grey(`Got minCollat: ${minCollat}!`));

  // Open a risky but not-liquidatable position -> 2mo, 2100 strike
  const positionId = await openPosition(deploymentParams, market, {
    strikeId: 19,
    optionType: OptionType.SHORT_CALL_QUOTE,
    amount: toBN('0.1'),
    setCollateralTo: minCollat.mul(toBN('1.5')).div(UNIT), // give 10% buffer
  });

  // revert invalid liquidation
  try {
    await execute(optionMarket, 'liquidatePosition', [positionId, deploymentParams.deployer.address]);
    throw new Error('Failed to revert with PositionNotLiquidatable');
  } catch (e) {
    console.log(chalk.green(`Reverted as expected with:`));
    console.log(chalk.gray((e as any).message));
  }

  // set very high liquidation vol
  await execute(optionGreekCache, 'setMinCollateralParameters', [
    {
      ...DEFAULT_MIN_COLLATERAL_PARAMS,
      minStaticQuoteCollateral: toBN('5000'),
    },
  ]);
  await execute(optionMarket, 'liquidatePosition', [positionId, deploymentParams.deployer.address]);

  // reset liquidation vol back to normal
  await execute(optionGreekCache, 'setMinCollateralParameters', [
    {
      ...DEFAULT_MIN_COLLATERAL_PARAMS,
      minStaticBaseCollateral: toBN('0.0001'),
      minStaticQuoteCollateral: toBN('1'),
    },
  ]);
}

export async function forceSettleAllBoards(optionMarket: Contract) {
  const liveBoards = await optionMarket['getLiveBoards']();
  for (let i = 0; i < liveBoards.length; i++) {
    await execute(optionMarket, 'setBoardFrozen', [liveBoards[i], true]);
    await execute(optionMarket, 'forceSettleBoard', [liveBoards[i]]);
    console.log(chalk.green(`Force settled board: ${liveBoards[i]}`));
  }
  if ((await optionMarket['getLiveBoards']()).length != 0) {
    throw new Error('Expected to settle all boards');
  }
}

export async function openTradesAndForceSettleBoard(
  deploymentParams: any,
  market: string,
  optionMarket: Contract,
  shortCollateral: Contract,
) {
  const tx = await execute(optionMarket, 'createOptionBoard', [
    (await currentTime()) + MONTH_SEC,
    toBN('0.65'),
    [toBN('2300')],
    [toBN('1')],
    false,
  ]);

  // confirm board is added
  const liveBoards = await optionMarket['getLiveBoards']();
  const boardData = await getEventArgs(await tx.wait(), 'BoardCreated');
  if (boardData.boardId != liveBoards.length) {
    throw new Error('Board not created');
  }

  const strikeId = (await optionMarket['getBoardStrikes'](boardData.boardId))[0];
  console.log(chalk.grey(`Got strikeId for forceSettle trades: ${strikeId}`));

  // open all trades
  const positionIds = await openAllLongShort(deploymentParams, market, strikeId);

  // forceSettleBoard
  await execute(optionMarket, 'setBoardFrozen', [boardData.boardId, true]);
  await execute(optionMarket, 'forceSettleBoard', [boardData.boardId]);
  console.log(chalk.green(`Force settled board: ${boardData.boardId}`));

  // settle all options
  await execute(shortCollateral, 'settleOptions', [positionIds]);
  console.log(chalk.green(`Seettled all options: ${positionIds}`));
}

export async function updateAllBoards(optionMarket: Contract, optionGreekCache: Contract) {
  const liveBoards = await optionMarket['getLiveBoards']();
  console.log(chalk.grey(`Updating cache on boards: ${liveBoards}`));

  for (let i = 0; i < liveBoards.length; i++) {
    console.log('board', liveBoards[i]);
    await execute(optionGreekCache, 'updateBoardCachedGreeks', [liveBoards[i]]);
  }
}

export async function revertedPoolHedgerSwap(liquidityPool: Contract, newPHAddress: string) {
  try {
    await execute(liquidityPool, 'setPoolHedger', [newPHAddress]);
    throw new Error('Expected to revert with HedgerIsNotEmpty');
  } catch (e) {
    console.log(chalk.green(`Reverted as expected with:`));
    console.log(chalk.gray((e as any).message));
  }
}

export async function attemptProcess(liquidityPool: Contract, isDeposit: boolean, expectProcess: boolean) {
  let fn = 'processDepositQueue';
  let eventName = 'DepositProcessed';
  if (!isDeposit) {
    fn = 'processWithdrawalQueue';
    eventName = 'WithdrawProcessed';
  }

  const tx = await execute(liquidityPool, fn, [1]);
  let processed = false;
  try {
    await getEventArgs(await tx.wait(), eventName);
    processed = true;
  } catch (e) {
    if (!((e as any).message == `Could not find event ${eventName}`)) {
      throw e;
    }
  }
  if ((processed && !expectProcess) || (!processed && expectProcess)) {
    throw new Error(`Expected process: ${expectProcess}`);
  } else {
    console.log(chalk.green(`Processed: ${expectProcess} as expected`));
  }
}

export async function isExchangeParamsChanged(
  snxAdapter: Contract,
  optionMarket: Contract,
  originalExchangeParams: any,
  expectGreater: boolean,
) {
  // TestSynthetixAdapterV2 multiplies spot price by 10 in V2 implementation
  await sleep(60000);
  const exchangeParams = await snxAdapter.getExchangeParams(optionMarket.address);
  if (exchangeParams.spotPrice.gt(originalExchangeParams.spotPrice.mul(5)) && expectGreater) {
    console.log(chalk.green(`Confirmed new implementation correct`));
  } else if (exchangeParams.spotPrice.lt(originalExchangeParams.spotPrice.mul(2)) && !expectGreater) {
    console.log(chalk.green(`Confirmed new implementation correct`));
  } else {
    throw new Error('Proxy implementation not upgraded');
  }
}

export async function isHedgerActive(poolHedger: Contract) {
  const netDelta = await poolHedger.getCurrentHedgedNetDelta();
  if (!netDelta.eq(toBN('0'))) {
    return true;
  } else {
    return false;
  }
}

export async function isDeltaUsed(liquidityPool: Contract) {
  const liquidity = await liquidityPool.getLiquidity();
  if (liquidity.usedDeltaLiquidity.gt(toBN('0'))) {
    return true;
  } else {
    return false;
  }
}

export async function isPoolHedgerAddressSwapped(liquidityPool: Contract, expectedAddress: string) {
  const poolHedgerAddress = (await liquidityPool.poolHedger()) as string;
  console.log('poolHedger address @ liquidityPool', poolHedgerAddress);
  if (poolHedgerAddress === expectedAddress) {
    return true;
  } else {
    return false;
  }
}
