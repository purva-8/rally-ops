'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function JoinStaffInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get('tournamentId');
  const email = searchParams.get('email');
  const [status, setStatus] = useState<'checking' | 'needs-auth' | 'claiming' | 'done' | 'error'>('checking');
  const [tournamentName, setTournamentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!tournamentId) { setStatus('error'); setErrorMsg('Missing invite details.'); return; }
    const supabase = createClient();

    supabase.from('tournaments').select('name').eq('id', tournamentId).single().then(({ data }) => {
      setTournamentName(data?.name ?? 'the tournament');
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setStatus('needs-auth'); return; }
      setStatus('claiming');
      const res = await fetch('/api/tournament/staff/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.claimed?.length) {
        setStatus('error');
        setErrorMsg(`You're signed in as ${user.email}, but this invite is for ${email ?? 'another email'}. Sign out (or use a private window), sign in with the invited email, and open the link again.`);
        return;
      }
      const staffRow = data.claimed[0];
      setStatus('done');
      setTimeout(() => {
        if (staffRow.court_id) router.push(`/coach/${staffRow.court_id}?tournamentId=${tournamentId}`);
        else router.push(`/events/${tournamentId}`);
      }, 1200);
    });
  }, [tournamentId, router]);

  const redirectTo = `/join-staff?tournamentId=${tournamentId}&email=${email ?? ''}`;

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl p-8 text-center shadow-xl">
        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <img src="/logo.png" alt="RallyOps" className="h-14 w-auto object-contain" />
        </div>

        {status === 'checking' && <p className="text-stone-500 text-sm">Loading invite...</p>}

        {status === 'needs-auth' && (
          <>
            <h1 className="text-lg font-bold text-stone-900 mb-2">Coach invite for {tournamentName}</h1>
            <p className="text-sm text-stone-500 mb-6">Sign in or create a free account with <strong>{email}</strong> to accept.</p>
            <div className="flex flex-col gap-2">
              <a href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                Sign in
              </a>
              <a href={`/signup?redirect=${encodeURIComponent(redirectTo)}`} className="w-full border border-stone-200 hover:border-stone-300 text-stone-700 font-semibold py-3 rounded-xl text-sm transition-colors">
                Create account
              </a>
            </div>
          </>
        )}

        {status === 'claiming' && <p className="text-stone-500 text-sm">Linking your account...</p>}

        {status === 'done' && (
          <>
            <h1 className="text-lg font-bold text-stone-900 mb-2">You're in!</h1>
            <p className="text-sm text-stone-500">Redirecting to your court...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-lg font-bold text-stone-900 mb-2">Couldn't accept invite</h1>
            <p className="text-sm text-stone-500">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinStaffPage() {
  return (
    <Suspense fallback={null}>
      <JoinStaffInner />
    </Suspense>
  );
}
