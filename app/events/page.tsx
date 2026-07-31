'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Tournament = {
  id: string;
  name: string;
  sport: string;
  venue: string;
  event_date: string;
  registration_close_at: string;
  status: 'upcoming' | 'open' | 'live' | 'completed';
  entry_fee: number;
  categories: string[];
  cover_image_url?: string;
};

const STATUS_CONFIG = {
  open:      { label: 'Registration Open', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  upcoming:  { label: 'Upcoming',          color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  live:      { label: 'Live Now',          color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  completed: { label: 'Completed',         color: 'bg-stone-500/20 text-stone-400 border-stone-500/30' },
};

const FILTER_LABELS: Record<string, string> = {
  all: 'All Events',
  open: 'Open',
  live: 'Live Now',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

const SPORT_ICONS: Record<string, string> = {
  badminton: '🏸',
  squash: '🎾',
  tennis: '🎾',
  'table tennis': '🏓',
  pickleball: '🏓',
};

export default function EventsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('tournaments')
      .select('*')
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        setTournaments(data ?? []);
        setLoading(false);
      });
  }, []);

  const filters = ['all', 'open', 'live', 'upcoming', 'completed'];
  const filtered = activeFilter === 'all'
    ? tournaments
    : tournaments.filter((t) => t.status === activeFilter);

  const openCount = tournaments.filter((t) => t.status === 'open').length;
  const liveCount = tournaments.filter((t) => t.status === 'live').length;

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Top nav */}
      <header className="bg-orange-950 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🏸</span>
            <span className="text-sm font-bold tracking-widest uppercase text-orange-300">RallyOps</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-orange-300 hover:text-white transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-orange-500 hover:bg-orange-400 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              Join free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-orange-950 text-white pb-12 pt-10 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-2">Play &amp; Compete</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Find your next tournament</h1>
          <p className="text-orange-200/80 text-sm max-w-xl">
            Browse open registrations, track live matches, and compete across racquet sports — all in one place.
          </p>
          {(openCount > 0 || liveCount > 0) && (
            <div className="flex gap-3 mt-6">
              {openCount > 0 && (
                <button
                  onClick={() => setActiveFilter('open')}
                  className="flex items-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 text-sm font-medium px-4 py-2 rounded-full transition-colors"
                >
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  {openCount} open for registration
                </button>
              )}
              {liveCount > 0 && (
                <button
                  onClick={() => setActiveFilter('live')}
                  className="flex items-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 text-sm font-medium px-4 py-2 rounded-full transition-colors"
                >
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                  {liveCount} live now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 -mt-4">
        {/* Filter tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-1.5 mb-6 flex gap-1 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeFilter === f
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {FILTER_LABELS[f]}
              {f === 'live' && liveCount > 0 && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-6 animate-pulse">
                <div className="h-5 bg-stone-100 rounded w-2/3 mb-3" />
                <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />
                <div className="h-4 bg-stone-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-24 text-stone-400">
            <div className="text-5xl mb-4">🏸</div>
            <p className="text-lg font-medium text-stone-600">No events here</p>
            <p className="text-sm mt-1">Check back soon for upcoming tournaments.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 pb-12">
          {filtered.map((t) => {
            const cfg = STATUS_CONFIG[t.status];
            const icon = SPORT_ICONS[t.sport] ?? '🏆';
            const isOpen = t.status === 'open';
            return (
              <Link
                key={t.id}
                href={`/events/${t.id}`}
                className="bg-white rounded-2xl border border-stone-200 p-6 hover:border-orange-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-2xl border border-orange-100">
                    {icon}
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${cfg.color}`}>
                    {t.status === 'live' && (
                      <span className="inline-block w-1.5 h-1.5 bg-orange-400 rounded-full mr-1.5 animate-pulse" />
                    )}
                    {cfg.label}
                  </span>
                </div>

                <h2 className="text-base font-bold text-stone-900 mb-2 group-hover:text-orange-600 transition-colors leading-snug">
                  {t.name}
                </h2>

                <div className="space-y-1 text-xs text-stone-500 mb-4">
                  {t.venue && <p>📍 {t.venue}</p>}
                  {t.event_date && (
                    <p>📅 {new Date(t.event_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  )}
                  {t.registration_close_at && isOpen && (
                    <p>⏰ Closes {new Date(t.registration_close_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="text-xs text-stone-400">
                    {t.categories?.length ?? 0} categories
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-stone-700">
                      {t.entry_fee ? `Entry: ${t.entry_fee}` : 'Free entry'}
                    </span>
                    {isOpen && (
                      <span className="text-xs font-bold text-orange-600 group-hover:underline">
                        Register →
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
