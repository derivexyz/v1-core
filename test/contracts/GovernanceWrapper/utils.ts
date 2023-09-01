import { BigNumber } from 'ethers';
import { TestSystemContractsTypeGMX } from '../../utils/deployTestSystemGMX';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  GMXAdapterGovernanceWrapper,
  GMXHedgerGovernanceWrapper,
  GovernanceWrapperViewerGMX,
  LiquidityPoolGovernanceWrapper,
  OptionGreekCacheGovernanceWrapper,
  OptionMarketGovernanceWrapper,
  OptionMarketPricerGovernanceWrapper,
  OptionTokenGovernanceWrapper,
  SNXAdapterGovernanceWrapper,
  SNXHedgerGovernanceWrapper,
} from '../../../typechain-types';
import { TestSystemContractsTypePerps } from '../../utils/fixture';
import { TestSystemContractsType } from '../../utils/deployTestSystem';

export type GovernanceWrappersTypeGMX = {
  gmxAdapterGov: GMXAdapterGovernanceWrapper;
  gmxHedgerGov: GMXHedgerGovernanceWrapper;
  liquidityPoolGov: LiquidityPoolGovernanceWrapper;
  optionMarketGov: OptionMarketGovernanceWrapper;
  optionMarketPricerGov: OptionMarketPricerGovernanceWrapper;
  greekCacheGov: OptionGreekCacheGovernanceWrapper;
  optionTokenGov: OptionTokenGovernanceWrapper;
  govWrapperViewer: GovernanceWrapperViewerGMX;
};

export type GovernanceWrappersTypeSNXPerps = {
  liquidityPoolGov: LiquidityPoolGovernanceWrapper;
  optionMarketGov: OptionMarketGovernanceWrapper;
  optionMarketPricerGov: OptionMarketPricerGovernanceWrapper;
  greekCacheGov: OptionGreekCacheGovernanceWrapper;
  optionTokenGov: OptionTokenGovernanceWrapper;
  snxHedgerGov: SNXHedgerGovernanceWrapper;
  snxAdapterGov: SNXAdapterGovernanceWrapper;
};

export async function deployGovernanceWrappers(c: TestSystemContractsTypeGMX, deployer: SignerWithAddress) {
  const govWrappers: GovernanceWrappersTypeGMX = {
    gmxAdapterGov: await (await ethers.getContractFactory('GMXAdapterGovernanceWrapper', deployer)).deploy(),
    gmxHedgerGov: await (await ethers.getContractFactory('GMXHedgerGovernanceWrapper', deployer)).deploy(),
    liquidityPoolGov: await (await ethers.getContractFactory('LiquidityPoolGovernanceWrapper', deployer)).deploy(),
    optionMarketGov: await (await ethers.getContractFactory('OptionMarketGovernanceWrapper', deployer)).deploy(),
    optionMarketPricerGov: await (
      await ethers.getContractFactory('OptionMarketPricerGovernanceWrapper', deployer)
    ).deploy(),
    greekCacheGov: await (await ethers.getContractFactory('OptionGreekCacheGovernanceWrapper', deployer)).deploy(),
    optionTokenGov: await (await ethers.getContractFactory('OptionTokenGovernanceWrapper', deployer)).deploy(),
    govWrapperViewer: await (await ethers.getContractFactory('GovernanceWrapperViewerGMX', deployer)).deploy(),
  };

  // nominating ownership on the governancewrapper
  await c.liquidityPool.connect(deployer).nominateNewOwner(govWrappers.liquidityPoolGov.address);
  await c.optionMarket.connect(deployer).nominateNewOwner(govWrappers.optionMarketGov.address);
  await c.optionGreekCache.connect(deployer).nominateNewOwner(govWrappers.greekCacheGov.address);
  await c.optionToken.connect(deployer).nominateNewOwner(govWrappers.optionTokenGov.address);
  await c.optionMarketPricer.connect(deployer).nominateNewOwner(govWrappers.optionMarketPricerGov.address);

  await c.futuresPoolHedger.connect(deployer).nominateNewOwner(govWrappers.gmxHedgerGov.address);
  await c.GMXAdapter.connect(deployer).nominateNewOwner(govWrappers.gmxAdapterGov.address);

  // Taking over ownership
  await govWrappers.gmxAdapterGov.setGMXAdapter(c.GMXAdapter.address);
  await govWrappers.gmxHedgerGov.setLiquidityPool(c.liquidityPool.address);
  await govWrappers.gmxHedgerGov.updateMarketHedger();

  await govWrappers.liquidityPoolGov.setLiquidityPool(c.liquidityPool.address);
  await govWrappers.optionMarketGov.setOptionMarket(c.optionMarket.address);
  await govWrappers.optionMarketPricerGov.setOptionMarketPricer(c.optionMarketPricer.address);
  await govWrappers.greekCacheGov.setOptionGreekCache(c.optionGreekCache.address);
  await govWrappers.optionTokenGov.setOptionToken(c.optionToken.address);
  await govWrappers.govWrapperViewer.addGMXGovernanceWrappers(c.optionMarket.address, {
    gmxAdapterGovernanceWrapper: govWrappers.gmxAdapterGov.address,
    gmxHedgerGovernanceWrapper: govWrappers.gmxHedgerGov.address,
    liquidityPoolGovernanceWrapper: govWrappers.liquidityPoolGov.address,
    optionGreekCacheGovernanceWrapper: govWrappers.greekCacheGov.address,
    optionMarketGovernanceWrapper: govWrappers.optionMarketGov.address,
    optionMarketPricerGovernanceWrapper: govWrappers.optionMarketPricerGov.address,
    optionTokenGovernanceWrapper: govWrappers.optionTokenGov.address,
  });

  return govWrappers;
}

export async function deploySNXGovernanceWrapper(
  c: TestSystemContractsType,
  pc: TestSystemContractsTypePerps,
  deployer: SignerWithAddress,
): Promise<GovernanceWrappersTypeSNXPerps> {
  const govWrappers: GovernanceWrappersTypeSNXPerps = {
    snxAdapterGov: await (await ethers.getContractFactory('SNXAdapterGovernanceWrapper', deployer)).deploy(),
    snxHedgerGov: await (await ethers.getContractFactory('SNXHedgerGovernanceWrapper', deployer)).deploy(),
    liquidityPoolGov: await (await ethers.getContractFactory('LiquidityPoolGovernanceWrapper', deployer)).deploy(),
    optionMarketGov: await (await ethers.getContractFactory('OptionMarketGovernanceWrapper', deployer)).deploy(),
    optionMarketPricerGov: await (
      await ethers.getContractFactory('OptionMarketPricerGovernanceWrapper', deployer)
    ).deploy(),
    greekCacheGov: await (await ethers.getContractFactory('OptionGreekCacheGovernanceWrapper', deployer)).deploy(),
    optionTokenGov: await (await ethers.getContractFactory('OptionTokenGovernanceWrapper', deployer)).deploy(),
  };

  // nominating ownership on the governancewrapper
  await c.liquidityPool.connect(deployer).nominateNewOwner(govWrappers.liquidityPoolGov.address);
  await c.optionMarket.connect(deployer).nominateNewOwner(govWrappers.optionMarketGov.address);
  await c.optionGreekCache.connect(deployer).nominateNewOwner(govWrappers.greekCacheGov.address);
  await c.optionToken.connect(deployer).nominateNewOwner(govWrappers.optionTokenGov.address);
  await c.optionMarketPricer.connect(deployer).nominateNewOwner(govWrappers.optionMarketPricerGov.address);

  await pc.perpHedger.connect(deployer).nominateNewOwner(govWrappers.snxHedgerGov.address);
  await c.synthetixPerpV2Adapter.connect(deployer).nominateNewOwner(govWrappers.snxAdapterGov.address);

  // Taking over ownership
  await govWrappers.snxAdapterGov.setSNXAdapter(c.synthetixPerpV2Adapter.address);
  await govWrappers.snxHedgerGov.setLiquidityPool(c.liquidityPool.address);
  await govWrappers.snxHedgerGov.updateMarketHedger();

  await govWrappers.liquidityPoolGov.setLiquidityPool(c.liquidityPool.address);
  await govWrappers.optionMarketGov.setOptionMarket(c.optionMarket.address);
  await govWrappers.optionMarketPricerGov.setOptionMarketPricer(c.optionMarketPricer.address);
  await govWrappers.greekCacheGov.setOptionGreekCache(c.optionGreekCache.address);
  await govWrappers.optionTokenGov.setOptionToken(c.optionToken.address);

  return govWrappers;
}

// function to compare the returned value from an ethers query and the passed in dictionary
export function compareStruct(struct: any, dict: any) {
  const regEx: RegExp = /[0-9]{1}/;

  for (const key in dict) {
    if (key.match(regEx)) {
      continue;
    }

    if (struct[key] instanceof BigNumber) {
      if (!struct[key].eq(dict[key])) {
        return false;
      }
    } else {
      if (struct[key] !== dict[key]) {
        return false;
      }
    }
  }
  return true;
}
