# benchmon

a pvp card battle game on monad where the cards are real ai models. stats come from real benchmarks, two players stake into a match, pick cards in secret, and the last round is a live duel where both models answer the same prompt and kimi judges.

- `contracts/` foundry: CardStats, Duel, Backing, MatchMarket, StatsFeed (chainlink cre receiver), SeasonBank (mainnet, aurora). addresses and testnet evidence in `contracts/README.md`
- `backend/` bun + viem: watches live duels, runs the real models, posts the verdict with the transcript hash
- `cre/` chainlink cre workflow that writes card stats through chainlink's forwarder
- `scripts/` end to end match scripts against any rpc
