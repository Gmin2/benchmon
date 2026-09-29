import { useMemo, useState } from "react";
import { DECK_CAP, ROSTER, STARTER_DECKS, byId, type Deck } from "../mock";
import { GameCard } from "../ui/Card";
import { MARKS } from "../ui/generated";
import { Btn, Chip, Ico, Panel, SearchBar, Seg } from "../ui/kit";
import { artOf, infoOf, tierOf, type CardInfo } from "../ui/meta";
import { LabMark } from "../ui/pixel";

const TYPES = ["all", "reasoning", "speed", "cost"] as const;
const SORTS = ["power", "name", "rarity"] as const;
const RARITY_ORDER = { legendary: 0, rare: 1, common: 2 };

// decks live in this browser until they are saved onchain with a match
const KEY = "benchmon:decks";
function loadDecks(): Deck[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(saved) && saved.length ? saved : STARTER_DECKS;
  } catch {
    return STARTER_DECKS;
  }
}
function storeDecks(d: Deck[]) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
export { loadDecks };

function PowerMeter({ value }: { value: number }) {
  const over = value > DECK_CAP;
  const pct = Math.min(1, value / DECK_CAP);
  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="text-sm text-mute">Deck power</span>
        <span className={`text-2xl font-bold ${over ? "text-down" : "text-ink"}`}>
          {value}
          <span className="text-base font-medium text-dim"> / {DECK_CAP}</span>
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-panel-2">
        <div className={`h-full rounded-full transition-all ${over ? "bg-down" : "bg-neon"}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <p className={`mt-2 text-sm ${over ? "text-down" : "text-dim"}`}>{over ? `${value - DECK_CAP} over the cap, swap in a cheaper card` : `${DECK_CAP - value} power left`}</p>
    </div>
  );
}

function Slot({ info, onRemove, index }: { info?: CardInfo; onRemove: () => void; index: number }) {
  if (!info)
    return (
      <div className="flex h-[76px] items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 text-dim">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-panel-2 text-sm font-semibold">{index + 1}</span>
        empty slot
      </div>
    );
  const mark = MARKS[info.lab];
  return (
    <div className="group flex h-[76px] items-center gap-3 rounded-2xl bg-panel-2 pr-3 pl-2">
      <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 50% 90%, ${info.main === "#1a1a1a" ? "#666" : info.main}, #1e1f23 75%)` }}>
        <img src={artOf(info.card.name, tierOf(info))} alt="" className="pixel h-full w-full scale-125 object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold">
          <span className="truncate">{info.display}</span>
          {mark && <LabMark mark={mark} className="h-3.5 w-3.5 shrink-0" />}
        </span>
        <span className="text-xs text-mute capitalize">
          {info.type} · {info.rarity}
        </span>
      </span>
      <span className="text-lg font-bold">{info.power}</span>
      <button onClick={onRemove} aria-label={`remove ${info.display}`} className="ml-1 grid h-9 w-9 place-items-center rounded-full text-mute opacity-60 transition hover:bg-raised hover:text-down group-hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

export function Decks({ onPlay }: { onPlay: (deck: Deck) => void }) {
  const [decks, setDecks] = useState<Deck[]>(loadDecks);
  const [active, setActive] = useState(decks[0]!.id);
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("power");
  const [q, setQ] = useState("");
  const deck = decks.find((d) => d.id === active) ?? decks[0]!;
  const infos = useMemo(() => ROSTER.map(infoOf), []);

  const list = infos
    .filter((i) => type === "all" || i.type === type)
    .filter((i) => !q || i.display.includes(q.toLowerCase()) || i.lab.includes(q.toLowerCase()))
    .sort((a, b) => (sort === "power" ? b.power - a.power : sort === "name" ? a.display.localeCompare(b.display) : RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || b.power - a.power));

  const chosen = deck.cards.map((id) => infoOf(byId(id)));
  const total = chosen.reduce((a, c) => a + c.power, 0);
  const valid = deck.cards.length === 5 && total <= DECK_CAP;

  const update = (cards: number[]) => {
    const next = decks.map((d) => (d.id === deck.id ? { ...d, cards } : d));
    setDecks(next);
    storeDecks(next);
  };
  const toggle = (id: number) => (deck.cards.includes(id) ? update(deck.cards.filter((x) => x !== id)) : deck.cards.length < 5 && update([...deck.cards, id]));
  const newDeck = () => {
    const d = { id: `deck-${Date.now()}`, name: `Deck ${decks.length + 1}`, cards: [] };
    const next = [...decks, d];
    setDecks(next);
    storeDecks(next);
    setActive(d.id);
  };
  const rename = (name: string) => {
    const next = decks.map((d) => (d.id === deck.id ? { ...d, name } : d));
    setDecks(next);
    storeDecks(next);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SearchBar placeholder="Search models or labs" value={q} onChange={setQ} />
          <div className="flex gap-3">
            <Seg value={type} options={TYPES} onChange={setType} />
          </div>
        </div>
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Collection <span className="text-mute">· {list.length} cards</span>
          </h2>
          <div className="flex items-center gap-2 text-sm text-mute">
            sort
            <Seg value={sort} options={SORTS} onChange={setSort} />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(198px,1fr))] justify-items-center gap-x-4 gap-y-7">
          {list.map((i) => {
            const inDeck = deck.cards.includes(i.card.id);
            const wouldOver = !inDeck && total + i.power > DECK_CAP;
            const full = !inDeck && deck.cards.length >= 5;
            return (
              <GameCard
                key={i.card.id}
                info={i}
                size="tile"
                state={inDeck ? "selected" : !full && wouldOver ? "locked" : null}
                className={full ? "opacity-50 hover:opacity-80" : ""}
                onClick={() => toggle(i.card.id)}
              />
            );
          })}
        </div>
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {decks.map((d) => (
            <button key={d.id} onClick={() => setActive(d.id)} className={`h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition ${d.id === deck.id ? "bg-neon text-bg" : "bg-panel text-mute hover:text-ink"}`}>
              {d.name}
            </button>
          ))}
          <button onClick={newDeck} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-panel text-mute hover:text-ink" aria-label="new deck">
            <Ico name="circle-plus" className="h-5 w-5" />
          </button>
        </div>

        <Panel className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between">
            <input value={deck.name} onChange={(e) => rename(e.target.value)} aria-label="deck name" className="min-w-0 bg-transparent text-2xl font-bold outline-none" />
            <Chip tone={valid ? "up" : deck.cards.length < 5 ? "flat" : "down"}>{valid ? "ready" : `${deck.cards.length}/5`}</Chip>
          </div>
          <PowerMeter value={total} />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Slot key={i} index={i} info={chosen[i]} onRemove={() => update(deck.cards.filter((_, k) => k !== i))} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {(["reasoning", "speed", "cost"] as const).map((t) => (
              <div key={t} className="rounded-2xl bg-panel-2 py-3">
                <div className="text-xl font-bold">{chosen.filter((c) => c.type === t).length}</div>
                <div className="text-mute capitalize">{t}</div>
              </div>
            ))}
          </div>
          <Btn size="lg" disabled={!valid} onClick={() => onPlay(deck)}>
            Play with this deck
          </Btn>
          <p className="text-center text-xs text-dim">tap a card to add or remove it. greyed cards would push the deck over the cap.</p>
        </Panel>
      </aside>
    </div>
  );
}
