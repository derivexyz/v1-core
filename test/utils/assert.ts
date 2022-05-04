import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { fromBN, toBN } from '../../scripts/util/web3utils';
chai.use(solidity);

export function assertCloseTo(a: BigNumber, b: BigNumber, delta: BigNumber = toBN('0.5')) {
  expect(a.sub(b).abs().lte(delta), `${fromBN(a)} is not close to ${fromBN(b)} +/- ${fromBN(delta)}`).is.true;
}

export function assertCloseToPercentage(a: BigNumber, b: BigNumber, percentage: BigNumber = toBN('0.0005')) {
  if (b.eq(0)) {
    expect(a.eq(0), `${fromBN(a)} is not close to ${fromBN(b)} +/- ${fromBN(percentage.mul(100))}%`).is.true;
    return;
  }
  expect(
    b.sub(a).mul(toBN('1')).div(b).abs().lte(percentage),
    `${fromBN(a)} is not close to ${fromBN(b)} +/- ${fromBN(percentage.mul(100))}%`,
  ).is.true;
}

export function assertNotCloseToPercentage(a: BigNumber, b: BigNumber, percentage: BigNumber = toBN('0.0005')) {
  if (b.eq(0)) {
    expect(a.eq(0), `${fromBN(a)} is close to ${fromBN(b)} +/- ${fromBN(percentage.mul(100))}%`).is.false;
    return;
  }
  expect(
    b.sub(a).mul(toBN('1')).div(b).abs().lte(percentage),
    `${fromBN(a)} is close to ${fromBN(b)} +/- ${fromBN(percentage.mul(100))}%`,
  ).is.false;
}

export function getPercentageDiff(a: BigNumber, b: BigNumber): BigNumber {
  if (b.eq(0)) {
    if (a.eq(0)) {
      return BigNumber.from(0);
    }
    return toBN('1');
  }
  return b.sub(a).mul(toBN('1')).div(b).abs();
}
