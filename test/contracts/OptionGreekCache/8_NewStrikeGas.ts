import { currentTime, DAY_SEC, toBN, WEEK_SEC } from '../../../scripts/util/web3utils';
import { seedFixture } from '../../utils/fixture';
import { hre } from '../../utils/testSetup';

describe('OptionGreekCache - SyncBoards', () => {
  beforeEach(seedFixture);
  it('Adding board with 1 strike', async () => {
    await hre.f.c.optionMarket.createOptionBoard(
      (await currentTime()) + DAY_SEC,
      toBN('1'),
      new Array(1).fill('1000').map(toBN),
      new Array(1).fill('1').map(toBN),
      false,
    );
  });

  // ~14.6mln gas
  it('Adding board with 25 strikes', async () => {
    const tx = await hre.f.c.optionMarket.createOptionBoard(
      (await currentTime()) + WEEK_SEC,
      toBN('1'),
      new Array(25).fill('1000').map(toBN),
      new Array(25).fill('1').map(toBN),
      false,
    );
    console.log((await tx.wait()).gasUsed.toString());
  });

  // about 10.4mln to 17.4mln
  // it('Adding board with 30 strikes', async () => {
  //   await hre.f.c.optionMarket.createOptionBoard(
  //     (await currentTime()) + WEEK_SEC,
  //     toBN("1"),
  //     new Array(30).fill('1000').map(toBN),
  //     new Array(30).fill('1').map(toBN),
  //     false,
  //   );
  // });
});
