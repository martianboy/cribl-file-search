import { createClient } from 'redis';
import * as config from './config.js';

export const hostkey = `${config.redisKeyPrefix}:${config.hostname}`;

const HEARTBEAT_TTL = 60; // 60 seconds

export async function heartbeat() {
  console.log('Connecting to Redis...');
  const client = await createClient(config.redis)
    .on('error', (err) => console.error('Redis Client Error', err))
    .connect();

  console.log('Connected to Redis');

  await client.set(
    `${config.redisKeyPrefix}:${config.hostname}:${config.port}`,
    Date.now(),
    {
      EX: HEARTBEAT_TTL,
    }
  );

  console.log('Heartbeat sent');
  await client.quit();
}

export async function getLiveServers() {
  const client = await createClient(config.redis)
    .on('error', (err) => console.error('Redis Client Error', err))
    .connect();

  let servers: string[] = [];
  let scanResult = { cursor: 0, keys: [] as string[] };

  do {
    scanResult = await client.scan(scanResult.cursor, {
      MATCH: `${config.redisKeyPrefix}:*`,
      COUNT: 1000,
    });

    servers = servers.concat(
      scanResult.keys.map((key) => key.replace(`${config.redisKeyPrefix}:`, ''))
    );

    scanResult.cursor = scanResult.cursor + 1000;
  } while (scanResult.keys.length === 1000);

  await client.quit();

  return servers;
}
