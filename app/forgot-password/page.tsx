'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
    });
    setLoading(false);
    if (error) {
      const readable = error.message && !error.message.trim().startsWith('{');
      setError(readable && !/sending recovery email/i.test(error.message)
        ? error.message
        : 'We could not send the reset email right now. Please try again in a few minutes, or contact +974 3311 5157 for help.');
    } else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">Reset your password</h1>
          <p className="text-sm text-stone-400 mt-1">
            Enter your account email and we will send you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-4 rounded-xl">
            <p>If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5">
              <li>Check your spam folder if you do not see it within a few minutes.</li>
              <li>Reach out to +974 3311 5157 for any technical assistance or if the issue persists.</li>
            </ul>
          </div>
        ) : (
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
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-stone-400 mt-6">
          <Link href="/login" className="text-orange-600 font-semibold hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
