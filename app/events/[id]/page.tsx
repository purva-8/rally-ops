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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500">Tournament not found.</p>
          <Link href="/events" className="text-orange-600 text-sm mt-2 inline-block">← Back to events</Link>
        </div>
      </div>
    );
  }

  const isOpen = tournament.status === 'open';
  const eventDate = tournament.event_date
    ? new Date(tournament.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const closeDate = tournament.registration_close_at
    ? new Date(tournament.registration_close_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/events" className="text-sm text-stone-500 hover:text-stone-900 flex items-center gap-1">
            ← All Events
          </Link>
          <Link href="/" className="text-sm font-bold text-orange-600">RallyOps</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Status badge */}
        {tournament.status === 'live' && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-6">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-orange-700">Tournament is Live — matches in progress</span>
            <Link href="/tournament/brackets" className="ml-auto text-sm text-orange-600 underline">Watch brackets →</Link>
          </div>
        )}

        {/* Title block */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-3">{tournament.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-stone-500">
            {tournament.venue && <span>📍 {tournament.venue}</span>}
            {eventDate && <span>📅 {eventDate}</span>}
            {closeDate && isOpen && <span>⏰ Registration closes {closeDate}</span>}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {tournament.entry_fee ? `QAR ${tournament.entry_fee}` : 'Free'}
            </div>
            <div className="text-xs text-stone-500 mt-1">Entry Fee</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <div className="text-2xl font-bold text-stone-800">{tournament.categories?.length ?? 0}</div>
            <div className="text-xs text-stone-500 mt-1">Categories</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <div className="text-2xl font-bold text-stone-800">{regCount}</div>
            <div className="text-xs text-stone-500 mt-1">Registered</div>
          </div>
        </div>

        {/* Categories */}
        <section className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
          <h2 className="text-base font-bold text-stone-900 mb-4">Categories</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tournament.categories?.map((cat) => (
              <div key={cat} className="bg-stone-50 rounded-xl px-4 py-3 text-sm font-medium text-stone-700 border border-stone-100">
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
            ))}
          </div>
        </section>

        {/* Eligibility */}
        {tournament.eligibility && (
          <section className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
            <h2 className="text-base font-bold text-stone-900 mb-3">Eligibility</h2>
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{tournament.eligibility}</p>
          </section>
        )}

        {/* Rules */}
        {tournament.rules && (
          <section className="bg-white rounded-2xl border border-stone-200 p-6 mb-8">
            <h2 className="text-base font-bold text-stone-900 mb-3">Rules</h2>
            <div className="space-y-2">
              {tournament.rules.split('\n').filter(Boolean).map((rule, i) => (
                <div key={i} className="flex gap-3 text-sm text-stone-600">
                  <span className="text-orange-500 font-bold shrink-0">{i + 1}.</span>
                  <span>{rule.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="sticky bottom-6">
          {isOpen ? (
            <button
              onClick={() => router.push(`/events/${id}/register`)}
              className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-orange-700 transition-colors shadow-lg"
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
      </main>
    </div>
  );
}
