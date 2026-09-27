# contracts

foundry. `forge test` runs the suite, `../scripts/e2e-match.sh` plays a full match against any rpc.

## testnet (10143)

first full match, sept 28 2026: cards `0x91bf33052556F2B7dd5a35947355A0b9Fe698389`, duel `0xe01A0562cdEaFC18c217B97eec3dFC17D79866ac`, match 0 won 2 to 1 by b, pot paid out, contract left empty.

full set, deployed sept 28 2026 with `script/DeployTestnet.s.sol` (deployer is judge and house for now):

| contract | address |
|---|---|
| CardStats | `0x7382DCBD92303378EFD50859b751Ba70bEcd1992` |
| Duel | `0x7B5C3Aa9566677D29804Bb33ae327540f0223a4F` |
| Backing | `0x036f0d5C58D6ef1e40B84b2763CEFDE46EfdB5ab` |
| MatchMarket | `0x4fb65413499186e3298E85284c9877686B8A552c` |
| StatsFeed | `0x9a53e1eB379846f47fA475Ef1268904F16761C0c` (trusts the cre simulation forwarder `0xB9F79d863261869B234c481D1f9A7af84AeAd192`) |

match 0 on this set went 1 to 1 into the live duel, the judge gave the last round to a, backers of a were paid, the market settled, and all three contracts ended empty. `../scripts/e2e-full.sh` replays it.

SeasonBank is for mainnet (aurora deposits) and is not deployed yet.

### current set (sept 28 2026, interfaces, solady ownable, pull payments)

| contract | address |
|---|---|
| CardStats | `0xDa6f2436E78d4CD7490Df5F0D593055CfAa62345` |
| Duel | `0x2d212A3898139EdEE5b27A2FCA8063edf9d51805` |
| Backing | `0x6b90b0793b2c31b294999Fad2Ec02E36d52Dc655` |
| MatchMarket | `0x061f75cfAcC6ecF54D9B7cfAAb4d353a9d6C7443` |
| StatsFeed | `0x288426F687201451A076f13A845f1485145D76AF` |

match 0: b won 2 to 0, withdrew the pot, backers and market shares paid, all three contracts empty. the earlier set above is retired.

layout: `src/interfaces/` holds every event, error, struct and external function; contracts implement them and talk to each other only through the interfaces. owner checks use solady `Ownable`. duel payouts are credited to `owed` and pulled with `withdraw()`.

### chainlink cre, proven on testnet (sept 28 2026)

StatsFeed redeployed with the workflow check: `0xb54D1290b0c8DF07ab0473eFeb64E3cd344BB50a` (CardStats updater points to it; the older feed `0x2884...` had no check and is retired).

`cre workflow simulate stats-feed --broadcast` (cli 1.35.0) sends a real tx from our key to chainlink's MockKeystoneForwarder `0xB9F79d863261869B234c481D1f9A7af84AeAd192`, which calls `onReport` on the feed:

| run | expected workflow | tx | result |
|---|---|---|---|
| 1 | owner = our deployer (wrong on purpose) | `0x5078ad9dfaac185e24db005e8003f861c757370f91bb052cf074c4f066a5c910` | forwarder logged success 0, feed rejected, card 4 unchanged |
| 2 | owner `0xaaaa..aaaa`, id `0x1111..1111` | `0x4f1c2938417bb96835385fbf949094050d0ceb21ab5fbf626c289c6d5cb1c45c` | accepted, card 4 `[72,73,64,86,90,58]` -> `[73,74,65,87,90,58]` |

note: the simulator fills metadata with placeholders (workflow id `0x11..11`, owner `0xaa..aa`, read from the raw report in the forwarder tx). a workflow deployed to a don carries the real owner, so `setWorkflow` has to be set to the real owner and id at that point.
