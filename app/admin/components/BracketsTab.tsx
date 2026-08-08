'use client';

import { useState, useEffect } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category } from '../../tournament/types';

type Staff = { id: string; name: string; email: string; role: 'coach' | 'admin'; status: 'invited' | 'active' };

export default function BracketsTab() {
  const { participants, matches, bracketGenerated, generateBrackets, courts, assignCourt, startMatch, updateScore, completeMatch, selectedCategories, tournamentId } = useTournamentStore();
  const [selectedCat, setSelectedCat] = useState<Category | 'all'>('all');
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

  const handleGenerateAndPersist = async () => {
    generateBrackets();
    if (!tournamentId) return; // legacy in-memory-only tournament, nothing to persist

    setPersisting(true);
    try {
      const generatedMatches = useTournamentStore.getState().matches;
      const res = await fetch('/api/tournament/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, matches: generatedMatches }),
      });
      const data = await res.json();
      if (data.matches) {
        // Replace in-memory match ids with real DB ids so scoring persists correctly
        const dbMatches = data.matches.map((dbM: any, i: number) => ({
          ...generatedMatches[i],
          id: dbM.id,
        }));
        useTournamentStore.setState({ matches: dbMatches });
      }
    } catch (err) {
      console.error('Failed to persist brackets:', err);
    } finally {
      setPersisting(false);
    }
  };

  const coaches = staff.filter((s) => s.role === 'coach' && s.status === 'active');
  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  const displayMatches = selectedCat === 'all' ? matches : matches.filter((m) => m.category === selectedCat);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Tournament Brackets</h2>
          <p className="text-stone-400 text-sm">{matches.length} matches generated</p>
        </div>
        {!bracketGenerated ? (
          <button
            disabled={persisting}
            onClick={() => {
              if (participants.length < 2) { alert('Need at least 2 participants to generate brackets.'); return; }
              if (confirm('Generate tournament brackets? This will create match fixtures based on current registrations.')) {
                handleGenerateAndPersist();
              }
            }}
            className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {persisting ? 'Generating…' : 'Generate Tournament'}
          </button>
        ) : (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-semibold">Brackets Ready</span>
        )}
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

      {bracketGenerated && (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCat === 'all' ? 'bg-[#111827] text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300'
              }`}>
              All
            </button>
            {categories.map((cat) => matches.filter((m) => m.category === cat).length > 0 && (
              <button key={cat} onClick={() => setSelectedCat(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCat === cat ? 'bg-[#111827] text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300'
                }`}>
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

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
        </>
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
