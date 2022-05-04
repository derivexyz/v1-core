import { BigNumber, BigNumberish, Contract } from 'ethers';
import { toBN, toBytes32, UNIT, ZERO_ADDRESS } from '../../../scripts/util/web3utils';
import { assertCloseToPercentage } from '../assert';
import { DEFAULT_FEE_RATE_FOR_BASE, DEFAULT_FEE_RATE_FOR_QUOTE, DEFAULT_SECURITY_MODULE } from '../defaultParams';
import { expect, hre } from '../testSetup';

export async function defaultBTCExchange() {
  await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32('sBTC'), toBN('20000'), false);
  await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sUSD'), toBytes32('sBTC'), toBN('0.005'));
  await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32('sBTC'), toBytes32('sUSD'), toBN('0.001'));

  await hre.f.c.synthetixAdapter.setGlobalsForContract(
    ZERO_ADDRESS,
    toBytes32('sUSD'),
    toBytes32('sBTC'),
    DEFAULT_SECURITY_MODULE,
    toBytes32(''),
  );
}

export type Balances = {
  quote: BigNumber;
  base: BigNumber;
};

export const getBalances = async (account?: string): Promise<Balances> => {
  return {
    quote: await hre.f.c.snx.quoteAsset.balanceOf(account || hre.f.deployer.address),
    base: await hre.f.c.snx.baseAsset.balanceOf(account || hre.f.deployer.address),
  };
};

export const expectBalance = async (tokenContract: Contract, expectedVal: BigNumber, account?: string) => {
  expect(await tokenContract.balanceOf(account || hre.f.signers[0].address)).to.eq(expectedVal);
};

export const expectBalanceCloseTo = async (tokenContract: Contract, expectedVal: BigNumber, account?: string) => {
  assertCloseToPercentage(await tokenContract.balanceOf(account || hre.f.signers[0].address), expectedVal);
};

export async function getSpotPrice() {
  return await hre.f.c.synthetixAdapter.getSpotPrice(toBytes32('sETH'));
}

export async function mockPrice(market: string, rate: BigNumberish) {
  await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32(market), rate, false);
}

export async function setETHPrice(rate: BigNumberish) {
  await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32('sETH'), rate, false);
}

export async function setETHExchangerInvalid() {
  const spot = await hre.f.c.snx.exchangeRates.rates(toBytes32('sETH'));
  await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32('sETH'), spot, true);
}

export async function setETHExchangerValid() {
  const spot = await hre.f.c.snx.exchangeRates.rates(toBytes32('sETH'));
  await hre.f.c.snx.exchangeRates.setRateAndInvalid(toBytes32('sETH'), spot, false);
}

export async function setETHFeeRate(from: string, to: string, forwardFee: BigNumber, backwardFee: BigNumber) {
  await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32(from), toBytes32(to), forwardFee);
  await hre.f.c.snx.exchanger.setFeeRateForExchange(toBytes32(to), toBytes32(from), backwardFee);
}

export async function estimateExchange(quote: BigNumber, toBase: boolean) {
  const params = await hre.f.c.synthetixAdapter.getExchangeParams(hre.f.c.optionMarket.address);
  const feeRate = toBase ? DEFAULT_FEE_RATE_FOR_QUOTE : DEFAULT_FEE_RATE_FOR_BASE;
  return quote.mul(params.spotPrice).div(UNIT).mul(UNIT.sub(feeRate));
}
