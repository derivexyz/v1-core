import { DeploymentParams } from '../../../scripts/util';
import { BigNumber } from 'ethers';
import {
  callExternalFunction,
  deployMockExternalContract,
  executeExternalFunction,
  getExternalContract,
} from '../../../scripts/util/transactions';
import { send } from '../../utils/evm';
import { MONTH_SEC } from '../../../scripts/util/web3utils';
import { MockPyth } from '../../../typechain-types';

export async function setSUSDBalance(deploymentParams: DeploymentParams, recipient: string, amount: BigNumber) {
  const sUSD_underlying = await getExternalContract(deploymentParams, 'SynthsUSD');
  // add ETH
  await send(
    'hardhat_setBalance',
    [sUSD_underlying.address, '0x1' + '0'.repeat(18)], // ~400 ETH
  );

  await send('hardhat_impersonateAccount', [sUSD_underlying.address]);
  const caller: any = await deploymentParams.provider?.getSigner(sUSD_underlying.address);

  await executeExternalFunction(deploymentParams, 'TokenStatesUSD', 'setBalanceOf', [recipient, amount], caller);

  await send('hardhat_stopImpersonatingAccount', [sUSD_underlying.address]);
}

export async function setUSDCBalance(deploymentParams: DeploymentParams, recipient: string, amount: BigNumber) {
  // add ETH
  await send(
    'hardhat_setBalance',
    ['0x4200000000000000000000000000000000000010', '0x1' + '0'.repeat(18)], // ~400 ETH
  );

  await send('hardhat_impersonateAccount', ['0x4200000000000000000000000000000000000010']);
  const caller: any = await deploymentParams.provider?.getSigner('0x4200000000000000000000000000000000000010');

  await executeExternalFunction(deploymentParams, 'USDC', 'mint', [recipient, amount], caller);

  await send('hardhat_stopImpersonatingAccount', ['0x4200000000000000000000000000000000000010']);
}

export async function deployMockPyth(deploymentParams: DeploymentParams): Promise<MockPyth> {
  const mockPyth: MockPyth = (await deployMockExternalContract(
    deploymentParams,
    'MockPyth',
    'MockPyth',
    MONTH_SEC * 12,
    1,
  )) as any;

  const owner = await callExternalFunction(deploymentParams, 'PerpsV2ExchangeRate', 'owner', []);
  await send('hardhat_impersonateAccount', [owner]);
  await send(
    'hardhat_setBalance',
    [owner, '0x1' + '0'.repeat(18)], // ~400 ETH
  );
  const caller: any = await deploymentParams.provider?.getSigner(owner);

  await executeExternalFunction(
    deploymentParams,
    'PerpsV2ExchangeRate',
    'setOffchainOracle',
    [mockPyth.address],
    caller,
  );

  await send('hardhat_stopImpersonatingAccount', [owner]);

  return mockPyth;
}
