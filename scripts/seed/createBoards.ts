import { BigNumber } from 'ethers';
import { DeploymentParams } from '../util';
import { executeLyraFunction } from '../util/transactions';
import { currentTime, fromBN, getEventArgs, MONTH_SEC, toBN, toBN18, WEEK_SEC } from '../util/web3utils';

export async function createBoards(
  deploymentParams: DeploymentParams,
  boards: { BaseIv: string; Expiry: number; Skews: string[]; Strikes: string[] }[],
  market: string,
): Promise<BigNumber[]> {
  boards.sort((x, y) => (x.Expiry < y.Expiry ? -1 : 1));
  boards.reverse();

  const boardIds: BigNumber[] = [];
  for (const board of boards) {
    const strikes = board.Strikes.map(toCleanBN);
    const skews = board.Skews.map(toBN18);
    console.log(`Adding board with expiry ${board.Expiry} and baseIv ${board.BaseIv}`);
    console.log(`With strikePrices: ${strikes.map(fromBN)}`);
    console.log(`With skews: ${skews.map(fromBN)}`);

    // TODO: move to params file
    let baseIv;
    switch (market) {
      case 'BTC':
        baseIv = '0.60';
        break;
      case 'wBTC':
        baseIv = '0.60';
        break;
      case 'ETH':
        baseIv = '0.65';
        break;
      case 'wETH':
        baseIv = '0.65';
        break;
    }

    if (!baseIv) {
      throw Error("Market doesn't have default baseIv");
    }

    for (let i = 0; i < strikes.length - 1; i++) {
      if (strikes[i].eq(strikes[i + 1])) {
        throw Error('duplicate strike in array' + strikes[i].toString());
      }
    }
    const tx = (await executeLyraFunction(
      deploymentParams,
      'OptionMarket',
      'createOptionBoard',
      [board.Expiry, toBN(baseIv), strikes, skews, false],
      market,
    )) as any;
    boardIds.push(getEventArgs(await tx.wait(), 'BoardCreated').boardId as BigNumber);
  }
  return boardIds;
}

function toCleanBN(num: string) {
  const bn = toBN(num);
  if (bn.gt(BigNumber.from(10).pow(28))) {
    throw Error('Cannot clean bn as too large');
  }
  for (let pow = 28; pow > 10; pow--) {
    if (bn.gt(BigNumber.from(10).pow(pow))) {
      const excess = bn.mod(BigNumber.from(10).pow(pow - 1));
      let extra = BigNumber.from(0);
      if (
        excess.gte(
          BigNumber.from(10)
            .pow(pow - 2)
            .mul(5),
        )
      ) {
        extra = BigNumber.from(10)
          .pow(pow - 2)
          .mul(5);
      }
      return bn.sub(excess).add(extra);
    }
  }
  return bn;
}

export async function generateBoards(currentRate: string) {
  const now = await currentTime();
  const basePrice = parseFloat(currentRate);

  return [
    // generateBoardParamsFor(basePrice, now, 20, WEEK_SEC),
    generateBoardParamsFor(basePrice, now, 13, WEEK_SEC * 2),
    // generateBoardParamsFor(basePrice, now, 20, WEEK_SEC * 3),
    generateBoardParamsFor(basePrice, now, 13, WEEK_SEC * 4),
    // generateBoardParamsFor(basePrice, now, 13, WEEK_SEC * 6),
    generateBoardParamsFor(basePrice, now, 13, WEEK_SEC * 8),
    // generateBoardParamsFor(basePrice, now, 20, WEEK_SEC * 10),
    generateBoardParamsFor(basePrice, now, 13, WEEK_SEC * 12),
  ];
}

export function generateBoardParamsFor(currentRate: number, now: number, numberListings: number, expiry: number) {
  if (expiry < WEEK_SEC || expiry > MONTH_SEC * 5) {
    throw 'Invalid expiry, must be between 1 week and 5 months';
  }

  // 1 week = 0.6x -> 1.7x
  // 3 months = 0.3x -> 3x
  const minStrike = ((3 * MONTH_SEC - WEEK_SEC - expiry) / (3 * MONTH_SEC - WEEK_SEC)) * (0.6 - 0.5) + 0.5;
  const maxStrike = ((expiry - WEEK_SEC) / (3 * MONTH_SEC - WEEK_SEC)) * (2 - 1.7) + 1.7;

  const strikes = [];
  const skews = [];
  for (let i = 0; i < numberListings; i++) {
    strikes.push(
      (+(((i / numberListings) * (maxStrike - minStrike) + minStrike) * currentRate).toPrecision(3)).toString(),
    );
    // For skews:
    // 1 + ((x)/4)^2
    // with x between -1 and 1
    skews.push((+(1 + ((i - numberListings / 2) / (numberListings / 2) / 4) ** 2).toPrecision(4)).toString());
  }

  return {
    BaseIv: '0.6',
    Expiry: roundTimestamp(now + expiry),
    Skews: skews,
    Strikes: strikes,
  };
}

function roundTimestamp(timestamp: number) {
  const d = new Date(timestamp * 1000);
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  return d.getTime() / 1000;
}
