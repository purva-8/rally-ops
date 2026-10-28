'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category, Match } from '../../tournament/types';
import { entryLabel } from '@/lib/categories';
import { bwfResult, winnerSide } from '@/lib/bracket';

// Results come in on paper; one person types them in here as each match ends.
// Every save goes to the server, which picks the winner and draws the next round.
export default function ScoreDeskTab() {
  const { matches, participants, tournamentId, loadMatches } = useTournamentStore();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`/api/tournament/matches?tournamentId=${tournamentId}`).then((x) => x.json()).catch(() => null);
    if (r?.matches) loadMatches(r.matches);
  }, [tournamentId, loadMatches]);

  // Another desk or a coach's phone may save too, so stay current
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const shown = (m: Match) => (cat === 'all' || m.category === cat)
    && (!q || `${m.player1Name} ${m.player2Name ?? ''}`.toLowerCase().includes(q));
  const order = (a: Match, b: Match) => a.category.localeCompare(b.category) || a.round - b.round || (a.position ?? 0) - (b.position ?? 0);

  const ready = matches.filter((m) => !m.isBye && m.status !== 'completed').filter(shown).sort(order);
  const done = matches.filter((m) => !m.isBye && m.status === 'completed').filter(shown)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const cats = Array.from(new Set(matches.map((m) => m.category))).sort() as Category[];
  const champions = cats.flatMap((c) => {
    const final = matches.find((m) => m.category === c && m.roundName === 'Final' && m.status === 'completed' && !m.isBye);
    return final?.winnerName ? [{ c, name: final.winnerName }] : [];
  });

  const names = useMemo(() => {
    const byCat = new Map<string, { id: string; label: string }[]>();
    for (const p of participants) for (const c of p.categories) {
      const list = byCat.get(c) ?? [];
      list.push({ id: p.id, label: entryLabel(p.fullName, p.partnerName, c) });
      byCat.set(c, list);
    }
    return byCat;
  }, [participants]);

  const saved = async (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote((n) => (n === msg ? null : n)), 6000);
    await refresh();
  };

  if (!tournamentId) return <p className="text-sm text-stone-400">Open an event to enter scores.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Score desk</h2>
          <p className="text-stone-400 text-sm">Type in each scoresheet as it comes back. The next round is drawn by itself.</p>
        </div>
        <a href={`/events/${tournamentId}/results`} target="_blank" rel="noreferrer"
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 rounded-lg px-3 py-2">
          Public results page ↗
        </a>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <select value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a player…"
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {note && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">{note}</div>}

      {matches.length === 0 && (
        <p className="text-sm text-stone-400 mb-6">No draws yet. Make them in the Brackets tab first.</p>
      )}

      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">To enter ({ready.length})</h3>
      <div className="space-y-2 mb-8">
        {ready.map((m) => <DeskRow key={m.id} match={m} names={names.get(m.category) ?? []} onSaved={saved} />)}
        {ready.length === 0 && matches.length > 0 && <p className="text-sm text-stone-400">Nothing waiting{q || cat !== 'all' ? ' for this filter' : ''}.</p>}
      </div>

      {champions.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Champions</h3>
          <div className="flex flex-wrap gap-2 mb-8">
            {champions.map(({ c, name }) => (
              <span key={c} className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="text-stone-500">{CATEGORY_LABELS[c] ?? c}:</span> <b className="text-stone-900">{name}</b>
              </span>
            ))}
          </div>
        </>
      )}

      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Entered ({done.length}), newest first</h3>
      <div className="space-y-2">
        {done.map((m) => <DeskRow key={m.id} match={m} names={[]} onSaved={saved} />)}
      </div>
    </div>
  );
}

type Games = [string, string][];

function DeskRow({ match, names, onSaved }: {
  match: Match;
  names: { id: string; label: string }[];
  onSaved: (msg: string) => Promise<void>;
}) {
  const finished = match.status === 'completed';
  const fromMatch = (): Games => [0, 1, 2].map((i) => {
    const s = match.sets[i];
    return s ? [String(s.player1Score), String(s.player2Score)] : ['', ''];
  });
  const [games, setGames] = useState<Games>(fromMatch);
  const [open, setOpen] = useState(!finished);
  const [editPlayers, setEditPlayers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up a score saved elsewhere unless this row is being typed into
  const key = JSON.stringify(match.sets);
  const [seen, setSeen] = useState(key);
  if (key !== seen && !busy) {
    setSeen(key);
    setGames(fromMatch());
  }

  const typed = (side: 0 | 1, i: number, v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    setGames((g) => g.map((pair, j) => (j === i ? (side === 0 ? [clean, pair[1]] : [pair[0], clean]) : pair)) as Games);
  };

  const save = async () => {
    setError(null);
    const half = games.find(([a, b]) => (a === '') !== (b === ''));
    if (half) { setError('Each game needs both numbers'); return; }
    const sets = games.filter(([a, b]) => a !== '' && b !== '').map(([a, b]) => ({ player1Score: Number(a), player2Score: Number(b) }));
    if (!sets.length) { setError('Type the scores first'); return; }

    let override = false;
    const r = bwfResult(sets);
    if ('problem' in r) {
      const side = winnerSide(sets);
      if (!side) { setError(`${r.problem}. Both sides won the same number of games.`); return; }
      const name = side === 1 ? match.player1Name : match.player2Name;
      if (!confirm(`${r.problem}.\n\nSave it anyway? ${name} won more games and will go through.`)) return;
      override = true;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/tournament/matches/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, sets, status: 'completed', override }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? `Not saved (${res.status})`); return; }
      const winner = data.match?.winnerName ?? '';
      const next = (data.nextMatches ?? []) as Match[];
      const drawn = !finished && next.length ? ` ${next[0].roundName}${next.length > 1 ? 's' : ''} drawn for ${CATEGORY_LABELS[match.category] ?? match.category}.` : '';
      await onSaved(`${finished ? 'Corrected' : 'Saved'}: ${winner} won ${match.roundName.toLowerCase()} (${scoreText(sets)}).${drawn}`);
      if (finished) setOpen(false);
    } catch {
      setError('No connection. Not saved; try again.');
    } finally {
      setBusy(false);
    }
  };

  const boxes = (side: 0 | 1) => games.map((g, i) => (
    <input key={i} inputMode="numeric" value={g[side]} disabled={busy}
      onChange={(e) => typed(side, i, e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
      aria-label={`Game ${i + 1} ${side === 0 ? match.player1Name : match.player2Name}`}
      className="w-11 border border-stone-200 rounded-md py-1.5 text-center font-bold text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
  ));

  return (
    <div className={`bg-white border rounded-xl px-4 py-3 ${error ? 'border-red-300' : 'border-stone-200'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[match.category] ?? 'bg-stone-100 text-stone-600'}`}>{CATEGORY_LABELS[match.category] ?? match.category}</span>
        <span className="text-xs text-stone-400">{match.roundName}{match.courtId ? ` · ${match.courtId.replace('court-', 'Court ')}` : ''}</span>
        {finished && !open && (
          <>
            <span className="text-sm text-stone-700 ml-1"><b>{match.winnerName}</b> won {scoreText(match.sets)}</span>
            <button onClick={() => setOpen(true)} className="ml-auto text-xs text-orange-600 font-semibold hover:underline">Fix</button>
          </>
        )}
        {!finished && !editPlayers && (
          <button onClick={() => setEditPlayers(true)} className="ml-auto text-xs text-stone-400 hover:text-stone-700 underline">Change players</button>
        )}
      </div>

      {editPlayers ? (
        <PlayerEditor match={match} names={names} onDone={async (msg) => { setEditPlayers(false); if (msg) await onSaved(msg); }} />
      ) : open && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="grid grid-cols-[minmax(0,14rem)_repeat(3,auto)] items-center gap-x-2 gap-y-1.5">
            <span />
            {[1, 2, 3].map((n) => <span key={n} className="text-[10px] text-stone-400 text-center">G{n}</span>)}
            <span className="text-sm font-medium text-stone-900 truncate">{match.player1Name}</span>
            {boxes(0)}
            <span className="text-sm font-medium text-stone-900 truncate">{match.player2Name}</span>
            {boxes(1)}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy}
              className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {busy ? 'Saving…' : finished ? 'Save correction' : 'Save result'}
            </button>
            {finished && <button onClick={() => { setOpen(false); setGames(fromMatch()); setError(null); }} className="text-xs text-stone-400 hover:text-stone-700">Cancel</button>}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

// Type any name; picking one from the list links it to that entry
function PlayerEditor({ match, names, onDone }: {
  match: Match;
  names: { id: string; label: string }[];
  onDone: (msg: string | null) => Promise<void>;
}) {
  const [p1, setP1] = useState(match.player1Name);
  const [p2, setP2] = useState(match.player2Name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = `names-${match.id}`;
  const side = (typedName: string, oldName: string | undefined, oldId: string | undefined) => {
    const name = typedName.trim();
    if (name === oldName) return { id: oldId ?? null, name };
    return { id: names.find((n) => n.label === name)?.id ?? null, name };
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tournament/matches/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          player1: side(p1, match.player1Name, match.player1Id),
          player2: side(p2, match.player2Name, match.player2Id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? `Not saved (${res.status})`); return; }
      await onDone(`Players changed: ${p1.trim()} vs ${p2.trim()}`);
    } catch {
      setError('No connection. Not saved; try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <datalist id={listId}>{names.map((n) => <option key={n.id} value={n.label} />)}</datalist>
      <input list={listId} value={p1} onChange={(e) => setP1(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40" />
      <span className="text-stone-400 text-xs">vs</span>
      <input list={listId} value={p2} onChange={(e) => setP2(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40" />
      <button onClick={save} disabled={busy || !p1.trim() || !p2.trim()} className="bg-[#111827] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
        {busy ? 'Saving…' : 'Save players'}
      </button>
      <button onClick={() => onDone(null)} className="text-xs text-stone-400 hover:text-stone-700">Cancel</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

function scoreText(sets: { player1Score: number; player2Score: number }[]) {
  return sets.map((s) => `${s.player1Score}-${s.player2Score}`).join(', ');
}
