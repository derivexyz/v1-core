import { ethers } from 'hardhat';
import { BigNumber, Contract } from 'ethers';
import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import {
  abi as POSITION_MANAGER_ABI,
  bytecode as POSITION_MANAGER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import { ISwapRouter, IUniswapV3Pool, TestWETH } from '../../typechain-types';
import { toBN, ZERO_ADDRESS } from '../util/web3utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { convertPriceE18ToSqrtX96 } from '../util/maths';

const ONE = BigNumber.from('1000000000000000000');

export async function deployUniswap(deployer: SignerWithAddress): Promise<{
  factory: Contract;
  weth: TestWETH;
  swapRouter: ISwapRouter;
  positionManager: Contract;
}> {
  const factory = await (await ethers.getContractFactory(FACTORY_ABI, FACTORY_BYTECODE)).connect(deployer).deploy();

  const weth = await (await ethers.getContractFactory('TestWETH')).connect(deployer).deploy('WETH', 'WETH', 18);

  const swapRouter = (await (await ethers.getContractFactory(SWAP_ROUTER_ABI, SWAP_ROUTER_BYTECODE))
    .connect(deployer)
    .deploy(factory.address, weth.address)) as ISwapRouter;

  // tokenDescriptor is set to address(0)
  const positionManager = await (await ethers.getContractFactory(POSITION_MANAGER_ABI, POSITION_MANAGER_BYTECODE))
    .connect(deployer)
    .deploy(factory.address, weth.address, ZERO_ADDRESS);

  return { factory, weth, swapRouter, positionManager };
}

/**
 *
 * @param factory
 * @param base
 * @param quote
 * @param initPrice
 */
export async function deployUniswapPool(
  factory: Contract,
  positionManager: Contract,
  base: Contract,
  quote: Contract,
  initPrice: string,
) {
  const isBaseToken0 = base.address < quote.address;

  // weth/usdt is 2000
  const price = toBN(initPrice);
  const sqrtX96Price = isBaseToken0
    ? convertPriceE18ToSqrtX96(price)
    : convertPriceE18ToSqrtX96(ONE.mul(ONE).div(price));

  const token0 = isBaseToken0 ? base.address : quote.address;
  const token1 = isBaseToken0 ? quote.address : base.address;

  // // https://docs.uniswap.org/protocol/reference/periphery/base/PoolInitializer
  await positionManager.createAndInitializePoolIfNecessary(
    token0,
    token1,
    3000, // fee = 0.3%
    sqrtX96Price,
  );

  const wethPoolAddr = await factory.getPool(token0, token1, 3000);
  const pool = (await ethers.getContractAt('IUniswapV3Pool', wethPoolAddr)) as IUniswapV3Pool;

  await pool.increaseObservationCardinalityNext(128);

  return { pool, isBaseToken0 };
}
