'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import TopPlayersView from './TopPlayersView';

// Public top players for the current event, the same one /leaderboard shows (?event=<id> picks another)
function TopInner() {
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
  if (id) return <TopPlayersView id={id} />;
  return (
    <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center px-6">
      <p className="text-sm text-stone-400">{id === null ? 'No tournament to show yet.' : 'Loading...'}</p>
    </div>
  );
}

export default function TopPage() {
  return (
    <Suspense fallback={null}>
      <TopInner />
    </Suspense>
  );
}
