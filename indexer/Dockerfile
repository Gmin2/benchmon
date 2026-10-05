# benchmon envio indexer, runs `envio start` against an external postgres + hasura
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.5.0

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .
# codegen needs no env, every ${VAR} in config.yaml has a default. start runs it again anyway
RUN pnpm codegen

ENV PATH=/app/node_modules/.bin:$PATH \
  NODE_ENV=production \
  ENVIO_TUI=false \
  LOG_STRATEGY=ecs-console \
  ENVIO_INDEXER_PORT=9898 \
  ENVIO_PG_PORT=5432 \
  ENVIO_PG_SSL_MODE=require \
  HASURA_GRAPHQL_ROLE=admin \
  ENVIO_HASURA_RESPONSE_LIMIT=100 \
  ENVIO_THROTTLE_CHAIN_METADATA_INTERVAL_MILLIS=500 \
  ENVIO_THROTTLE_PRUNE_STALE_DATA_INTERVAL_MILLIS=30000

EXPOSE 9898

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.ENVIO_INDEXER_PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./docker-start.sh"]
