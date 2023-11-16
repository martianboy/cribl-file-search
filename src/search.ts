import * as fs from 'fs/promises';
import * as path from 'path';

import { Request, Response, NextFunction } from 'express';

import * as config from './config';

const CHUNK_SIZE = config.chunkSize;
const EOL = 0x0a;

/**
 * An async generator that yields lines from a file in reverse order.
 * This function assumes the file exists and is readable.
 */
async function* readLinesBackwards(file: fs.FileHandle, fileSize: number) {
  let position = fileSize;
  const buffer = Buffer.alloc(CHUNK_SIZE);

  // tail is used to store the last line unfinished of the previous chunk
  let tail = '';

  while (position > 0) {
    const readSize = Math.min(CHUNK_SIZE, position);
    position -= readSize;
    await file.read(buffer, 0, readSize, position);

    let chunk = buffer.toString('utf-8', 0, readSize);
    let parts = chunk.split('\n');

    if (tail.length > 0) {
      parts[parts.length - 1] += tail;
      tail = '';
    }

    if (position == 0) {
      yield parts;
    } else {
      yield parts.slice(1);
    }
  }
}

interface SearchParams {
  file?: string;
  limit?: number;
  term?: string;
}

/**
 * Route handler for the search endpoint. Takes a file path, a search term, and
 * optionally a limit on the number of results to return. Returns a list of
 * lines from the file that contain the search term.
 *
 * If the file does not exist or is not readable, this function will return a
 * 404 error.
 */
export async function searchFile(
  req: Request<{}, {}, {}, SearchParams>,
  res: Response,
  next: NextFunction
) {
  const { term, limit, file } = req.query;
  if (!file) {
    res.status(400).send('Missing required parameter: file');
    return;
  }

  const filePath = path.join(config.baseDir, file);

  let stat = null;
  try {
    stat = await fs.stat(filePath);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).send('File not found');
    } else {
      next(err);
    }
    return;
  }

  try {
    const { size } = stat;
    const file = await fs.open(filePath, 'r');

    let count = 0;
    for await (const lines of readLinesBackwards(file, size)) {
      for (const line of lines) {
        if (!term || line.includes(term)) {
          res.write(line + '\n');
          count++;
        }
    
        if (limit && count >= limit) {
          res.end();
          break;
        }
      }
    }
    await file.close();
  } catch (err) {
    next(err);
  }
}
