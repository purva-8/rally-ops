'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS, isDoublesCategory } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import { BLOCKS, COURTS, SMALL_CATEGORY, autoPlan, blockCapacity, matchesFor, playOrder, withDefaults, type Schedule, type Slot } from '@/lib/schedule';

// The whole day on one page: which 2-hour block each category plays in, everyone in it, and a
// find-a-person list. Organizers move categories between blocks and days; changes save straight away.
export default function ScheduleTab() {
  const { participants, tournamentId, eventDate } = useTournamentStore();
  const [saved, setSaved] = useState<unknown>(undefined);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  // Entries per category, and each entry's display name(s)
  const { entries, names } = useMemo(() => {
    const entries: Record<string, number> = {};
    const names: Record<string, string[]> = {};
    for (const p of participants) for (const c of p.categories) {
      entries[c] = (entries[c] ?? 0) + 1;
      (names[c] ??= []).push(isDoublesCategory(c) && p.partnerName ? `${p.fullName} / ${p.partnerName}` : p.fullName);
    }
    for (const c of Object.keys(names)) names[c].sort((a, b) => a.localeCompare(b));
    return { entries, names };
  }, [participants]);

  useEffect(() => {
    if (!tournamentId) return;
    createClient().from('tournaments').select('schedule').eq('id', tournamentId).single()
      // No saved plan (or no connection, or the column isn't there yet): start from the automatic one
      .then(({ data, error }) => setSaved(error ? null : (data?.schedule ?? null)), () => setSaved(null));
  }, [tournamentId]);

  // Show the saved plan (or the automatic one) once both the entries and the saved plan are in
  const plan = schedule ?? (saved === undefined || !participants.length ? null : withDefaults(saved, entries));

  const days = useMemo(() => {
    const first = eventDate ? new Date(`${eventDate.slice(0, 10)}T12:00:00`) : null;
    if (!first || isNaN(first.getTime())) return ['Day 1', 'Day 2'];
    const second = new Date(first.getTime() + 7 * 86400000);
    const fmt = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${formatDate(d)}`;
    return [fmt(first), fmt(second)];
  }, [eventDate]);

  const save = async (next: Schedule) => {
    setSchedule(next);
    setStatus({ ok: true, text: 'Saving…' });
    try {
      const res = await fetch('/api/tournament/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, schedule: next }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? { ok: true, text: 'Saved' } : { ok: false, text: data.error ?? `Not saved (${res.status})` });
    } catch {
      setStatus({ ok: false, text: 'No connection. Not saved; change it again to retry.' });
    }
  };

  if (!tournamentId) return <p className="text-sm text-stone-400">Open an event to see its schedule.</p>;
  if (!plan) return <p className="text-sm text-stone-400">Loading entries…</p>;

  const move = (cat: string, slot: Slot) => save({ ...plan, assign: { ...plan.assign, [cat]: slot } });
  const cap = blockCapacity(plan.minutesPerMatch);
  const q = search.trim().toLowerCase();
  const cats = playOrder(Object.keys(entries));
  const inSlot = (day: number, block: number) => cats.filter((c) => plan.assign[c]?.day === day && plan.assign[c]?.block === block);
  const slotLabel = (s?: Slot) => (s ? `${days[s.day]}, ${BLOCKS[s.block]}` : 'Not placed');

  // Everyone, one row per person per category
  const people = cats.flatMap((c) => participants.filter((p) => p.categories.includes(c)).flatMap((p) => {
    const rows = [{ name: p.fullName, with: p.partnerName, cat: c }];
    if (isDoublesCategory(c) && p.partnerName) rows.push({ name: p.partnerName, with: p.fullName, cat: c });
    return rows;
  })).sort((a, b) => a.name.localeCompare(b.name) || cats.indexOf(a.cat) - cats.indexOf(b.cat));
  const shownPeople = q ? people.filter((r) => r.name.toLowerCase().includes(q) || (r.with ?? '').toLowerCase().includes(q)) : people;

  return (
    <div className="schedule-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Schedule</h2>
          <p className="text-stone-400 text-sm">
            {COURTS} courts, 2-hour blocks. Players come at the start of their block and stay until they are out.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="text-xs text-stone-500">
            Minutes per match{' '}
            <select value={plan.minutesPerMatch} onChange={(e) => save({ ...plan, minutesPerMatch: Number(e.target.value) })}
              className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white ml-1">
              {[10, 15, 20, 25, 30].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <button onClick={() => { if (confirm('Put every category back where the automatic plan puts it?')) save(autoPlan(entries, plan.minutesPerMatch)); }}
            className="text-xs border border-stone-200 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50">Reset to automatic</button>
          <button onClick={() => window.print()} className="text-xs bg-[#111827] text-white px-3 py-2 rounded-lg font-semibold">Print</button>
        </div>
      </div>

      {status && (
        <p className={`text-xs mb-3 print:hidden ${status.ok ? 'text-emerald-700' : 'text-red-600 font-medium'}`}>{status.text}</p>
      )}

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person…"
        className="w-full sm:w-80 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white mb-6 focus:outline-none focus:ring-2 focus:ring-orange-500 print:hidden" />

      {[0, 1].map((day) => (
        <section key={day} className="mb-8 break-inside-avoid">
          <h3 className="text-base font-bold text-stone-900 mb-3 pb-1 border-b-2 border-stone-900">
            {days[day]} {day === 1 && <span className="text-xs font-normal text-stone-400">(categories under {SMALL_CATEGORY} entries go here by default)</span>}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {BLOCKS.map((label, block) => {
              const here = inSlot(day, block);
              const load = here.reduce((s, c) => s + matchesFor(entries[c]), 0);
              return (
                <div key={block} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                  <div className="bg-stone-900 text-white px-4 py-2.5 flex items-baseline justify-between">
                    <span className="font-bold">{label}</span>
                    <span className={`text-xs ${load > cap ? 'text-red-300 font-bold' : 'text-white/60'}`}>
                      ≈ {load} / {cap} matches{load > cap ? ' · too many' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {here.length === 0 && <p className="px-4 py-3 text-sm text-stone-300">Free</p>}
                    {here.map((c) => (
                      <div key={c} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-bold text-stone-900 leading-snug">{CATEGORY_LABELS[c] ?? c}</p>
                          <select value={`${day}-${block}`} aria-label={`Move ${CATEGORY_LABELS[c] ?? c}`}
                            onChange={(e) => { const [d, b] = e.target.value.split('-').map(Number); move(c, { day: d as 0 | 1, block: b }); }}
                            className="text-[11px] border border-stone-200 rounded-md px-1 py-0.5 bg-white text-stone-600 shrink-0 print:hidden">
                            {[0, 1].flatMap((d) => BLOCKS.map((l, b) => <option key={`${d}-${b}`} value={`${d}-${b}`}>{days[d].split(' ')[1] ?? days[d]} · {l.split(' –')[0]}</option>))}
                          </select>
                        </div>
                        <p className="text-[11px] text-stone-400 mb-1.5">{entries[c]} {isDoublesCategory(c) ? 'pairs' : 'players'} · {matchesFor(entries[c])} matches</p>
                        <ol className="text-[13px] text-stone-700 space-y-0.5 list-decimal list-inside">
                          {names[c].map((n, i) => (
                            <li key={i} className={q && n.toLowerCase().includes(q) ? 'bg-amber-100 rounded px-1 font-semibold' : ''}>{n}</li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="break-before-page">
        <h3 className="text-base font-bold text-stone-900 mb-3 pb-1 border-b-2 border-stone-900">
          Everyone ({new Set(people.map((p) => p.name)).size} people){q && <span className="text-xs font-normal text-stone-400"> · matching “{search.trim()}”</span>}
        </h3>
        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500 uppercase tracking-wider">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Partner</th><th className="px-4 py-2">When</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shownPeople.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-1.5 font-medium text-stone-900 whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-1.5 text-stone-600">{CATEGORY_LABELS[r.cat] ?? r.cat}</td>
                  <td className="px-4 py-1.5 text-stone-500">{isDoublesCategory(r.cat) ? r.with ?? '' : ''}</td>
                  <td className="px-4 py-1.5 font-semibold text-stone-900 whitespace-nowrap">{slotLabel(plan.assign[r.cat])}</td>
                </tr>
              ))}
              {shownPeople.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-stone-400">Nobody matches.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
