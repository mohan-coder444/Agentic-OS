FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
ENV NODE_PATH=/app/node_modules:/shared/node_modules
COPY services/agent/package*.json ./
RUN npm ci --only=production
COPY services/agent/. .
COPY shared /shared
RUN mkdir -p /shared/node_modules && cp -r node_modules/ioredis /shared/node_modules/ 2>/dev/null || (cd /shared && npm init -y > /dev/null 2>&1 && npm install ioredis > /dev/null 2>&1)
EXPOSE 8003
CMD ["node", "index.js"]
