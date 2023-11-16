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

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = app.listen(config.port, () => {
    console.log(`Agent server listening on port ${config.port}`);
  });

  let shutdownTimer: NodeJS.Timeout | null = null;
  let forceShutdownFlag = false;

  function forceShutdown() {
    console.log('Force shutdown!');
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
    }
    server.closeAllConnections();
  }

  function shutdown() {
    // If we've already received a shutdown signal, then force shutdown.
    if (forceShutdownFlag) {
      forceShutdown();
    } else {
      forceShutdownFlag = true;
    }

    // Don't accept new connections
    server.close();

    // Close any idle connections with keep-alive
    server.closeIdleConnections();

    // Allow 5 seconds for active connections to close.
    shutdownTimer = setTimeout(forceShutdown, 5000);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
