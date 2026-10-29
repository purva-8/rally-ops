'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS, isDoublesCategory } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import {
  DAY_BLOCKS, COURTS, LATER, arrangeSchedule, autoPlan, baseCategory, blockCapacity, dayItems, describeDay, playOrder, withDefaults,
  type Entry, type Schedule, type Slot,
} from '@/lib/schedule';

// Partners typed by name only are taken to be family in these categories (they can't be anyone else's)
const FAMILY_PAIRS = new Set(['spouse_doubles_open', 'mixed_doubles_open']);

// The whole tournament on one page. Organizers pick each category's day; "Arrange times" then gives every
// category a block so nobody is needed in two places at once, families are at the venue for as
// short a stretch as possible, and the courts stay busy. Everything can still be moved by hand.
export default function ScheduleTab() {
  const { participants, tournamentId, eventDate } = useTournamentStore();
  const [saved, setSaved] = useState<unknown>(undefined);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  // Entries per category, each entry's display name, and who plays (with their family) for the planner
  const { entries, names, people } = useMemo(() => {
    const entries: Record<string, number> = {};
    const names: Record<string, string[]> = {};
    const people: Entry[] = [];
    for (const p of participants) for (const c of p.categories) {
      entries[c] = (entries[c] ?? 0) + 1;
      const pair = isDoublesCategory(c) && p.partnerName;
      (names[c] ??= []).push(pair ? `${p.fullName} / ${p.partnerName}` : p.fullName);
      const family = p.familyGroupId ?? p.id;
      const who = [{ key: p.id, family, name: p.fullName }];
      if (pair) {
        const key = p.partnerId ?? `name:${p.partnerName!.trim().toLowerCase()}`;
        who.push({ key, family: p.partnerFamilyId ?? (FAMILY_PAIRS.has(c) ? family : key), name: p.partnerName! });
      }
      people.push({ cat: c, people: who });
    }
    for (const c of Object.keys(names)) names[c].sort((a, b) => a.localeCompare(b));
    return { entries, names, people };
  }, [participants]);

  useEffect(() => {
    if (!tournamentId) return;
    createClient().from('tournaments').select('schedule').eq('id', tournamentId).single()
      // No saved plan (or no connection, or the column isn't there yet): start from the automatic one
      .then(({ data, error }) => setSaved(error ? null : (data?.schedule ?? null)), () => setSaved(null));
  }, [tournamentId]);

  // Show the saved plan (or the automatic one) once both the entries and the saved plan are in
  const initial = useMemo(() => (saved === undefined || !people.length
    ? null
    : saved ? withDefaults(saved, entries) : arrangeSchedule(autoPlan(entries), people)), [saved, entries, people]);
  const plan = schedule ?? initial;

  const days = useMemo(() => {
    const first = eventDate ? new Date(`${eventDate.slice(0, 10)}T12:00:00`) : null;
    if (!first || isNaN(first.getTime())) return ['Day 1', 'Day 2'];
    const second = new Date(first.getTime() + 7 * 86400000);
    const fmt = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${formatDate(d)}`;
    return [fmt(first), fmt(second)];
  }, [eventDate]);

  // What each day holds (round 1 of the first-day categories on day 1, their later rounds on day 2) and how many matches
  const items = useMemo(() => plan && dayItems(plan, entries), [plan, entries]);
  const dayPlans = useMemo(() => plan && items && items.map((it, day) => describeDay(
    Object.fromEntries(Object.keys(it).map((c) => [c, plan.assign[c]?.block ?? 0])),
    people, it,
  )), [plan, items, people]);

  // The plan as of the last change, so two quick clicks build on each other instead of the second undoing the first
  const latest = useRef<Schedule | null>(null);
  const save = async (next: Schedule, done = 'Saved') => {
    latest.current = next;
    setSchedule(next);
    setStatus({ ok: true, text: 'Saving…' });
    try {
      const res = await fetch('/api/tournament/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, schedule: next }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? { ok: true, text: done } : { ok: false, text: data.error ?? `Not saved (${res.status})` });
    } catch {
      setStatus({ ok: false, text: 'No connection. Not saved; change it again to retry.' });
    }
  };

  if (!tournamentId) return <p className="text-sm text-stone-400">Open an event to see its schedule.</p>;
  if (!plan || !items || !dayPlans) return <p className="text-sm text-stone-400">Loading entries…</p>;

  const current = () => latest.current ?? plan;
  const move = (cat: string, slot: Slot) => { const p = current(); save({ ...p, assign: { ...p.assign, [cat]: slot } }); };
  const arrange = () => save(arrangeSchedule(current(), people), 'Arranged and saved. Check the families below.');
  const q = search.trim().toLowerCase();
  const cats = playOrder(Object.keys(entries));
  const round1 = plan.firstDayRound1 !== false;
  const inSlot = (day: number, block: number) => playOrder(Object.keys(items[day])).filter((c) => (plan.assign[c]?.block ?? 0) === block);
  const slotLabel = (s?: Slot) => (s ? `${days[s.day]}, ${DAY_BLOCKS[s.day][s.block]}` : 'Not placed');
  const span = (day: number, blocks: number[]) => `${DAY_BLOCKS[day][blocks[0]].split(' –')[0]} – ${DAY_BLOCKS[day][blocks[blocks.length - 1]].split('– ')[1]}`;
  const short = (c: string) => (CATEGORY_LABELS[c] ?? c).replace(/^(Singles|Doubles) - /, (m) => (m.startsWith('S') ? 'S: ' : 'D: '));

  // Everyone, one row per person per category
  const rows = cats.flatMap((c) => participants.filter((p) => p.categories.includes(c)).flatMap((p) => {
    const r = [{ name: p.fullName, with: p.partnerName, cat: c }];
    if (isDoublesCategory(c) && p.partnerName) r.push({ name: p.partnerName, with: p.fullName, cat: c });
    return r;
  })).sort((a, b) => a.name.localeCompare(b.name) || cats.indexOf(a.cat) - cats.indexOf(b.cat));
  const shownRows = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || (r.with ?? '').toLowerCase().includes(q)) : rows;

  return (
    <div className="schedule-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Schedule</h2>
          <p className="text-stone-400 text-sm">
            {COURTS} courts. {days[0]}: 4–7 PM in 1-hour blocks; {days[1]}: 4–10 PM in 2-hour blocks. Players come at the start of their block{round1 ? `; on ${days[0]} only round 1 is played, the rest on ${days[1]}` : ' and stay until they are out'}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="text-xs text-stone-500">
            Minutes per match{' '}
            <select value={plan.minutesPerMatch} onChange={(e) => save({ ...current(), minutesPerMatch: Number(e.target.value) })}
              className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white ml-1">
              {[10, 15, 20, 25, 30].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <button onClick={() => { if (confirm(`Start over: the ${days[0]} categories (men's singles and doubles 18+, women's singles 18+, kids under 10, boys 10-14, parent + child) play round 1 on ${days[0]}, everything else on ${days[1]}, then arrange the times?`)) save(arrangeSchedule(autoPlan(entries, plan.minutesPerMatch), people), 'Reset and arranged'); }}
            className="text-xs border border-stone-200 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50">Start over</button>
          <button onClick={() => window.print()} className="text-xs border border-stone-200 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50">Print</button>
        </div>
      </div>

      {/* Step 1: days. Step 2: arrange. */}
      <section className="bg-white border border-stone-200 rounded-xl p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold text-stone-900">1. Which day does each category play?</p>
            <label className="flex items-center gap-2 text-xs text-stone-600 mt-1">
              <input type="checkbox" checked={round1} onChange={(e) => save({ ...current(), firstDayRound1: e.target.checked })} />
              {days[0]}: round 1 only (later rounds on {days[1]}). Press Arrange after changing.
            </label>
          </div>
          <button onClick={arrange} className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm">
            ✨ 2. Arrange times for families
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {cats.map((c) => {
            const d = plan.assign[c]?.day ?? 0;
            return (
              <div key={c} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-stone-700 truncate">{CATEGORY_LABELS[c] ?? c} <span className="text-stone-400 text-xs">({entries[c]})</span></span>
                <span className="flex shrink-0 rounded-lg border border-stone-200 overflow-hidden text-xs">
                  {[0, 1].map((x) => (
                    <button key={x} onClick={() => x !== d && move(c, { day: x as 0 | 1, block: plan.assign[c]?.block ?? 0 })}
                      className={`px-2.5 py-1 font-semibold ${x === d ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
                      {days[x].split(' ')[1] ?? days[x]}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-stone-400 mt-3">
          After changing days, press Arrange. It tries every way of placing the categories in the three blocks and keeps the one where nobody is
          needed in two places at once, families are at the venue for the shortest time, and no block has more matches than {COURTS} courts can play.
        </p>
      </section>

      {status && (
        <p className={`text-sm mb-3 print:hidden ${status.ok ? 'text-emerald-700' : 'text-red-600 font-medium'}`}>{status.text}</p>
      )}

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person…"
        className="w-full sm:w-80 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white mb-6 focus:outline-none focus:ring-2 focus:ring-orange-500 print:hidden" />

      {[0, 1].map((day) => {
        const dp = dayPlans[day];
        const families = dp.families.filter((f) => f.people.length > 1 || f.people.some((p) => p.cats.length > 1));
        if (!Object.keys(dp.block).length) return (
          <section key={day} className="mb-8">
            <h3 className="text-base font-bold text-stone-900 mb-2 pb-1 border-b-2 border-stone-900">{days[day]}</h3>
            <p className="text-sm text-stone-400">No categories on this day.</p>
          </section>
        );
        return (
          <section key={day} className="mb-10">
            <h3 className="text-base font-bold text-stone-900 mb-3 pb-1 border-b-2 border-stone-900">{days[day]}</h3>

            {(() => {
              const allEvening = families.filter((f) => f.blocks.length === DAY_BLOCKS[day].length).length;
              return allEvening > 0 && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                  <b>{allEvening} {allEvening === 1 ? 'family is' : 'families are'} here all evening.</b>{' '}
                  Fitting them into two blocks would put more matches in a block than {COURTS} courts can play. To fix it: shorter matches
                  (Minutes per match), fewer categories on this day, or move one category by hand, then Arrange again.
                </div>
              );
            })()}
            {dp.doubleBooked.length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                <b>{dp.doubleBooked.length} {dp.doubleBooked.length === 1 ? 'person plays' : 'people play'} two categories in the same block</b>
                {' '}(they play them one after the other):{' '}
                {dp.doubleBooked.map((x) => `${x.name} (${x.cats.map(short).join(' + ')}, ${DAY_BLOCKS[day][x.block].split(' –')[0]})`).join('; ')}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {DAY_BLOCKS[day].map((label, block) => {
                const cap = blockCapacity(plan.minutesPerMatch, day);
                const here = inSlot(day, block);
                const load = dp.load[block];
                return (
                  <div key={block} className="bg-white border border-stone-200 rounded-xl overflow-hidden break-inside-avoid">
                    <div className="bg-stone-900 text-white px-4 py-2.5 flex items-baseline justify-between">
                      <span className="font-bold">{label}</span>
                      <span className={`text-xs ${load > cap ? 'text-red-300 font-bold' : 'text-white/60'}`}>
                        ≈ {load} / {cap} matches{load > cap ? ' · too many' : ''}
                      </span>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {here.length === 0 && <p className="px-4 py-3 text-sm text-stone-300">Free</p>}
                      {here.map((c) => c.endsWith(LATER) ? (
                        <div key={c} className="px-4 py-3 bg-stone-50">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-bold text-stone-900 leading-snug">{CATEGORY_LABELS[baseCategory(c)] ?? c} <span className="font-semibold text-orange-700">· later rounds</span></p>
                            <select value={block} aria-label={`Move later rounds of ${CATEGORY_LABELS[baseCategory(c)] ?? c}`}
                              onChange={(e) => move(c, { day: 1, block: Number(e.target.value) })}
                              className="text-[11px] border border-stone-200 rounded-md px-1 py-0.5 bg-white text-stone-600 shrink-0 print:hidden">
                              {DAY_BLOCKS[1].map((l, b) => <option key={b} value={b}>{l.split(' –')[0]}</option>)}
                            </select>
                          </div>
                          <p className="text-[11px] text-stone-400">{items[day][c]} matches · round 1 winners from {days[0]}</p>
                        </div>
                      ) : (
                        <div key={c} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-sm font-bold text-stone-900 leading-snug">{CATEGORY_LABELS[c] ?? c}</p>
                            <select value={`${day}-${block}`} aria-label={`Move ${CATEGORY_LABELS[c] ?? c}`}
                              onChange={(e) => { const [d, b] = e.target.value.split('-').map(Number); move(c, { day: d as 0 | 1, block: b }); }}
                              className="text-[11px] border border-stone-200 rounded-md px-1 py-0.5 bg-white text-stone-600 shrink-0 print:hidden">
                              {[0, 1].flatMap((d) => DAY_BLOCKS[d].map((l, b) => <option key={`${d}-${b}`} value={`${d}-${b}`}>{days[d].split(' ')[1] ?? days[d]} · {l.split(' –')[0]}</option>))}
                            </select>
                          </div>
                          <p className="text-[11px] text-stone-400 mb-1.5">{entries[c]} {isDoublesCategory(c) ? 'pairs' : 'players'} · {day === 0 && round1 ? `round 1 only, ${items[day][c]} matches` : `${items[day][c]} matches`}</p>
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

            {families.length > 0 && (
              <>
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                  Families and players in more than one category ({families.length})
                </h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {families.filter((f) => !q || f.people.some((p) => p.name.toLowerCase().includes(q))).map((f) => (
                    <div key={f.family} className={`bg-white border rounded-lg px-3 py-2 break-inside-avoid ${f.blocks.length === 3 ? 'border-amber-300' : 'border-stone-200'}`}>
                      <p className="text-xs font-semibold text-stone-500 mb-1">
                        At the venue {span(day, f.blocks)}{f.blocks.length === 3 ? ' · all evening' : ''}
                      </p>
                      {f.people.map((p) => (
                        <p key={p.name} className="text-[13px] text-stone-800 leading-snug">
                          <b>{p.name}</b>{' '}
                          <span className="text-stone-500">{p.cats.map((c) => `${short(c)} ${DAY_BLOCKS[day][dp.block[c]].split(' –')[0]}`).join(' · ')}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}

      <section className="break-before-page">
        <h3 className="text-base font-bold text-stone-900 mb-3 pb-1 border-b-2 border-stone-900">
          Everyone ({new Set(rows.map((p) => p.name)).size} people){q && <span className="text-xs font-normal text-stone-400"> · matching “{search.trim()}”</span>}
        </h3>
        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-stone-500 uppercase tracking-wider">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Partner</th><th className="px-4 py-2">When</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shownRows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-1.5 font-medium text-stone-900 whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-1.5 text-stone-600">{CATEGORY_LABELS[r.cat] ?? r.cat}</td>
                  <td className="px-4 py-1.5 text-stone-500">{isDoublesCategory(r.cat) ? r.with ?? '' : ''}</td>
                  <td className="px-4 py-1.5 font-semibold text-stone-900 whitespace-nowrap">{slotLabel(plan.assign[r.cat])}
                    {items[1][r.cat + LATER] !== undefined && <span className="block text-xs font-normal text-stone-500">if they win: {slotLabel({ day: 1, block: plan.assign[r.cat + LATER]?.block ?? 0 })}</span>}
                  </td>
                </tr>
              ))}
              {shownRows.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-stone-400">Nobody matches.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
