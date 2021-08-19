import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { currentTime, fromBN, toBN } from '../../scripts/util/web3utils';
import { expect } from './testSetup';

export function send(method: string, params?: Array<any>) {
  return ethers.provider.send(method, params === undefined ? [] : params);
}

export function mineBlock() {
  return send('evm_mine', []);
}

/**
 *  Increases the time in the EVM.
 *  @param seconds Number of seconds to increase the time by
 */
export async function fastForward(seconds: number) {
  const method = 'evm_increaseTime';
  const params = [seconds];

  await send(method, params);

  await mineBlock();
}

/**
 *  Increases the time in the EVM to as close to a specific timestamp as possible
 */
export async function fastForwardTo(time: number) {
  const timestamp = await currentTime();
  if (time < timestamp) {
    throw new Error(
      `Time parameter (${time}) is less than now ${timestamp}. You can only fast forward to times in the future.`,
    );
  }

  const secondsBetween = Math.floor(time - timestamp);
  await fastForward(secondsBetween);
}

/**
 *  Takes a snapshot and returns the ID of the snapshot for restoring later.
 */
export async function takeSnapshot(): Promise<number> {
  const result = await send('evm_snapshot');
  await mineBlock();
  return result;
}

/**
 *  Restores a snapshot that was previously taken with takeSnapshot
 *  @param id The ID that was returned when takeSnapshot was called.
 */
export async function restoreSnapshot(id: number) {
  await send('evm_revert', [id]);
  await mineBlock();
}

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
