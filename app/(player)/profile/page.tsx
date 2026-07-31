'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  full_name: string;
  mobile: string | null;
  gender: string | null;
  dob: string | null;
  avatar_url: string | null;
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', mobile: '', dob: '' });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/profile'); return; }
      setEmail(user.email ?? '');
      const { data } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile(data);
        setForm({ full_name: data.full_name, mobile: data.mobile ?? '', dob: data.dob ?? '' });
      }
      setLoading(false);
    });
  }, [router]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('player_profiles')
      .update({ full_name: form.full_name, mobile: form.mobile || null, dob: form.dob || null })
      .eq('id', profile.id)
      .select()
      .single();
    if (!error && data) { setProfile(data); setEditing(false); }
    setSaving(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/events');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-950 flex items-center justify-center">
        <div className="text-orange-300/40 text-sm">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-5xl">👤</div>
        <p className="text-stone-600 text-sm text-center">No profile found. Please sign in or complete signup.</p>
        <button onClick={() => router.push('/signup')} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold text-sm">
          Create profile
        </button>
      </div>
    );
  }

  const avatarBg = 'bg-orange-500';

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <div className="bg-orange-950 text-white pt-12 pb-20 px-6">
        <p className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-6">Profile</p>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 ${avatarBg} rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
            {initials(profile.full_name)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{profile.full_name}</h1>
            <p className="text-orange-300/70 text-sm mt-0.5">{email}</p>
            {profile.gender && (
              <span className="inline-block mt-1 text-xs bg-orange-900/60 border border-orange-800 text-orange-300 px-2 py-0.5 rounded-full capitalize">
                {profile.gender}
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 -mt-10">
        {/* Info card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">Player Info</span>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-orange-600 font-semibold hover:underline">
                Edit
              </button>
            )}
          </div>

          {!editing ? (
            <div className="divide-y divide-stone-50">
              <Row label="Full Name" value={profile.full_name} />
              <Row label="Mobile" value={profile.mobile ?? '—'} />
              <Row label="Date of Birth" value={profile.dob ? new Date(profile.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
              <Row label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} />
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <Field label="Full Name">
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                />
              </Field>
              <Field label="Mobile">
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                />
              </Field>
              <Field label="Date of Birth">
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                />
              </Field>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditing(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-500">
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-50 mb-4">
          <NavRow href="/my-entries" icon="🏆" label="My Tournament Entries" />
          <NavRow href="/events" icon="🏸" label="Browse Events" />
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full py-4 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between">
      <span className="text-xs text-stone-400 font-medium">{label}</span>
      <span className="text-sm text-stone-800 font-medium text-right">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function NavRow({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition-colors">
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium text-stone-700 flex-1">{label}</span>
      <span className="text-stone-300 text-xs">›</span>
    </a>
  );
}
