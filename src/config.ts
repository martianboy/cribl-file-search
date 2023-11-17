export const baseDir = process.env.BASE_DIR ?? '/var/log';
export const chunkSize = process.env.CHUNK_SIZE
  ? parseInt(process.env.CHUNK_SIZE)
  : 1024 * 1024;
export const port = process.env.AGENT_PORT ?? 3000;
