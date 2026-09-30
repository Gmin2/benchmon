# benchmon

a pvp card battle game on monad where the cards are real ai models. stats come from real benchmarks, two players stake into a match, pick cards in secret, the loser of a round picks the next arena, and the last round is a live duel where both models answer the same prompt and kimi judges. spectators back a side or trade a per match market until the first card is revealed.

everything lives in this one repo:

- `web/` the game: react, vite, tailwind. `pnpm dev`, then open `/home?dev=a` to play without logging in
- `backend/` bun + viem: reveals committed picks, runs and judges live duels, opens and settles the house market per match. `bun --env-file=../.env src/index.ts`
- `contracts/` foundry: Duel, Backing, MatchMarket, CardStats, StatsFeed (chainlink cre receiver), SeasonBank (mainnet). addresses in `contracts/README.md`
- `arts/` the pixel art: lpc sprites and card art (`lpc/`), card frame (`card/`), arenas (`arena/`). `bun export-web.ts` copies it into `web/`
- `indexer/` envio indexer for matches, rounds, players, cards and trades
- `cre/` chainlink cre workflow that writes card stats through chainlink's forwarder
- `scripts/` end to end match scripts against any rpc

keys go in `.env` at the root (see the names the backend and web read in `backend/src/config.ts` and `web/src/gas.ts`).
