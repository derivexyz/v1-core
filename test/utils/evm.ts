import { ethers } from 'hardhat';
import { currentTime } from '../../scripts/util/web3utils';

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
export async function fastForwardTo(time: number, silentError: boolean = false) {
  const timestamp = await currentTime();
  if (time < timestamp) {
    if (silentError) {
      console.log(`Time parameter (${time}) is less than now ${timestamp}. Continuing.`);
      return;
    }
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
