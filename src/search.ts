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
    position = Math.max(0, position - CHUNK_SIZE);

    const { bytesRead } = await file.read({
      buffer,
      offset: 0,
      length: CHUNK_SIZE,
      position,
    });

    for (let i = bytesRead; i >= 0; ) {
      let j = buffer.lastIndexOf(EOL, i - 1);
      if (j >= 0 || position === 0) {
        // If position is 0, we are at the beginning of the file. In this case,
        // we should yield the first line of the file even if it doesn't include
        // another newline character.
        let line = buffer.toString('utf8', j + 1, i);
        if (tail.length > 0) {
          line += tail;
          tail = '';
        }
        yield line;
      } else {
        tail = buffer.toString('utf8', 0, i) + tail;
      }

      i = j;
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
    for await (const line of readLinesBackwards(file, size)) {
      if (!term || line.includes(term)) {
        res.write(line + '\n');
        count++;
      }

      if (limit && count >= limit) {
        res.end();
        break;
      }
    }

    await file.close();
  } catch (err) {
    next(err);
  }
}
