'use client';

import { useTournamentStore } from '../store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import type { Category } from '../types';

export default function LeaderboardPage() {
  const { matches, tournamentName, bracketGenerated, selectedCategories } = useTournamentStore();

  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#111827] text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">R</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-stone-400 text-sm">Live Leaderboard</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-4 text-sm">
            <a href="/tournament" className="text-stone-400 hover:text-white">Register</a>
            <a href="/tournament/brackets" className="text-stone-400 hover:text-white">Brackets</a>
            <a href="/tournament/leaderboard" className="text-white font-semibold border-b border-orange-500 pb-0.5">Leaderboard</a>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 lg:pb-8">
        <div className="flex items-center gap-3 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Live Leaderboard</h2>
            <p className="text-stone-500">Updates automatically as matches complete</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>

        {!bracketGenerated ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-stone-200">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-stone-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z"/></svg>
            </div>
            <h3 className="text-xl font-bold text-stone-700">Tournament Not Started</h3>
            <p className="text-stone-400 mt-2">Brackets have not been generated yet. Check back soon!</p>
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
                <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-stone-200">
                  <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[cat]}`}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-stone-400 text-sm">Current: {currentRoundName}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-stone-500">
                      <span>{completed.length} done</span>
                      {inProgress.length > 0 && (
                        <span className="text-orange-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
                          {inProgress.length} live
                        </span>
                      )}
                      <span>{upcoming.length} upcoming</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    {inProgress.map((m) => (
                      <MatchRow key={m.id} match={m} type="in_progress" />
                    ))}
                    {completed.map((m) => (
                      <MatchRow key={m.id} match={m} type="completed" />
                    ))}
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around py-3 text-xs">
        <a href="/tournament" className="flex flex-col items-center gap-1 text-stone-500">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Register
        </a>
        <a href="/tournament/brackets" className="flex flex-col items-center gap-1 text-stone-500">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          Brackets
        </a>
        <a href="/tournament/leaderboard" className="flex flex-col items-center gap-1 text-orange-600">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Leaders
        </a>
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
      type === 'completed' ? 'bg-stone-50' : 'bg-white'
    }`}>
      {type === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-stone-400 flex-shrink-0" />}
      {type === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />}
      {type === 'upcoming' && <span className="w-1.5 h-1.5 rounded-full bg-stone-200 flex-shrink-0" />}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${match.winnerId === match.player1Id ? 'text-orange-700' : 'text-stone-700'}`}>
            {match.player1Name}
          </span>
          <span className="text-stone-400 text-xs">vs</span>
          <span className={`font-medium ${match.winnerId === match.player2Id ? 'text-orange-700' : 'text-stone-700'}`}>
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
      <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">{match.roundName}</span>
    </div>
  );
}
