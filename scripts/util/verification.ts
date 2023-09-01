import hre from 'hardhat';

export const etherscanVerification = (contractAddress: string, args: (string | string[])[]) => {
  if (hre.network.name === 'local') {
    return;
  }
  console.log('Attempting to verify contract on etherscan');

  return runTaskWithRetry(
    'verify:verify',
    {
      address: contractAddress,
      constructorArguments: args,
    },
    4,
    5000,
  );
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry is needed because the contract was recently deployed and it hasn't propagated to the explorer backend yet
export const runTaskWithRetry = async (task: string, params: any, times: number, msDelay: number) => {
  let counter = times;
  await delay(msDelay);

  try {
    await hre.run(task, params);
  } catch (error: any) {
    if (error.message.includes('Reason: Already Verified')) {
      console.log('Exiting verification, already verified');
      return;
    }
    if (error instanceof Error) {
      console.error('[ETHERSCAN][ERROR]', 'unable to verify', error.message);

      if (error.message.includes('Reason: Already Verified')) {
        console.log('Exiting, already verified');
        return;
      }
      counter--;

      if (counter > 0) {
        console.log('Retrying...');
        await runTaskWithRetry(task, params, counter, msDelay);
      }
    }
  }
};
