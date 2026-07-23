'use client';

import { useTournamentStore } from '../store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import type { Category } from '../types';

export default function BracketsPage() {
  const { matches, bracketGenerated, tournamentName, selectedCategories } = useTournamentStore();

  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <header className="bg-orange-800 text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏸</span>
            <div>
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-orange-200 text-sm">Tournament Brackets</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-4 text-sm">
            <a href="/tournament" className="text-orange-200 hover:text-white">Register</a>
            <a href="/tournament/brackets" className="text-white font-semibold border-b border-orange-400 pb-0.5">Brackets</a>
            <a href="/tournament/leaderboard" className="text-orange-200 hover:text-white">Leaderboard</a>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">🏆</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tournament Brackets</h2>
            <p className="text-gray-500">Live bracket progression</p>
          </div>
        </div>

        {!bracketGenerated ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-md">
            <span className="text-6xl">🗂️</span>
            <h3 className="text-xl font-bold text-gray-700 mt-4">Brackets Not Generated Yet</h3>
            <p className="text-gray-500 mt-2">The tournament admin will generate brackets after registration closes.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => {
              const catMatches = matches.filter((m) => m.category === cat);
              if (catMatches.length === 0) return null;
              const maxRound = Math.max(...catMatches.map((m) => m.round));

              return (
                <div key={cat} className="bg-white rounded-2xl shadow-md overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                  </div>

                  <div className="p-4 overflow-x-auto">
                    <div className="flex gap-6 min-w-max">
                      {Array.from({ length: maxRound + 1 }, (_, r) => {
                        const roundMatches = catMatches.filter((m) => m.round === r);
                        if (roundMatches.length === 0) return null;
                        return (
                          <div key={r} className="flex flex-col gap-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                              {roundMatches[0]?.roundName}
                            </p>
                            {roundMatches.map((m) => (
                              <div key={m.id} className={`w-56 border-2 rounded-xl overflow-hidden ${
                                m.status === 'in_progress' ? 'border-orange-400' :
                                m.status === 'completed' ? 'border-orange-400' : 'border-gray-200'
                              }`}>
                                <div className={`flex items-center justify-between px-3 py-2 text-sm ${
                                  m.winnerId === m.player1Id ? 'bg-orange-50 font-semibold text-orange-800' : 'text-gray-700'
                                }`}>
                                  <span className="truncate">{m.player1Name}</span>
                                  {m.sets.length > 0 && (
                                    <span className="ml-2 text-xs font-mono">
                                      {m.sets.map((s) => s.player1Score).join(' ')}
                                    </span>
                                  )}
                                </div>
                                <div className="h-px bg-gray-100" />
                                <div className={`flex items-center justify-between px-3 py-2 text-sm ${
                                  m.winnerId === m.player2Id ? 'bg-orange-50 font-semibold text-orange-800' : 'text-gray-700'
                                }`}>
                                  <span className="truncate">{m.player2Name}</span>
                                  {m.sets.length > 0 && (
                                    <span className="ml-2 text-xs font-mono">
                                      {m.sets.map((s) => s.player2Score).join(' ')}
                                    </span>
                                  )}
                                </div>
                                <div className={`px-3 py-1 text-xs text-center font-medium ${
                                  m.status === 'completed' ? 'bg-orange-100 text-orange-700' :
                                  m.status === 'in_progress' ? 'bg-orange-100 text-orange-700' :
                                  'bg-gray-50 text-gray-500'
                                }`}>
                                  {m.status === 'completed' ? `✓ ${m.winnerName}` :
                                   m.status === 'in_progress' ? '⚡ In Progress' : '⏳ Upcoming'}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 text-xs">
        <a href="/tournament" className="flex flex-col items-center gap-1 text-gray-500"><span className="text-lg">📝</span>Register</a>
        <a href="/tournament/brackets" className="flex flex-col items-center gap-1 text-orange-700"><span className="text-lg">🏆</span>Brackets</a>
        <a href="/tournament/leaderboard" className="flex flex-col items-center gap-1 text-gray-500"><span className="text-lg">📊</span>Leaders</a>
      </nav>
    </main>
  );
}
