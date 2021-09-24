import axios from 'axios';
import sqlite3 from 'better-sqlite3';
import * as path from 'path';
import { Params } from '../util';

async function getBlockTimestamp(blockNumber: number | 'latest'): Promise<[number, number] | null> {
  let res;
  if (!process.env.OVM_RPC_URL) {
    throw new Error('process.env.OVM_RPC_URL is undefined');
  }
  for (let i = 0; i < 10; i++) {
    try {
      res = await axios.post(process.env.OVM_RPC_URL, {
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [blockNumber == 'latest' ? 'latest' : '0x' + blockNumber.toString(16), false],
        id: 1,
      });
      break;
    } catch (e) {
      console.log(`Error fetching block ${blockNumber}, with error ${e.message}`);
    }
  }
  if (!res) {
    throw new Error('Failed to fetch block 10 times');
  }
  if (res.data.result) {
    return [parseInt(res.data.result.number, 16), parseInt(res.data.result.timestamp, 16)];
  } else {
    return null;
  }
}

async function getBlocksFast(db: any) {
  const endpoint = 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-blocks';

  await db.exec(`CREATE TABLE IF NOT EXISTS blockNums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blockNumber INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    )`);

  const insertStmt = db.prepare('INSERT INTO blockNums (blockNumber, timestamp) VALUES (?, ?)');
  const insertMany = db.transaction((blockNums: any) => {
    for (const blockNum of blockNums) {
      insertStmt.run(blockNum.number, blockNum.timestamp);
    }
  });

  let current: number = (db.prepare('SELECT MAX(blockNumber) as maxBlock FROM blockNums').get()?.maxBlock || 0) + 1;
  const limit = 1000;
  let responseLength = 1000;
  while (responseLength >= 1000) {
    console.log(`[Fetching ${current}-${current + 1000}]`);
    const res = await axios.post(endpoint, {
      query: `{
        blocks(first: ${limit}, where:{number_gte:${current}}, orderBy: number) {
          number
          timestamp
        }
      }`,
    });
    current += limit;
    await insertMany(res.data.data.blocks);
    responseLength = res.data.data.blocks.length;
  }
}

async function cacheBlockNumbers(db: any) {
  await db.exec(`CREATE TABLE IF NOT EXISTS blockNums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blockNumber INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
  )`);

  const insertStmt = db.prepare('INSERT INTO blockNums (blockNumber, timestamp) VALUES (?, ?)');
  const insertMany = db.transaction((blockNums: any) => {
    for (const blockNum of blockNums) {
      insertStmt.run(blockNum[0], blockNum[1]);
    }
  });

  const startBlock: number =
    (db.prepare('SELECT MAX(blockNumber) as maxBlock FROM blockNums').get()?.maxBlock || 0) + 1;
  const maxBlock = await getBlockTimestamp('latest' as any);
  console.log({
    startBlock,
    maxBlock,
  });
  if (!maxBlock) {
    throw Error('');
  }
  const endBlock = maxBlock[0];
  const batchSize = 200;

  for (let i = startBlock; i < endBlock; i += batchSize) {
    console.log(`${i}/${endBlock}`);
    const promises = [];
    for (let j = i; j < i + batchSize; j++) {
      promises.push(getBlockTimestamp(j));
    }
    const results = await Promise.all(promises);
    insertMany(results.filter(x => x !== null));
  }
}

export async function updateBlockNumbers(params: Params) {
  const blocksDB = sqlite3(path.join(__dirname, '../data/', params.network, '/blockNumbers.sqlite'));

  if (params.network == 'mainnet-ovm') {
    await getBlocksFast(blocksDB);
  } else {
    await cacheBlockNumbers(blocksDB);
  }

  blocksDB.close();
}
