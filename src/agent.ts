import express, { Request, Response, NextFunction } from 'express';

import * as config from './config.js';
import { searchFile } from './search.js';

const app = express();

app.get('/search', searchFile);

// Error handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).send('Something broke!');
});

/* istanbul ignore if -- @preserve */
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(config.port, () => {
    console.log(`Agent server listening on port ${config.port}`);
  });
}

export default app;
