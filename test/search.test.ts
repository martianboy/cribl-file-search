import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

import * as config from '../src/config.js';
import { readLinesBackwards } from '../src/search.js';

describe('readLinesBackwards()', () => {
  async function prepareFile(contents: string) {
    const filePath = path.join(config.baseDir, 'test.txt');
    await fs.writeFile(filePath, contents);

    return {
      file: await fs.open(filePath, 'r'),
      length: contents.length,
    };
  }

  async function readAllLines(file: fs.FileHandle, length: number) {
    const lines: string[] = [];
    for await (const chunk of readLinesBackwards(file, length)) {
      lines.push(...chunk);
    }
    return lines;
  }

  async function testCase(contents: string, expected: string[]) {
    const { file, length } = await prepareFile(contents);
    const readLines = await readAllLines(file, length);

    expect(readLines).toEqual(expected);
    await file.close();
  }

  it('should read a single line', async () => {
    await testCase('hello world', ['hello world']);
  });

  it('should read multiple lines', async () => {
    await testCase('hello\nworld', ['world', 'hello']);
  });

  it('should read multiple chunks', async () => {
    await testCase('hello\nworld\n', ['', 'world', 'hello']);
  });

  it('should read long lines spanning multiple chunks not at the end', async () => {
    await testCase('hello world this is a long\nline.', [
      'line.',
      'hello world this is a long',
    ]);
  });

  it('should read long lines spanning multiple chunks at the end', async () => {
    await testCase('hello\nworld this is a long line.', [
      'world this is a long line.',
      'hello',
    ]);
  });

  it('should empty lines', async () => {
    await testCase('hello\n\nworld', ['world', '', 'hello']);
  });

  it('should read an empty file', async () => {
    await testCase('', []);
  });
});
