'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  eligibility: string;
  rules: string;
  max_participants?: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  male_singles:    'Male Singles',
  female_singles:  'Female Singles',
  male_doubles:    'Male Doubles',
  female_doubles:  'Female Doubles',
  spouse_doubles:  'Spouse Doubles',
};

const SPORT_ICONS: Record<string, string> = {
  badminton: '🏸',
  squash: '🎾',
  tennis: '🎾',
  'table tennis': '🏓',
  pickleball: '🏓',
};

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [regCount, setRegCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('registrations').select('id', { count: 'exact', head: true })
        .eq('tournament_id', id).eq('status', 'approved'),
    ]).then(([{ data }, { count }]) => {
      setTournament(data);
      setRegCount(count ?? 0);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-950 flex items-center justify-center">
        <div className="text-orange-300/60 text-sm">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500">Tournament not found.</p>
          <Link href="/events" className="text-orange-600 text-sm mt-2 inline-block">← Back to events</Link>
        </div>
      </div>
    );
  }

  const isOpen = tournament.status === 'open';
  const sportIcon = SPORT_ICONS[tournament.sport] ?? '🏆';
  const eventDate = tournament.event_date
    ? new Date(tournament.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const closeDate = tournament.registration_close_at
    ? new Date(tournament.registration_close_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Dark hero header */}
      <div className="bg-orange-950 text-white">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-10">
          <Link href="/events" className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-200 transition-colors mb-6">
            ← All Events
          </Link>

          {tournament.status === 'live' && (
            <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-xl px-4 py-2.5 mb-5 w-fit">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-orange-200">Live — matches in progress</span>
              <Link href="/tournament/brackets" className="ml-2 text-xs text-orange-400 hover:text-orange-200 underline">Watch →</Link>
            </div>
          )}

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-orange-900/60 border border-orange-800 rounded-2xl flex items-center justify-center text-2xl shrink-0">
              {sportIcon}
            </div>
            <div>
              <p className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-1">{tournament.sport}</p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">{tournament.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-orange-200/70">
                {tournament.venue && <span>📍 {tournament.venue}</span>}
                {eventDate && <span>📅 {eventDate}</span>}
                {closeDate && isOpen && <span>⏰ Registration closes {closeDate}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 -mt-4 pb-32">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center shadow-sm">
            <div className="text-xl font-bold text-orange-600">
              {tournament.entry_fee ? tournament.entry_fee : 'Free'}
            </div>
            <div className="text-xs text-stone-400 mt-1">Entry Fee</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center shadow-sm">
            <div className="text-xl font-bold text-stone-800">{tournament.categories?.length ?? 0}</div>
            <div className="text-xs text-stone-400 mt-1">Categories</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center shadow-sm">
            <div className="text-xl font-bold text-stone-800">{regCount}</div>
            <div className="text-xs text-stone-400 mt-1">Registered</div>
          </div>
        </div>

        {/* Categories */}
        <section className="bg-white rounded-2xl border border-stone-200 p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-bold text-stone-900 mb-3 uppercase tracking-wide">Categories</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tournament.categories?.map((cat) => (
              <div key={cat} className="bg-orange-50 rounded-xl px-4 py-3 text-sm font-medium text-orange-800 border border-orange-100 text-center">
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
            ))}
          </div>
        </section>

        {/* Eligibility */}
        {tournament.eligibility && (
          <section className="bg-white rounded-2xl border border-stone-200 p-5 mb-4 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900 mb-3 uppercase tracking-wide">Eligibility</h2>
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{tournament.eligibility}</p>
          </section>
        )}

        {/* Rules */}
        {tournament.rules && (
          <section className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 shadow-sm">
            <h2 className="text-sm font-bold text-stone-900 mb-3 uppercase tracking-wide">Rules</h2>
            <div className="space-y-3">
              {tournament.rules.split('\n').filter(Boolean).map((rule, i) => (
                <div key={i} className="flex gap-3 text-sm text-stone-600">
                  <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{rule.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 shadow-xl">
        <div className="max-w-3xl mx-auto">
          {isOpen ? (
            <button
              onClick={() => router.push(`/events/${id}/register`)}
              className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-orange-700 transition-colors shadow-sm"
            >
              Register for this Tournament →
            </button>
          ) : tournament.status === 'completed' ? (
            <div className="w-full bg-stone-100 text-stone-500 py-4 rounded-2xl font-medium text-base text-center">
              This tournament has ended
            </div>
          ) : (
            <div className="w-full bg-stone-100 text-stone-500 py-4 rounded-2xl font-medium text-base text-center">
              Registration not yet open
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
