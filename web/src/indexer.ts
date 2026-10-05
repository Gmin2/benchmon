import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";

// the envio indexer behind a public read only hasura endpoint. leaderboards, live lists and records
// come from here so the browser does not scan the chain for them
export const INDEXER = (import.meta.env.VITE_INDEXER_URL ?? "").trim();

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!INDEXER) throw new Error("indexer is not set");
  const r = await fetch(INDEXER, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error(`indexer ${r.status}`);
  const j = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(j.errors[0]!.message);
  return j.data as T;
}

// bigints come back as strings
export type IxPlayer = { id: string; matches: number; wins: number; losses: number; draws: number; staked: string; won: string; roundsWon: number };
export type IxCard = { id: string; name: string; stats: number[]; plays: number; roundWins: number; roundLosses: number; roundDraws: number; liveDuels: number; liveDuelWins: number };
export type IxRound = { round: number; arena: number; cardA: number | null; cardB: number | null; live: boolean };
export type IxMatch = {
  id: string;
  a: string;
  b: string | null;
  stake: string;
  state: "open" | "playing" | "done" | "cancelled";
  arena: number | null;
  winsA: number;
  winsB: number;
  result: "a" | "b" | "draw" | "cancelled" | null;
  backedA: string;
  backedB: string;
  lastPriceA: string | null;
  createdAt: number;
  rounds: IxRound[];
};

const PLAYER = "id matches wins losses draws staked won roundsWon";
const MATCH = "id a b stake state arena winsA winsB result backedA backedB lastPriceA createdAt rounds(order_by: {round: asc}) { round arena cardA cardB live }";

export const mon = (wei: string | null | undefined) => (wei ? Number(formatEther(BigInt(wei))) : 0);

// what a screen needs to know: off means no indexer is configured, so it shows an empty state, never made up rows
export type Ix<T> = { data: T | undefined; status: "off" | "loading" | "error" | "ok" };
function ix<T>(q: { data: T | undefined; isPending: boolean; isError: boolean }): Ix<T> {
  return { data: q.data, status: !INDEXER ? "off" : q.data !== undefined ? "ok" : q.isError ? "error" : "loading" };
}

const base = { enabled: Boolean(INDEXER), retry: 1, refetchIntervalInBackground: false } as const;

export function useTopPlayers(limit = 100) {
  return ix<IxPlayer[]>(
    useQuery({
      ...base,
      queryKey: ["ix", "players", limit],
      queryFn: () => gql<{ Player: IxPlayer[] }>(`query($n: Int!) { Player(order_by: [{won: desc}, {wins: desc}], limit: $n, where: {matches: {_gt: 0}}) { ${PLAYER} } }`, { n: limit }).then((d) => d.Player),
      refetchInterval: 30_000,
    }),
  );
}

export function usePlayer(address?: string) {
  const id = address?.toLowerCase() ?? "";
  return ix<IxPlayer | null>(
    useQuery({
      ...base,
      enabled: base.enabled && Boolean(id),
      queryKey: ["ix", "player", id],
      queryFn: () => gql<{ Player: IxPlayer[] }>(`query($id: String!) { Player(where: {id: {_eq: $id}}) { ${PLAYER} } }`, { id }).then((d) => d.Player[0] ?? null),
      refetchInterval: 20_000,
    }),
  );
}

// an address's matches, newest first
export function usePlayerMatches(address?: string, limit = 50) {
  const id = address?.toLowerCase() ?? "";
  return ix<IxMatch[]>(
    useQuery({
      ...base,
      enabled: base.enabled && Boolean(id),
      queryKey: ["ix", "player-matches", id, limit],
      queryFn: () =>
        gql<{ Match: IxMatch[] }>(`query($id: String!, $n: Int!) { Match(where: {_or: [{a: {_eq: $id}}, {b: {_eq: $id}}], state: {_neq: "cancelled"}}, order_by: {createdAt: desc}, limit: $n) { ${MATCH} } }`, { id, n: limit }).then(
          (d) => d.Match,
        ),
      refetchInterval: 20_000,
    }),
  );
}

export function useCardRecords() {
  return ix<IxCard[]>(
    useQuery({
      ...base,
      queryKey: ["ix", "cards"],
      queryFn: () => gql<{ Card: IxCard[] }>(`{ Card { id name stats plays roundWins roundLosses roundDraws liveDuels liveDuelWins } }`).then((d) => d.Card),
      refetchInterval: 60_000,
    }),
  );
}

export function useLiveMatches(limit = 20) {
  return ix<IxMatch[]>(
    useQuery({
      ...base,
      queryKey: ["ix", "live", limit],
      queryFn: () => gql<{ Match: IxMatch[] }>(`query($n: Int!) { Match(where: {state: {_eq: "playing"}}, order_by: {createdAt: desc}, limit: $n) { ${MATCH} } }`, { n: limit }).then((d) => d.Match),
      refetchInterval: 10_000,
    }),
  );
}

// match ids for the chain to fill in, so a list costs a few reads instead of a scan of the newest matches
export async function matchIds(where: Record<string, unknown>, limit: number): Promise<bigint[]> {
  const d = await gql<{ Match: { id: string }[] }>(`query($w: Match_bool_exp!, $n: Int!) { Match(where: $w, order_by: {createdAt: desc}, limit: $n) { id } }`, { w: where, n: limit });
  return d.Match.map((m) => BigInt(m.id));
}

// net MON and the current win streak from a player's finished matches, newest first
export function recordOf(matches: IxMatch[], who: string) {
  const me = who.toLowerCase();
  const done = matches.filter((m) => m.state === "done");
  const side = (m: IxMatch) => (m.a === me ? "a" : "b");
  const net = done.reduce((a, m) => (m.result === "draw" ? a : m.result === side(m) ? a + mon(m.stake) : a - mon(m.stake)), 0);
  let streak = 0;
  for (const m of done) {
    if (m.result !== side(m)) break;
    streak++;
  }
  return { net, streak, side };
}

// what an empty list says when the reason is the indexer, not a lack of players
export const ixNote = { off: "stats are not connected on this build", error: "could not reach the stats service, retrying", loading: "loading…", ok: "" } as const;
export const ixEmpty = (status: Ix<unknown>["status"], what: string) => (status === "loading" ? { title: "Loading…" } : { title: `${what} unavailable`, body: ixNote[status] });
