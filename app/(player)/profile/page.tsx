'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconEdit, IconLogout, IconUser } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { CATEGORY_LABELS } from '@/lib/categories';
import Avatar from '@/components/Avatar';
import FamilyBill, { buildLines, type BillRegistration } from '@/components/FamilyBill';

type Profile = {
  id: string;
  full_name: string;
  mobile: string | null;
  gender: string | null;
  qid: string | null;
  samanvayam_member: boolean;
  dob: string | null;
  samanvayam_id?: string | null;
};

type Kid = {
  id: string;
  full_name: string;
  gender: string | null;
  dob: string | null;
  relationship: string | null;
};

const RELATIONSHIPS = [
  { value: 'spouse',   label: 'Wife / Husband' },
  { value: 'son',      label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'parent',   label: 'Parent' },
  { value: 'other',    label: 'Other family member' },
];
const relLabel = (v: string | null) => RELATIONSHIPS.find((r) => r.value === v)?.label ?? 'Family member';

type Entry = {
  id: string;
  player_id: string;
  category: string;
  status: string;
  payment_status: string | null;
  tournaments: { name: string } | null;
};

type Stats = { total: number; approved: number; pending: number };
type Roles = { isOrganizer: boolean; isCoach: boolean; isAdminStaff: boolean };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, pending: 0 });
  const [roles, setRoles] = useState<Roles>({ isOrganizer: false, isCoach: false, isAdminStaff: false });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', mobile: '', qid: '', dob: '', sid: '' });
  const [kids, setKids] = useState<Kid[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [billRegs, setBillRegs] = useState<BillRegistration[]>([]);
  const [tab, setTab] = useState<'me' | 'family' | 'bill'>('me');
  const [showAddKid, setShowAddKid] = useState(false);
  const [addingKid, setAddingKid] = useState(false);
  const [kidForm, setKidForm] = useState({ full_name: '', relationship: '', gender: '', dob: '' });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/profile'); return; }
      setEmail(user.email ?? '');
      const [{ data: prof }, { data: ownedTournaments }, { data: staffRows }] = await Promise.all([
        supabase.from('player_profiles').select('*').eq('auth_user_id', user.id).single(),
        supabase.from('tournaments').select('id').eq('created_by', user.id).limit(1),
        supabase.from('tournament_staff').select('role').eq('user_id', user.id).eq('status', 'active'),
      ]);
      let rows: Entry[] = [];
      if (prof) {
        setProfile(prof);
        setForm({ full_name: prof.full_name, mobile: prof.mobile ?? '', qid: prof.qid ?? '', dob: prof.dob ?? '', sid: prof.samanvayam_id ?? '' });
        const { data: kidRows } = await supabase.from('player_profiles').select('id,full_name,gender,dob,relationship').eq('parent_id', prof.id);
        setKids(kidRows ?? []);
        // Entries for the account holder and every family member
        const ids = [prof.id, ...(kidRows ?? []).map((k) => k.id)];
        const { data: regs } = await supabase
          .from('registrations')
          .select('id, player_id, category, status, payment_status, tournaments ( name )')
          .in('player_id', ids)
          .neq('status', 'withdrawn')
          .order('created_at', { ascending: false });
        rows = (regs as unknown as Entry[]) ?? [];
        setEntries(rows);

        // Everything the household owes, including their half of doubles booked by someone else
        const idList = ids.join(',');
        const { data: billRows } = await supabase
          .from('registrations')
          .select('id, category, status, payment_status, player_id, partner_id, partner_name, tournaments ( name, entry_fee ), player_profiles!registrations_player_id_fkey ( full_name )')
          .or(`player_id.in.(${idList}),partner_id.in.(${idList})`);
        setBillRegs((billRows as unknown as BillRegistration[]) ?? []);
      }
      setStats({
        total:    rows.length,
        approved: rows.filter((r) => r.status === 'approved').length,
        pending:  rows.filter((r) => r.status === 'pending').length,
      });
      const staff = staffRows ?? [];
      setRoles({
        isOrganizer:  (ownedTournaments ?? []).length > 0,
        isCoach:      staff.some((s) => s.role === 'coach'),
        isAdminStaff: staff.some((s) => s.role === 'admin'),
      });
      setLoading(false);
    });
  }, [router]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const { data, error } = await createClient()
      .from('player_profiles')
      .update({ full_name: form.full_name, mobile: form.mobile || null, qid: form.qid.trim() || null, dob: form.dob || null, samanvayam_id: form.sid.trim() || null })
      .eq('id', profile.id)
      .select()
      .single();
    if (!error && data) {
      if ((data.qid ?? null) !== (profile.qid ?? null)) {
        await createClient().from('player_profiles').update({ qid: data.qid }).eq('parent_id', profile.id);
      }
      setProfile(data);
      setEditing(false);
    }
    setSaving(false);
  }

  async function addKid() {
    if (!profile?.samanvayam_member || !kidForm.full_name.trim() || !kidForm.relationship || !kidForm.gender || !kidForm.dob) return;
    setAddingKid(true);
    const { data, error } = await createClient()
      .from('player_profiles')
      .insert({
        parent_id: profile.id,
        full_name: kidForm.full_name.trim(),
        relationship: kidForm.relationship,
        gender: kidForm.gender,
        dob: kidForm.dob,
        qid: profile.qid,
        samanvayam_member: profile.samanvayam_member,
      })
      .select('id,full_name,gender,dob,relationship')
      .single();
    if (!error && data) {
      setKids((prev) => [...prev, data]);
      setKidForm({ full_name: '', relationship: '', gender: '', dob: '' });
      setShowAddKid(false);
    }
    setAddingKid(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    // Full reload to the home page so no signed-in state lingers
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-white/20 text-sm">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex flex-col items-center justify-center gap-4 px-6">
        <IconUser className="w-12 h-12 text-stone-300" />
        <p className="text-sm text-stone-500 text-center">No profile found.</p>
        <button onClick={() => router.push('/signup')} className="bg-orange-600 text-white px-6 py-3 rounded-xl text-sm font-bold">
          Create profile
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* Header */}
      <div className="bg-[#111827]">
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-10">
          {/* Avatar + identity */}
          <div className="flex items-center gap-4 mb-7">
            <Avatar seed={profile.id} size={64} gender={profile.gender as never} className="shadow-lg shadow-black/30" />
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">{profile.full_name}</h1>
              <p className="text-sm text-white/40 mt-0.5">{email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {roles.isOrganizer && (
                  <span className="inline-block text-[11px] font-semibold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                    Organizer
                  </span>
                )}
                {(roles.isOrganizer || roles.isAdminStaff) && (
                  <span className="inline-block text-[11px] font-semibold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
                {(roles.isOrganizer || roles.isCoach) && (
                  <span className="inline-block text-[11px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                    Coach
                  </span>
                )}
                <span className="inline-block text-[11px] font-semibold bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                  Player
                </span>
                {profile.samanvayam_member && (
                  <span className="inline-block text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                    Samanvayam Member
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {[
              { label: 'Total',     value: stats.total },
              { label: 'Confirmed', value: stats.approved },
              { label: 'Pending',   value: stats.pending },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 py-4 text-center">
                <div className="text-xl font-extrabold text-white">{value}</div>
                <div className="text-[11px] text-white/40 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-3 pb-10 space-y-3">
        {(() => {
          const billPeople = [
            { id: profile.id, name: profile.full_name, gender: profile.gender },
            ...kids.map((k) => ({ id: k.id, name: k.full_name, gender: k.gender })),
          ];
          const billLines = buildLines(billPeople, billRegs);
          const due = billLines.filter((l) => !l.paid).reduce((sum, l) => sum + l.amount, 0);
          const tabs = [
            { id: 'me' as const, label: 'Me' },
            ...(profile.samanvayam_member || kids.length > 0 ? [{ id: 'family' as const, label: 'Family' }] : []),
            ...(billLines.length > 0 ? [{ id: 'bill' as const, label: due > 0 ? `Bill · QAR ${due}` : 'Bill' }] : []),
          ];
          if (tabs.length < 2) return null;
          return (
            <div className="flex gap-1 bg-white rounded-2xl border border-stone-200 shadow-sm p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    tab === t.id ? 'bg-[#111827] text-white' : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        })()}

        {tab === 'me' && (<>
        {/* Player info card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Player Info</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-orange-600 font-semibold hover:text-orange-700"
              >
                <IconEdit className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>

          {!editing ? (
            <div className="divide-y divide-stone-50">
              {[
                { label: 'Full Name', value: profile.full_name },
                { label: 'Mobile',    value: profile.mobile ?? '-' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-xs text-stone-400 font-medium">{label}</span>
                  <span className="text-sm text-stone-800 font-medium">{value}</span>
                </div>
              ))}
              {/* Qatar ID and date of birth side by side */}
              <div className="grid grid-cols-2 divide-x divide-stone-50">
                <div className="px-5 py-3.5">
                  <p className="text-xs text-stone-400 font-medium mb-0.5">Qatar ID</p>
                  <p className="text-sm text-stone-800 font-medium">{profile.qid ?? '-'}</p>
                </div>
                <div className="px-5 py-3.5">
                  <p className="text-xs text-stone-400 font-medium mb-0.5">Date of birth</p>
                  <p className="text-sm text-stone-800 font-medium">{profile.dob ? formatDate(profile.dob) : '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-stone-50">
                <div className="px-5 py-3.5">
                  <p className="text-xs text-stone-400 font-medium mb-0.5">Samanvayam member</p>
                  <p className="text-sm text-stone-800 font-medium">{profile.samanvayam_member ? 'Yes' : 'No'}</p>
                </div>
                <div className="px-5 py-3.5">
                  <p className="text-xs text-stone-400 font-medium mb-0.5">Samanvayam ID</p>
                  <p className="text-sm text-stone-800 font-medium">{profile.samanvayam_id || '-'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-xs text-stone-400 font-medium">Gender</span>
                <span className="text-sm text-stone-800 font-medium">
                  {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '-'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {(() => {
                const field = (key: 'full_name' | 'mobile' | 'qid' | 'dob' | 'sid', label: string, type: string, hint?: string) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                      {label}{hint && <span className="normal-case tracking-normal font-normal"> {hint}</span>}
                    </label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                );
                return (
                  <>
                    {field('full_name', 'Full Name', 'text')}
                    {field('mobile', 'Mobile', 'tel')}
                    <div className="grid grid-cols-2 gap-3">
                      {field('qid', 'Qatar ID', 'text')}
                      {field('dob', 'Date of birth', 'date')}
                    </div>
                    {field('sid', 'Samanvayam ID', 'text', '(optional)')}
                  </>
                );
              })()}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-500 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        </>)}

        {/* Family (Samanvayam members only; the flag is set when registering for a Samanvayam tournament) */}
        {tab === 'family' && (profile.samanvayam_member || kids.length > 0) && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Family &amp; entries</h2>
            {profile.samanvayam_member && !showAddKid && (
              <button
                onClick={() => setShowAddKid(true)}
                className="text-xs text-orange-600 font-semibold hover:text-orange-700"
              >
                + Add family member
              </button>
            )}
          </div>

          {profile.samanvayam_member && kids.length === 0 && !showAddKid && (
            <p className="px-5 py-4 text-sm text-stone-400">No family members yet. Add your wife, husband, sons or daughters; they register under your Qatar ID.</p>
          )}

          <div className="divide-y divide-stone-50">
            {[
              { id: profile.id, name: profile.full_name, sub: 'Me (Samanvayam member)', self: true, gender: profile.gender },
              ...kids.map((k) => ({
                id: k.id,
                name: k.full_name,
                sub: `${relLabel(k.relationship)} · ${k.gender ?? '-'}${k.dob ? ` · Born ${formatDate(k.dob)}` : ''}`,
                self: false,
                gender: k.gender,
              })),
            ].map((person) => {
              const mine = entries.filter((e) => e.player_id === person.id);
              return (
                <div key={person.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <Avatar seed={person.id} size={40} gender={person.gender as never} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800">{person.name}</p>
                      <p className="text-xs text-stone-400 mt-0.5 capitalize">{person.sub}</p>
                    </div>
                    <a
                      href={person.self ? '/events' : `/events?profileId=${person.id}`}
                      className="text-xs text-orange-600 font-semibold hover:text-orange-700 shrink-0"
                    >
                      Register →
                    </a>
                  </div>
                  {mine.length > 0 ? (
                    <ul className="mt-2.5 space-y-1.5">
                      {mine.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 text-xs bg-stone-50 rounded-lg px-3 py-2">
                          <span className="text-stone-600 truncate">
                            {CATEGORY_LABELS[e.category] ?? e.category}
                            <span className="text-stone-400"> · {e.tournaments?.name}</span>
                          </span>
                          <span className={`shrink-0 font-semibold ${e.status === 'approved' ? 'text-emerald-600' : e.status === 'rejected' ? 'text-red-500' : 'text-amber-600'}`}>
                            {e.status === 'approved' ? 'Confirmed' : e.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-stone-300">No entries yet</p>
                  )}
                </div>
              );
            })}
          </div>

          {profile.samanvayam_member && showAddKid && (
            <div className="p-5 space-y-4 border-t border-stone-100">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={kidForm.full_name}
                  onChange={(e) => setKidForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">Relationship</label>
                <select
                  value={kidForm.relationship}
                  onChange={(e) => {
                    const relationship = e.target.value;
                    setKidForm((f) => ({ ...f, relationship, gender: relationship === 'son' ? 'male' : relationship === 'daughter' ? 'female' : f.gender }));
                  }}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select relationship</option>
                  {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">Gender</label>
                <select
                  value={kidForm.gender}
                  onChange={(e) => setKidForm((f) => ({ ...f, gender: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={kidForm.dob}
                  onChange={(e) => setKidForm((f) => ({ ...f, dob: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowAddKid(false); setKidForm({ full_name: '', relationship: '', gender: '', dob: '' }); }}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addKid}
                  disabled={addingKid || !kidForm.full_name.trim() || !kidForm.relationship || !kidForm.gender || !kidForm.dob}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-500 transition-colors disabled:opacity-50"
                >
                  {addingKid ? 'Adding...' : 'Add member'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Bill */}
        {tab === 'bill' && <FamilyBill
          people={[
            { id: profile.id, name: profile.full_name, gender: profile.gender },
            ...kids.map((k) => ({ id: k.id, name: k.full_name, gender: k.gender })),
          ]}
          regs={billRegs}
        />}

        {tab === 'me' && (<>
        {/* Quick nav */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100 overflow-hidden">
          {[
            ...(roles.isOrganizer || roles.isCoach
              ? [{ href: '/my-tournaments', label: 'My Hosted Tournaments', sub: 'Admin & coach access' }]
              : []),
            { href: '/my-entries', label: 'My Tournament Entries', sub: 'View all registrations' },
            { href: '/events',     label: 'Browse Events',         sub: 'Find open tournaments' },
          ].map(({ href, label, sub }) => (
            <a key={href} href={href} className="flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors">
              <div>
                <div className="text-sm font-semibold text-stone-800">{label}</div>
                <div className="text-xs text-stone-400 mt-0.5">{sub}</div>
              </div>
              <svg className="w-4 h-4 text-stone-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </a>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
        >
          <IconLogout className="w-4 h-4" />
          Sign out
        </button>
        </>)}
      </main>
    </div>
  );
}
