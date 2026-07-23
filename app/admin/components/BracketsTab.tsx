'use client';

import { useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category } from '../../tournament/types';

export default function BracketsTab() {
  const { participants, matches, bracketGenerated, generateBrackets, courts, users, assignCourt, startMatch, updateScore, completeMatch, selectedCategories } = useTournamentStore();
  const [selectedCat, setSelectedCat] = useState<Category | 'all'>('all');
  const [assigningMatch, setAssigningMatch] = useState<string | null>(null);
  const [assignCourt2, setAssignCourt2] = useState('');
  const [assignReferee, setAssignReferee] = useState('');
  const [scoringMatch, setScoringMatch] = useState<string | null>(null);

  const coaches = users.filter((u) => u.role === 'coach');
  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  const catCounts = categories.map((cat) => ({
    cat,
    count: participants.filter((p) => p.categories.includes(cat)).length,
  })).filter((c) => c.count >= 2);

  const displayMatches = selectedCat === 'all' ? matches : matches.filter((m) => m.category === selectedCat);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tournament Brackets</h2>
          <p className="text-gray-500 text-sm">{matches.length} matches generated</p>
        </div>
        {!bracketGenerated ? (
          <button
            onClick={() => {
              if (participants.length < 2) { alert('Need at least 2 participants to generate brackets.'); return; }
              if (confirm('Generate tournament brackets? This will create match fixtures based on current registrations.')) {
                generateBrackets();
              }
            }}
            className="bg-orange-700 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-800 transition-colors"
          >
            ⚡ Generate Tournament
          </button>
        ) : (
          <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg text-sm font-medium">✓ Brackets Generated</span>
        )}
      </div>

      {/* Category counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {categories.map((cat) => {
          const count = participants.filter((p) => p.categories.includes(cat)).length;
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{CATEGORY_LABELS[cat]}</p>
              {count < 2 && <p className="text-xs text-amber-500 mt-1">Need 2+ to play</p>}
            </div>
          );
        })}
      </div>

      {bracketGenerated && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCat === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              All Categories
            </button>
            {categories.map((cat) => matches.filter((m) => m.category === cat).length > 0 && (
              <button key={cat} onClick={() => setSelectedCat(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCat === cat ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {displayMatches.map((match) => (
              <div key={match.id} className={`bg-white rounded-xl border-2 p-4 ${
                match.status === 'in_progress' ? 'border-green-300' :
                match.status === 'completed' ? 'border-gray-200' : 'border-gray-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[match.category]}`}>
                        {CATEGORY_LABELS[match.category]}
                      </span>
                      <span className="text-xs text-gray-500">{match.roundName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        match.status === 'completed' ? 'bg-gray-100 text-gray-500' :
                        match.status === 'in_progress' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        {match.status === 'completed' ? '✓ Done' : match.status === 'in_progress' ? '● Live' : '⏳ Upcoming'}
                      </span>
                    </div>
                    <p className="font-medium text-gray-800">
                      {match.player1Name} <span className="text-gray-400">vs</span> {match.player2Name}
                    </p>
                    {match.sets.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Scores: {match.sets.map((s) => `${s.player1Score}–${s.player2Score}`).join(', ')}
                        {match.winnerName && <> · Winner: <strong className="text-orange-700">{match.winnerName}</strong></>}
                      </p>
                    )}
                    {match.courtId && (
                      <p className="text-xs text-gray-400 mt-1">
                        {courts.find((c) => c.id === match.courtId)?.name} · {match.refereeName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {match.status === 'upcoming' && (
                      <>
                        {!match.courtId && (
                          <button onClick={() => { setAssigningMatch(match.id); setAssignCourt2(''); setAssignReferee(''); }}
                            className="text-sm border border-orange-300 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                            Assign Court
                          </button>
                        )}
                        {match.courtId && (
                          <button onClick={() => startMatch(match.id)}
                            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors">
                            ▶ Start Match
                          </button>
                        )}
                      </>
                    )}
                    {match.status === 'in_progress' && (
                      <button onClick={() => setScoringMatch(match.id)}
                        className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors">
                        Enter Scores
                      </button>
                    )}
                  </div>
                </div>

                {/* Assign court inline */}
                {assigningMatch === match.id && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Court</label>
                      <select value={assignCourt2} onChange={(e) => setAssignCourt2(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="">Select court</option>
                        {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Referee</label>
                      <select value={assignReferee} onChange={(e) => setAssignReferee(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
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
                      className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-orange-700 transition-colors">
                      Assign
                    </button>
                    <button onClick={() => setAssigningMatch(null)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Score entry modal */}
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
          <h3 className="text-lg font-bold text-gray-800">Enter Scores</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{match.player1Name} vs {match.player2Name}</p>

        <div className="space-y-3">
          {sets.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 w-12">Set {i + 1}</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1 truncate">{match.player1Name}</p>
                  <input type="number" min={0} max={30} value={s.player1Score}
                    onChange={(e) => updateSet(i, 'player1Score', parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <span className="text-gray-400 font-bold mt-5">—</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1 truncate">{match.player2Name}</p>
                  <input type="number" min={0} max={30} value={s.player2Score}
                    onChange={(e) => updateSet(i, 'player2Score', parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              {sets.length > 1 && (
                <button onClick={() => setSets((prev: any[]) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 mt-5 text-sm">✕</button>
              )}
            </div>
          ))}
        </div>

        {sets.length < 3 && (
          <button onClick={() => setSets((prev: any[]) => [...prev, { player1Score: 0, player2Score: 0 }])}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800">+ Add Set</button>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => onSave(sets)}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            Save Draft
          </button>
          <button onClick={() => onComplete(sets)}
            className="flex-1 bg-orange-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-800">
            ✓ Complete Match
          </button>
        </div>
      </div>
    </div>
  );
}
