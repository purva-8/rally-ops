'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/events';

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    mobile: '',
    gender: '',
    dob: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.gender) { setError('Please select your gender.'); return; }
    setLoading(true);
    const supabase = createClient();

    const { data, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    });
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Signup failed. Try again.');
      setLoading(false);
      return;
    }

    const { error: profileErr } = await supabase.from('player_profiles').insert({
      id: data.user.id,
      full_name: form.fullName,
      mobile: form.mobile,
      gender: form.gender,
      dob: form.dob || null,
    });
    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <div className="min-h-screen bg-orange-950 flex flex-col">
      {/* Brand top bar */}
      <div className="px-6 pt-6 pb-0">
        <Link href="/events" className="inline-flex items-center gap-2">
          <span className="text-xl">🏸</span>
          <span className="text-xs font-bold tracking-widest uppercase text-orange-300">RallyOps</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Create your player profile</h1>
            <p className="text-sm text-orange-200/70 mt-2">One free account for all your tournaments</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Full name</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Mobile</label>
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                  placeholder="+1 555 000 0000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  {['male', 'female'].map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => set('gender', g)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-colors capitalize ${
                        form.gender === g
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-orange-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Date of birth <span className="text-stone-300 normal-case font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => set('dob', e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-orange-700 transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs text-stone-400 mt-5">
              Already have an account?{' '}
              <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-orange-600 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
