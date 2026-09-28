import type { Address, Hex } from "viem";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

// addresses of the current testnet set, see contracts/README.md
export const config = {
  // alchemy when a key is set, the public rpc caps a client at 15 requests a second
  rpcUrl: process.env.ALCHEMY_RPC ?? (process.env.VITE_ALCHEMY_API_KEY ? `https://monad-testnet.g.alchemy.com/v2/${process.env.VITE_ALCHEMY_API_KEY}` : (process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz")),
  port: Number(process.env.PORT ?? 8788),
  judgeKey: need("JUDGE_KEY") as Hex,
  // fighters go through openrouter; kimi is the judge through moonshot directly (kimi bounty)
  openrouterKey: process.env.OPENROUTER_API_KEY ?? "",
  moonshotKey: process.env.MOONSHOT_API_KEY ?? "",
  moonshotBase: process.env.MOONSHOT_BASE ?? "https://api.moonshot.ai/v1",
  judgeModel: process.env.JUDGE_MODEL ?? "kimi-k3",
  duelsDir: process.env.DUELS_DIR ?? new URL("../../tmp/duels/", import.meta.url).pathname,
  contracts: {
    cards: (process.env.CARDS ?? "0xD27730D0482746B1e0BD702429C2A9AB98d141Fb") as Address,
    duel: (process.env.DUEL ?? "0x1B9E807c7e738779998e943879132CA03B603ccb") as Address,
    backing: (process.env.BACKING ?? "0x6807C5681B77A28CF1E177f6C4518A9730771238") as Address,
    market: (process.env.MARKET ?? "0xC3cd445e804FEC26d873D736eA284F33dB275dC8") as Address,
  },
};
