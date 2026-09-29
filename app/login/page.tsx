'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/events';
  const passwordJustReset = searchParams.get('reset') === 'success';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else window.location.href = redirectTo;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#111827] flex-col justify-between p-12">
        <Link href="/events" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="RallyOps" className="h-14 w-auto object-contain" />
        </Link>

        <div>
          <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight mb-5">
            Your tournament.<br />
            <span className="text-orange-500">Professionally run.</span>
          </h1>
          <p className="text-white/40 text-base leading-relaxed max-w-sm">
            Register for events, track your results, and manage your player profile, all in one place.
          </p>
        </div>

        <p className="text-white/20 text-xs">
          &copy; {new Date().getFullYear()} RallyOps. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        {/* Mobile logo */}
        <Link href="/events" className="flex items-center gap-2.5 mb-10 lg:hidden">
          <img src="/logo.png" alt="RallyOps" className="h-14 w-auto object-contain" />
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-stone-400 mt-1">Sign in to your player account</p>
          </div>

          {passwordJustReset && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl mb-4">
              Your password has been updated. Sign in with your new password.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <div className="text-right mt-1.5">
                <Link href="/forgot-password" className="text-xs text-orange-600 font-semibold hover:underline">
                  Forgot password?
                </Link>
              </div>
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-stone-400 mt-6">
            No account?{' '}
            <Link href={`/signup?redirect=${encodeURIComponent(redirectTo)}`} className="text-orange-600 font-semibold hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
