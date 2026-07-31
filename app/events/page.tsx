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
  open:      { label: 'Registration Open', color: 'bg-green-100 text-green-800 border-green-200' },
  upcoming:  { label: 'Upcoming',          color: 'bg-blue-100 text-blue-800 border-blue-200' },
  live:      { label: 'Live Now',          color: 'bg-orange-100 text-orange-800 border-orange-200' },
  completed: { label: 'Completed',         color: 'bg-stone-100 text-stone-600 border-stone-200' },
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

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-orange-600">RallyOps</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900">Sign in</Link>
            <Link href="/signup" className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Play & Compete</h1>
          <p className="text-stone-500">Find tournaments, register, and compete.</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors capitalize ${
                activeFilter === f
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
              }`}
            >
              {f === 'all' ? 'All Events' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG]?.label ?? f}
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
          <div className="text-center py-20 text-stone-400">
            <div className="text-5xl mb-4">🏸</div>
            <p className="text-lg font-medium">No events found</p>
            <p className="text-sm mt-1">Check back soon for upcoming tournaments.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
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
                  <div className="text-3xl">{icon}</div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${cfg.color}`}>
                    {t.status === 'live' && <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5 animate-pulse" />}
                    {cfg.label}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-stone-900 mb-1 group-hover:text-orange-600 transition-colors">
                  {t.name}
                </h2>

                <div className="space-y-1 text-sm text-stone-500 mb-4">
                  {t.venue && <p>📍 {t.venue}</p>}
                  {t.event_date && (
                    <p>📅 {new Date(t.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  )}
                  {t.registration_close_at && isOpen && (
                    <p>⏰ Registration closes {new Date(t.registration_close_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-stone-400">
                    {t.categories?.length} categories
                  </div>
                  <div className="text-sm font-semibold text-orange-600">
                    {t.entry_fee ? `Entry: ${t.entry_fee}` : 'Free entry'}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <span className="text-sm font-semibold text-orange-600 group-hover:underline">
                      Register now →
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
