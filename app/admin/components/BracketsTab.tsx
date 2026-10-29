'use client';

import { useMemo, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category, Match } from '../../tournament/types';
import { entryLabel, isDoublesCategory, sortCategories } from '@/lib/categories';
import { undoResult } from './undo';
import MatchMaker from './MatchMaker';


export default function BracketsTab() {
  const { participants, matches, selectedCategories, tournamentId, saveError, clearSaveError, loadMatches } = useTournamentStore();
  const [selectedCat, setSelectedCat] = useState<Category | ''>('');
  const [persisting, setPersisting] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // The last deleted draw, kept so it can be put back; dropped once a new draw is made for that category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows exactly as the server returned them
  const [deletedDraw, setDeletedDraw] = useState<{ category: Category; matches: any[]; sets: any[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categories: Category[] = selectedCategories.length > 0 ? sortCategories(selectedCategories) : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  const hasMatches = selectedCat ? matches.some((m) => m.category === selectedCat) : false;
  // Every entry, by category, under the name matches use ("A / B" for a doubles pair)
  const names = useMemo(() => {
    const byCat = new Map<string, { id: string; label: string }[]>();
    for (const p of participants) for (const c of p.categories) byCat.set(c, [...(byCat.get(c) ?? []), { id: p.id, label: entryLabel(p.fullName, p.partnerName, c) }]);
    return byCat;
  }, [participants]);
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
          <p className="text-stone-400 text-sm">{matches.length} matches. Pick a category to make its first matches as players arrive; winners are paired up on the Score desk.</p>
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

      {selectedCat && tournamentId && (
        <MatchMaker mode="first" category={selectedCat} tournamentId={tournamentId} names={names} matches={matches}
          onMade={async (msg) => { setNote({ ok: true, text: msg }); await reload(); }} />
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Done</span>;
  if (status === 'in_progress') return (
    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
    </span>
  );
  return <span className="text-xs bg-stone-50 text-stone-400 border border-stone-200 px-2 py-0.5 rounded-full">Upcoming</span>;
}
