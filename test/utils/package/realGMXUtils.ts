import { Signer } from 'ethers';

import { deployGMXTestSystem } from 'gmx/scripts/core/deployGMXComplete';
import { ethers } from 'hardhat';
import { MockAggregatorV2V3, PriceFeed, Router, TestERC20SetDecimals, USDG, Vault } from '../../../typechain-types';
import { GMXDeployContractsType } from '../deployTestSystemGMX';

const errors = [
  'Vault: zero error',
  'Vault: already initialized',
  'Vault: invalid _maxLeverage',
  'Vault: invalid _taxBasisPoints',
  'Vault: invalid _stableTaxBasisPoints',
  'Vault: invalid _mintBurnFeeBasisPoints',
  'Vault: invalid _swapFeeBasisPoints',
  'Vault: invalid _stableSwapFeeBasisPoints',
  'Vault: invalid _marginFeeBasisPoints',
  'Vault: invalid _liquidationFeeUsd',
  'Vault: invalid _fundingInterval',
  'Vault: invalid _fundingRateFactor',
  'Vault: invalid _stableFundingRateFactor',
  'Vault: token not whitelisted',
  'Vault: _token not whitelisted',
  'Vault: invalid tokenAmount',
  'Vault: _token not whitelisted',
  'Vault: invalid tokenAmount',
  'Vault: invalid usdgAmount',
  'Vault: _token not whitelisted',
  'Vault: invalid usdgAmount',
  'Vault: invalid redemptionAmount',
  'Vault: invalid amountOut',
  'Vault: swaps not enabled',
  'Vault: _tokenIn not whitelisted',
  'Vault: _tokenOut not whitelisted',
  'Vault: invalid tokens',
  'Vault: invalid amountIn',
  'Vault: leverage not enabled',
  'Vault: insufficient collateral for fees',
  'Vault: invalid position.size',
  'Vault: empty position',
  'Vault: position size exceeded',
  'Vault: position collateral exceeded',
  'Vault: invalid liquidator',
  'Vault: empty position',
  'Vault: position cannot be liquidated',
  'Vault: invalid position',
  'Vault: invalid _averagePrice',
  'Vault: collateral should be withdrawn',
  'Vault: _size must be more than _collateral',
  'Vault: invalid msg.sender',
  'Vault: mismatched tokens',
  'Vault: _collateralToken not whitelisted',
  'Vault: _collateralToken must not be a stableToken',
  'Vault: _collateralToken not whitelisted',
  'Vault: _collateralToken must be a stableToken',
  'Vault: _indexToken must not be a stableToken',
  'Vault: _indexToken not shortable',
  'Vault: invalid increase',
  'Vault: reserve exceeds pool',
  'Vault: max USDG exceeded',
  'Vault: reserve exceeds pool',
  'Vault: forbidden',
  'Vault: forbidden',
  'Vault: maxGasPrice exceeded',
];

export async function deployRealGMX(
  deployer: Signer,
  contractOverrides?: {
    USDC: TestERC20SetDecimals;
    eth: TestERC20SetDecimals;
    btc: TestERC20SetDecimals;
    usdcPriceFeed: MockAggregatorV2V3;
    ethPriceFeed: MockAggregatorV2V3;
    btcPriceFeed: MockAggregatorV2V3;
  },
): Promise<GMXDeployContractsType> {
  const [_minter, _wallet, tokenManager, mintReceiver] = await ethers.getSigners();
  const result = (await deployGMXTestSystem(
    deployer,
    deployer,
    tokenManager,
    mintReceiver,
    contractOverrides || {},
  )) as GMXDeployContractsType;
  result.isMockGMX = false; // may not be necessary.

  return result as GMXDeployContractsType;
}

async function initVaultErrors(vault: Vault) {
  const vaultErrorController = await (await ethers.getContractFactory('VaultErrorController')).deploy();
  await vault.setErrorController(vaultErrorController.address);
  await vaultErrorController.setErrors(vault.address, errors);
  return vaultErrorController;
}

export async function initVault(vault: Vault, router: Router, usdg: USDG, priceFeed: PriceFeed) {
  await vault.initialize(
    router.address, // router
    usdg.address, // usdg
    priceFeed.address, // priceFeed
    toUsd(5), // liquidationFeeUsd, This is usd but
    600, // fundingRateFactor
    600, // stableFundingRateFactor
  );

  const vaultErrorController = await initVaultErrors(vault);

  return { vault, vaultErrorController };
}

// TODO: from the GMX code base absolute....
function toUsd(value: number) {
  const normalizedValue = parseInt((value * Math.pow(10, 10)).toString());
  return ethers.BigNumber.from(normalizedValue).mul(ethers.BigNumber.from(10).pow(20));
}
