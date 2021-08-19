import { MockContract } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { IExchangeRates } from '../../../typechain';

export class MockedExchangeRates {
  contract: MockContract & IExchangeRates;

  constructor(_contract: MockContract & IExchangeRates) {
    this.contract = _contract;
  }

  async mockInvalid(invalid: boolean) {
    await this.contract.mock.rateAndInvalid.returns(0, invalid);
  }

  async mockLatestPrice(price: BigNumber) {
    await this.contract.mock.rateAndInvalid.returns(price, false);
  }
}
