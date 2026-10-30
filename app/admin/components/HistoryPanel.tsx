'use client';

import { useCallback, useEffect, useState } from 'react';
import { CATEGORY_LABELS } from '../../tournament/types';

type Entry = { id: number | string; matchId: string | null; category: string | null; action: string; summary: string; at: string; restorable: boolean };
const ACTION: Record<string, string> = {
  score: 'Score', reset: 'Undone', create: 'Made', delete: 'Removed', players: 'Players', restore: 'Restored', court: 'Court', start: 'Started',
};

// Every change to a match, newest first. Restore puts that match back the way it was just before the change
// (and the restore is itself in the list, so it can be put back too).
export default function HistoryPanel({ tournamentId, onRestored }: { tournamentId: string; onRestored: (msg: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/tournament/matches/history?tournamentId=${tournamentId}`).then((x) => x.json()).catch(() => null);
    if (r) { setEntries(r.entries ?? []); setReady(r.ready !== false); }
  }, [tournamentId]);
  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [open, load]);

  async function restore(e: Entry) {
    if (!confirm(`Put this match back the way it was before this change?\n\n${e.summary}`)) return;
    setBusy(e.id); setError(null);
    const res = await fetch('/api/tournament/matches/history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId, logId: e.id }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({})) ?? {};
    setBusy(null);
    if (!res?.ok) { setError(d.error ?? 'No connection. Nothing was changed.'); return; }
    await load();
    await onRestored(d.message ?? 'Restored');
  }

  const shown = (entries ?? []).filter((e) => !q || e.summary.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`px-3 py-1.5 border rounded-lg text-xs font-semibold ${open ? 'bg-stone-800 border-stone-800 text-white' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'}`}>
        ↺ History &amp; restore
      </button>
      {open && (
      <div className="basis-full w-full mt-2 bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-bold text-stone-900">History &amp; restore <span className="font-normal text-stone-400">· every score, undo, match made or removed</span></p>
          <button onClick={() => setOpen(false)} className="text-xs text-stone-500 underline">Close</button>
        </div>
        {!ready && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">History needs a one-time database update: run <code>supabase/match_log.sql</code> in Supabase → SQL editor.</p>}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search history by player"
          className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" />
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {entries === null && <p className="text-sm text-stone-400">Loading…</p>}
        {entries && shown.length === 0 && <p className="text-sm text-stone-400">Nothing yet.</p>}
        <ul className="divide-y divide-stone-100 max-h-[420px] overflow-y-auto">
          {shown.map((e) => (
            <li key={e.id} className="py-2 flex items-start gap-3 text-sm">
              <span className="text-xs text-stone-400 w-14 shrink-0 pt-0.5">{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 rounded px-1.5 py-0.5 shrink-0">{ACTION[e.action] ?? e.action}</span>
              <span className="flex-1 text-stone-700">{e.summary}{e.category ? <span className="text-stone-400"> · {CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS] ?? e.category}</span> : null}</span>
              {e.restorable && e.matchId && (
                <button onClick={() => restore(e)} disabled={busy !== null}
                  className="text-xs font-semibold text-orange-700 hover:underline shrink-0 disabled:opacity-40">{busy === e.id ? 'Restoring…' : 'Restore'}</button>
              )}
            </li>
          ))}
        </ul>
      </div>
      )}
    </>
  );
}
