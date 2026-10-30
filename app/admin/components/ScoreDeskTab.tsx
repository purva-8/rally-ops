'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category, Match } from '../../tournament/types';
import { entryLabel, sortCategories } from '@/lib/categories';
import { matchResult, winnerSide } from '@/lib/bracket';
import { undoResult } from './undo';
import MatchMaker from './MatchMaker';
import HistoryPanel from './HistoryPanel';
import BackupBar from './BackupBar';
import { clearDraft, fetchRetry, loadDraft, saveDraft, type Base, type Games } from '@/lib/deskSafety';

// Scores come in from the coaches; one person types them in here as each match ends. The server picks the winner.
// First matches are made in Brackets; winners are paired up for their next match here. Nothing is drawn ahead.
export default function ScoreDeskTab() {
  const { matches, participants, tournamentId, loadMatches } = useTournamentStore();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`/api/tournament/matches?tournamentId=${tournamentId}`).then((x) => x.json()).catch(() => null);
    if (r?.matches) loadMatches(r.matches);
  }, [tournamentId, loadMatches]);

  // The venue runs on a phone hotspot: say plainly when it drops, and catch up as soon as it's back
  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => { setOffline(false); refresh(); };
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => { window.removeEventListener('offline', down); window.removeEventListener('online', up); };
  }, [refresh]);

  // Another desk may save too, so stay current
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const shown = (m: Match) => (cat === 'all' || m.category === cat)
    && (!q || `${m.player1Name} ${m.player2Name ?? ''}`.toLowerCase().includes(q));
  const catOrder = sortCategories(Array.from(new Set(matches.map((m) => m.category))));
  const catRank = (c: string) => catOrder.indexOf(c);
  const order = (a: Match, b: Match) => catRank(a.category) - catRank(b.category) || a.round - b.round || (a.position ?? 0) - (b.position ?? 0);

  const ready = matches.filter((m) => !m.isBye && m.status !== 'completed').filter(shown).sort(order);
  const done = matches.filter((m) => !m.isBye && m.status === 'completed').filter(shown)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const cats = catOrder as Category[];
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
          <p className="text-stone-400 text-sm">Type in each score as the coach reports it, then pair up the winners for their next match. First matches are made in Brackets.</p>
        </div>
        <a href="/leaderboard" target="_blank" rel="noreferrer"
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 rounded-lg px-3 py-2">
          Public leaderboard ↗
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

      {offline && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900 font-medium">No signal. Keep typing scores: they stay on this device and send themselves when the hotspot is back. Keep this page open.</div>}
      {note && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">{note}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BackupBar tournamentId={tournamentId} />
        <HistoryPanel tournamentId={tournamentId} onRestored={saved} />
      </div>
      <MatchMaker mode="winners" tournamentId={tournamentId} names={names} matches={matches} onMade={saved} />

      {matches.length === 0 && (
        <p className="text-sm text-stone-400 mb-6">No matches yet. Make first matches in the Brackets tab as players arrive.</p>
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


function DeskRow({ match, names, onSaved }: {
  match: Match;
  names: { id: string; label: string }[];
  onSaved: (msg: string) => Promise<void>;
}) {
  const tournamentId = useTournamentStore((s) => s.tournamentId);
  const finished = match.status === 'completed';
  const fromMatch = (): Games => [0, 1, 2].map((i) => {
    const s = match.sets[i];
    return s ? [String(s.player1Score), String(s.player2Score)] : ['', ''];
  });
  const baseOf = (): Base => ({ status: match.status, sets: match.sets.map((x) => ({ player1Score: x.player1Score, player2Score: x.player2Score })) });
  // A score typed on this device but not yet saved comes back after a reload or a dropped connection
  const [draft] = useState(() => loadDraft(match.id));
  const [games, setGames] = useState<Games>(() => draft?.games ?? fromMatch());
  const [base, setBase] = useState<Base>(() => draft?.base ?? baseOf());
  const [dirty, setDirty] = useState(!!draft);
  const [open, setOpen] = useState(!finished || !!draft);
  const [editPlayers, setEditPlayers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  // A score that couldn't be sent (no signal): held here and sent again by itself when the connection is back
  const [held, setHeld] = useState<{ force: boolean; override: boolean } | null>(null);
  const sending = useRef(false);
  const [info, setInfo] = useState<string | null>(draft ? `Unsaved score from this device (typed ${new Date(draft.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}) is back. Check it and save.` : null);

  // Pick up a score saved elsewhere, unless something is typed here: then keep the typing and say so
  const key = JSON.stringify([match.status, match.sets]);
  const [seen, setSeen] = useState(key);
  if (key !== seen && !busy) {
    setSeen(key);
    if (!dirty) { setGames(fromMatch()); setBase(baseOf()); }
    else setInfo(`Another desk changed this match (${match.status === 'completed' ? `${match.winnerName} won ` : ''}${scoreText(match.sets) || 'no score'}). Your typed score is kept until you save or clear it.`);
  }

  const typed = (side: 0 | 1, i: number, v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    const next = games.map((pair, j) => (j === i ? (side === 0 ? [clean, pair[1]] : [pair[0], clean]) : pair)) as Games;
    setGames(next);
    setDirty(true);
    setHeld(null); // changed after it was held: Save sends the new score
    saveDraft(match.id, { games: next, base, at: new Date().toISOString() });
  };
  const discard = () => {
    clearDraft(match.id);
    setDirty(false); setGames(fromMatch()); setBase(baseOf()); setError(null); setConflict(false); setInfo(null); setHeld(null);
  };

  const save = async (force = false, resend?: { override: boolean }) => {
    if (sending.current) return;
    setError(null);
    const half = games.find(([a, b]) => (a === '') !== (b === ''));
    if (half) { setError('Each game needs both numbers'); return; }
    const sets = games.filter(([a, b]) => a !== '' && b !== '').map(([a, b]) => ({ player1Score: Number(a), player2Score: Number(b) }));
    if (!sets.length) { setError('Type the scores first'); return; }

    let override = resend?.override ?? false;
    const r = matchResult(sets);
    if ('problem' in r && !resend) {
      const side = winnerSide(sets);
      if (!side) { setError(`${r.problem}. Both sides won the same number of games.`); return; }
      const name = side === 1 ? match.player1Name : match.player2Name;
      if (!confirm(`${r.problem}.\n\nSave it anyway? ${name} won more games and will go through.`)) return;
      override = true;
    }

    setBusy(true);
    sending.current = true;
    saveDraft(match.id, { games, base, at: new Date().toISOString() });
    const hold = () => { setHeld({ force, override }); setError(null); };
    try {
      const res = await fetchRetry('/api/tournament/matches/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, sets, status: 'completed', override, expected: base, force }),
      });
      if ([502, 503, 504].includes(res.status)) { hold(); return; }
      setHeld(null);
      const data = await res.json().catch(() => ({}));
      if (data.alreadySaved) setInfo(null);
      if (res.status === 401) { setError('You have been signed out. Your typed score is kept on this device: sign in again in another tab, then press Save.'); return; }
      if (res.status === 409 && data.conflict) { setConflict(true); setError(`${data.error} Your typed score is kept.`); return; }
      if (!res.ok) { setError(`${data.error ?? `Not saved (${res.status})`}. Your typed score is kept.`); return; }
      clearDraft(match.id);
      setDirty(false); setConflict(false); setInfo(null);
      const winner = data.match?.winnerName ?? '';
      await onSaved(`${finished ? 'Corrected' : 'Saved'}: ${winner} won ${match.roundName.toLowerCase()} (${scoreText(sets)}).`);
      if (finished) setOpen(false);
    } catch {
      hold();
    } finally {
      setBusy(false);
      sending.current = false;
    }
  };

  // Send a held score again as soon as the connection is back, and every 15s in case that event is missed
  const latest = useRef(save);
  useEffect(() => { latest.current = save; });
  useEffect(() => {
    if (!held) return;
    const again = () => { if (navigator.onLine) latest.current(held.force, { override: held.override }); };
    window.addEventListener('online', again);
    const t = setInterval(again, 15000);
    return () => { window.removeEventListener('online', again); clearInterval(t); };
  }, [held]);

  const boxes = (side: 0 | 1) => games.map((g, i) => (
    <input key={i} inputMode="numeric" value={g[side]} disabled={busy}
      onChange={(e) => typed(side, i, e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
      aria-label={`Game ${i + 1} ${side === 0 ? match.player1Name : match.player2Name}`}
      className="w-11 border border-stone-200 rounded-md py-1.5 text-center font-bold text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
  ));

  // Court and "match started" (the leaderboard shows a started match as on court now). Safe to repeat.
  const courtNo = match.courtId?.replace('court-', '') ?? '';
  const changeMatch = async (body: { court?: string | null; started?: boolean }, msg: string) => {
    setError(null); setBusy(true);
    const res = await fetchRetry('/api/tournament/matches/court', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId: match.id, ...body }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({})) ?? {};
    setBusy(false);
    if (!res?.ok) setError(d.error ?? 'No connection. Not saved; try again.');
    else await onSaved(msg);
  };
  const who = `${match.player1Name} vs ${match.player2Name}`;

  return (
    <div className={`bg-white border rounded-xl px-4 py-3 ${error ? 'border-red-300' : dirty || held ? 'border-amber-300' : 'border-stone-200'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[match.category] ?? 'bg-stone-100 text-stone-600'}`}>{CATEGORY_LABELS[match.category] ?? match.category}</span>
        <span className="text-xs text-stone-400">{match.roundName}{finished && match.courtId ? ` · ${match.courtId.replace('court-', 'Court ')}` : ''}</span>
        {!finished && (
          <>
            <select value={courtNo} disabled={busy} aria-label="Court"
              onChange={(e) => changeMatch({ court: e.target.value || null }, e.target.value ? `${who}: Court ${e.target.value}` : `${who}: court cleared`)}
              className={`text-xs font-semibold border rounded-md px-1.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${courtNo ? 'border-stone-300 text-stone-800' : 'border-dashed border-stone-300 text-stone-400'}`}>
              <option value="">Court…</option>
              {['6', '7', '8', '9'].map((c) => <option key={c} value={c}>Court {c}</option>)}
            </select>
            {match.status === 'upcoming' ? (
              <button disabled={busy} onClick={() => changeMatch({ started: true }, `Started: ${who}${courtNo ? ` on Court ${courtNo}` : ''}`)}
                className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">▶ Match started</button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />On court
                </span>
                {match.sets.length === 0 && (
                  <button disabled={busy} onClick={() => changeMatch({ started: false }, `Not started yet: ${who}`)}
                    className="text-xs text-stone-400 hover:text-stone-700 underline disabled:opacity-50">Not started</button>
                )}
              </span>
            )}
          </>
        )}
        {finished && !open && (
          <>
            <span className="text-sm text-stone-700 ml-1"><b>{match.winnerName}</b> won {scoreText(match.sets)}</span>
            <span className="ml-auto flex gap-3">
              <button onClick={() => setOpen(true)} className="text-xs text-orange-600 font-semibold hover:underline">Fix</button>
              <button disabled={busy} onClick={async () => {
                setError(null);
                setBusy(true);
                const r = await undoResult(match);
                setBusy(false);
                if (r && !r.ok) setError(r.message);
                else if (r) await onSaved(r.message);
              }} className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-50">Undo</button>
            </span>
          </>
        )}
        {!finished && !editPlayers && (
          <span className="ml-auto flex gap-3">
            <button onClick={() => setEditPlayers(true)} className="text-xs text-stone-400 hover:text-stone-700 underline">Change players</button>
            {match.sets.length === 0 && match.status === 'upcoming' && (
              <button disabled={busy} onClick={async () => {
                if (!confirm(`Take back ${match.player1Name} vs ${match.player2Name}? Both can be put in another match.`)) return;
                setError(null); setBusy(true);
                const res = await fetch('/api/tournament/matches/quick', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tournamentId, matchId: match.id }) }).catch(() => null);
                const d = await res?.json().catch(() => ({})) ?? {};
                setBusy(false);
                if (!res?.ok) setError(d.error ?? 'No connection. Not removed.');
                else await onSaved(`Taken back: ${match.player1Name} vs ${match.player2Name}`);
              }} className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50">Take back</button>
            )}
          </span>
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
            <button onClick={() => save()} disabled={busy}
              className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {busy ? 'Saving…' : held ? 'Send now' : finished ? 'Save correction' : 'Save result'}
            </button>
            {conflict && <button onClick={() => save(true)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-red-300 text-red-700 bg-white disabled:opacity-50">Save mine anyway</button>}
            {finished && <button onClick={() => { discard(); setOpen(false); }} className="text-xs text-stone-400 hover:text-stone-700">Cancel</button>}
            {!finished && dirty && <button onClick={() => { if (confirm('Clear the typed score?')) discard(); }} className="text-xs text-stone-400 hover:text-stone-700">Clear</button>}
          </div>
        </div>
      )}
      {held && !busy && <p className="text-sm text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-1.5 mt-2">No signal. This score is held on this device and will send itself when the connection is back. Don&apos;t close this page.</p>}
      {info && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">{info}</p>}
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
