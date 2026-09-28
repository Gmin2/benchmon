// compares every card onchain with data/stats.json
import { cardStatsAbi } from "../src/abi";
import { pub } from "../src/chain";
import { config } from "../src/config";
const file = (await Bun.file(new URL("../data/stats.json", import.meta.url).pathname).json()) as { cards: { id: number; name: string; stats: number[] }[] };
let ok = 0;
for (const c of file.cards) {
  const [name, s] = await Promise.all([
    pub.readContract({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "names", args: [BigInt(c.id)] }),
    pub.readContract({ address: config.contracts.cards, abi: cardStatsAbi, functionName: "statsOf", args: [BigInt(c.id)] }),
  ]);
  const same = name === c.name && s.every((v, i) => v === c.stats[i]);
  if (same) ok++;
  else console.log(`mismatch card ${c.id}: onchain ${name} ${s.join(",")} vs ${c.name} ${c.stats.join(",")}`);
}
console.log(`${ok}/${file.cards.length} cards match stats.json`);
