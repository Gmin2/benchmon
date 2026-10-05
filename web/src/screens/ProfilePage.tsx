import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther } from "viem";
import { rankOf } from "../duel";
import { ixEmpty, recordOf, usePlayer, usePlayerMatches } from "../indexer";
import { profileByName, profileUrl, siteHost, useMe, useProfiles, type Profile } from "../profile";
import { Wordmark } from "../ui/brand";
import { CLASSES } from "../ui/generated";
import { Btn, Chip, Empty, Panel } from "../ui/kit";
import { faceOf } from "./play/parts";

// a player's public page at /@username, open to anyone with the link
export function ProfilePage({ standalone = false }: { standalone?: boolean }) {
  const { at = "" } = useParams();
  const name = at.startsWith("@") ? at.slice(1).toLowerCase() : "";
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const { profile: mine } = useMe();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setP(undefined);
    if (name) profileByName(name).then(setP);
    else setP(null);
  }, [name]);

  // the record comes from the indexer, one query instead of reading the newest matches off the chain
  const addr = p?.address.toLowerCase();
  const player = usePlayer(addr);
  const hist = usePlayerMatches(addr);
  const played = (hist.data ?? []).filter((m) => m.b);
  const rec = addr && hist.data ? recordOf(hist.data, addr) : null;
  const others = played.map((m) => (m.a === addr ? m.b! : m.a));
  const nameOf = useProfiles(others);

  const body =
    p === undefined ? (
      <Panel className="p-8 text-mute">loading @{name}…</Panel>
    ) : p === null ? (
      <Panel className="p-8">
        <div className="text-2xl font-extrabold">No player called @{name || at}</div>
        <p className="mt-1 text-mute">the name is free. claim it when you sign up.</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-neon">
          play benchmon
        </Link>
      </Panel>
    ) : (
      (() => {
        const cls = CLASSES.find((c) => c.cls === p.cls);
        const stats = player.status === "ok" ? (player.data ?? { matches: 0, wins: 0, losses: 0 }) : null;
        const wins = stats?.wins ?? 0;
        const rank = rankOf(wins);
        const isMe = mine?.address === p.address;
        const copy = () =>
          navigator.clipboard.writeText(profileUrl(p.username)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        return (
          <div className="flex flex-col gap-6">
            <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-panel">
              <img src="/art/arenas/reasoning@1x.png" alt="" className="pixel absolute inset-0 h-full w-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/85 to-panel/30" />
              <div className="relative grid items-center gap-6 p-7 md:grid-cols-[auto_1fr] md:p-10">
                <img src={`/art/classes/${p.cls}-${p.body}-${rank}@1x.png`} alt="" className="pixel mx-auto h-56 w-56 object-contain md:h-64 md:w-64" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="up">{rank}</Chip>
                    {isMe && <Chip tone="flat">this is you</Chip>}
                  </div>
                  <h1 className="mt-3 text-[44px] leading-none font-extrabold md:text-[56px]">@{p.username}</h1>
                  <p className="mt-2 text-lg text-mute capitalize">
                    {cls?.title} · <span className="normal-case">{cls?.blurb}</span>
                  </p>
                  <p className="mt-1 text-sm text-dim">playing since {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="flex h-12 items-center gap-2 rounded-full border border-line bg-panel-2/80 pr-1.5 pl-4 font-mono text-sm">
                      {siteHost}/@{p.username}
                      <button onClick={copy} className="h-9 rounded-full bg-neon px-3.5 text-xs font-bold text-bg">
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </span>
                    <a
                      href={`https://x.com/intent/post?text=${encodeURIComponent(isMe ? "my benchmon page, come fight me" : `@${p.username} on benchmon`)}&url=${encodeURIComponent(profileUrl(p.username))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:opacity-90"
                    >
                      Share on X
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                [stats ? String(stats.matches) : "—", "matches"],
                [stats ? String(wins) : "—", "wins"],
                [stats ? String(stats.losses) : "—", "losses"],
                [stats?.matches ? `${Math.round((wins / stats.matches) * 100)}%` : "—", "win rate"],
                [rec ? `${rec.net < 0 ? "" : "+"}${rec.net.toFixed(2)}` : "—", "net MON"],
              ].map(([v, l]) => (
                <Panel key={l} className="p-5 text-center">
                  <div className="text-3xl font-extrabold">{v}</div>
                  <div className="mt-1 text-sm text-mute">{l}</div>
                </Panel>
              ))}
            </div>

            <Panel className="p-6">
              <h2 className="text-xl font-bold">Recent matches</h2>
              {hist.status !== "ok" ? (
                <Empty className="mt-4" {...ixEmpty(hist.status, "Match history")} />
              ) : played.length === 0 ? (
                <Empty className="mt-4" title="No matches yet" body="matches show up here once they start." />
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {played.slice(0, 12).map((m) => {
                    const side = m.a === addr ? "a" : "b";
                    const opp = side === "a" ? m.b! : m.a;
                    const op = nameOf(opp);
                    const res = m.state !== "done" ? "live" : m.result === "draw" ? "draw" : m.result === side ? "win" : "loss";
                    return (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel-2 px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="text-sm text-dim">#{m.id}</span>
                          <span>
                            vs{" "}
                            {op ? (
                              <Link to={`/@${op.username}`} className="font-semibold hover:text-neon">
                                @{op.username}
                              </Link>
                            ) : (
                              <span className="font-semibold">{faceOf(opp).handle}</span>
                            )}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 text-sm">
                          <span className="text-mute">
                            {side === "a" ? m.winsA : m.winsB} : {side === "a" ? m.winsB : m.winsA} · {formatEther(BigInt(m.stake))} MON
                          </span>
                          <Chip tone={res === "win" ? "up" : res === "loss" ? "down" : res === "live" ? "violet" : "flat"}>{res}</Chip>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        );
      })()
    );

  if (!standalone) return <div className="pt-2">{body}</div>;
  // someone opened a shared link without being logged in
  return (
    <div className="min-h-svh bg-app">
      <div className="mx-auto max-w-[1100px] px-5 pb-16">
        <header className="flex h-24 items-center justify-between">
          <Link to="/" aria-label="benchmon">
            <Wordmark className="h-12" />
          </Link>
          <Link to="/">
            <Btn>Play for free</Btn>
          </Link>
        </header>
        {body}
      </div>
    </div>
  );
}
