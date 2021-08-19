import { MockContract } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { toBytes32 } from '../../../scripts/util/web3utils';
import { IExchanger } from '../../../typechain';

export class MockedExchanger {
  contract: MockContract & IExchanger;

  constructor(_contract: MockContract & IExchanger) {
    this.contract = _contract;
  }

  async mockFeeFor(sourceCurrencyKey: string, destCurrencyKey: string, fee: BigNumber) {
    await this.contract.mock.feeRateForExchange
      .withArgs(toBytes32(sourceCurrencyKey), toBytes32(destCurrencyKey))
      .returns(fee);
  }
}
