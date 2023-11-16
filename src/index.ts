import express, { Request, Response, NextFunction } from 'express';

import * as config from './config';
import { searchFile } from './search';

const app = express();

app.get('/search', searchFile);

// Error handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).send('Something broke!');
});

app.listen(config.port, () => {
  console.log(`Agent server listening on port ${config.port}`);
});
