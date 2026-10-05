# benchmon indexer

envio 3.12.1 indexer for benchmon on monad testnet (10143). it writes matches, rounds, players, cards, card stat history and market trades to postgres, and hasura serves them as a public read only graphql api. the web reads it straight from the browser:

```
VITE_INDEXER_URL=https://<hasura host>/v1/graphql
```

## what gets indexed

| contract | address | start block |
| --- | --- | --- |
| CardStats | 0xD27730D0482746B1e0BD702429C2A9AB98d141Fb | 66260790 (chain start, its deploy block) |
| Duel | 0xC110B9Ee0845Ed76D722Ccec3111302D56d1cA61 | 66898566 |
| Backing | 0x966B8773B281589bFE3E83C7153a64B7E192a9F5 | 66898573 |
| MatchMarket | 0x52CE235DCF1Afa5d4AF427BE9Df039c7797Fa35B | 66898576 |

CardStats starts at its deploy block so the first CardSet of every card (name + stats, around 66280734) lands, and `Card.history` has every version. StatsFeed is not indexed on its own, it writes through CardStats so its updates show up as CardSet too. the game contracts start at their deploy blocks from `contracts/broadcast`.

## containers

two containers plus azure postgres flexible server. both point at the same database: envio writes tables into `public`, hasura keeps its metadata in `hdb_catalog`.

```
web  ->  hasura (public ingress, /v1/graphql)  ->  postgres
indexer (no ingress)  ->  postgres
indexer  ->  hasura /v1/metadata (internal, admin secret)
```

### indexer container

build from this folder: `docker build --platform linux/amd64 -t benchmon-indexer .`

it runs `envio start` (production, no tui, no docker inside). codegen runs at build and again at start. one replica only, never scale it out.

| env | value |
| --- | --- |
| ENVIO_PG_HOST | `<server>.postgres.database.azure.com` |
| ENVIO_PG_PORT | `5432` (default in the image) |
| ENVIO_PG_USER | db user |
| ENVIO_PG_PASSWORD | secret |
| ENVIO_PG_DATABASE | db name |
| ENVIO_PG_SSL_MODE | `require` (default in the image, use `false` for a local postgres) |
| HASURA_GRAPHQL_ENDPOINT | `http://<hasura app>/v1/metadata`, the internal url is fine |
| HASURA_GRAPHQL_ADMIN_SECRET | same secret as the hasura container |
| ENVIO_RPC_URL | optional, sync rpc. default `https://testnet-rpc.monad.xyz` |
| ENVIO_FALLBACK_RPC_URL | optional, default `https://rpc-testnet.monadinfra.com` |
| ENVIO_API_TOKEN + ENVIO_RPC_FOR=fallback | optional, sync from hypersync instead of rpc (see below) |

already set in the image, override only if needed: `NODE_ENV=production`, `ENVIO_INDEXER_PORT=9898` (health at `/healthz`, prometheus at `/metrics`), `HASURA_GRAPHQL_ROLE=admin`, `ENVIO_HASURA_RESPONSE_LIMIT=100`, `LOG_STRATEGY=ecs-console` (json lines), `ENVIO_TUI=false`, `ENVIO_THROTTLE_CHAIN_METADATA_INTERVAL_MILLIS=500`, `ENVIO_THROTTLE_PRUNE_STALE_DATA_INTERVAL_MILLIS=30000`. `HASURA_PUBLIC_HIDDEN` (default `raw_events,chain_metadata`) is the list of envio tables the lock step hides from the public role.

### hasura container

image `hasura/graphql-engine:v2.43.0` (same version `envio dev` uses), port 8080, public ingress.

| env | value |
| --- | --- |
| HASURA_GRAPHQL_DATABASE_URL | `postgres://<user>:<password>@<server>.postgres.database.azure.com:5432/<db>?sslmode=require` |
| HASURA_GRAPHQL_ADMIN_SECRET | long random secret, same as the indexer |
| HASURA_GRAPHQL_UNAUTHORIZED_ROLE | `public` |
| HASURA_GRAPHQL_ENABLE_CONSOLE | `false` |
| HASURA_GRAPHQL_DEV_MODE | `false` |
| HASURA_GRAPHQL_ENABLED_APIS | `graphql,metadata` |
| HASURA_GRAPHQL_CORS_DOMAIN | `https://<web domain>` (comma list, `http://localhost:5173` too if local web should hit it) |
| HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES | `true` (bigints come back as strings, the web expects that) |
| HASURA_GRAPHQL_ENABLE_TELEMETRY | `false` |
| HASURA_GRAPHQL_NO_OF_RETRIES | `10` |

on azure flexible server allow list `pgcrypto` in the `azure.extensions` server parameter, hasura creates it for its catalog.

health: `GET /healthz`.

## public access

envio sets hasura up itself the first time it initialises a database (`HASURA_GRAPHQL_ENDPOINT` + admin secret): it clears hasura metadata, tracks every table, adds the relationships (`Card.history`, `Match.rounds`, `CardUpdate.card`, `Round.match`) and gives the role `public` select on all of them with `limit = ENVIO_HASURA_RESPONSE_LIMIT`. that includes its own `raw_events` and `chain_metadata`. so the container runs `hasura/lock.mjs` next to envio: it waits for envio's `/healthz` (envio only opens that port after the hasura step), then drops public select on those two. it runs on every start and only drops what is there.

what an anonymous caller gets:

- select on `Card`, `CardUpdate`, `Match`, `Round`, `Player`, `Trade` and envio's `_meta` view (sync progress), all columns, max 100 rows per table per query (paginate with `offset`)
- no aggregates, no mutations (`no mutations exist`), no `raw_events` or `chain_metadata`
- metadata api, run_sql and the console are refused without the admin secret

hasura metadata is only rebuilt when envio initialises a fresh database (first start or `-r`). a plain restart keeps it.

## run locally

with `envio dev` (starts its own postgres + hasura in docker on 5433 / 8080):

```
pnpm install
pnpm dev
```

against a postgres + hasura you run yourself, e.g. throwaway containers:

```
docker network create bm
docker run -d --name bm-pg --network bm -p 55432:5432 -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=benchmon postgres:17
docker run -d --name bm-hasura --network bm -p 18080:8080 \
  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:pw@bm-pg:5432/benchmon \
  -e HASURA_GRAPHQL_ADMIN_SECRET=admin -e HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public \
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=false -e HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true \
  -e HASURA_GRAPHQL_CORS_DOMAIN='*' hasura/graphql-engine:v2.43.0
docker build -t benchmon-indexer .
docker run -d --name bm-indexer --network bm \
  -e ENVIO_PG_HOST=bm-pg -e ENVIO_PG_USER=postgres -e ENVIO_PG_PASSWORD=pw -e ENVIO_PG_DATABASE=benchmon -e ENVIO_PG_SSL_MODE=false \
  -e HASURA_GRAPHQL_ENDPOINT=http://bm-hasura:8080/v1/metadata -e HASURA_GRAPHQL_ADMIN_SECRET=admin \
  benchmon-indexer
```

then query with no auth:

```
curl -s localhost:18080/v1/graphql -d '{"query":"{ Card(order_by:{id:asc}) { id name stats history(order_by:{version:asc}) { version stats } } }"}'
```

## sync speed and resync

there is no hypersync without an envio api token, so the indexer reads plain rpc and the eth_getLogs block range is what limits it. measured on oct 5 from 66.26M to a head of ~68.36M (2.1M blocks):

| rpc | getLogs range | what happened |
| --- | --- | --- |
| alchemy free | 10 blocks | hits its compute units per second cap, ~30 blocks/s, a full resync is ~20h |
| thirdweb public | 1000 blocks | 429 straight away without a client id |
| drpc free | 100 blocks | stalls under envio's parallel calls |
| testnet-rpc.monad.xyz | 100 blocks, 25-50 req/s | ~950 blocks/s while ranges have events, ~100 blocks/s in long empty stretches |

envio runs up to 12 queries in parallel while it keeps finding events, but after a long stretch of empty ranges its event density estimate drops to zero and it goes down to one 100 block query at a time. benchmon's contracts are quiet most of the time, so expect a full resync on the default rpc to take roughly 2 to 5 hours. live indexing after that keeps up easily (monad makes ~2.5 blocks/s).

to make resyncs fast, any of:

- envio api token (create one at https://envio.dev/app/api-tokens): set `ENVIO_API_TOKEN=<token>` and `ENVIO_RPC_FOR=fallback`. envio then syncs from monad testnet hypersync, minutes not hours, and keeps the rpc as fallback
- an rpc with a bigger getLogs range in `ENVIO_RPC_URL` (thirdweb with a client id does 1000, paid plans more). envio reads the allowed range out of the rpc error and adjusts

resync means a fresh database: run once with `envio start -r` (or drop the `public` schema) and start again. envio then re-tracks hasura and the lock step re-hides its tables. change `start_block`, `config.yaml` events or `schema.graphql` only together with a resync.

the web should treat the indexer as behind while `_meta { isReady }` is false.
