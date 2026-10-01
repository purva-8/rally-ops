'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';

type Option = { id: string; name: string; says: string; score: number };
type Entry = { id: string; category: string; categoryLabel: string; status: string; name: string; mobile: string; says: string; options: Option[]; suggestion: string | null };

export default function PairsTab() {
  const tournamentId = useTournamentStore((s) => s.tournamentId);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`/api/tournament/pairs?tournamentId=${tournamentId}`);
    const d = await r.json().catch(() => ({}));
    setEntries(d.entries ?? []);
    setLoading(false);
  }, [tournamentId]);
  useEffect(() => { load(); }, [load]);

  async function link(e: Entry) {
    const other = pick[e.id] ?? e.suggestion;
    if (!other) return;
    const r = await fetch('/api/tournament/pairs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, a: e.id, b: other }),
    });
    const d = await r.json().catch(() => ({}));
    setNote(r.ok ? `Paired ${e.name}` : d.error ?? 'Failed');
    setTimeout(() => setNote(''), 5000);
    if (r.ok) await load();
  }

  const cats = Array.from(new Set(entries.map((e) => e.categoryLabel)));

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-stone-900">Doubles pairs</h2>
        <p className="text-stone-400 text-sm">Entries not linked to a partner yet. Most link on their own; these need a nudge. Linking pairs both entries and splits the fee in halves.</p>
      </div>
      {note && <p className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-3">{note}</p>}
      {loading && <p className="text-sm text-stone-400">Loading...</p>}
      {!loading && entries.length === 0 && <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-3">Everyone in doubles is paired.</p>}

      {cats.map((c) => (
        <div key={c} className="mb-6">
          <h3 className="text-sm font-bold text-stone-700 mb-2">{c}</h3>
          <div className="space-y-2">
            {entries.filter((e) => e.categoryLabel === c).map((e) => {
              const chosen = pick[e.id] ?? e.suggestion ?? '';
              return (
                <div key={e.id} className="bg-white rounded-xl border border-stone-200 p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-semibold text-stone-900">{e.name}</p>
                    <p className="text-xs text-stone-400">says partner is: <span className="text-stone-600">{e.says || 'nobody'}</span>{e.mobile ? ` · ${e.mobile}` : ''}</p>
                    {e.options.length === 0 && <p className="text-xs text-amber-600 mt-0.5">Nobody else is waiting in this category yet. {e.says ? `Pairs up automatically when ${e.says} registers and names ${e.name.split(' ')[0]}.` : ''}</p>}
                  </div>
                  <select value={chosen} onChange={(ev) => setPick((p) => ({ ...p, [e.id]: ev.target.value }))}
                    className="border border-stone-200 rounded-lg px-2 py-2 text-sm min-w-[200px]">
                    <option value="">Pair with...</option>
                    {e.options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.id === e.suggestion ? '  (suggested)' : ''}</option>)}
                  </select>
                  <button onClick={() => link(e)} disabled={!chosen}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 disabled:opacity-40">Pair</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
