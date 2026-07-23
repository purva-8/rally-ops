'use client';

import { useTournamentStore } from '../store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import type { Category } from '../types';

export default function LeaderboardPage() {
  const { matches, tournamentName, bracketGenerated, selectedCategories } = useTournamentStore();

  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <header className="bg-orange-800 text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏸</span>
            <div>
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-orange-200 text-sm">Live Leaderboard</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-4 text-sm">
            <a href="/tournament" className="text-orange-200 hover:text-white">Register</a>
            <a href="/tournament/brackets" className="text-orange-200 hover:text-white">Brackets</a>
            <a href="/tournament/leaderboard" className="text-white font-semibold border-b border-orange-400 pb-0.5">Leaderboard</a>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">📊</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Live Leaderboard</h2>
            <p className="text-gray-500">Updates automatically as matches complete</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-orange-700 bg-orange-100 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>

        {!bracketGenerated ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-md">
            <span className="text-6xl">🏆</span>
            <h3 className="text-xl font-bold text-gray-700 mt-4">Tournament Not Started</h3>
            <p className="text-gray-500 mt-2">Brackets have not been generated yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => {
              const catMatches = matches.filter((m) => m.category === cat);
              if (catMatches.length === 0) return null;

              const completed = catMatches.filter((m) => m.status === 'completed');
              const inProgress = catMatches.filter((m) => m.status === 'in_progress');
              const upcoming = catMatches.filter((m) => m.status === 'upcoming');
              const maxRound = Math.max(...catMatches.map((m) => m.round));
              const currentRoundName = catMatches.find((m) => m.round === maxRound)?.roundName || '';

              return (
                <div key={cat} className="bg-white rounded-2xl shadow-md overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat]}`}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-gray-500 text-sm">Current: {currentRoundName}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>✓ {completed.length} done</span>
                      {inProgress.length > 0 && <span className="text-orange-500">⚡ {inProgress.length} live</span>}
                      <span>⏳ {upcoming.length} upcoming</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    {/* In Progress */}
                    {inProgress.map((m) => (
                      <MatchRow key={m.id} match={m} type="in_progress" />
                    ))}
                    {/* Completed */}
                    {completed.map((m) => (
                      <MatchRow key={m.id} match={m} type="completed" />
                    ))}
                    {/* Upcoming */}
                    {upcoming.map((m) => (
                      <MatchRow key={m.id} match={m} type="upcoming" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 text-xs">
        <a href="/tournament" className="flex flex-col items-center gap-1 text-gray-500"><span className="text-lg">📝</span>Register</a>
        <a href="/tournament/brackets" className="flex flex-col items-center gap-1 text-gray-500"><span className="text-lg">🏆</span>Brackets</a>
        <a href="/tournament/leaderboard" className="flex flex-col items-center gap-1 text-orange-700"><span className="text-lg">📊</span>Leaders</a>
      </nav>
    </main>
  );
}

function MatchRow({ match, type }: { match: any; type: string }) {
  const scoreStr = match.sets.length > 0
    ? match.sets.map((s: any) => `${s.player1Score}-${s.player2Score}`).join(', ')
    : null;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${
      type === 'in_progress' ? 'bg-orange-50 border border-orange-200' :
      type === 'completed' ? 'bg-gray-50' : 'bg-white'
    }`}>
      {type === 'completed' && <span className="text-orange-500 text-base">✓</span>}
      {type === 'in_progress' && <span className="text-orange-500 text-base animate-pulse">⚡</span>}
      {type === 'upcoming' && <span className="text-gray-400 text-base">⏳</span>}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${match.winnerId === match.player1Id ? 'text-orange-700' : 'text-gray-700'}`}>
            {match.player1Name}
          </span>
          <span className="text-gray-400 text-xs">vs</span>
          <span className={`font-medium ${match.winnerId === match.player2Id ? 'text-orange-700' : 'text-gray-700'}`}>
            {match.player2Name}
          </span>
        </div>
        {type === 'completed' && match.winnerName && (
          <p className="text-xs text-orange-600 mt-0.5">Winner: <strong>{match.winnerName}</strong> {scoreStr && `(${scoreStr})`}</p>
        )}
        {type === 'in_progress' && scoreStr && (
          <p className="text-xs text-orange-600 mt-0.5">Live: {scoreStr}</p>
        )}
      </div>
      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{match.roundName}</span>
    </div>
  );
}
