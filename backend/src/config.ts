import type { Address, Hex } from "viem";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

// addresses of the current testnet set, see contracts/README.md
export const config = {
  rpcUrl: process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz",
  port: Number(process.env.PORT ?? 8788),
  judgeKey: need("JUDGE_KEY") as Hex,
  contracts: {
    cards: (process.env.CARDS ?? "0xDa6f2436E78d4CD7490Df5F0D593055CfAa62345") as Address,
    duel: (process.env.DUEL ?? "0x2d212A3898139EdEE5b27A2FCA8063edf9d51805") as Address,
    backing: (process.env.BACKING ?? "0x6b90b0793b2c31b294999Fad2Ec02E36d52Dc655") as Address,
    market: (process.env.MARKET ?? "0x061f75cfAcC6ecF54D9B7cfAAb4d353a9d6C7443") as Address,
  },
};
