'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconCalendar, IconMapPin, IconChevronRight } from '@/components/icons';
import { formatDate } from '@/lib/format';

type HostedTournament = {
  id: string;
  name: string;
  venue: string;
  event_date: string;
  status: string;
  role: 'organizer' | 'coach';
  courtId: string | null;
};

export default function MyTournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<HostedTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/my-tournaments'); return; }

      const [{ data: owned }, { data: staffRows }] = await Promise.all([
        supabase.from('tournaments').select('id, name, venue, event_date, status').eq('created_by', user.id),
        supabase
          .from('tournament_staff')
          .select('role, court_id, tournaments ( id, name, venue, event_date, status )')
          .eq('user_id', user.id)
          .eq('status', 'active'),
      ]);

      // Admin staff (co-organizers) run the event just like its creator
      const coOrganized: HostedTournament[] = (staffRows ?? [])
        .filter((s: any) => s.tournaments && s.role === 'admin')
        .map((s: any) => ({
          id: s.tournaments.id, name: s.tournaments.name, venue: s.tournaments.venue,
          event_date: s.tournaments.event_date, status: s.tournaments.status,
          role: 'organizer' as const, courtId: null,
        }));
      const ownedIds = new Set((owned ?? []).map((t) => t.id));
      const organized: HostedTournament[] = [
        ...(owned ?? []).map((t) => ({
          id: t.id, name: t.name, venue: t.venue, event_date: t.event_date, status: t.status,
          role: 'organizer' as const, courtId: null,
        })),
        ...coOrganized.filter((t) => !ownedIds.has(t.id)),
      ];

      const coached: HostedTournament[] = (staffRows ?? [])
        .filter((s: any) => s.tournaments && s.role === 'coach')
        .map((s: any) => ({
          id: s.tournaments.id, name: s.tournaments.name, venue: s.tournaments.venue,
          event_date: s.tournaments.event_date, status: s.tournaments.status,
          role: 'coach', courtId: s.court_id,
        }));

      // An organizer can also run any court, so they get a coach entry for their own tournaments
      const organizerAsCoach: HostedTournament[] = (owned ?? []).map((t) => organized.find((o) => o.id === t.id)!).map((t) => ({ ...t, role: 'coach', courtId: 'court-1' }));
      const seen = new Set(coached.map((c) => c.id));
      setTournaments([...organized, ...organizerAsCoach.filter((t) => !seen.has(t.id)), ...coached]);
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-white/20 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">My Hosted Tournaments</h1>
          <p className="text-sm text-white/40">Tournaments you organize or coach at</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-10">
        {tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-stone-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5h4.5a.75.75 0 010 1.5H14.5v.25a4.5 4.5 0 01-9 0V4.75H4.75a.75.75 0 010-1.5h4.5V1.75A.75.75 0 0110 1zm-4 4.5v.25a3 3 0 006 0V5.5H6zm-1.5 7.5a.75.75 0 000 1.5h11a.75.75 0 000-1.5h-11z" clipRule="evenodd" /></svg>
            </div>
            <h2 className="text-sm font-bold text-stone-700 mb-1">Nothing hosted yet</h2>
            <p className="text-xs text-stone-400 mb-6 max-w-xs">Tournaments you create, or ones you're invited to coach at, will show up here.</p>
            <Link
              href="/create-event"
              className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors"
            >
              Host a Tournament
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => {
              const dateStr = t.event_date
                ? formatDate(t.event_date)
                : null;
              const href = t.role === 'organizer'
                ? `/admin?tournamentId=${t.id}`
                : `/coach/${t.courtId ?? 'court-1'}?tournamentId=${t.id}`;

              return (
                <button
                  key={`${t.id}-${t.role}`}
                  onClick={() => router.push(href)}
                  className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden text-left hover:border-orange-200 transition-colors"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        t.role === 'organizer'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {t.role === 'organizer' ? 'Organizer' : 'Coach'}
                      </span>
                      <IconChevronRight className="w-4 h-4 text-stone-300" />
                    </div>

                    <h3 className="text-base font-bold text-stone-900 leading-snug mb-3">{t.name}</h3>

                    <div className="space-y-1.5">
                      {t.venue && (
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                          {t.venue}
                        </div>
                      )}
                      {dateStr && (
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <IconCalendar className="w-3.5 h-3.5 shrink-0" />
                          {dateStr}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
