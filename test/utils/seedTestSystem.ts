import { BigNumber, Contract, Signer } from 'ethers';
import { currentTime, getEventArgs, toBN, toBytes32 } from '../../scripts/util/web3utils';
import * as defaultParams from './defaultParams';
import { MarketTestSystemContracts, TestSystemContractsType } from './deployTestSystem';
import { getLocalRealSynthetixContract } from './package/parseFiles';
import { changeRate, mintBase, mintQuote } from './package/realSynthetixUtils';

export type SeedOverrides = {
  initialBasePrice?: BigNumber;
  initialBoard?: defaultParams.BoardParameters;
  initialPoolDeposit?: BigNumber;
  initialQuoteBalace?: BigNumber;
  initialBaseBalance?: BigNumber;
};

export async function seedTestSystem(deployer: Signer, testSystem: TestSystemContractsType, overrides?: SeedOverrides) {
  overrides = overrides || ({} as SeedOverrides);
  if (testSystem.snx.isMockSNX) {
    await testSystem.snx.exchangeRates.setRateAndInvalid(
      toBytes32('sETH'),
      overrides.initialBasePrice || defaultParams.DEFAULT_BASE_PRICE,
      false,
    );
  } else {
    await changeRate(testSystem, overrides.initialBasePrice || defaultParams.DEFAULT_BASE_PRICE, 'sETH');

    // Some issues with snx deploy script where these values are not being set properly
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralShort`)) as Contract).addSynths(
      [toBytes32('SynthsETH')],
      [toBytes32('sETH')],
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralShort`)) as Contract).addSynths(
      [toBytes32('SynthsUSD')],
      [toBytes32('sUSD')],
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).setMaxDebt(
      '75000000000000000000000000',
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).setMaxSkewRate(
      '200000000000000000',
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).setBaseBorrowRate(
      '158443823',
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).setBaseShortRate(
      '158443823',
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).addSynths(
      [toBytes32('SynthsUSD')],
      [toBytes32('sUSD')],
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).addSynths(
      [toBytes32('SynthsBTC')],
      [toBytes32('sBTC')],
    );
    await ((await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract).addSynths(
      [toBytes32('SynthsETH')],
      [toBytes32('sETH')],
    );
    await (
      (await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract
    ).addShortableSynths([toBytes32('SynthsBTC')], [toBytes32('sBTC')]);
    await (
      (await getLocalRealSynthetixContract(deployer, 'local', `CollateralManager`)) as Contract
    ).addShortableSynths([toBytes32('SynthsETH')], [toBytes32('sETH')]);
    await ((await getLocalRealSynthetixContract(deployer, 'local', `Issuer`)) as Contract).rebuildCache();
  }

  await seedLiquidityPool(deployer, testSystem, overrides.initialPoolDeposit);
  await seedBalanceAndApprovalFor(deployer, testSystem, overrides.initialQuoteBalace, overrides.initialBaseBalance);

  // Open hedger short account
  testSystem.snx.collateralManager = testSystem.snx.collateralManager || ({} as Contract);

  await testSystem.poolHedger.openShortAccount();
  await testSystem.poolHedger.hedgeDelta();
  await testSystem.poolHedger.hedgeDelta();

  return await createDefaultBoardWithOverrides(
    testSystem,
    overrides.initialBoard || defaultParams.DEFAULT_BOARD_PARAMS,
  );
}

export async function seedNewMarketSystem(
  deployer: Signer,
  testSystem: TestSystemContractsType,
  overrides?: SeedOverrides,
) {
  overrides = overrides || ({} as SeedOverrides);
  await seedLiquidityPool(deployer, testSystem, overrides.initialPoolDeposit);
  await seedBalanceAndApprovalFor(deployer, testSystem, overrides.initialQuoteBalace, overrides.initialBaseBalance);

  // Open hedger short account
  await testSystem.poolHedger.openShortAccount();
  await testSystem.poolHedger.hedgeDelta();
  return;
}

export async function seedLiquidityPool(
  deployer: Signer,
  testSystem: TestSystemContractsType,
  poolDeposit?: BigNumber,
) {
  poolDeposit = poolDeposit || defaultParams.DEFAULT_POOL_DEPOSIT;

  if (testSystem.snx.isMockSNX) {
    // mint
    await testSystem.snx.quoteAsset.mint(await deployer.getAddress(), poolDeposit);
  } else {
    // mint
    // during deployTestSystem, mintsUSD already generated ~$16bln for deployer
  }
  // approve
  await testSystem.snx.quoteAsset.connect(deployer).approve(testSystem.liquidityPool.address, poolDeposit);

  // deposit
  await testSystem.liquidityPool.connect(deployer).initiateDeposit(await deployer.getAddress(), poolDeposit);
}

export async function seedBalanceAndApprovalFor(
  account: Signer,
  testSystem: TestSystemContractsType,
  initialQuoteBalance?: BigNumber,
  initialBaseBalance?: BigNumber,
  market?: string,
) {
  initialQuoteBalance = initialQuoteBalance || defaultParams.DEFAULT_QUOTE_BALANCE;
  initialBaseBalance = initialBaseBalance || defaultParams.DEFAULT_BASE_BALANCE;

  if (testSystem.snx.isMockSNX) {
    // Mint tokens
    await testSystem.snx.quoteAsset.mint(await account.getAddress(), initialQuoteBalance);
    await testSystem.snx.baseAsset.mint(await account.getAddress(), initialBaseBalance);
  } else {
    market = market || 'sETH';
    await mintQuote(testSystem, account, initialQuoteBalance);
    await mintBase(testSystem, market, account, initialBaseBalance);
  }

  // Approve option market
  await testSystem.snx.quoteAsset
    .connect(account)
    .approve(testSystem.optionMarket.address, initialQuoteBalance || defaultParams.DEFAULT_QUOTE_BALANCE);
  await testSystem.snx.baseAsset
    .connect(account)
    .approve(testSystem.optionMarket.address, initialBaseBalance || defaultParams.DEFAULT_BASE_BALANCE);

  // Approve liquidity pool
  await testSystem.snx.quoteAsset
    .connect(account)
    .approve(testSystem.liquidityPool.address, initialQuoteBalance || defaultParams.DEFAULT_QUOTE_BALANCE);
}

export async function createDefaultBoardWithOverrides(
  testSystem: TestSystemContractsType | MarketTestSystemContracts,
  overrides?: {
    expiresIn?: number;
    baseIV?: string;
    strikePrices?: string[];
    skews?: string[];
  },
): Promise<BigNumber> {
  const expiresIn = overrides?.expiresIn || defaultParams.DEFAULT_BOARD_PARAMS.expiresIn;
  const baseIV = overrides?.baseIV || defaultParams.DEFAULT_BOARD_PARAMS.baseIV;
  const strikePrices = overrides?.strikePrices || defaultParams.DEFAULT_BOARD_PARAMS.strikePrices;
  const skews = overrides?.skews || defaultParams.DEFAULT_BOARD_PARAMS.skews;

  const tx = await testSystem.optionMarket.createOptionBoard(
    (await currentTime()) + expiresIn,
    toBN(baseIV),
    strikePrices.map(toBN),
    skews.map(toBN),
    false,
  );

  const boardId = getEventArgs(await tx.wait(), 'BoardCreated').boardId;
  await testSystem.optionGreekCache.updateBoardCachedGreeks(boardId);
  return boardId;
}

export async function mockPrice(testSystem: TestSystemContractsType, price: BigNumber, market: string) {
  if (testSystem.snx.isMockSNX) {
    testSystem.snx.exchangeRates.setRateAndInvalid(toBytes32(market), price, false);
  } else {
    await changeRate(testSystem, price, 'sETH');
  }
}

// export async function seedMarketBalances(
//   deployer: Signer,
//   existingTestSystem: TestSystemContractsType,
//   marketSystem?: MarketTestSystemContracts,
//   poolDeposit?: BigNumber
// ) {

//   const combinedTestSystem: TestSystemContractsType = replaceMarketTestSystem(existingTestSystem, marketSystem);
//   const deployerAddr = await deployer.getAddress();

//   if (existingTestSystem.snx.isMockSNX) {
//     // Mint tokens
//     await existingTestSystem.snx.quoteAsset.mint(deployerAddr, toBN('1000000'));
//     await combinedTestSystem.snx.baseAsset.mint(deployerAddr, toBN('10000'));

//     // Seed pool
//     await existingTestSystem.snx.quoteAsset.connect(deployer).approve(combinedTestSystem.liquidityPool.address, MAX_UINT);

//     await combinedTestSystem.liquidityPool.connect(deployer)
//       .initiateDeposit(deployerAddr, overrides.initialPoolDeposit || defaultParams.DEFAULT_POOL_DEPOSIT);
//   }

//   // Approve option market
//   await existingTestSystem.snx.quoteAsset.connect(deployer).approve(combinedTestSystem.optionMarket.address, MAX_UINT);
//   await combinedTestSystem.snx.baseAsset.connect(deployer).approve(combinedTestSystem.optionMarket.address, MAX_UINT);

//   // Open hedger short account
//   await combinedTestSystem.poolHedger.openShortAccount();
//   await combinedTestSystem.poolHedger.hedgeDelta();
// }
