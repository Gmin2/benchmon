FROM oven/bun:1.3-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY src ./src
COPY data ./data

# one instance only: picks, profiles and transcripts live in DUELS_DIR and every role key has a single nonce queue
ENV PORT=8788 DUELS_DIR=/data TRUST_PROXY=1
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data

USER bun
EXPOSE 8788

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 8788) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["bun", "src/index.ts"]
