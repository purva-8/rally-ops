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
  { id: 'participants', label: 'Participants' },
  { id: 'brackets',    label: 'Brackets' },
  { id: 'courts',      label: 'Courts' },
  { id: 'analytics',   label: 'Analytics' },
  { id: 'export',      label: 'Export' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('participants');
  const { isSetup, _hasHydrated, tournamentName, organizerName, eventDate, venue } = useTournamentStore();
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

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top nav */}
      <header className="bg-[#111827] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/rallyops" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black text-white">R</div>
            </a>
            <div className="w-px h-4 bg-white/10 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate leading-tight">{tournamentName}</p>
              {(organizerName || formattedDate || venue) && (
                <p className="text-white/30 text-[11px] truncate">
                  {[organizerName, venue, formattedDate].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SeedButton />
            <a
              href="/admin/registrations"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-white/10"
            >
              Registrations
            </a>
            <a
              href="/tournament"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Player Link
            </a>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'participants' && <ParticipantsTab />}
        {activeTab === 'brackets'    && <BracketsTab />}
        {activeTab === 'courts'      && <CourtsTab />}
        {activeTab === 'analytics'   && <AnalyticsTab />}
        {activeTab === 'export'      && <ExportTab />}
      </main>
    </div>
  );
}
