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
    <main className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#111827] text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">R</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-stone-400 text-sm">{venue || 'Venue TBD'}</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <a href="/tournament" className="text-white font-semibold border-b border-orange-500 pb-0.5">Register</a>
            <a href="/tournament/brackets" className="text-stone-400 hover:text-white transition-colors">Brackets</a>
            <a href="/tournament/leaderboard" className="text-stone-400 hover:text-white transition-colors">Leaderboard</a>
          </nav>
        </div>
      </header>

      {registered ? (
        <div className="max-w-lg mx-auto mt-12 px-4 pb-24">
          <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-1">You&apos;re in!</h2>
            <p className="text-stone-500 mb-5">Welcome, <strong className="text-stone-700">{registered.name}</strong>. Your spot is confirmed.</p>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-1">Registration ID</p>
              <p className="text-3xl font-mono font-bold text-orange-700">{registered.id}</p>
              <p className="text-xs text-stone-400 mt-2">Save this ID. You may need it to check your match schedule.</p>
            </div>
            <div className="flex flex-col gap-3">
              <a href="/tournament/brackets"
                className="block bg-[#111827] text-white font-semibold py-3 rounded-xl hover:bg-[#1F2937] transition-colors">
                View Brackets
              </a>
              <a href="/tournament/leaderboard"
                className="block bg-stone-50 text-stone-700 font-semibold py-3 rounded-xl hover:bg-stone-100 transition-colors border border-stone-200">
                Leaderboard
              </a>
              <button
                onClick={() => setRegistered(null)}
                className="text-stone-400 text-sm hover:text-stone-600 transition-colors py-2">
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around py-3 text-xs">
        <a href="/tournament" className="flex flex-col items-center gap-1 text-orange-600">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Register
        </a>
        <a href="/tournament/brackets" className="flex flex-col items-center gap-1 text-stone-500">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          Brackets
        </a>
        <a href="/tournament/leaderboard" className="flex flex-col items-center gap-1 text-stone-500">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Leaders
        </a>
      </nav>
    </main>
  );
}
