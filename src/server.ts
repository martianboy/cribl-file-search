import path from 'path';
import express, { Request, Response, NextFunction } from 'express';

import * as config from './config.js';
import {
  listServers,
  searchAllServers,
  searchFile,
  searchServer,
} from './routes.js';
import { heartbeat } from './registry.js';

const app = express();

app.get('/search', searchFile);
app.get('/search-all', searchAllServers);
app.get('/search-server', searchServer);
app.get('/servers', listServers);

app.use(express.static(path.resolve(process.cwd(), 'web')));

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
  let heartbeatTimer: NodeJS.Timeout | null = null;

  let forceShutdownFlag = false;

  function forceShutdown() {
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
    }
    server.closeAllConnections();
  }

  function shutdown() {
    // If we've already received a shutdown signal, then force shutdown.
    if (forceShutdownFlag) {
      console.log('Force shutdown!');
      return forceShutdown();
    } else {
      console.log('Press Ctrl+C again to force shutdown.');
      forceShutdownFlag = true;
    }

    // Stop the heartbeat timer
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
    }

    // Don't accept new connections
    server.close();

    // Close any idle connections with keep-alive
    server.closeIdleConnections();

    // Allow 5 seconds for active connections to close.
    shutdownTimer = setTimeout(forceShutdown, 5000);
  }

  // Start the heartbeat timer
  function scheduleHeartbeat() {
    heartbeatTimer = setTimeout(() => {
      heartbeat().then(scheduleHeartbeat);
    }, 30 * 1000);
  }

  console.log('Starting heartbeat...');
  heartbeat().then(scheduleHeartbeat);

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
