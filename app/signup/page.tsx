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

    // 1. Create auth user
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

    // 2. Create player profile
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
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/events" className="text-2xl font-bold text-orange-600">RallyOps</Link>
          <h1 className="text-xl font-bold text-stone-900 mt-4">Create your player profile</h1>
          <p className="text-sm text-stone-500 mt-1">One account for all your tournaments</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Mobile</label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => set('mobile', e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="+974 XXXX XXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Gender</label>
              <div className="grid grid-cols-2 gap-2">
                {['male', 'female'].map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => set('gender', g)}
                    className={`py-3 rounded-xl text-sm font-medium border transition-colors capitalize ${
                      form.gender === g
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => set('dob', e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-500 mt-4">
          Already have an account?{' '}
          <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-orange-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
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
