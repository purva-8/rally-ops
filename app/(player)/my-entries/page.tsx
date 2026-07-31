'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    entry_fee: number;
    sport: string;
  } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
};

const STATUS = {
  pending:  { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600 border-red-200' },
};

const SPORT_ICON: Record<string, string> = {
  badminton: '🏸',
  tennis: '🎾',
  squash: '🎱',
  pickleball: '🏓',
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
        .select(`
          id, category, status, registration_code, partner_name, payment_status, created_at,
          tournaments ( id, name, start_date, entry_fee, sport )
        `)
        .eq('player_id', user.id)
        .order('created_at', { ascending: false });
      setEntries((data as unknown as Entry[]) ?? []);
      setLoading(false);
    });
  }, [router]);

  async function withdraw(id: string) {
    if (!confirm('Withdraw this registration?')) return;
    setWithdrawing(id);
    const supabase = createClient();
    await supabase.from('registrations').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setWithdrawing(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-950 flex items-center justify-center">
        <div className="text-orange-300/40 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <div className="bg-orange-950 text-white pt-12 pb-8 px-6">
        <p className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-2">My Entries</p>
        <h1 className="text-2xl font-bold text-white">My Tournaments</h1>
        {entries.length > 0 && (
          <p className="text-orange-300/60 text-sm mt-1">{entries.length} registration{entries.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      <main className="max-w-lg mx-auto px-4 py-5">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl mb-4">🏆</div>
            <h2 className="text-base font-semibold text-stone-700 mb-1">No entries yet</h2>
            <p className="text-sm text-stone-400 mb-6">Find an open tournament and register to see your entries here.</p>
            <a
              href="/events"
              className="bg-orange-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-orange-700 transition-colors"
            >
              Browse Events
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const s = STATUS[entry.status];
              const sport = entry.tournaments?.sport ?? '';
              const icon = SPORT_ICON[sport] ?? '🏆';
              const tournamentDate = entry.tournaments?.start_date
                ? new Date(entry.tournaments.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;

              return (
                <div key={entry.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-stone-900 text-sm leading-snug">
                            {entry.tournaments?.name ?? 'Unknown tournament'}
                          </h3>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-sm text-stone-500 mt-0.5">
                          {CATEGORY_LABELS[entry.category] ?? entry.category}
                          {entry.partner_name && <span className="text-stone-400"> · with {entry.partner_name}</span>}
                        </p>
                        {tournamentDate && (
                          <p className="text-xs text-stone-400 mt-1">{tournamentDate}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-stone-50 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-stone-400 tracking-wide">{entry.registration_code}</span>
                      {entry.status === 'pending' && (
                        <button
                          onClick={() => withdraw(entry.id)}
                          disabled={withdrawing === entry.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-40"
                        >
                          {withdrawing === entry.id ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      )}
                      {entry.status === 'approved' && (
                        <span className="text-[11px] text-green-600 font-semibold">✓ Confirmed</span>
                      )}
                    </div>
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
