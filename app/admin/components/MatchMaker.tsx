'use client';

import { useMemo, useState } from 'react';
import { CATEGORY_LABELS } from '../../tournament/types';
import type { Match } from '../../tournament/types';
import { sortCategories } from '@/lib/categories';
import { rollPairs, standing, type Standing } from '@/lib/quickMatch';

type Entry = { id: string; label: string };
type Rolled = { pairs: [Entry, Entry][]; waiting: Entry | null };

// Matches made as players arrive: tick who is here, roll the dice (or, for two, just make the match).
// Nothing is drawn ahead; each match goes straight onto the Score desk and the leaderboard.
// mode 'first' (Brackets): first matches, for entries that haven't played yet.
// mode 'winners' (Score desk): next matches, for entries that have won and are free.
export default function MatchMaker({ tournamentId, names, matches, onMade, mode, category }: {
  tournamentId: string;
  names: Map<string, Entry[]>;
  matches: Match[];
  onMade: (msg: string) => Promise<void>;
  mode: 'first' | 'winners';
  // a fixed category (the one picked in Brackets); otherwise the box has its own picker
  category?: string;
}) {
  const cats = sortCategories(Array.from(names.keys()));
  const [ownCat, setCat] = useState('');
  const cat = category ?? ownCat;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rolled, setRolled] = useState<Rolled | null>(null);
  const [rolling, setRolling] = useState(false);
  const [final, setFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => matches.filter((m) => m.category === cat).map((m) => ({
    round: m.round, status: m.status, player1_name: m.player1Name, player2_name: m.player2Name ?? null,
    winner_name: m.winnerName ?? null, label: m.roundName === 'Final' ? 'Final' : null,
  })), [matches, cat]);
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return (names.get(cat) ?? []).filter((e) => !seen.has(e.label) && seen.add(e.label))
      .map((e) => ({ ...e, s: standing(e.label, rows) }))
      .sort((a, b) => rank(a.s) - rank(b.s) || b.s.wins - a.s.wins || a.label.localeCompare(b.label));
  }, [names, cat, rows]);
  // Who this box is for: first matches list everyone, and only those who haven't played can be ticked. Next matches
  // list the winners first, then anyone still waiting for a first match (with an odd count they may meet a winner).
  const fresh = (s: Standing) => !s.out && !s.playing && s.wins === 0;
  const shownEntries = mode === 'winners' ? entries.filter((e) => e.s.wins > 0 || fresh(e.s)) : entries;
  const free = shownEntries.filter((e) => (mode === 'winners' ? !e.s.out && !e.s.playing && !e.s.champion : fresh(e.s)));
  const chosen = free.filter((e) => picked.has(e.label));
  const winsOf = (e: Entry) => entries.find((x) => x.label === e.label)?.s.wins ?? 0;

  const reset = () => { setPicked(new Set()); setRolled(null); setFinal(false); setError(null); };
  const [seenCat, setSeenCat] = useState(cat);
  if (cat !== seenCat) { setSeenCat(cat); reset(); }
  const toggle = (label: string) => {
    setRolled(null); setFinal(false);
    setPicked((p) => { const n = new Set(p); if (n.has(label)) n.delete(label); else n.add(label); return n; });
  };
  // Rolled on the server; with no connection it rolls here (making the matches needs the connection anyway)
  const roll = async () => {
    setError(null); setRolling(true); setRolled(null);
    const entries = chosen.map(({ id, label }) => ({ id, label }));
    const [res] = await Promise.all([
      fetch('/api/tournament/matches/roll', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, category: cat, entries }) }).catch(() => null),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    setRolled(d?.pairs ? d : rollPairs(entries));
    setRolling(false);
  };

  async function create(pairs: [Entry, Entry][]) {
    setBusy(true); setError(null);
    const res = await fetch('/api/tournament/matches/quick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, category: cat, final: final && pairs.length === 1,
        pairs: pairs.map(([a, b]) => ({ player1: { id: a.id, name: a.label }, player2: { id: b.id, name: b.label } })) }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({})) ?? {};
    setBusy(false);
    if (!res?.ok) { setError(d.error ?? 'No connection. Not saved; try again.'); return; }
    const made = pairs.map(([a, b]) => `${a.label} vs ${b.label}`).join(', ');
    reset();
    await onMade(`${final && pairs.length === 1 ? 'Final' : `${pairs.length} match${pairs.length === 1 ? '' : 'es'}`} made in ${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}: ${made}. They are on the Score desk.`);
  }

  return (
    <section className="mb-6 bg-white rounded-xl border border-orange-200 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-stone-900 mr-auto">
          {mode === 'first' ? 'First matches' : 'Next matches for winners'}
          <span className="font-normal text-stone-400"> · {mode === 'first' ? 'tick who has arrived, then roll the dice' : 'tick the winners who are ready, then roll the dice'}</span>
        </h3>
        {category === undefined && (
          <select value={cat} onChange={(e) => { setCat(e.target.value); reset(); }}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">Pick a category…</option>
            {cats.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c} ({names.get(c)?.length ?? 0})</option>)}
          </select>
        )}
      </div>

      {cat && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-stone-500">
            <span>{free.length} can play now</span>
            {free.length > 0 && <button onClick={() => { setRolled(null); setPicked(new Set(free.map((e) => e.label))); }} className="underline">Tick all</button>}
            {picked.size > 0 && <button onClick={reset} className="underline">Clear</button>}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {shownEntries.map((e) => {
              const can = free.includes(e);
              const on = can && picked.has(e.label);
              return (
                <button key={e.label} onClick={() => can && toggle(e.label)} disabled={!can}
                  className={`text-sm rounded-lg border px-2.5 py-1.5 text-left ${on ? 'bg-orange-600 border-orange-600 text-white' : can ? 'bg-white border-stone-200 text-stone-800 hover:border-orange-300' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>
                  {e.label}
                  <span className={`ml-1.5 text-[11px] ${on ? 'text-orange-100' : 'text-stone-400'}`}>
                    {e.s.champion ? '🏆 champion' : e.s.out ? 'out' : e.s.playing ? 'on court / waiting' : e.s.wins ? `${e.s.wins} win${e.s.wins === 1 ? '' : 's'}` : mode === 'winners' ? "hasn't played" : 'new'}
                  </span>
                </button>
              );
            })}
            {shownEntries.length === 0 && <p className="text-sm text-stone-400">{mode === 'winners' ? 'Nobody is free for a next match in this category yet. First matches are made in Brackets.' : 'Nobody is entered in this category.'}</p>}
          </div>

          {chosen.length === 2 && !rolled && (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => create([[chosen[0], chosen[1]]])} disabled={busy}
                className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {busy ? 'Saving…' : `Make match: ${chosen[0].label} vs ${chosen[1].label}`}
              </button>
              <FinalBox final={final} setFinal={setFinal} />
            </div>
          )}
          {chosen.length >= 3 && !rolled && (
            <button onClick={roll} disabled={rolling}
              className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-70">
              <span className={`inline-block mr-1.5 ${rolling ? 'animate-spin' : ''}`}>🎲</span>{rolling ? 'Rolling…' : `Roll the dice for ${chosen.length}`}
            </button>
          )}
          {chosen.length === 1 && <p className="text-sm text-stone-400">Tick one more to make a match.</p>}

          {rolled && (
            <div className="rounded-lg bg-orange-50/60 border border-orange-200 p-3 space-y-2">
              <ul className="space-y-1">
                {rolled.pairs.map(([a, b], i) => (
                  <li key={i} className="text-sm text-stone-800">
                    <b>{a.label}</b> <span className="text-stone-400">vs</span> <b>{b.label}</b>
                    {winsOf(a) !== winsOf(b) && <span className="ml-2 text-xs text-amber-700">({winsOf(a)} vs {winsOf(b)} wins)</span>}
                  </li>
                ))}
              </ul>
              {rolled.waiting && <p className="text-xs text-stone-500">Waits for the next match: <b>{rolled.waiting.label}</b></p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={() => create(rolled.pairs)} disabled={busy}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {busy ? 'Saving…' : `Make ${rolled.pairs.length === 1 ? 'this match' : `these ${rolled.pairs.length} matches`}`}
                </button>
                <button onClick={roll} disabled={busy || rolling} className="px-3 py-2 border border-stone-200 bg-white rounded-lg text-sm text-stone-700">🎲 Roll again</button>
                <button onClick={() => setRolled(null)} className="text-xs text-stone-500 underline">Cancel</button>
                {rolled.pairs.length === 1 && <FinalBox final={final} setFinal={setFinal} />}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </>
      )}
    </section>
  );
}

// Free to play first, then those on court, then those out
const rank = (s: Standing) => (s.champion ? 3 : s.out ? 2 : s.playing ? 1 : 0);

function FinalBox({ final, setFinal }: { final: boolean; setFinal: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-stone-600">
      <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} />
      This is the final (the winner is champion)
    </label>
  );
}
