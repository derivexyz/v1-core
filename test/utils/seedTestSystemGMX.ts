// Seed GMX system

import { BigNumber, BigNumberish, Signer } from 'ethers';
import { currentTime, getEventArgs, toBN, toBN18 } from '../../scripts/util/web3utils';
import { MarketTestSystemContractsGMX, TestSystemContractsTypeGMX } from './deployTestSystemGMX';
import { SeedOverrides } from './seedTestSystem';
import * as defaultParams from './defaultParams';
import { FuturesPoolHedgerParametersStruct } from '../../typechain-types/GMXFuturesPoolHedger';
import { ERC20, MockAggregatorV2V3 } from '../../typechain-types';
import { DEFAULT_BASE_PRICE, DEFAULT_GMX_POOL_HEDGER_PARAMS } from './defaultParams';

export async function seedTestSystemGMX(
  deployer: Signer,
  testSystem: TestSystemContractsTypeGMX,
  overrides?: SeedOverrides,
) {
  overrides = overrides || ({} as SeedOverrides);

  if (testSystem.gmx.isMockGMX) {
    await setCLETHPrice(testSystem, DEFAULT_BASE_PRICE);
    await testSystem.gmx.usdcPriceFeed.setLatestAnswer(toBN('1'), await currentTime());
  } else {
    await setPrice(testSystem, '1500', testSystem.gmx.eth, testSystem.gmx.ethPriceFeed); // setting eth price to 1.5k
    await setPrice(testSystem, '20000', testSystem.gmx.btc, testSystem.gmx.btcPriceFeed); // setting btc price to 20k
  }

  // seed vault
  // await testSystem.gmx.USDC.mint(testSystem.gmx.vault.address, toBN('3000'));
  // await testSystem.gmx.vault.buyUSDG(testSystem.gmx.USDC.address, await deployer.getAddress());

  await seedLiquidityPoolGMX(deployer, testSystem, overrides.initialPoolDeposit);
  await seedBalanceAndApprovalForGMX(deployer, testSystem);

  await testSystem.futuresPoolHedger.setFuturesPoolHedgerParams({
    ...DEFAULT_GMX_POOL_HEDGER_PARAMS,
  } as FuturesPoolHedgerParametersStruct);

  return await createDefaultBoardWithOverrides(
    testSystem,
    overrides.initialBoard || defaultParams.DEFAULT_BOARD_PARAMS,
  );
}

export async function seedLiquidityPoolGMX(
  deployer: Signer,
  testSystem: TestSystemContractsTypeGMX,
  poolDeposit?: BigNumberish,
) {
  poolDeposit = poolDeposit || defaultParams.DEFAULT_POOL_DEPOSIT;

  // As per gmx testing
  await testSystem.gmx.USDC.connect(deployer).mint(await deployer.getAddress(), toBN('1000000'));
  await testSystem.gmx.eth.connect(deployer).mint(await deployer.getAddress(), toBN('1000000'));

  await testSystem.gmx.USDC.mint(await deployer.getAddress(), poolDeposit);
  await testSystem.gmx.USDC.connect(deployer).approve(testSystem.liquidityPool.address, poolDeposit);
  await testSystem.liquidityPool.connect(deployer).initiateDeposit(await deployer.getAddress(), poolDeposit);
}

export async function seedBalanceAndApprovalForGMX(
  account: Signer,
  testSystem: TestSystemContractsTypeGMX,
  initialQuoteBalance?: BigNumber,
  initialBaseBalance?: BigNumber,
) {
  initialQuoteBalance = initialQuoteBalance || defaultParams.DEFAULT_QUOTE_BALANCE;
  initialBaseBalance = initialBaseBalance || defaultParams.DEFAULT_BASE_BALANCE;

  // Mint tokens
  // await testSystem.gmx.USDC.mint(await account.getAddress(), initialQuoteBalance);
  // await testSystem.gmx.eth.mint(await account.getAddress(), initialBaseBalance);

  // Approve option market
  await testSystem.gmx.USDC.connect(account).approve(
    testSystem.optionMarket.address,
    initialQuoteBalance || defaultParams.DEFAULT_QUOTE_BALANCE,
  );
  await testSystem.gmx.eth
    .connect(account)
    .approve(testSystem.optionMarket.address, initialBaseBalance || defaultParams.DEFAULT_BASE_BALANCE);

  // Approve liquidity pool
  await testSystem.gmx.USDC.connect(account).approve(
    testSystem.liquidityPool.address,
    initialQuoteBalance || defaultParams.DEFAULT_QUOTE_BALANCE,
  );
}

export async function createDefaultBoardWithOverrides(
  testSystem: TestSystemContractsTypeGMX | MarketTestSystemContractsGMX,
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
    strikePrices.map(toBN18),
    skews.map(toBN18),
    false,
  );

  return getEventArgs(await tx.wait(), 'BoardCreated').boardId;
}

// sets the fast price feed for gmx
export async function setPrice(
  testSystem: TestSystemContractsTypeGMX,
  price: string,
  token: ERC20,
  priceFeed: MockAggregatorV2V3,
) {
  if (testSystem.gmx.fastPriceFeed !== undefined) {
    // skipping this if mocked gmx
    await testSystem.gmx.fastPriceFeed.setPrices([token.address], [price + '0'.repeat(30)], await currentTime());
  }
  await priceFeed.setLatestAnswer(price + '0'.repeat(8), await currentTime());
}

export async function setCLETHPrice(testSystem: TestSystemContractsTypeGMX, price: BigNumber) {
  await testSystem.gmx.ethPriceFeed.setLatestAnswer(price.div(BigNumber.from(10).pow(10)), await currentTime());
}
