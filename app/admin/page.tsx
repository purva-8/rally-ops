'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ParticipantsTab from './components/ParticipantsTab';
import BracketsTab from './components/BracketsTab';
import CourtsTab from './components/CourtsTab';
import ExportTab from './components/ExportTab';
import AnalyticsTab from './components/AnalyticsTab';
import SeedButton from './components/SeedButton';
import { useTournamentStore } from '../tournament/store';

const TABS = [
  { id: 'participants', label: 'Participants', icon: '👥' },
  { id: 'brackets', label: 'Brackets', icon: '🏆' },
  { id: 'courts', label: 'Courts', icon: '🏟️' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'export', label: 'Export', icon: '📤' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('participants');
  const { isSetup, _hasHydrated, tournamentName, organizerName } = useTournamentStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isSetup) { router.replace('/rallyops'); return; }
    const { managerPassword } = useTournamentStore.getState();
    if (managerPassword && !sessionStorage.getItem('rally-unlocked')) {
      router.replace('/rallyops');
    }
  }, [_hasHydrated, isSetup, router]);

  if (!_hasHydrated || !isSetup) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-orange-950 text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/rallyops" className="text-2xl hover:scale-110 transition-transform">🏸</a>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-orange-400 font-bold tracking-widest uppercase">RallyOps</span>
                <span className="text-orange-700 text-xs">·</span>
                <span className="text-xs text-gray-400">Badminton</span>
              </div>
              <h1 className="text-xl font-bold leading-tight">{tournamentName || 'Admin Dashboard'}</h1>
              {organizerName && <p className="text-orange-300 text-xs">{organizerName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SeedButton />
            <a href="/tournament"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium bg-orange-800 hover:bg-orange-700 text-orange-200 hover:text-white px-3 py-2 rounded-lg transition-colors border border-orange-700">
              <span>🔗</span> Player Link
            </a>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'participants' && <ParticipantsTab />}
        {activeTab === 'brackets' && <BracketsTab />}
        {activeTab === 'courts' && <CourtsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'export' && <ExportTab />}
      </div>

      <footer className="border-t border-gray-200 mt-8 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-500">RallyOps</span>
            <span>·</span>
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Support</a>
          </div>
          <a
            href="https://purvahk.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-orange-500 transition-colors"
          >
            Made with love, dedication & coffee by <span className="font-medium text-gray-500 hover:text-orange-500">Purva</span> ☕
          </a>
        </div>
      </footer>
    </main>
  );
}
