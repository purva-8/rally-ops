'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // The email link signs the user in through /auth/callback, so a session means the link was valid
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setReady(!!user);
      setChecked(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  if (!checked) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">Choose a new password</h1>
        </div>

        {!ready ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-4 rounded-xl">
            This reset link is invalid or has expired.{' '}
            <Link href="/forgot-password" className="font-semibold underline">Request a new one</Link>. Open the link in the same browser you used to request it.
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-4 rounded-xl">
              Your password has been updated.
            </div>
            <Link href="/events" className="block w-full text-center bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors">
              Continue
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5">Confirm new password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
