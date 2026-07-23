'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RegistrationForm from './components/RegistrationForm';
import TournamentInfo from './components/TournamentInfo';
import { useTournamentStore } from './store';

export default function TournamentPage() {
  const [registered, setRegistered] = useState<{ id: string; name: string } | null>(null);
  const { isSetup, _hasHydrated, tournamentName, venue } = useTournamentStore();
  const router = useRouter();

  useEffect(() => {
    if (_hasHydrated && !isSetup) router.replace('/rallyops');
  }, [_hasHydrated, isSetup, router]);

  if (!_hasHydrated || !isSetup) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <header className="bg-orange-800 text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏸</span>
            <div>
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-orange-200 text-sm">{venue || 'Venue TBD'}</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <a href="/tournament" className="text-white font-semibold border-b border-orange-400 pb-0.5">Register</a>
            <a href="/tournament/brackets" className="text-orange-200 hover:text-white transition-colors">Brackets</a>
            <a href="/tournament/leaderboard" className="text-orange-200 hover:text-white transition-colors">Leaderboard</a>
          </nav>
        </div>
      </header>

      {registered ? (
        <div className="max-w-lg mx-auto mt-12 px-4 pb-24">
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">You&apos;re in!</h2>
            <p className="text-gray-500 mb-5">Welcome, <strong className="text-gray-700">{registered.name}</strong>. Your spot is confirmed.</p>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-1">Registration ID</p>
              <p className="text-3xl font-mono font-bold text-orange-700">{registered.id}</p>
              <p className="text-xs text-gray-400 mt-2">Save this ID — you may need it to check your match schedule.</p>
            </div>
            <div className="flex flex-col gap-3">
              <a href="/tournament/brackets"
                className="block bg-orange-700 text-white font-semibold py-3 rounded-xl hover:bg-orange-800 transition-colors">
                View Brackets
              </a>
              <a href="/tournament/leaderboard"
                className="block bg-orange-50 text-orange-700 font-semibold py-3 rounded-xl hover:bg-orange-100 transition-colors border border-orange-200">
                Leaderboard
              </a>
              <button
                onClick={() => setRegistered(null)}
                className="text-gray-400 text-sm hover:text-gray-600 transition-colors py-2">
                Register another participant
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TournamentInfo />
          <RegistrationForm onSuccess={(id, name) => setRegistered({ id, name })} />
        </div>
      )}

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 text-xs">
        <a href="/tournament" className="flex flex-col items-center gap-1 text-orange-700">
          <span className="text-lg">📝</span>Register
        </a>
        <a href="/tournament/brackets" className="flex flex-col items-center gap-1 text-gray-500">
          <span className="text-lg">🏆</span>Brackets
        </a>
        <a href="/tournament/leaderboard" className="flex flex-col items-center gap-1 text-gray-500">
          <span className="text-lg">📊</span>Leaders
        </a>
      </nav>
    </main>
  );
}
