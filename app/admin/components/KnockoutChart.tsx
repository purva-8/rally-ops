'use client';

import { useState } from 'react';
import { CATEGORY_LABELS } from '../../tournament/types';
import type { Match } from '../../tournament/types';
import { sortCategories } from '@/lib/categories';
import { sameName } from '@/lib/daySheet';

type Entry = { id: string; label: string };

const score = (m: Match) => m.sets.map((s) => `${s.player1Score}-${s.player2Score}`).join(', ');

// Read-only knockout chart for one category: every match made so far, round by round, and who is still to play or
// waiting for their next match. It only shows what the Score desk already holds; it changes nothing.
export default function KnockoutChart({ names, matches }: { names: Map<string, Entry[]>; matches: Match[] }) {
  const [open, setOpen] = useState(false);
  const cats = sortCategories(Array.from(new Set([...names.keys(), ...matches.map((m) => m.category)])));
  const [cat, setCat] = useState('');
  const shown = cat || cats.find((c) => matches.some((m) => m.category === c)) || cats[0] || '';

  const view = (() => {
    const ms = matches.filter((m) => m.category === shown && !m.isBye && m.player2Name);
    // Columns: rounds in order, the final last
    const order = (m: Match) => (m.roundName === 'Final' ? 1e6 : m.round);
    const roundsSeen = Array.from(new Set(ms.sort((a, b) => order(a) - order(b) || (a.position ?? 0) - (b.position ?? 0)).map((m) => m.roundName)));
    const rounds = roundsSeen.map((r) => ({ name: r, matches: ms.filter((m) => m.roundName === r) }));
    const champion = ms.find((m) => m.roundName === 'Final' && m.status === 'completed')?.winnerName ?? null;

    // Where each entry is: in a match now, knocked out, or free (never played, or won and waiting for the next one)
    const seen = new Set<string>();
    const entries = (names.get(shown) ?? []).filter((e) => !seen.has(e.label) && seen.add(e.label));
    const notPlayed: string[] = [], waiting: { label: string; wins: number }[] = [];
    for (const e of entries) {
      const mine = ms.filter((m) => sameName(m.player1Name, e.label) || sameName(m.player2Name, e.label));
      const busy = mine.some((m) => m.status !== 'completed');
      const lost = mine.some((m) => m.status === 'completed' && !sameName(m.winnerName, e.label));
      const wins = mine.filter((m) => m.status === 'completed' && sameName(m.winnerName, e.label)).length;
      if (busy || lost || (champion && sameName(champion, e.label))) continue;
      if (wins === 0) notPlayed.push(e.label); else waiting.push({ label: e.label, wins });
    }
    waiting.sort((a, b) => b.wins - a.wins || a.label.localeCompare(b.label));
    return { rounds, champion, notPlayed: notPlayed.sort((a, b) => a.localeCompare(b)), waiting, total: entries.length };
  })();

  return (
    <div className="mb-4">
      <button onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 border border-stone-200 bg-white rounded-lg text-xs text-stone-700 font-semibold hover:bg-stone-50">
        {open ? '▾' : '▸'} Knockout chart
      </button>
      {open && (
        <div className="mt-2 bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={shown} onChange={(e) => setCat(e.target.value)} aria-label="Category for the chart"
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              {cats.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}</option>)}
            </select>
            <span className="text-xs text-stone-500">{view.total} entries · {view.rounds.reduce((n, r) => n + r.matches.length, 0)} matches made</span>
            {view.champion && <span className="text-sm font-semibold text-amber-700">★ Champion: {view.champion}</span>}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 items-start">
            {view.rounds.length === 0 && <p className="text-sm text-stone-400">No matches made in this category yet.</p>}
            {view.rounds.map((r, ri) => (
              <div key={r.name} className="flex items-start gap-3 shrink-0">
                {ri > 0 && <span className="self-center text-stone-300 text-xl">→</span>}
                <div className="w-60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-2">{r.name} · {r.matches.length}</h4>
                  <div className="space-y-2">
                    {r.matches.map((m) => {
                      const done = m.status === 'completed';
                      const side = (n?: string) => {
                        const won = done && sameName(m.winnerName, n);
                        const lost = done && !won;
                        return <div className={`truncate ${won ? 'font-semibold text-emerald-700' : lost ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{won ? '✓ ' : ''}{n}</div>;
                      };
                      return (
                        <div key={m.id} className={`rounded-lg border px-2.5 py-2 text-sm ${m.status === 'in_progress' ? 'border-emerald-300 bg-emerald-50' : done ? 'border-stone-200 bg-stone-50' : 'border-dashed border-stone-300'}`}>
                          {side(m.player1Name)}
                          {side(m.player2Name)}
                          <div className="mt-1 text-[11px] text-stone-500">
                            {done ? score(m) : m.status === 'in_progress' ? `● On court${m.courtId ? ` · ${m.courtId.replace('court-', 'Court ')}` : ''}` : `Waiting${m.courtId ? ` · ${m.courtId.replace('court-', 'Court ')}` : ''}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {(view.waiting.length > 0 || view.notPlayed.length > 0) && (
              <div className="flex items-start gap-3 shrink-0">
                {view.rounds.length > 0 && <span className="self-center text-stone-300 text-xl">→</span>}
                <div className="w-60 space-y-3">
                  {view.waiting.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Won, waiting for next match · {view.waiting.length}</h4>
                      <ul className="text-sm space-y-1">{view.waiting.map((w) => <li key={w.label} className="text-stone-800">✓ {w.label}{w.wins > 1 ? ` ×${w.wins}` : ''}</li>)}</ul>
                    </div>
                  )}
                  {view.notPlayed.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Not played yet · {view.notPlayed.length}</h4>
                      <ul className="text-sm space-y-1">{view.notPlayed.map((n) => <li key={n} className="text-stone-600">· {n}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-stone-400">Shows only. Make matches with the match maker below; it reads the same matches.</p>
        </div>
      )}
    </div>
  );
}
