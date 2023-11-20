# Cribl File Search

Cribl File Search is a Node.js web application designed for searching within log files across multiple remote servers. It is optimized for performance, even with large files, and leverages Redis to enable server discovery and coordination.

## Features

- **Search in Log Files:** Quickly search through log files located on multiple remote servers.
- **Performance Optimized:** Handles large files efficiently.
- **Redis Integration:** Utilizes Redis for inter-server communication and service discovery.
- **Docker Support:** Includes a Dockerfile for easy containerization and deployment.

## Getting Started

These instructions will guide you on how to set up and run Cribl File Search on your local machine for development and testing purposes.

### Prerequisites

- Node.js
- Redis
- Docker (optional)

### Installing and Running Locally

1. Clone the repository:
```bash
git clone https://github.com/martianboy/cribl-file-search
```
2. Navigate to the project directory:
```bash
cd cribl-file-search
```
3. Install the dependencies:
```bash
npm i
```
4. Build and start the application:
```bash
npm run build
npm start
```
5. Open the application in a web browser:
```bash
open http://localhost:3000
```

If you want to run the tests, you can simply run:
```
npm test
```

The tests are executed using vitest.

### Using Docker

Alternatively, you can build and run the application using Docker:

1. Build the Docker image:
```bash
docker build . --tag cribl-file-search:latest
```
2. Run the Docker container:
```bash
docker run --name cribl-file-search -p 3000:3000 -v "$(pwd)/data:/data" cribl-file-search:latest
```
3. Open the application in a web browser:
```bash
open http://localhost:3000
```

If you wish to run multiple instances on a single host for testing purposes, an example Docker Compose file is provided as well.

### Environment Variables

The application can be configured using the following environment variables:

* `BASE_DIR`: The base directory in which the program will look for requested files.
* `CHUNK_SIZE`: Amount of data to load from disk at a time. Defaults to 1M.
* `PORT`: The port on which the web server listens. Defaults to 3000.
* `REDIS_URL`: Redis URL for service discovery.
* `HOSTNAME`: The hostname used by each server for advertising itself in the service directory.
* `REDIS_KEY_PREFIX`: Prefix used for all registered services in Redis. Defaults to `search:servers`.


## Architecture

The core of the application is the `searchFile` function, which handles the `/search` endpoint on the web server. This function uses an async generator, `readLinesBackwards()`, to read files line by line from end to beginning, handling lines that may be split across chunks. 

Chunks are loaded in large amounts to improve processing speed. The implemented algorithm splits each chunk by new-line characters, then searches for the term in each line. This approach proved more efficient than more complex algorithms during testing.

For service discovery, the application uses Redis. Each server advertises its hostname and port on a Redis key with a 60-second expiry, updating every 30 seconds as a heartbeat. The `/search-all` endpoint acts as a proxy, aggregating `/search` results from all servers registered in Redis, handling errors gracefully.

The application also includes a simple web-based UI for easier interaction.

## Usage

### Calling the APIs

1. **Search in a Single Server:**
```
GET /search?file={file}&term={term}&limit={limit}
```
2. **Search in All Servers:**
```
GET /search-all?file={file}&term={term}&limit={limit}
```
3. **Proxy Search in a Single Server:**
```
GET /search-server?server={server}&file={file}&term={term}&limit={limit}
```
4. **Get List of Live Servers:**
```
GET /servers
```

### Using the Provided UI

1. Enter the desired file name, excluding the base directory.
2. Select an option from the list of servers.
3. Specify a limit for the number of lines to return (optional).
4. Enter a search term (optional).
5. Click search.
