import * as fs from 'fs/promises';
import * as qs from 'querystring';

import * as path from 'path';

import { Request, Response, NextFunction } from 'express';

import * as config from './config.js';
import { getLiveServers } from './registry.js';

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
  limit?: string;
  term?: string;
}

/**
 * Route handler for the search endpoint. Takes a file path, a search term, and
 * optionally a limit on the number of results to return. Returns a list of
 * lines from the file that contain the search term.
 *
 * If the file does not exist or is not readable, this function will return a
 * 403 or 404 error.
 */
export async function searchFile(
  req: Request<{}, {}, {}, SearchParams & { prependHostname?: string; }>,
  res: Response,
  next: NextFunction
) {
  const { term, limit: _limit, file, prependHostname } = req.query;
  const limit = _limit ? parseInt(_limit) : 0;

  if (!file) {
    res.status(400).send('Missing required parameter: file');
    return;
  }

  if (limit <= 0) {
    res.status(400).send('Invalid limit');
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
      console.log(ex.message);
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
          res.write(
            (prependHostname === 'true' ? '' + config.hostname + ': ' : '') +
              line +
              '\n'
          );
          count++;
        }

        if ((limit && count >= limit) || req.closed) {
          limitReached = true;
        }
      }

      if (limitReached) {
        break;
      }
    }

    // If we've reached the end of the file and we haven't sent any data, then
    // send a Content-Length header with a value of 0.
    if (!res.headersSent) {
      res.setHeader('Content-Length', '0');
    }

    await f.close();
    res.end();
  } catch (err) {
    // don't call next() here, because we've already sent a response
    console.error(err);
    res.end('\n\nAn error occurred while reading the file.\n');
  }
}

export async function searchAllServers(
  req: Request<{}, {}, {}, SearchParams>,
  res: Response,
  next: NextFunction
) {
  const servers = await getLiveServers();
  console.log('Servers', servers);

  const { term, limit, file } = req.query;
  const args = qs.stringify({
    term,
    limit: limit ? parseInt(limit) : undefined,
    file,
    prependHostname: 'true',
  });

  const abortController = new AbortController();
  const { signal } = abortController;

  async function searchInServer(url: string) {
    let response: globalThis.Response;
    try {
      console.log(`GET ${url}`);
      response = await fetch(url);
      console.log('Response', response.status);
    } catch (ex) {
      console.error(ex);
      return;
    }

    if (
      response.status === 200 &&
      response.body !== null &&
      response.headers.get('Content-Length') !== '0'
    ) {
      try {
        await response.body.pipeTo(
          new WritableStream({
            write(chunk) {
              res.write(chunk);
            },
          }),
          { signal }
        );
      } catch (ex: any) {
        // ignore AbortError
        if (ex.name !== 'AbortError') {
          throw ex;
        }
      }
    }
  }

  res.setHeader('Content-Type', 'text/plain');
  res.status(200);

  await Promise.all(servers.map((url) =>
    searchInServer(`http://${url}/search?${args}`).catch((ex) => {
      // This is an unknown error, so we should abort the whole operation.
      if (!signal.aborted) {
        abortController.abort();
        next(ex);
      }
    })
  ));

  res.end();
}

export async function searchServer(
  req: Request<{}, {}, {}, SearchParams & { server: string; }>,
  res: Response,
  next: NextFunction
) {
  if (!req.query.server) {
    res.status(400).send('Missing required parameter: server');
    return;
  }

  const { term, limit, file, server } = req.query;
  const args = qs.stringify({
    term,
    limit: limit ? parseInt(limit) : undefined,
    file,
  });

  let response: globalThis.Response;
  const url = `http://${server}/search?${args}`;
  try {
    response = await fetch(url);
    console.log(`${response.status} GET ${url}`);
  } catch (ex) {
    return next(ex);
  }

  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  if (response.body) {
    await response.body.pipeTo(
      new WritableStream({
        write(chunk) {
          res.write(chunk);
        },
      })
    );
  }

  res.end();
}

export async function listServers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const servers = await getLiveServers();
  res.json({ data: servers });
}
