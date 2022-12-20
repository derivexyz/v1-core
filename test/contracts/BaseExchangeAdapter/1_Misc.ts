import { toBN, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { expect } from '../../utils/testSetup';
import { ethers } from 'hardhat';
import { TestBaseExchangeAdapter } from '../../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('GMXAdapter', async () => {
  let exchangeAdapter: TestBaseExchangeAdapter;
  let deployer: SignerWithAddress;
  before(async () => {
    [deployer] = await ethers.getSigners();
    exchangeAdapter = await (await ethers.getContractFactory('TestBaseExchangeAdapter', deployer)).deploy();
  });

  // Integration test
  it('reverts on non implemented functions', async () => {
    await expect(exchangeAdapter.estimateExchangeToExactQuote(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.estimateExchangeToExactBase(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.exchangeFromExactBase(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.exchangeFromExactQuote(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.exchangeToExactBaseWithLimit(ZERO_ADDRESS, 0, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.exchangeToExactBase(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.exchangeToExactQuoteWithLimit(ZERO_ADDRESS, 0, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.exchangeToExactQuote(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.rateAndCarry(ZERO_ADDRESS)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.getSpotPriceForMarket(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
    await expect(exchangeAdapter.getSettlementPriceForMarket(ZERO_ADDRESS, 0)).revertedWith('NotImplemented');
  });

  it('reverts on transfer', async () => {
    const tokenForceFailQuote = await (await ethers.getContractFactory('TestERC20Fail')).deploy('t', 't');
    await tokenForceFailQuote.mint(exchangeAdapter.address, toBN('2'));
    await exchangeAdapter.testTransferAsset(tokenForceFailQuote.address, deployer.address, toBN('1'));
    await tokenForceFailQuote.setForceFail(true);
    await expect(
      exchangeAdapter.testTransferAsset(tokenForceFailQuote.address, deployer.address, toBN('1')),
    ).revertedWith('');
  });
});
