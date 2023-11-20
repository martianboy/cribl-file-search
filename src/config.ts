import os from 'os';

export const baseDir = process.env.BASE_DIR ?? '/var/log';
export const chunkSize = process.env.CHUNK_SIZE
  ? parseInt(process.env.CHUNK_SIZE)
  : 1024 * 1024;
export const port = process.env.PORT ?? 3000;
export const redis = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379'
};
export const hostname = process.env.HOSTNAME ?? os.hostname();
export const redisKeyPrefix = process.env.REDIS_KEY_PREFIX ?? 'search:servers';
