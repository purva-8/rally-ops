'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IconCalendar, IconMapPin } from '@/components/icons';

type Entry = {
  id: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  registration_code: string;
  partner_name: string | null;
  payment_status: string;
  created_at: string;
  tournaments: {
    id: string;
    name: string;
    start_date: string;
    venue: string;
    entry_fee: number;
    sport: string;
    event_date: string;
  } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  approved: { label: 'Confirmed',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected',       cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400' },
};

export default function MyEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/my-entries'); return; }
      const { data } = await supabase
        .from('registrations')
        .select(`id, category, status, registration_code, partner_name, payment_status, created_at,
          tournaments ( id, name, start_date, venue, entry_fee, sport, event_date )`)
        .eq('player_id', user.id)
        .order('created_at', { ascending: false });
      setEntries((data as unknown as Entry[]) ?? []);
      setLoading(false);
    });
  }, [router]);

  async function withdraw(id: string) {
    if (!confirm('Withdraw this registration? This cannot be undone.')) return;
    setWithdrawing(id);
    await createClient().from('registrations').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setWithdrawing(null);
  }

  const approved = entries.filter((e) => e.status === 'approved').length;
  const pending  = entries.filter((e) => e.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-white/20 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* Header */}
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-10">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">My Entries</h1>
          <p className="text-sm text-white/40">Your tournament registration history</p>

          {entries.length > 0 && (
            <div className="flex gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-white">{entries.length}</div>
                <div className="text-[11px] text-white/40 font-medium mt-0.5">Total</div>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-extrabold text-emerald-400">{approved}</div>
                <div className="text-[11px] text-white/40 font-medium mt-0.5">Confirmed</div>
              </div>
              {pending > 0 && (
                <>
                  <div className="w-px bg-white/10" />
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-amber-400">{pending}</div>
                    <div className="text-[11px] text-white/40 font-medium mt-0.5">Pending</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-10">
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-stone-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5h4.5a.75.75 0 010 1.5H14.5v.25a4.5 4.5 0 01-9 0V4.75H4.75a.75.75 0 010-1.5h4.5V1.75A.75.75 0 0110 1zm-4 4.5v.25a3 3 0 006 0V5.5H6zm-1.5 7.5a.75.75 0 000 1.5h11a.75.75 0 000-1.5h-11z" clipRule="evenodd" /></svg>
              </div>
            <h2 className="text-sm font-bold text-stone-700 mb-1">No entries yet</h2>
            <p className="text-xs text-stone-400 mb-6 max-w-xs">Register for an open tournament and your entries will appear here.</p>
            <Link
              href="/events"
              className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const scfg = STATUS_CONFIG[entry.status];
              const dateStr = entry.tournaments?.event_date
                ? new Date(entry.tournaments.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : null;

              return (
                <div key={entry.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                  <div className="p-5">
                    {/* Status + code row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${scfg.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
                        {scfg.label}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400 tracking-wider">{entry.registration_code}</span>
                    </div>

                    {/* Tournament name */}
                    <h3 className="text-base font-bold text-stone-900 leading-snug mb-1">
                      {entry.tournaments?.name ?? 'Unknown tournament'}
                    </h3>

                    {/* Category */}
                    <p className="text-sm text-stone-500 mb-3">
                      {CATEGORY_LABELS[entry.category] ?? entry.category}
                      {entry.partner_name && (
                        <span className="text-stone-400"> · with {entry.partner_name}</span>
                      )}
                    </p>

                    {/* Meta */}
                    <div className="space-y-1.5">
                      {entry.tournaments?.venue && (
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <IconMapPin className="w-3.5 h-3.5 shrink-0" />
                          {entry.tournaments.venue}
                        </div>
                      )}
                      {dateStr && (
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <IconCalendar className="w-3.5 h-3.5 shrink-0" />
                          {dateStr}
                        </div>
                      )}
                    </div>

                    {/* Footer action */}
                    {entry.status === 'pending' && (
                      <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                        <p className="text-xs text-stone-400">Awaiting organiser approval</p>
                        <button
                          onClick={() => withdraw(entry.id)}
                          disabled={withdrawing === entry.id}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors disabled:opacity-40"
                        >
                          {withdrawing === entry.id ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
