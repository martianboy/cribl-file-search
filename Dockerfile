FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc && npm prune --production
ENV AGENT_PORT=3000
ENV REDIS_URL=

ENV BASE_DIR=/data
VOLUME $BASE_DIR

CMD ["node", "build/agent.js"]
