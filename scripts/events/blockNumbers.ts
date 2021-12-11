import axios from 'axios';
import sqlite3 from 'better-sqlite3';
import * as path from 'path';
import { AllowedNetworks, getNetworkProviderUrl } from '../util';

const REGENESIS_ADD = 10_000_000;
const mainnet_endpoint = 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-blocks';
const kovan_endpoint = 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-kovan-blocks';

const USE_GRAPH = false;

async function getBlockTimestamp(
  network: AllowedNetworks,
  isPostRegenesis: boolean,
  blockNumber: number | 'latest',
): Promise<[number, number] | null> {
  let res;
  for (let i = 0; i < 10; i++) {
    try {
      res = await axios.post(getNetworkProviderUrl(network), {
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [
          blockNumber == 'latest'
            ? 'latest'
            : '0x' + (blockNumber - (isPostRegenesis ? REGENESIS_ADD : 0)).toString(16),
          false,
        ],
        id: 1,
      });
      break;
    } catch {
      console.log(`-- fail fetching block ${blockNumber} timestamp, retrying`);
    }
  }
  if (!res) {
    throw new Error('Failed to fetch block 10 times');
  }
  if (res.data.result) {
    return [
      parseInt(res.data.result.number, 16) + (isPostRegenesis ? REGENESIS_ADD : 0),
      parseInt(res.data.result.timestamp, 16),
    ];
  } else {
    return null;
  }
}

async function getBlocksFast(blocksDb: any, isPostRegenesis: boolean, network: AllowedNetworks) {
  await blocksDb.exec(`CREATE TABLE IF NOT EXISTS blockNums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blockNumber INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    )`);

  const insertStmt = blocksDb.prepare('INSERT INTO blockNums (blockNumber, timestamp) VALUES (?, ?)');
  const insertMany = blocksDb.transaction((blockNums: any) => {
    for (const blockNum of blockNums) {
      insertStmt.run(parseInt(blockNum.number) + (isPostRegenesis ? REGENESIS_ADD : 0), blockNum.timestamp);
    }
  });

  let current: number =
    (blocksDb.prepare('SELECT MAX(blockNumber) as maxBlock FROM blockNums').get()?.maxBlock || 0) + 1;

  if (current > REGENESIS_ADD) {
    current = current - REGENESIS_ADD;
  }

  const limit = 1000;
  let res;
  do {
    console.log(`- Caching block timestamps: [${current}-${current + 1000}]`);
    res = await axios.post(network == 'mainnet-ovm' ? mainnet_endpoint : kovan_endpoint, {
      query: `{
        blocks(first: ${limit}, where:{number_gte:${current}}, orderBy: number) {
          number
          timestamp
        }
      }`,
    });
    current += limit;
    insertMany(res.data.data.blocks);
  } while (res.data.data.blocks.length > 1000);
}

async function cacheBlockNumbers(blocksDb: any, isPostRegenesis: boolean, network: AllowedNetworks) {
  await blocksDb.exec(`CREATE TABLE IF NOT EXISTS blockNums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
  )`);

  const insertStmt = blocksDb.prepare('INSERT INTO blockNums (blockNumber, timestamp) VALUES (?, ?)');
  const insertMany = blocksDb.transaction((blockNums: any) => {
    for (const blockNum of blockNums) {
      insertStmt.run(parseInt(blockNum[0]), blockNum[1]);
    }
  });

  let startBlock: number =
    (blocksDb.prepare('SELECT MAX(blockNumber) as maxBlock FROM blockNums').get()?.maxBlock || 0) + 1;
  const maxBlock = await getBlockTimestamp(network, false, 'latest' as any);
  console.log(`- Caching block timestamps: [${startBlock}-${maxBlock}]`);

  if (!maxBlock) {
    throw Error('');
  }
  let endBlock = maxBlock[0];
  const batchSize = 200;

  if (isPostRegenesis && endBlock < REGENESIS_ADD) {
    endBlock += REGENESIS_ADD;
  }

  if (isPostRegenesis && startBlock < REGENESIS_ADD) {
    startBlock += REGENESIS_ADD;
  }

  for (let i = startBlock; i < endBlock; i += batchSize) {
    console.log(`- ${i}/${endBlock}`);
    const promises = [];
    for (let j = i; j < i + batchSize; j++) {
      promises.push(getBlockTimestamp(network, isPostRegenesis, j));
    }
    const results = await Promise.all(promises);
    insertMany(results.filter(x => x !== null));
  }
}

export async function getTimestampForBlock(blocksDb: sqlite3.Database, blockNumber: number) {
  const res = blocksDb.prepare('SELECT blockNumber, timestamp FROM blockNums WHERE blockNumber = ?').get(blockNumber);

  if (res.length == 0) {
    throw Error('missing timestamp for block ' + blockNumber);
  }

  return res.timestamp;
}

export async function updateBlocksToLatest(network: AllowedNetworks) {
  const blocksDb = sqlite3(path.join(__dirname, '../data/', network, '/blockNumbers.sqlite'));

  if (USE_GRAPH) {
    await getBlocksFast(blocksDb, false, network);
  } else {
    await cacheBlockNumbers(blocksDb, true, network);
  }

  return blocksDb.prepare('SELECT MAX(blockNumber) as maxBlock FROM blockNums').get()?.maxBlock || 0;
}
