'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconMapPin, IconCalendar, IconClock, IconUsers, IconChevronRight } from '@/components/icons';
import { CATEGORY_LABELS as SHARED_CATEGORY_LABELS, feeLabel } from '@/lib/categories';
import { formatDate } from '@/lib/format';

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
  eligibility: string;
  rules: string;
  max_participants?: number;
  created_by: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  ...SHARED_CATEGORY_LABELS,
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
  boys_u13: 'Boys U13',
  boys_u15: 'Boys U15',
  boys_u18: 'Boys U18',
  girls_u13: 'Girls U13',
  girls_u15: 'Girls U15',
  girls_u18: 'Girls U18',
};

const STATUS_CONFIG = {
  open:      { label: 'Registering',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  upcoming:  { label: 'Upcoming',     cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  live:      { label: 'Live Now',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  completed: { label: 'Completed',    cls: 'bg-stone-50 text-stone-500 border-stone-200' },
};

const SPORT_LABEL = 'Badminton';

function TournamentDetailPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [regCount, setRegCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('tournament_id', id).eq('status', 'approved'),
    ]).then(([{ data }, { count }]) => {
      setTournament(data);
      setRegCount(count ?? 0);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-white/20 text-sm">Loading...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-stone-600 text-sm">Tournament not found.</p>
          <Link href="/events" className="text-orange-600 text-sm mt-3 inline-block font-medium">← Back to events</Link>
        </div>
      </div>
    );
  }

  const isOpen = tournament.status === 'open';
  const scfg = STATUS_CONFIG[tournament.status];
  const eventDate = tournament.event_date
    ? formatDate(tournament.event_date)
    : null;
  const closeDate = tournament.registration_close_at
    ? formatDate(tournament.registration_close_at)
    : null;

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* Dark hero */}
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-10">
          <Link href="/events" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mb-6">
            ← Events
          </Link>

          {tournament.status === 'live' && (
            <Link href={`/events/${id}/results`} className="flex items-center gap-2 bg-orange-500/15 border border-orange-500/25 rounded-xl px-4 py-2.5 mb-5 w-fit hover:bg-orange-500/25 transition-colors">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-orange-200">Live · Matches in progress</span>
              <span className="text-xs text-orange-300/70">View results →</span>
            </Link>
          )}
          {tournament.status === 'completed' && (
            <Link href={`/events/${id}/results`} className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 mb-5 w-fit hover:bg-white/15 transition-colors">
              <span className="text-sm font-semibold text-white/80">View final results & champions →</span>
            </Link>
          )}

          <div className="flex items-start gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${scfg.cls}`}>
                  {scfg.label}
                </span>
                {tournament.sport && (
                  <span className="text-xs text-white/40 font-medium">{SPORT_LABEL}</span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight tracking-tight">{tournament.name}</h1>
            </div>
          </div>

          {/* Meta info bar */}
          <div className="grid grid-cols-1 gap-2">
            {tournament.venue && (
              <div className="flex items-center gap-2.5 text-sm text-white/50">
                <IconMapPin className="w-4 h-4 text-white/30 shrink-0" />
                {tournament.venue}
              </div>
            )}
            {eventDate && (
              <div className="flex items-center gap-2.5 text-sm text-white/50">
                <IconCalendar className="w-4 h-4 text-white/30 shrink-0" />
                {eventDate}
              </div>
            )}
            {closeDate && isOpen && (
              <div className="flex items-center gap-2.5 text-sm text-orange-300/80 font-medium">
                <IconClock className="w-4 h-4 text-orange-400/60 shrink-0" />
                Registration closes {closeDate}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-32">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { label: 'Entry Fee', value: feeLabel(tournament.categories, tournament.entry_fee) },
            { label: 'Categories', value: String(tournament.categories?.length ?? 0) },
            { label: 'Registered', value: String(regCount) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 text-center">
              <div className="text-lg font-extrabold text-stone-900">{value}</div>
              <div className="text-[11px] text-stone-400 mt-0.5 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* Categories, eligibility and rules as three dropdowns */}
        {[
          {
            key: 'categories',
            title: `Categories${(tournament.categories?.length ?? 0) > 0 ? ` (${tournament.categories.length})` : ''}`,
            show: (tournament.categories?.length ?? 0) > 0,
            body: (
              <ul className="space-y-2">
                {tournament.categories.map((cat) => (
                  <li key={cat} className="flex items-start gap-2.5 text-sm text-stone-700">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0 mt-2" />
                    {CATEGORY_LABELS[cat] ?? cat}
                  </li>
                ))}
              </ul>
            ),
          },
          {
            key: 'eligibility',
            title: 'Eligibility',
            show: !!tournament.eligibility,
            body: (
              <div className="space-y-2.5">
                {(tournament.eligibility ?? '').split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm text-stone-600 leading-relaxed">{line}</p>
                ))}
              </div>
            ),
          },
          {
            key: 'rules',
            title: 'Rules',
            show: !!tournament.rules,
            body: (
              <div className="space-y-2.5">
                {(tournament.rules ?? '').split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm text-stone-600 leading-relaxed">{line}</p>
                ))}
              </div>
            ),
          },
        ].filter((x) => x.show).map((x) => (
          <details key={x.key} className="group bg-white rounded-2xl border border-stone-200 shadow-sm mb-3 overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-bold text-stone-800">{x.title}</span>
              <svg className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </summary>
            <div className="px-5 pb-5 pt-1 border-t border-stone-100">{x.body}</div>
          </details>
        ))}
      </main>

      {/* Sticky CTA — sits above bottom nav */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 z-30">
        <div className="max-w-2xl mx-auto">
          {isOpen ? (
            <button
              onClick={() => router.push(profileId ? `/events/${id}/register?profileId=${profileId}` : `/events/${id}/register`)}
              className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white py-4 rounded-2xl font-bold text-base transition-colors shadow-xl shadow-orange-900/20"
            >
              Register for this Tournament
              <IconChevronRight className="inline ml-1 w-4 h-4 -mt-0.5" />
            </button>
          ) : (
            <div className="w-full bg-white border border-stone-200 text-stone-400 py-4 rounded-2xl font-medium text-base text-center text-sm">
              {tournament.status === 'completed' ? 'This tournament has ended' : 'Registration not yet open'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TournamentDetailPage() {
  return (
    <Suspense fallback={null}>
      <TournamentDetailPageInner />
    </Suspense>
  );
}
