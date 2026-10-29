'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ResultsView from '../(player)/events/[id]/results/ResultsView';

// Short public address for the live results: the current event (?event=<id> picks another).
// "Current" is the latest event that isn't finished yet, or else the latest event.
function LeaderboardInner() {
  const picked = useSearchParams().get('event');
  const [found, setFound] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (picked) return;
    createClient().from('tournaments').select('id, status, event_date').order('event_date', { ascending: false })
      .then(({ data }) => {
        const all = data ?? [];
        setFound((all.find((t) => t.status !== 'completed') ?? all[0])?.id ?? null);
      }, () => setFound(null));
  }, [picked]);

  const id = picked ?? found;
  if (id) return <ResultsView id={id} />;
  return (
    <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center px-6">
      <p className="text-sm text-stone-400">{id === null ? 'No tournament to show yet.' : 'Loading...'}</p>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardInner />
    </Suspense>
  );
}
