'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/events';

  const [form, setForm] = useState({ fullName: '', email: '', password: '', mobile: '', gender: '', dob: '' });
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
    if (profileErr) { setError(profileErr.message); setLoading(false); return; }

    router.push(redirectTo);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-[#1C0A00] flex-col justify-between p-12 shrink-0">
        <Link href="/events" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black text-white">R</div>
          <span className="text-sm font-bold text-white tracking-tight">RallyOps</span>
        </Link>

        <div>
          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            One profile.<br />Every tournament.
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Create your free player account and register for any event on the platform.
          </p>
        </div>

        <p className="text-white/20 text-xs">
          &copy; {new Date().getFullYear()} RallyOps
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white overflow-y-auto">
        <Link href="/events" className="flex items-center gap-2.5 mb-8 lg:hidden">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black text-white">R</div>
          <span className="text-sm font-bold text-stone-900 tracking-tight">RallyOps</span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">Create your account</h2>
            <p className="text-sm text-stone-400 mt-1">Free forever — no card required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'fullName', label: 'Full name',  type: 'text',     placeholder: 'Your full name' },
              { key: 'email',    label: 'Email',       type: 'email',    placeholder: 'you@example.com' },
              { key: 'password', label: 'Password',    type: 'password', placeholder: 'At least 8 characters', min: 8 },
              { key: 'mobile',   label: 'Mobile',      type: 'tel',      placeholder: '+1 555 000 0000', optional: true },
            ].map(({ key, label, type, placeholder, min, optional }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">
                  {label}{optional && <span className="ml-1 text-stone-300 font-normal normal-case">(optional)</span>}
                </label>
                <input
                  type={type}
                  required={!optional}
                  minLength={min}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">Gender</label>
              <div className="grid grid-cols-2 gap-2">
                {['Male', 'Female'].map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => set('gender', g.toLowerCase())}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      form.gender === g.toLowerCase()
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
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">
                Date of birth <span className="text-stone-300 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => set('dob', e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-stone-400 mt-6">
            Already have an account?{' '}
            <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-orange-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
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
