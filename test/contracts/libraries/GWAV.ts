import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { currentTime, DAY_SEC, HOUR_SEC, toBN } from '../../../scripts/util/web3utils';
import { GWAV, TestGWAV } from '../../../typechain-types';
import { assertCloseToPercentage } from '../../utils/assert';
import { restoreSnapshot, takeSnapshot } from '../../utils/evm';
import { expect } from '../../utils/testSetup';

describe('Oracle - unit test', async () => {
  let deployer: Signer;
  let gwav: GWAV;
  let oracle: TestGWAV;

  let snap: number;

  before(async () => {
    [deployer] = await ethers.getSigners();

    gwav = (await (await ethers.getContractFactory('GWAV')).connect(deployer).deploy()) as GWAV;
    oracle = (await (await ethers.getContractFactory('TestGWAV', { libraries: { GWAV: gwav.address } }))
      .connect(deployer)
      .deploy()) as TestGWAV;
  });

  beforeEach(async () => {
    snap = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snap);
  });

  it('records data', async () => {
    const startTimestamp = await currentTime();

    await oracle.initialize(toBN('0.96'), startTimestamp - DAY_SEC * 8);
    await oracle.recordObservation(toBN('1'), startTimestamp - DAY_SEC * 7);
    await oracle.recordObservation(toBN('1'), startTimestamp - DAY_SEC * 6);
    await oracle.recordObservation(toBN('1'), startTimestamp - DAY_SEC * 5);
    await oracle.recordObservation(toBN('1.04'), startTimestamp - DAY_SEC * 4);
    await oracle.recordObservation(toBN('1.04'), startTimestamp - DAY_SEC * 3);
    await oracle.recordObservation(toBN('1.04'), startTimestamp - DAY_SEC * 2);
    await oracle.recordObservation(toBN('1.04'), startTimestamp - DAY_SEC);

    assertCloseToPercentage(await oracle.getGWAVBetween(DAY_SEC * 6, DAY_SEC * 2), toBN('1.01980'));
  });

  it('records data', async () => {
    const startTimestamp = await currentTime();

    await oracle.initialize(toBN('1.1'), startTimestamp - HOUR_SEC * 11);
    await oracle.recordObservation(toBN('1.2'), startTimestamp - HOUR_SEC * 10);
    await oracle.recordObservation(toBN('1.3'), startTimestamp - HOUR_SEC * 9);
    await oracle.recordObservation(toBN('1.4'), startTimestamp - HOUR_SEC * 2);
    await oracle.recordObservation(toBN('1.5'), startTimestamp);

    assertCloseToPercentage(await oracle.getGWAVBetween(HOUR_SEC * 7, HOUR_SEC), toBN('1.31616'));
  });

  describe('correctness', () => {
    it('simple case', async () => {
      // #gwap_length = 12, start_vol = 100,
      // #new_vols = [104,88,89,70,111,120,73,100]
      // #new_times = [1,2.5,4,9,11,15,16.5,22]
      //    Times	GWAPs	Vols
      // 0	1.0	100.00000000000004	104
      // 1	2.5	100.49146264976785	88
      // 2	4.0	98.89845371700163	89
      // 3	9.0	94.2110847269601	70
      // 4	11.0	88.77384097015569	111
      // 5	15.0	91.95529141409918	120
      // 6	16.5	95.54535414612687	73
      // 7	22.0	89.01293672672743	100

      const startTimestamp = (await currentTime()) - HOUR_SEC * 22;
      await oracle.initialize(toBN('1.0'), startTimestamp);
      await oracle.recordObservation(toBN('1.04'), startTimestamp + HOUR_SEC);
      await oracle.recordObservation(toBN('0.88'), startTimestamp + 2.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.89'), startTimestamp + 4 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.70'), startTimestamp + 9 * HOUR_SEC);
      await oracle.recordObservation(toBN('1.11'), startTimestamp + 11 * HOUR_SEC);
      await oracle.recordObservation(toBN('1.20'), startTimestamp + 15 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.73'), startTimestamp + 16.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('1.00'), startTimestamp + 22 * HOUR_SEC);
      assertCloseToPercentage(await oracle.getGWAVBetween(HOUR_SEC * 12, 0), toBN('0.89012937'));
    });

    it('Always low', async () => {
      // # gwap_length = 8, start_vol = 5
      // # new_vols = [6,12,3,4,9,9,4.5,4.7]
      // # new_times = [.1,3.5,4.3,7.9,8.2,12,12.5,20]
      // 	Times	GWAPs	Vols
      // 0	0.1	4.999999999999999	6.0
      // 1	3.5	5.402839096785406	12.0
      // 2	4.3	5.897163353812607	3.0
      // 3	7.9	4.686096424938813	4.0
      // 4	8.2	4.636468672294784	9.0
      // 5	12.0	5.382899890403113	9.0
      // 6	12.5	5.4734244989614895	4.5
      // 7	20.0	4.699232020923361	4.7

      const startTimestamp = (await currentTime()) - HOUR_SEC * 20;
      await oracle.initialize(toBN('0.05'), startTimestamp);
      await oracle.recordObservation(toBN('0.06'), startTimestamp + 0.1 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.12'), startTimestamp + 3.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.03'), startTimestamp + 4.3 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.04'), startTimestamp + 7.9 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.09'), startTimestamp + 8.2 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.09'), startTimestamp + 12 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.045'), startTimestamp + 12.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.047'), startTimestamp + 20 * HOUR_SEC);
      assertCloseToPercentage(await oracle.getGWAVBetween(HOUR_SEC * 8, 0), toBN('0.04699232'));
    });

    it('crashes', async () => {
      // #Crash Down
      // # gwap_length = 9, start_vol = 100
      // # new_vols = [6,12,3,4,9,9,4.5,4.7]
      // # new_times = [.1,3.5,4.3,7.9,8.2,12,12.5,20]
      // 	Times	GWAPs	Vols
      // 0	0.1	100.00000000000004	6.0
      // 1	3.5	34.54718730296874	12.0
      // 2	4.3	28.612917238275767	3.0
      // 3	7.9	7.037374136536201	4.0
      // 4	8.2	6.321390803498157	9.0
      // 5	12.0	5.662098340769949	9.0
      // 6	12.5	5.79108921794283	4.5
      // 7	20.0	5.051079217392179	4.7
      const startTimestamp = (await currentTime()) - HOUR_SEC * 20;
      await oracle.initialize(toBN('1'), startTimestamp);
      await oracle.recordObservation(toBN('0.06'), startTimestamp + 0.1 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.12'), startTimestamp + 3.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.03'), startTimestamp + 4.3 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.04'), startTimestamp + 7.9 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.09'), startTimestamp + 8.2 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.09'), startTimestamp + 12 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.045'), startTimestamp + 12.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.047'), startTimestamp + 20 * HOUR_SEC);
      assertCloseToPercentage(await oracle.getGWAVBetween(HOUR_SEC * 9, 0), toBN('0.050511'));
    });

    it('crazy high crash and recover', async () => {
      // # gwap_length = 10
      // #new_vols = [22000,10000,1000,4,3000,40000,19000,22222]
      // #new_times = [.1,2.5,7.3,14.9,18.2,20.5,31.5,32.0]
      // 0	0.1	19999.99999999998	22000
      // 1	2.5	20462.761389844505	10000
      // 2	7.3	14671.342041931583	1000
      // 3	14.9	1737.8008287493772	4
      // 4	18.2	161.68874760841757	3000
      // 5	20.5	208.16978119298082	40000
      // 6	31.5	40000.00000000012	19000
      // 7	32.0	38538.48800449833	22222

      const startTimestamp = (await currentTime()) - HOUR_SEC * 32;
      await oracle.initialize(toBN('1'), startTimestamp);
      await oracle.recordObservation(toBN('220.00'), startTimestamp + 0.1 * HOUR_SEC);
      await oracle.recordObservation(toBN('100.00'), startTimestamp + 2.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('10.00'), startTimestamp + 7.3 * HOUR_SEC);
      await oracle.recordObservation(toBN('0.04'), startTimestamp + 14.9 * HOUR_SEC);
      await oracle.recordObservation(toBN('30.00'), startTimestamp + 18.2 * HOUR_SEC);
      await oracle.recordObservation(toBN('400.00'), startTimestamp + 20.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('190.00'), startTimestamp + 31.5 * HOUR_SEC);
      await oracle.recordObservation(toBN('222.22'), startTimestamp + 32.0 * HOUR_SEC);
      assertCloseToPercentage(await oracle.getGWAVBetween(HOUR_SEC * 10, 0), toBN('385.38488'));
    });
  });

  describe('edge cases / coverage', () => {
    // exp/ln are tested thoroughly in BlackScholes

    it('can get gwav for period where timeA == timeB', async () => {
      const startTimestamp = await currentTime();
      await oracle.initialize(toBN('0.96'), startTimestamp - DAY_SEC);
      assertCloseToPercentage(await oracle.getGWAVBetween(DAY_SEC, DAY_SEC), toBN('0.96'));
    });

    it('cannot record values in the past', async () => {
      const startTimestamp = await currentTime();
      await oracle.initialize(toBN('0.96'), startTimestamp - DAY_SEC);
      // Note: revert error is due to a bug with hardhat
      await expect(oracle.recordObservation(toBN('1.2'), startTimestamp - DAY_SEC - 1)).revertedWith(
        'InvalidBlockTimestamp',
      );
    });

    it('updates the latest nexVal if the timestamp is the same', async () => {
      const startTimestamp = await currentTime();
      await oracle.initialize(toBN('0.96'), startTimestamp - DAY_SEC);
      await oracle.recordObservation(toBN('1.2'), startTimestamp - DAY_SEC);
      assertCloseToPercentage(await oracle.getGWAVBetween(DAY_SEC, 0), toBN('1.2'));
    });

    it('observe edge cases', async () => {
      const startTimestamp = await currentTime();
      await oracle.initialize(toBN('0.96'), startTimestamp - DAY_SEC * 2);
      await oracle.recordObservation(toBN('1.2'), startTimestamp - DAY_SEC);
      await oracle.observe([DAY_SEC * 4, DAY_SEC]);
    });

    it('queries empty', async () => {
      await expect(oracle.observe([DAY_SEC * 2, DAY_SEC])).revertedWith(
        'Array accessed at an out-of-bounds or negative index',
      );
    });

    it('fills the array', async () => {
      const startTimestamp = await currentTime();
      await oracle.initialize(toBN('0.96'), startTimestamp - 2 * DAY_SEC);
      const timestamps = [];
      const values = [];
      for (let j = 0; j < 100; j += 1) {
        timestamps.push(startTimestamp - DAY_SEC + j * 6);
        values.push(toBN('0.96').add(j % 2));
      }
      await oracle.recordMany(values, timestamps);
      await oracle.observe([DAY_SEC * 2, DAY_SEC]);
      assertCloseToPercentage(await oracle.getGWAVBetween(HOUR_SEC * 7, HOUR_SEC), toBN('0.96'));
    });
  });
});
