# benchmon backend

bun + viem service next to the contracts on monad testnet (chain 10143). it does three jobs:

- reveals committed picks for players through `Duel.revealFor` (relayer key)
- runs the live duel in round 3: two models answer through openrouter, kimi judges, verdict goes onchain with `Duel.settleLive` (judge key)
- opens and settles the per match market with `MatchMarket.open` / `houseSettle` (house key)

each role has its own key and its own tx queue, so one account never has two txs racing for a nonce. the deployer key is not used by the backend.

## env

`process.env` is the only source. nothing is read from a fixed `.env` path, so it works the same from the repo root, from `backend/` and in a container where the platform sets the vars.

| name | required | default | what |
| --- | --- | --- | --- |
| `JUDGE_KEY` | yes | | Duel judge, only sends `settleLive` |
| `RELAYER_KEY` | yes | | sends `revealFor` |
| `HOUSE_KEY` | yes, unless `HOUSE=0` | | MatchMarket owner, sends `open` and `houseSettle` |
| `JUDGE`, `RELAYER` | no | | address; when set, boot checks it matches the key |
| `HOUSE` | no | | `0` turns the house off; an address is checked against `HOUSE_KEY` |
| `HOUSE_SEED` | no | `0.01` | MON put into each market, the most the house can lose on one match |
| `STATS_KEEPER` | no | | address, only shown with its balance in `/health` |
| `OPENROUTER_API_KEY` | yes | | fighters, and the judge when there is no moonshot key |
| `MOONSHOT_API_KEY` | no | | kimi straight from moonshot; without it kimi goes through openrouter |
| `MOONSHOT_BASE` | no | `https://api.moonshot.ai/v1` | |
| `JUDGE_MODEL` | no | `kimi-k3` | moonshot model name |
| `ALCHEMY_RPC` | no | | full rpc url, wins over the next two |
| `VITE_ALCHEMY_API_KEY` | no | | builds the alchemy monad testnet url |
| `RPC_URL` | no | `https://testnet-rpc.monad.xyz` | |
| `PORT` | no | `8788` | |
| `DUELS_DIR` | no | `../tmp/duels` (repo tmp), `/data` in docker | picks.json, profiles.json and `<match>.json` transcripts |
| `ALLOWED_ORIGINS` | no | `http://localhost:5173,http://localhost:5174` | comma separated, `*` allows any. other browser origins get 403 |
| `TRUST_PROXY` | no | off, `1` in docker | take the client ip from the last `x-forwarded-for` hop (azure ingress) |
| `LIVE_DUEL_MIN_STAKE` | no | `0.01` | live duels below this stake get no model calls. plain number or `0.01mon` is MON, `10000000000000000wei` is wei |
| `LIVE_DUELS_PER_DAY` | no | `20` | live duels per player address per utc day the backend will judge |
| `CARDS`, `DUEL`, `BACKING`, `MARKET`, `STATS_FEED` | no | current testnet set | contract addresses |

boot fails with one message listing everything missing or wrong (keys, openrouter key, key vs address mismatch, bad amounts).

a skipped live duel (stake under the min, or a player over the daily cap, or three failed tries) is left alone. Duel keeps `awaitingVerdict` set for `VERDICT_TIMEOUT` (10 minutes); after that anyone can call `settleLiveByStats`, which settles the round by the cards stats exactly like rounds 1 and 2 (the web app gives players that call as `settleByStats`, the backend never sends it). the judge can still post a verdict any time before someone does. the daily counts are in memory and start over on a restart.

## run locally

```sh
cd backend
bun install
bun run local      # bun --env-file=../.env --env-file=.env src/index.ts
bun run dev        # same with --watch
bun test
bun run typecheck
```

later env files win, missing ones are skipped, and vars already in the shell win over both. from the repo root: `bun --env-file=.env --env-file=backend/.env backend/src/index.ts`.

## docker

```sh
docker build -t benchmon-backend backend
docker run -p 8788:8788 --env-file .env -v benchmon-data:/data benchmon-backend
```

runs as the `bun` user, `DUELS_DIR=/data` is a volume, healthcheck hits `/health`. in prod `/data` is an azure files share. files are written to a tmp name and renamed over the old one, no locks.

**run exactly one instance.** picks, profiles and the rate limiter live in memory and are saved to one directory, and each key has one nonce queue. two instances would overwrite each others files and race each others nonces. no autoscaling, max replicas 1, and stop the old one before the new one starts writing.

## http

- `GET /health` chain reads cached for 10s. 200 with block, match count, whether the keys hold their onchain roles, each signer balance and `low` under 0.05 MON, plus `warnings`. 503 when the rpc fails.
- `POST /pick`, `POST /profile`, `GET /profile/:address|@name`, `GET /profiles?addresses=`, `GET /username/:name`, `GET /stats`, `GET /duel/:id`
- every route: 120 burst, 5 a second per ip. `POST /pick`: 10 burst, one per 5s. `POST /profile`: 5 burst, one per 20s. bodies over 16kb get 413.
- SIGTERM stops the loops, waits up to 20s for pending txs and file writes, then exits.

## stats keeper

`scripts/push-stats.ts` pushes `data/stats.json` (the same data the cre workflow sends) into CardStats through `StatsFeed.onReport`, from `STATS_KEEPER_KEY`, which is the feed forwarder now. it reads the expected workflow id and owner from the feed and builds the metadata the way the forwarder would (`workflowId | 10 zero bytes | workflowOwner | 2 byte report id`).

```sh
bun run push-stats            # dry run: diff vs onchain stats and an eth_call of onReport
bun run push-stats -- --send  # actually sends it
```

the dry run needs `STATS_KEEPER_KEY` or just `STATS_KEEPER`. `scripts/stats.ts` rebuilds `data/stats.json`.
