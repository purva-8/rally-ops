'use client';

import { useState, useEffect, useMemo } from 'react';
import { Reorder } from 'framer-motion';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category, Participant } from '../../tournament/types';
import { entryLabel } from '@/lib/categories';

type Staff = { id: string; name: string; email: string; role: 'coach' | 'admin'; status: 'invited' | 'active' };

function nextPowerOf2(n: number) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

export default function BracketsTab() {
  const { participants, matches, generateCategoryBracket, courts, assignCourt, startMatch, updateScore, completeMatch, selectedCategories, tournamentId } = useTournamentStore();
  const [selectedCat, setSelectedCat] = useState<Category | ''>('');
  const [assigningMatch, setAssigningMatch] = useState<string | null>(null);
  const [assignCourt2, setAssignCourt2] = useState('');
  const [assignReferee, setAssignReferee] = useState('');
  const [scoringMatch, setScoringMatch] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournament/staff?tournamentId=${tournamentId}`)
      .then((res) => res.json())
      .then((data) => setStaff(data.staff ?? []));
  }, [tournamentId]);

  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  const catPlayers = useMemo(
    () => (selectedCat ? participants.filter((p) => p.categories.includes(selectedCat)) : []),
    [participants, selectedCat]
  );

  const hasMatches = selectedCat ? matches.some((m) => m.category === selectedCat) : false;
  const coaches = staff.filter((s) => s.role === 'coach' && s.status === 'active');
  const displayMatches = selectedCat ? matches.filter((m) => m.category === selectedCat) : [];

  const handleGenerateCategory = async (category: Category, orderedIds: string[], byeIds: string[]) => {
    const beforeIds = new Set(matches.map((m) => m.id));
    generateCategoryBracket(category, orderedIds, byeIds);
    if (!tournamentId) return; // legacy in-memory-only tournament, nothing to persist

    setPersisting(true);
    try {
      const allMatches = useTournamentStore.getState().matches;
      const newMatches = allMatches.filter((m) => !beforeIds.has(m.id));
      const res = await fetch('/api/tournament/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matches: newMatches }),
      });
      const data = await res.json();
      if (data.matches) {
        // Replace in-memory match ids with real DB ids so scoring persists correctly
        const idMap = new Map(newMatches.map((m, i) => [m.id, data.matches[i]?.id]));
        useTournamentStore.setState((s) => ({
          matches: s.matches.map((m) => (idMap.has(m.id) ? { ...m, id: idMap.get(m.id)! } : m)),
        }));
      }
    } catch (err) {
      console.error('Failed to persist brackets:', err);
    } finally {
      setPersisting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Tournament Brackets</h2>
          <p className="text-stone-400 text-sm">{matches.length} matches generated</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {categories.map((cat) => {
          const count = participants.filter((p) => p.categories.includes(cat)).length;
          return (
            <div key={cat} className="bg-white rounded-xl border border-stone-200 p-3 text-center">
              <p className="text-2xl font-bold text-stone-900">{count}</p>
              <p className="text-xs text-stone-400 mt-1">{CATEGORY_LABELS[cat]}</p>
              {count < 2 && <p className="text-xs text-amber-500 mt-1">Need 2+</p>}
            </div>
          );
        })}
      </div>

      <div className="mb-6">
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
          <p>Pick a category above to build or view its bracket.</p>
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
                  {match.courtId && (
                    <p className="text-xs text-stone-400 mt-1">
                      {courts.find((c) => c.id === match.courtId)?.name}{match.refereeName ? ` · ${match.refereeName}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {match.status === 'upcoming' && !match.courtId && (
                    <button onClick={() => { setAssigningMatch(match.id); setAssignCourt2(''); setAssignReferee(''); }}
                      className="text-xs border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors">
                      Assign Court
                    </button>
                  )}
                  {match.status === 'upcoming' && match.courtId && (
                    <button onClick={() => startMatch(match.id)}
                      className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-500 transition-colors font-semibold">
                      Start Match
                    </button>
                  )}
                  {match.status === 'in_progress' && (
                    <button onClick={() => setScoringMatch(match.id)}
                      className="text-xs bg-[#111827] text-white px-3 py-1.5 rounded-lg hover:bg-[#1F2937] transition-colors font-semibold">
                      Enter Scores
                    </button>
                  )}
                </div>
              </div>

              {assigningMatch === match.id && (
                <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Court</label>
                    <select value={assignCourt2} onChange={(e) => setAssignCourt2(e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                      <option value="">Select court</option>
                      {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Referee</label>
                    <select value={assignReferee} onChange={(e) => setAssignReferee(e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                      <option value="">Select referee</option>
                      {coaches.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      if (!assignCourt2 || !assignReferee) return;
                      const referee = coaches.find((u) => u.id === assignReferee);
                      assignCourt(match.id, assignCourt2, assignReferee, referee?.name || '');
                      setAssigningMatch(null);
                    }}
                    className="bg-[#111827] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#1F2937] transition-colors">
                    Assign
                  </button>
                  <button onClick={() => setAssigningMatch(null)} className="text-stone-400 text-sm hover:text-stone-600">Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {scoringMatch && (
        <ScoreModal
          matchId={scoringMatch}
          match={matches.find((m) => m.id === scoringMatch)!}
          onSave={(sets) => { updateScore(scoringMatch, sets); setScoringMatch(null); }}
          onComplete={(sets) => { updateScore(scoringMatch, sets); completeMatch(scoringMatch); setScoringMatch(null); }}
          onClose={() => setScoringMatch(null)}
        />
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
  const [mode, setMode] = useState<'manual' | 'seed'>('manual');
  const [seedOrder, setSeedOrder] = useState<Participant[]>(players);
  const [byeIds, setByeIds] = useState<Set<string>>(new Set());

  const size = players.length >= 2 ? nextPowerOf2(players.length) : 0;
  const requiredByes = size - players.length;
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
            {([['manual', 'Pick who plays whom'], ['seed', 'Drag to seed']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === m ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}
              >
                {label}
              </button>
            ))}
          </div>

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

  const size = nextPowerOf2(players.length);
  const requiredByes = size - players.length;
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

function ScoreModal({ matchId, match, onSave, onComplete, onClose }: {
  matchId: string;
  match: any;
  onSave: (sets: any[]) => void;
  onComplete: (sets: any[]) => void;
  onClose: () => void;
}) {
  const [sets, setSets] = useState(match.sets.length > 0 ? match.sets : [{ player1Score: 0, player2Score: 0 }]);

  const updateSet = (i: number, field: 'player1Score' | 'player2Score', val: number) => {
    setSets((prev: any[]) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-stone-900">Enter Scores</h3>
          <button onClick={onClose} className="text-stone-300 hover:text-stone-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-5">{match.player1Name} vs {match.player2Name}</p>

        <div className="space-y-3">
          {sets.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-stone-400 w-10">Set {i + 1}</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <p className="text-xs text-stone-400 mb-1 truncate">{match.player1Name}</p>
                  <input type="number" min={0} max={30} value={s.player1Score}
                    onChange={(e) => updateSet(i, 'player1Score', parseInt(e.target.value) || 0)}
                    className="w-full border border-stone-200 rounded-lg px-2 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50" />
                </div>
                <span className="text-stone-200 font-bold mt-5">-</span>
                <div className="flex-1">
                  <p className="text-xs text-stone-400 mb-1 truncate">{match.player2Name}</p>
                  <input type="number" min={0} max={30} value={s.player2Score}
                    onChange={(e) => updateSet(i, 'player2Score', parseInt(e.target.value) || 0)}
                    className="w-full border border-stone-200 rounded-lg px-2 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50" />
                </div>
              </div>
              {sets.length > 1 && (
                <button onClick={() => setSets((prev: any[]) => prev.filter((_, idx) => idx !== i))}
                  className="text-stone-300 hover:text-red-400 mt-5 text-sm">✕</button>
              )}
            </div>
          ))}
        </div>

        {sets.length < 3 && (
          <button onClick={() => setSets((prev: any[]) => [...prev, { player1Score: 0, player2Score: 0 }])}
            className="mt-3 text-xs text-orange-600 hover:text-orange-700 font-semibold">+ Add Set</button>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => onSave(sets)}
            className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-lg text-sm hover:bg-stone-50 font-medium transition-colors">
            Save Draft
          </button>
          <button onClick={() => onComplete(sets)}
            className="flex-1 bg-[#111827] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1F2937] transition-colors">
            Complete Match
          </button>
        </div>
      </div>
    </div>
  );
}
