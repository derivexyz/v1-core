import { Signer } from 'ethers';
import { MONTH_SEC, toBN } from '../../scripts/util/web3utils';
import { createDefaultBoardWithOverrides } from './contractHelpers';
import { TestSystemContractsType } from './deployTestSystem';

export async function seedTestBalances(deployer: Signer, c: TestSystemContractsType, overrides?: any) {
  const deployerAddr = await deployer.getAddress();

  // Mint tokens
  await c.test.quoteToken.mint(deployerAddr, toBN('1000000'));
  await c.test.baseToken.mint(deployerAddr, toBN('10000'));

  // Seed pool
  await c.test.quoteToken.approve(c.liquidityPool.address, toBN('1000000'));
  await c.liquidityPool.deposit(deployerAddr, toBN(overrides?.poolDeposit || '500000'));

  // Approve option market
  await c.test.quoteToken.approve(c.optionMarket.address, toBN('1000000'));
  await c.test.baseToken.approve(c.optionMarket.address, toBN('10000'));
}

export async function seedBalanceAndApprovalFor(account: Signer, c: TestSystemContractsType) {
  // Mint tokens
  await c.test.quoteToken.mint(await account.getAddress(), toBN('1000000'));
  await c.test.baseToken.mint(await account.getAddress(), toBN('10000'));

  // Approve option market
  await c.test.quoteToken.connect(account).approve(c.optionMarket.address, toBN('1000000'));
  await c.test.baseToken.connect(account).approve(c.optionMarket.address, toBN('10000'));
}

export async function seedTestSystem(deployer: Signer, c: TestSystemContractsType, overrides?: any) {
  await seedTestBalances(deployer, c, overrides);

  return await createDefaultBoardWithOverrides(c, {
    expiresIn: MONTH_SEC,
    baseIV: '1',
    strikes: ['1500', '2000', '2500'],
    skews: ['0.9', '1', '1.1'],
  });
}
