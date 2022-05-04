import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import * as hardhatRuntimeEnvironment from 'hardhat';
import { HardhatRuntimeEnvironmentWithFixture } from './fixture';

chai.use(solidity);

const hre: HardhatRuntimeEnvironmentWithFixture =
  hardhatRuntimeEnvironment as any as HardhatRuntimeEnvironmentWithFixture;

export { expect as expect, hre };
