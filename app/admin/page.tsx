'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import EntriesTab from './components/EntriesTab';
import BracketsTab from './components/BracketsTab';
import CourtsTab from './components/CourtsTab';
import ExportTab from './components/ExportTab';
import AnalyticsTab from './components/AnalyticsTab';
import { useTournamentStore } from '../tournament/store';
import { formatDate } from '@/lib/format';

const TABS = [
  { id: 'entries',   label: 'Entries' },
  { id: 'brackets',  label: 'Brackets' },
  { id: 'courts',    label: 'Courts' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'export',    label: 'Export' },
];

function AdminPageInner() {
  const [activeTab, setActiveTab] = useState('entries');
  const { isSetup, _hasHydrated, tournamentName, organizerName, eventDate, venue, loadParticipants, loadMatches, setTournamentId, tournamentId } = useTournamentStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dbTournamentId = searchParams.get('tournamentId');
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [notifyState, setNotifyState] = useState<'idle' | 'sending' | string>('idle');

  useEffect(() => {
    if (!_hasHydrated) return;
    if (dbTournamentId) return; // ownership check below handles this case
    if (!isSetup) { router.replace('/rallyops'); return; }
    const { managerPassword } = useTournamentStore.getState();
    if (managerPassword && !sessionStorage.getItem('rally-unlocked')) {
      router.replace('/rallyops');
    }
  }, [_hasHydrated, isSetup, router, dbTournamentId]);

  useEffect(() => {
    if (!dbTournamentId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace(`/login?redirect=/admin?tournamentId=${dbTournamentId}`); return; }
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('created_by, name, venue, event_date, registration_close_at, categories')
        .eq('id', dbTournamentId)
        .single();
      if (!tournament || tournament.created_by !== user.id) { router.replace('/events'); return; }
      // Always start from this tournament's own data, never whatever the browser held before
      if (useTournamentStore.getState().tournamentId !== dbTournamentId) useTournamentStore.getState().reset();
      useTournamentStore.setState({
        isSetup: true,
        sport: 'badminton',
        tournamentName: tournament.name,
        venue: tournament.venue ?? '',
        eventDate: tournament.event_date ?? '',
        registrationDeadline: tournament.registration_close_at ?? '',
        selectedCategories: (tournament.categories ?? []) as never,
      });
      setAuthorized(true);
      setAuthChecked(true);
    });
  }, [dbTournamentId, router]);

  useEffect(() => {
    if (!dbTournamentId || !authorized) return;
    setTournamentId(dbTournamentId);
    fetch(`/api/tournament/registrations?tournamentId=${dbTournamentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.participants) loadParticipants(data.participants);
      });
    fetch(`/api/tournament/matches?tournamentId=${dbTournamentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.matches) loadMatches(data.matches);
      })
      .catch((err) => console.error('Failed to load registrations:', err));
  }, [dbTournamentId, authorized, setTournamentId, loadParticipants, loadMatches]);

  if (!_hasHydrated) return null;
  if (dbTournamentId && !authChecked) return null;
  if (!isSetup && !dbTournamentId) return null;

  const formattedDate = eventDate
    ? formatDate(eventDate)
    : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top nav */}
      <header className="bg-[#111827] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/rallyops" className="flex items-center gap-2 shrink-0">
              <img src="/logo.png" alt="RallyOps" className="h-14 w-auto object-contain" />
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
            {dbTournamentId && (
              <button
                onClick={async () => {
                  setNotifyState('sending');
                  try {
                    const res = await fetch('/api/tournament/notify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tournamentId: dbTournamentId }),
                    });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.error ?? 'Failed');
                    const sent = d.decisions + d.fixtures + d.results;
                    setNotifyState(`${sent} sent${d.failed ? `, ${d.failed} failed` : ''}`);
                  } catch (e) {
                    setNotifyState(e instanceof Error ? e.message : 'Failed');
                  }
                  setTimeout(() => setNotifyState('idle'), 5000);
                }}
                disabled={notifyState === 'sending'}
                className="text-xs font-medium bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                title="Email players their approval decisions, fixtures and results now instead of waiting for the daily run"
              >
                {notifyState === 'idle' ? 'Send updates' : notifyState === 'sending' ? 'Sending...' : notifyState}
              </button>
            )}
            <button
              onClick={() => {
                const link = dbTournamentId
                  ? `${window.location.origin}/events/${dbTournamentId}`
                  : `${window.location.origin}/tournament`;
                navigator.clipboard.writeText(link);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {linkCopied ? 'Link copied!' : 'Player Link'}
            </button>
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
        {activeTab === 'entries'     && <EntriesTab />}
        {activeTab === 'brackets'    && <BracketsTab />}
        {activeTab === 'courts'      && <CourtsTab />}
        {activeTab === 'analytics'   && <AnalyticsTab />}
        {activeTab === 'export'      && <ExportTab />}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  );
}
