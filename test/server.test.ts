import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import * as config from '../src/config.js';
import app from '../src/server.js';

/* istanbul ignore if -- @preserve */
describe('/search', () => {
  it('should return 400 if file is not specified', async () => {
    await request(app).get('/search').expect(400);
  });
  it('should return 404 if file does not exist', async () => {
    await request(app).get('/search?file=nonexistent.log').expect(404);
  });
  it('should return 403 if file is not accessible', async () => {
    const inaccessibleFile = path.join(config.baseDir, 'inaccessible.log');
    await fs.writeFile(inaccessibleFile, 'test');
    await fs.chmod(inaccessibleFile, 0o222);
    await request(app).get('/search?file=inaccessible.log').expect(403);
    await fs.unlink(inaccessibleFile);
  });
  it('should return 400 if file is a directory', async () => {
    await fs.mkdir(path.join(config.baseDir, 'dummydir')).catch(() => {});
    try {
      await request(app).get('/search?file=dummydir').expect(400);
    } finally {
      await fs.rmdir(path.join(config.baseDir, 'dummydir'));
    }
  });

  it('should return 200 if file exists', async () => {
    const testFilePath = path.join(config.baseDir, 'test.txt');
    await fs.writeFile(testFilePath, 'test');
    try {
      const res = await request(app)
        .get('/search?file=test.txt')
        .expect('Content-Type', /text/)
        .expect(200);

      expect(res.text).toBe('test\n');
    } finally {
      await fs.unlink(testFilePath);
    }
  });

  it('should return 200 with the contents of the file in reverse order', async () => {
    const testFilePath = path.join(config.baseDir, 'test.txt');
    await fs.writeFile(testFilePath, 'hello\nworld\nof\n\nwonders\nhello');
    try {
      const res = await request(app)
        .get('/search?file=test.txt')
        .expect('Content-Type', /text/)
        .expect(200);

      expect(res.text).toBe('hello\nwonders\n\nof\nworld\nhello\n');
    } finally {
      await fs.unlink(testFilePath);
    }
  });

  it('should return 200 if file exists and contains the search term', async () => {
    const testFilePath = path.join(config.baseDir, 'test.txt');
    await fs.writeFile(testFilePath, 'hello\nworld\nof\n\nwonders\nhello');
    try {
      const res = await request(app)
        .get('/search?file=test.txt&term=hello')
        .expect('Content-Type', /text/)
        .expect(200);

      expect(res.text).toBe('hello\nhello\n');
    } finally {
      await fs.unlink(testFilePath);
    }
  });

  it('should return 200 with search term and limit', async () => {
    const testFilePath = path.join(config.baseDir, 'test.txt');
    await fs.writeFile(testFilePath, 'hello\nworld\nof\n\nwonders\nhello');
    try {
      const res = await request(app)
        .get('/search?file=test.txt&term=hello&limit=1')
        .expect('Content-Type', /text/)
        .expect(200);

      expect(res.text).toBe('hello\n');
    } finally {
      await fs.unlink(testFilePath);
    }
  });

  it('should return 200 if the file does not contain the search term', async () => {
    const testFilePath = path.join(config.baseDir, 'test.txt');
    await fs.writeFile(testFilePath, 'hello\nworld\nof\n\nwonders\nhello');
    try {
      const res = await request(app)
        .get('/search?file=test.txt&term=nonexistent')
        .expect('Content-Type', /text/)
        .expect(200);

      expect(res.text).toBe('');
    } finally {
      await fs.unlink(testFilePath);
    }
  });
});
