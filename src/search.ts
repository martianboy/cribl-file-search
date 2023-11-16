import * as fs from 'fs/promises';
import * as path from 'path';

import { Request, Response, NextFunction } from 'express';

import * as config from './config.js';

const CHUNK_SIZE = config.chunkSize;

/**
 * An async generator that yields lines from a file in reverse order.
 * This function assumes the file exists and is readable.
 */
export async function* readLinesBackwards(
  file: fs.FileHandle,
  fileSize: number
) {
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
      yield parts.reverse();
    } else {
      tail = parts[0];
      if (parts.length > 1) {
        yield parts.slice(1).reverse();
      }
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

    if (stat.isDirectory()) {
      res.status(400).send('File is a directory');
      return;
    }
  } catch (ex: any) {
    if (ex.code === 'ENOENT') {
      console.error(ex);
      res.status(404).send('File not found');
    } else if (ex.code === 'EACCES') {
      res.status(403).send('File not accessible');
    } else {
      next(ex);
    }
    return;
  }

  let f: fs.FileHandle;
  const { size } = stat;

  try {
    f = await fs.open(filePath, 'r');
  } catch (ex: any) {
    if (ex.code === 'EACCES') {
      return res.status(403).send('File not accessible');
    }

    return next(ex);
  }

  res.setHeader('Content-Type', 'text/plain');

  let count = 0;
  let limitReached = false;

  try {
    for await (const lines of readLinesBackwards(f, size)) {
      for (let i = 0; i < lines.length && !limitReached; i++) {
        const line = lines[i];
        if (!term || line.includes(term)) {
          res.write(line + '\n');
          count++;
        }

        if (limit && count >= limit) {
          limitReached = true;
        }
      }

      if (limitReached) {
        break;
      }
    }

    await f.close();
    res.end();
  } catch (err) {
    // don't call next() here, because we've already sent a response
    console.error(err);
    res.end('\n\nAn error occurred while reading the file.\n');
  }
}
