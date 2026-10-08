'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Avatar from '@/components/Avatar';
import { CATEGORY_LABELS as SHARED_CATEGORY_LABELS } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import { buildLines, type BillRegistration } from '@/components/FamilyBill';

type Entry = {
  id: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  registration_code: string;
  partner_name: string | null;
  payment_status: string;
  created_at: string;
  player_id: string | null;
  tournaments: {
    id: string;
    name: string;
    venue: string;
    entry_fee: number;
    sport: string;
    event_date: string;
  } | null;
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
  pending:  { label: 'Pending',   cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected',  cls: 'bg-red-50 text-red-600' },
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'Wife / Husband', son: 'Son', daughter: 'Daughter', parent: 'Parent', other: 'Family',
};

type Person = { id: string; name: string; gender: string | null; relation: string };

export default function MyEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [billRegs, setBillRegs] = useState<BillRegistration[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/my-entries'); return; }
      const { data: prof } = await supabase.from('player_profiles').select('id,full_name,gender').eq('auth_user_id', user.id).single();
      if (!prof) { setLoading(false); return; }

      const { data: kids } = await supabase.from('player_profiles').select('id,full_name,gender,relationship').eq('parent_id', prof.id);
      const list: Person[] = [
        { id: prof.id, name: prof.full_name, gender: prof.gender, relation: 'Me' },
        ...(kids ?? []).map((k) => ({ id: k.id, name: k.full_name, gender: k.gender, relation: RELATIONSHIP_LABELS[k.relationship ?? ''] ?? 'Family' })),
      ];
      setPeople(list);

      const { data } = await supabase
        .from('registrations')
        .select(`id, category, status, registration_code, partner_id, partner_name, payment_status, created_at, player_id,
          tournaments ( id, name, venue, entry_fee, sport, event_date ),
          player_profiles!registrations_player_id_fkey ( full_name )`)
        .in('player_id', list.map((p) => p.id))
        .neq('status', 'withdrawn')
        .order('created_at', { ascending: true });
      setEntries((data as unknown as Entry[]) ?? []);
      // The same registrations the profile's family bill uses, including a partner's half booked by someone else
      const idList = list.map((p) => p.id).join(',');
      const { data: billData } = await supabase
        .from('registrations')
        .select('id, category, status, payment_status, partner_paid, player_id, partner_id, partner_name, tournaments ( name, entry_fee ), player_profiles!registrations_player_id_fkey ( full_name )')
        .or(`player_id.in.(${idList}),partner_id.in.(${idList})`);
      setBillRegs((billData as unknown as BillRegistration[]) ?? []);
      setLoading(false);
    });
  }, [router]);

  async function withdraw(id: string) {
    if (!confirm('Withdraw this entry?')) return;
    setWithdrawing(id);
    // Marked as withdrawn rather than deleted, so the organizer's records stay complete
    const supabase = createClient();
    let { error } = await supabase.from('registrations').update({ status: 'withdrawn' }).eq('id', id);
    // Until the withdraw policy is updated in the database, fall back to removing the row (the audit log keeps a copy)
    if (error) ({ error } = await supabase.from('registrations').delete().eq('id', id));
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    setWithdrawing(null);
  }

  const approved = entries.filter((e) => e.status === 'approved').length;
  const pending  = entries.filter((e) => e.status === 'pending').length;
  const tournamentNames = new Set(entries.map((e) => e.tournaments?.name));
  const single = entries.length > 0 && tournamentNames.size === 1 ? entries[0].tournaments : null;

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">My Entries</h1>
              {single ? (
                <p className="text-sm text-white/40">{single.name} · {single.venue} · {formatDate(single.event_date)}</p>
              ) : (
                <p className="text-sm text-white/40">Everyone you have registered</p>
              )}
            </div>
            <Link href="/my-matches" className="shrink-0 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white px-3 py-2 rounded-lg transition-colors">
              My Matches →
            </Link>
          </div>

          {entries.length > 0 && (
            <div className="flex gap-5 mt-6 text-sm">
              <span className="text-white"><strong className="text-lg font-extrabold">{entries.length}</strong> <span className="text-white/40">total</span></span>
              <span className="text-emerald-400"><strong className="text-lg font-extrabold">{approved}</strong> <span className="text-white/40">confirmed</span></span>
              {pending > 0 && <span className="text-amber-400"><strong className="text-lg font-extrabold">{pending}</strong> <span className="text-white/40">pending</span></span>}
            </div>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-10">
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 flex flex-col items-center text-center">
            <h2 className="text-sm font-bold text-stone-700 mb-1">No entries yet</h2>
            <p className="text-xs text-stone-400 mb-6 max-w-xs">Register for an open tournament and your entries will appear here.</p>
            <Link href="/events" className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors">
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {people.map((person) => {
              const mine = entries.filter((e) => e.player_id === person.id);
              // Doubles someone else entered naming this person as partner, with no entry of their own: billed to them, so shown here too
              const live = (r: BillRegistration) => r.status !== 'withdrawn' && r.status !== 'rejected';
              const named = billRegs.filter((r) => r.partner_id === person.id && r.player_id !== person.id && live(r)
                && !billRegs.some((o) => o.player_id === person.id && o.category === r.category && live(o)));
              if (mine.length === 0 && named.length === 0) return null;
              // Same numbers as the family bill on the profile: each person's own share (doubles are halved)
              const due = buildLines(people.map((p) => ({ id: p.id, name: p.name, gender: p.gender ?? null })), billRegs)
                .filter((l) => l.personId === person.id && !l.paid)
                .reduce((sum, l) => sum + l.amount, 0);
              return (
                <section key={person.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                  <header className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <Avatar seed={person.id} size={36} gender={person.gender as never} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">{person.name}</p>
                      <p className="text-[11px] text-stone-400">{person.relation}</p>
                    </div>
                    {due > 0 && <span className="text-xs font-semibold text-amber-600 shrink-0">QAR {due} due</span>}
                  </header>

                  <ul className="divide-y divide-stone-100">
                    {mine.map((entry) => {
                      const scfg = STATUS_CONFIG[entry.status];
                      return (
                        <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-800">{CATEGORY_LABELS[entry.category] ?? entry.category}</p>
                            {(entry.partner_name || (!single && entry.tournaments)) && (
                              <p className="text-xs text-stone-400 truncate">
                                {entry.partner_name ? `with ${entry.partner_name}` : ''}
                                {entry.partner_name && !single && entry.tournaments ? ' · ' : ''}
                                {!single && entry.tournaments ? entry.tournaments.name : ''}
                              </p>
                            )}
                          </div>
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${scfg.cls}`}>{scfg.label}</span>
                          {entry.status === 'pending' && (
                            <button
                              onClick={() => withdraw(entry.id)}
                              disabled={withdrawing === entry.id}
                              className="text-xs text-stone-300 hover:text-red-500 transition-colors disabled:opacity-40 shrink-0"
                              aria-label="Withdraw entry"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {named.map((r) => {
                      const scfg = STATUS_CONFIG[(r.status as keyof typeof STATUS_CONFIG)] ?? STATUS_CONFIG.pending;
                      return (
                        <li key={r.id + 'n'} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-800">{CATEGORY_LABELS[r.category] ?? r.category}</p>
                            <p className="text-xs text-stone-400 truncate">with {r.player_profiles?.full_name ?? 'partner'} · entered by them</p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${scfg.cls}`}>{scfg.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
