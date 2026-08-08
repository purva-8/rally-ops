'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconEdit, IconLogout, IconUser } from '@/components/icons';

type Profile = {
  id: string;
  full_name: string;
  mobile: string | null;
  gender: string | null;
};

type Stats = { total: number; approved: number; pending: number };
type Roles = { isOrganizer: boolean; isCoach: boolean; isAdminStaff: boolean };

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, pending: 0 });
  const [roles, setRoles] = useState<Roles>({ isOrganizer: false, isCoach: false, isAdminStaff: false });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', mobile: '' });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/profile'); return; }
      setEmail(user.email ?? '');
      const [{ data: prof }, { data: regs }, { data: ownedTournaments }, { data: staffRows }] = await Promise.all([
        supabase.from('player_profiles').select('*').eq('id', user.id).single(),
        supabase.from('registrations').select('status').eq('player_id', user.id),
        supabase.from('tournaments').select('id').eq('created_by', user.id).limit(1),
        supabase.from('tournament_staff').select('role').eq('user_id', user.id).eq('status', 'active'),
      ]);
      if (prof) {
        setProfile(prof);
        setForm({ full_name: prof.full_name, mobile: prof.mobile ?? '' });
      }
      const rows = regs ?? [];
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
      .update({ full_name: form.full_name, mobile: form.mobile || null })
      .eq('id', profile.id)
      .select()
      .single();
    if (!error && data) { setProfile(data); setEditing(false); }
    setSaving(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/events');
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
            <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold tracking-tight shadow-lg shadow-orange-900/40">
              {initials(profile.full_name)}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">{profile.full_name}</h1>
              <p className="text-sm text-white/40 mt-0.5">{email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {roles.isOrganizer && (
                  <span className="inline-block text-[11px] font-semibold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                    Organizer
                  </span>
                )}
                {roles.isAdminStaff && (
                  <span className="inline-block text-[11px] font-semibold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
                {roles.isCoach && (
                  <span className="inline-block text-[11px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                    Coach
                  </span>
                )}
                {!roles.isOrganizer && !roles.isCoach && !roles.isAdminStaff && (
                  <span className="inline-block text-[11px] font-semibold bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                    Player
                  </span>
                )}
                {profile.gender && (
                  <span className="inline-block text-[11px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full capitalize">
                    {profile.gender}
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
                {
                  label: 'Gender',
                  value: profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '-',
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-xs text-stone-400 font-medium">{label}</span>
                  <span className="text-sm text-stone-800 font-medium">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {[
                { key: 'full_name', label: 'Full Name', type: 'text' },
                { key: 'mobile',    label: 'Mobile',    type: 'tel' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              ))}
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
      </main>
    </div>
  );
}
