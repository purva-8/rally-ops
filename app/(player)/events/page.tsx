'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconMapPin, IconCalendar, IconClock, IconUsers } from '@/components/icons';

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
};

const STATUS_CONFIG = {
  open:      { label: 'Registering', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'border-l-emerald-500' },
  upcoming:  { label: 'Upcoming',    dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700 border-sky-200',         bar: 'border-l-sky-400'   },
  live:      { label: 'Live Now',    dot: 'bg-orange-500',  badge: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'border-l-orange-500'},
  completed: { label: 'Completed',   dot: 'bg-stone-400',   badge: 'bg-stone-50 text-stone-500 border-stone-200',    bar: 'border-l-stone-300' },
};

const SPORT_LABEL: Record<string, string> = {
  badminton:     'Badminton',
  tennis:        'Tennis',
  squash:        'Squash',
  'table tennis':'Table Tennis',
  pickleball:    'Pickleball',
};

const FILTERS = ['all', 'open', 'live', 'upcoming', 'completed'] as const;
type Filter = typeof FILTERS[number];
const FILTER_LABELS: Record<Filter, string> = { all: 'All', open: 'Registering', live: 'Live', upcoming: 'Upcoming', completed: 'Completed' };

export default function EventsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    createClient()
      .from('tournaments')
      .select('*')
      .order('event_date', { ascending: true })
      .then(({ data }) => { setTournaments(data ?? []); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? tournaments : tournaments.filter((t) => t.status === filter);
  const openCount = tournaments.filter((t) => t.status === 'open').length;
  const liveCount = tournaments.filter((t) => t.status === 'live').length;

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* Top nav */}
      <header className="bg-[#111827] text-white sticky top-0 z-20 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black">R</div>
            <span className="text-sm font-bold tracking-tight text-white">RallyOps</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/create-event" className="hidden sm:flex text-xs font-semibold text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-3.5 py-1.5 rounded-lg transition-colors mr-1">
              + Host
            </Link>
            <Link href="/login" className="text-xs text-white/60 hover:text-white px-3 py-2 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="text-xs bg-orange-600 hover:bg-orange-500 text-white font-semibold px-3.5 py-1.5 rounded-lg transition-colors">
              Join free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Tournaments</h1>
          <p className="text-sm text-white/50">Find events, register, and track your results</p>

          {(openCount > 0 || liveCount > 0) && (
            <div className="flex flex-wrap gap-2 mt-5">
              {openCount > 0 && (
                <button
                  onClick={() => setFilter('open')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-full hover:bg-emerald-500/25 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {openCount} open for registration
                </button>
              )}
              {liveCount > 0 && (
                <button
                  onClick={() => setFilter('live')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-orange-500/15 border border-orange-500/30 text-orange-300 px-3 py-1.5 rounded-full hover:bg-orange-500/25 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  {liveCount} live now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4">
        {/* Filter bar */}
        <div className="flex gap-2 overflow-x-auto py-4 -mx-4 px-4 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                filter === f
                  ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
              }`}
            >
              {FILTER_LABELS[f]}
              {f === 'live' && liveCount > 0 && filter !== 'live' && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse align-middle" />
              )}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 pb-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse">
                <div className="h-3 bg-stone-100 rounded w-16 mb-3" />
                <div className="h-5 bg-stone-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🏆</div>
            <p className="text-sm font-semibold text-stone-700">No events found</p>
            <p className="text-xs text-stone-400 mt-1">Check back soon for upcoming tournaments</p>
          </div>
        )}

        <div className="space-y-3 pb-10">
          {filtered.map((t) => {
            const cfg = STATUS_CONFIG[t.status];
            const isOpen = t.status === 'open';
            const dateStr = t.event_date
              ? new Date(t.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              : null;
            const closeStr = t.registration_close_at && isOpen
              ? new Date(t.registration_close_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : null;

            return (
              <Link
                key={t.id}
                href={`/events/${t.id}`}
                className={`block bg-white rounded-2xl border border-stone-200 border-l-4 ${cfg.bar} hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden`}
              >
                <div className="p-5">
                  {/* Status + sport row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                        {t.status === 'live' && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />}
                        {cfg.label}
                      </span>
                      {t.sport && (
                        <span className="text-[11px] text-stone-400 font-medium">{SPORT_LABEL[t.sport] ?? t.sport}</span>
                      )}
                    </div>
                    {t.entry_fee ? (
                      <span className="text-xs font-bold text-stone-800">{t.entry_fee} <span className="font-normal text-stone-400">entry</span></span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">Free</span>
                    )}
                  </div>

                  {/* Name */}
                  <h2 className="text-base font-bold text-stone-900 leading-snug mb-3">
                    {t.name}
                  </h2>

                  {/* Metadata */}
                  <div className="flex flex-col gap-1.5">
                    {t.venue && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <IconMapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        {t.venue}
                      </div>
                    )}
                    {dateStr && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <IconCalendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        {dateStr}
                      </div>
                    )}
                    {closeStr && (
                      <div className="flex items-center gap-2 text-xs text-orange-600 font-medium">
                        <IconClock className="w-3.5 h-3.5 shrink-0" />
                        Registration closes {closeStr}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                      <IconUsers className="w-3.5 h-3.5" />
                      {t.categories?.length ?? 0} {(t.categories?.length ?? 0) === 1 ? 'category' : 'categories'}
                    </div>
                    {isOpen && (
                      <span className="text-xs font-bold text-orange-600">
                        Register now →
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
