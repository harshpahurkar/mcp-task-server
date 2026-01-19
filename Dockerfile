FROM node:22-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY scripts ./scripts
RUN mkdir -p data && chown -R node:node /app

ENV NODE_OPTIONS="--no-warnings=ExperimentalWarning"
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "import('./dist/server.js').then(({ buildServer }) => { const built = buildServer('/tmp/mcp-health.sqlite'); built.database.close(); }).catch(() => process.exit(1))"
CMD ["node", "dist/index.js"]
