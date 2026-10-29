'use client';

import { useState, useMemo } from 'react';
import { Reorder } from 'framer-motion';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category, Match, Participant } from '../../tournament/types';
import { entryLabel, isDoublesCategory, sortCategories } from '@/lib/categories';
import { undoResult } from './undo';
import { firstRoundByes } from '@/lib/bracket';


export default function BracketsTab() {
  const { participants, matches, generateCategoryBracket, selectedCategories, tournamentId, saveError, clearSaveError, loadMatches } = useTournamentStore();
  const [selectedCat, setSelectedCat] = useState<Category | ''>('');
  const [persisting, setPersisting] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // The last deleted draw, kept so it can be put back; dropped once a new draw is made for that category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows exactly as the server returned them
  const [deletedDraw, setDeletedDraw] = useState<{ category: Category; matches: any[]; sets: any[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categories: Category[] = selectedCategories.length > 0 ? sortCategories(selectedCategories) : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  const catPlayers = useMemo(
    () => (selectedCat ? participants.filter((p) => p.categories.includes(selectedCat)) : []),
    [participants, selectedCat]
  );

  const hasMatches = selectedCat ? matches.some((m) => m.category === selectedCat) : false;
  const displayMatches = selectedCat ? matches.filter((m) => m.category === selectedCat) : [];

  const reload = async () => {
    const r = await fetch(`/api/tournament/matches?tournamentId=${tournamentId}`).then((x) => x.json()).catch(() => null);
    if (r?.matches) loadMatches(r.matches);
  };

  const handleUndoResult = async (match: Match) => {
    setBusyId(match.id);
    const r = await undoResult(match);
    if (r) { setNote({ ok: r.ok, text: r.message }); await reload(); }
    setBusyId(null);
  };

  const handleDeleteDraw = async (category: Category) => {
    const catMatches = matches.filter((m) => m.category === category);
    const played = catMatches.filter((m) => !m.isBye && (m.status !== 'upcoming' || m.sets.length)).length;
    if (!confirm(`Delete the whole ${CATEGORY_LABELS[category]} draw?\n\n${catMatches.length} matches${played ? `, including ${played} with scores,` : ''} will be removed and you can draw it again. You can undo this until you make a new draw.`)) return;
    setPersisting(true);
    try {
      const res = await fetch('/api/tournament/brackets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNote({ ok: false, text: data.error ?? `Not deleted (${res.status})` }); return; }
      setDeletedDraw({ category, matches: data.deleted.matches, sets: data.deleted.sets });
      setNote(null);
    } catch {
      setNote({ ok: false, text: 'No connection. Nothing was deleted.' });
    } finally {
      await reload();
      setPersisting(false);
    }
  };

  const handleRestoreDraw = async () => {
    if (!deletedDraw) return;
    setPersisting(true);
    try {
      const res = await fetch('/api/tournament/brackets/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, ...deletedDraw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNote({ ok: false, text: data.error ?? `Not restored (${res.status})` }); return; }
      setNote({ ok: true, text: `${CATEGORY_LABELS[deletedDraw.category]} draw is back, with its scores.` });
      setDeletedDraw(null);
    } catch {
      setNote({ ok: false, text: 'No connection. The draw was not put back; try again.' });
    } finally {
      await reload();
      setPersisting(false);
    }
  };

  const handleGenerateCategory = async (category: Category, orderedIds: string[], byeIds: string[]) => {
    if (deletedDraw?.category === category) setDeletedDraw(null);
    const beforeIds = new Set(matches.map((m) => m.id));
    generateCategoryBracket(category, orderedIds, byeIds);
    if (!tournamentId) return; // legacy in-memory-only tournament, nothing to persist

    setPersisting(true);
    const newMatches = useTournamentStore.getState().matches.filter((m) => !beforeIds.has(m.id));
    const undo = () => useTournamentStore.setState((s) => ({ matches: s.matches.filter((m) => beforeIds.has(m.id)) }));
    try {
      const res = await fetch('/api/tournament/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matches: newMatches }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        undo();
        alert(`Bracket not saved: ${data.error ?? res.status}`);
      }
    } catch {
      undo();
      alert('Bracket not saved: no connection');
    } finally {
      // Reload from the database so ids, slots and round names are exactly what was stored
      const r = await fetch(`/api/tournament/matches?tournamentId=${tournamentId}`).then((x) => x.json()).catch(() => null);
      if (r?.matches) loadMatches(r.matches);
      setPersisting(false);
    }
  };

  return (
    <div>
      {saveError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <p className="flex-1 text-sm text-red-700 font-medium">Not saved: {saveError}</p>
          <button onClick={clearSaveError} className="text-xs text-red-600 underline">Dismiss</button>
        </div>
      )}
      {note && (
        <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${note.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <p className={`flex-1 text-sm font-medium ${note.ok ? 'text-emerald-800' : 'text-red-700'}`}>{note.text}</p>
          <button onClick={() => setNote(null)} className="text-xs text-stone-500 underline">Dismiss</button>
        </div>
      )}
      {deletedDraw && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-amber-900 font-medium">
            {CATEGORY_LABELS[deletedDraw.category]} draw deleted ({deletedDraw.matches.length} matches).
          </p>
          <button onClick={handleRestoreDraw} disabled={persisting}
            className="text-xs bg-[#111827] text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">
            Undo delete
          </button>
          <button onClick={() => setDeletedDraw(null)} className="text-xs text-stone-500 underline">Dismiss</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Tournament Brackets</h2>
          <p className="text-stone-400 text-sm">{matches.length} matches generated</p>
        </div>
      </div>

      {/* Singles and doubles each get their own row, youngest first */}
      {[
        { title: 'Singles', cats: categories.filter((c) => !isDoublesCategory(c)) },
        { title: 'Doubles', cats: categories.filter((c) => isDoublesCategory(c)) },
      ].filter((g) => g.cats.length).map((g) => (
        <section key={g.title} className="mb-5">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2 pb-1 border-b border-stone-200">{g.title}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {g.cats.map((cat) => {
              const count = participants.filter((p) => p.categories.includes(cat)).length;
              const made = matches.filter((m) => m.category === cat).length;
              const active = selectedCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCat(cat);
                    setTimeout(() => document.getElementById('bracket-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                  className={`rounded-xl border p-3 text-center transition-colors cursor-pointer ${active ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' : 'bg-white border-stone-200 hover:border-orange-300'}`}
                >
                  <p className="text-2xl font-bold text-stone-900">{count}</p>
                  <p className="text-xs text-stone-500 mt-1 leading-snug">{CATEGORY_LABELS[cat].replace(/^(Singles|Doubles) - /, '')}</p>
                  {made > 0 ? <p className="text-xs text-emerald-600 font-medium mt-1">{made} match{made === 1 ? '' : 'es'}</p> : count < 2 && <p className="text-xs text-amber-500 mt-1">Need 2+</p>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div className="mb-1" />

      <div id="bracket-detail" className="mb-6 scroll-mt-4">
        <label className="block text-xs font-medium text-stone-500 mb-1.5">Category</label>
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value as Category | '')}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white w-full sm:w-64"
        >
          <option value="">Select a category…</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]} ({participants.filter((p) => p.categories.includes(cat)).length})
            </option>
          ))}
        </select>
      </div>

      {!selectedCat && (
        <div className="text-center py-16 text-stone-400 bg-white rounded-xl border border-stone-200">
          <p>Tap a category above, or pick one from the list, to build or view its bracket.</p>
        </div>
      )}

      {selectedCat && !hasMatches && (
        <SeedBuilder
          key={selectedCat}
          category={selectedCat}
          players={catPlayers}
          persisting={persisting}
          onGenerate={handleGenerateCategory}
        />
      )}

      {selectedCat && hasMatches && (
        <div className="space-y-2.5">
          {tournamentId && (
            <div className="flex justify-end">
              <button onClick={() => handleDeleteDraw(selectedCat)} disabled={persisting}
                className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 font-semibold disabled:opacity-50">
                Delete this draw
              </button>
            </div>
          )}
          {displayMatches.map((match) => (
            <div key={match.id} className={`bg-white rounded-xl border p-4 ${
              match.status === 'in_progress' ? 'border-emerald-200' : 'border-stone-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[match.category]}`}>
                      {CATEGORY_LABELS[match.category]}
                    </span>
                    <span className="text-xs text-stone-400">{match.roundName}</span>
                    <StatusBadge status={match.status} />
                  </div>
                  <p className="font-semibold text-stone-900">
                    {match.isBye ? (
                      <>{match.player1Name} <span className="text-stone-400 font-normal text-sm">(bye, advances automatically)</span></>
                    ) : (
                      <>{match.player1Name} <span className="text-stone-300 font-normal">vs</span> {match.player2Name}</>
                    )}
                  </p>
                  {!match.isBye && match.sets.length > 0 && (
                    <p className="text-sm text-stone-500 mt-1">
                      {match.sets.map((s) => `${s.player1Score}–${s.player2Score}`).join(', ')}
                      {match.winnerName && <> · <strong className="text-orange-600">{match.winnerName}</strong></>}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {tournamentId && !match.isBye && (match.status !== 'upcoming' || match.sets.length > 0) && (
                    <button onClick={() => handleUndoResult(match)} disabled={busyId === match.id}
                      className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                      {match.status === 'completed' ? 'Undo result' : 'Clear score'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function SeedBuilder({ category, players, persisting, onGenerate }: {
  category: Category;
  players: Participant[];
  persisting: boolean;
  onGenerate: (category: Category, orderedIds: string[], byeIds: string[]) => void;
}) {
  const [mode, setMode] = useState<'random' | 'manual' | 'seed'>('random');
  const [seedOrder, setSeedOrder] = useState<Participant[]>(players);
  const [byeIds, setByeIds] = useState<Set<string>>(new Set());

  const requiredByes = players.length >= 2 ? firstRoundByes(players.length) : 0;
  const byeCountValid = byeIds.size === requiredByes;
  const canGenerate = players.length >= 2 && byeCountValid;

  const toggleBye = (id: string) => {
    setByeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
      <h3 className="text-sm font-bold text-stone-800 mb-1">Set Round 1 seeding — {CATEGORY_LABELS[category]}</h3>
      {players.length < 2 ? (
        <p className="text-sm text-stone-400 mt-2">Need at least 2 approved participants in this category.</p>
      ) : (
        <>
          <div className="inline-flex rounded-lg border border-stone-200 p-0.5 mb-4 bg-stone-50">
            {([['random', 'Random draw 🎲'], ['manual', 'Pick who plays whom'], ['seed', 'Drag to seed']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === m ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'random' && (
            <RandomDraw category={category} players={players} byes={requiredByes} persisting={persisting} onGenerate={onGenerate} />
          )}

          {mode === 'manual' && (
            <ManualPairing category={category} players={players} persisting={persisting} onGenerate={onGenerate} />
          )}

          {mode === 'seed' && (<>
          <p className="text-stone-400 text-sm mb-4">
            Drag to set the order, then flag byes for any players skipping Round 1. Remaining players pair up 1v2, 3v4, etc.
          </p>
          <Reorder.Group axis="y" values={seedOrder} onReorder={setSeedOrder} className="space-y-2">
            {seedOrder.map((p, i) => (
              <Reorder.Item
                key={p.id}
                value={p}
                className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing"
              >
                <span className="text-stone-300 select-none" aria-hidden>⠿</span>
                <span className="text-xs font-mono text-stone-400 w-5">{i + 1}</span>
                <span className="flex-1 font-medium text-stone-900 text-sm">{entryLabel(p.fullName, p.partnerName, category)}</span>
                <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={byeIds.has(p.id)}
                    onChange={() => toggleBye(p.id)}
                    className="w-3.5 h-3.5 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                  />
                  Bye
                </label>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <div className="flex items-center justify-between mt-4">
            <p className={`text-xs ${byeCountValid ? 'text-stone-400' : 'text-amber-600'}`}>
              {requiredByes === 0
                ? 'No byes needed for this category.'
                : `Flag ${requiredByes} player${requiredByes > 1 ? 's' : ''} for a bye to continue (${byeIds.size}/${requiredByes} flagged).`}
            </p>
            <button
              disabled={!canGenerate || persisting}
              onClick={() => onGenerate(category, seedOrder.map((p) => p.id), Array.from(byeIds))}
              className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
            >
              {persisting ? 'Generating…' : 'Generate Round 1'}
            </button>
          </div>
          </>)}
        </>
      )}
    </div>
  );
}

// Fair shuffle using the browser's secure random numbers
function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  const r = new Uint32Array(a.length);
  crypto.getRandomValues(r);
  for (let i = a.length - 1; i > 0; i--) {
    const j = r[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Names tumble for a moment, then land: the first ones out get the byes, the rest pair off in order.
// Nothing is saved until "Use this draw", so it can be rolled again in front of everyone.
function RandomDraw({ category, players, byes, persisting, onGenerate }: {
  category: Category;
  players: Participant[];
  byes: number;
  persisting: boolean;
  onGenerate: (category: Category, orderedIds: string[], byeIds: string[]) => void;
}) {
  const [order, setOrder] = useState<Participant[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [tumble, setTumble] = useState<Participant[]>(players);

  const roll = () => {
    setRolling(true);
    setOrder(null);
    const spin = setInterval(() => setTumble(shuffled(players)), 90);
    setTimeout(() => {
      clearInterval(spin);
      setOrder(shuffled(players));
      setRolling(false);
    }, 1800);
  };

  const label = (p: Participant) => entryLabel(p.fullName, p.partnerName, category);
  const byePlayers = order?.slice(0, byes) ?? [];
  const rest = order?.slice(byes) ?? [];
  const pairs: [Participant, Participant][] = [];
  for (let i = 0; i + 1 < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);

  return (
    <div>
      <p className="text-stone-400 text-sm mb-4">
        {players.length} entries{byes ? ', so 1 bye (straight to round 2)' : ', no byes in round 1'}. Later, when a round has an odd number of winners, the last one waits a round. Roll to draw Round 1 at random.
      </p>

      {rolling && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 mb-4 overflow-hidden">
          <div className="text-3xl mb-2 inline-block animate-spin">🎲</div>
          <div className="flex flex-wrap gap-1.5">
            {tumble.map((p) => <span key={p.id} className="text-xs bg-white border border-orange-200 rounded-full px-2 py-1 text-stone-700">{label(p)}</span>)}
          </div>
        </div>
      )}

      {order && !rolling && (
        <div className="space-y-3 mb-4">
          {byePlayers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 mb-1.5">Byes</p>
              <div className="flex flex-wrap gap-1.5">
                {byePlayers.map((p) => <span key={p.id} className="text-sm bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-emerald-800">{label(p)}</span>)}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-stone-500 mb-1.5">Round 1</p>
            <div className="space-y-1.5">
              {pairs.map(([a, b], i) => (
                <div key={a.id} className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm">
                  <span className="text-xs font-mono text-stone-400 w-5">{i + 1}</span>
                  <span className="flex-1 font-medium text-stone-900">{label(a)}</span>
                  <span className="text-stone-300 text-xs">vs</span>
                  <span className="flex-1 font-medium text-stone-900 text-right">{label(b)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={roll} disabled={rolling || persisting}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50">
          {rolling ? 'Rolling…' : order ? 'Roll again' : 'Roll the dice 🎲'}
        </button>
        {order && !rolling && (
          <button
            disabled={persisting}
            onClick={() => { if (confirm('Use this draw? It is saved for good and can\'t be redrawn.')) onGenerate(category, order.map((p) => p.id), byePlayers.map((p) => p.id)); }}
            className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold"
          >
            {persisting ? 'Saving…' : 'Use this draw'}
          </button>
        )}
      </div>
    </div>
  );
}

// Organizer decides every Round 1 match by hand. Anyone left unpaired gets a bye.
function ManualPairing({ category, players, persisting, onGenerate }: {
  category: Category;
  players: Participant[];
  persisting: boolean;
  onGenerate: (category: Category, orderedIds: string[], byeIds: string[]) => void;
}) {
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const requiredByes = firstRoundByes(players.length);
  const used = new Set(pairs.flat());
  const free = players.filter((p) => !used.has(p.id));
  const label = (p: Participant) => entryLabel(p.fullName, p.partnerName, category);
  const byName = (id: string) => { const p = players.find((x) => x.id === id); return p ? label(p) : ''; };
  const byesOk = free.length === requiredByes;

  const addPair = () => {
    if (!a || !b || a === b) return;
    setPairs((prev) => [...prev, [a, b]]);
    setA(''); setB('');
  };

  const generate = () => {
    const ordered = [...pairs.flat(), ...free.map((p) => p.id)];
    onGenerate(category, ordered, free.map((p) => p.id));
  };

  const selectCls = 'flex-1 min-w-0 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500';

  return (
    <div>
      <p className="text-stone-400 text-sm mb-4">
        Choose the two players for each Round 1 match. Players you leave out get a bye into Round 2.
      </p>

      {pairs.length > 0 && (
        <div className="space-y-2 mb-4">
          {pairs.map(([x, y], i) => (
            <div key={i} className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5">
              <span className="text-xs font-mono text-stone-400 w-14">Match {i + 1}</span>
              <span className="flex-1 text-sm font-medium text-stone-900 truncate">{byName(x)}</span>
              <span className="text-xs text-stone-400">vs</span>
              <span className="flex-1 text-sm font-medium text-stone-900 truncate text-right">{byName(y)}</span>
              <button onClick={() => setPairs((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-stone-300 hover:text-red-500 shrink-0">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {free.length >= 2 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select value={a} onChange={(e) => setA(e.target.value)} className={selectCls}>
            <option value="">Player 1…</option>
            {free.filter((p) => p.id !== b).map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
          <span className="hidden sm:block text-xs text-stone-400 self-center">vs</span>
          <select value={b} onChange={(e) => setB(e.target.value)} className={selectCls}>
            <option value="">Player 2…</option>
            {free.filter((p) => p.id !== a).map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
          <button
            onClick={addPair}
            disabled={!a || !b}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          >
            Add match
          </button>
        </div>
      )}

      {free.length > 0 && (
        <p className="text-xs text-stone-400 mb-4">
          Not yet placed ({free.length}): {free.map(label).join(', ')}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className={`text-xs ${byesOk ? 'text-stone-400' : 'text-amber-600'}`}>
          {byesOk
            ? (free.length === 0 ? 'Everyone is placed.' : `${free.length} player${free.length > 1 ? 's' : ''} will get a bye.`)
            : `This draw needs exactly ${requiredByes} bye${requiredByes === 1 ? '' : 's'}, so leave ${requiredByes} player${requiredByes === 1 ? '' : 's'} unpaired (${free.length} left now).`}
        </p>
        <div className="flex gap-2">
          {pairs.length > 0 && (
            <button onClick={() => setPairs([])} className="px-3 py-2 rounded-lg text-xs font-semibold text-stone-500 border border-stone-200 hover:bg-stone-50">
              Clear
            </button>
          )}
          <button
            disabled={!byesOk || pairs.length === 0 || persisting}
            onClick={generate}
            className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
          >
            {persisting ? 'Saving…' : 'Create Round 1'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Done</span>;
  if (status === 'in_progress') return (
    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
    </span>
  );
  return <span className="text-xs bg-stone-50 text-stone-400 border border-stone-200 px-2 py-0.5 rounded-full">Upcoming</span>;
}
