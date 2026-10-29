'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Barlow, Barlow_Condensed } from 'next/font/google';

const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--lb-body' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--lb-display' });

// Same terracotta and beige as the leaderboard
const C = { court: '#B4532A', courtDeep: '#8F3F1E', line: '#FBF5EC', floor: '#F3EADB', ink: '#2B1D14', muted: '#7A6656', gold: '#D9962B', rule: '#E4D6C1' };

export type BoardEntry = { name: string; wins: number; out: boolean; champion: boolean };
export type BoardSlot = { from: string; to: string; categories: { key: string; label: string; doubles: boolean; drawn: boolean; entries: BoardEntry[] }[] };

// The sheet is laid out at a fixed poster width and scaled to fit the whole screen, so it never scrolls
const SHEET_WIDTH = 1400;

type Props = { empty: true } | { empty?: false; event: { name: string; venue: string | null; day: string; nextDay: string }; slots: BoardSlot[] };

function Name({ e, hit }: { e: BoardEntry; hit: boolean }) {
  return (
    <li className="flex items-baseline gap-1.5 break-inside-avoid py-[2px] leading-snug text-[14px]"
      style={{ background: hit ? '#FFE3A8' : undefined, color: e.out ? C.muted : C.ink }}>
      <span className="w-3.5 shrink-0 text-center" style={{ color: e.champion ? C.gold : C.court }}>
        {e.champion ? '★' : e.out ? '' : e.wins > 0 ? '✓' : '·'}
      </span>
      <span className={`${e.out ? 'line-through decoration-1' : ''} ${e.champion || hit ? 'font-semibold' : ''}`}>{e.name}</span>
      {!e.out && e.wins > 1 && <span className="text-[11px] font-semibold" style={{ color: C.court }}>×{e.wins}</span>}
    </li>
  );
}

export default function BoardView(props: Props) {
  const [q, setQ] = useState('');
  const sheet = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; left: number; top: number } | null>(null);
  const measure = () => {
    const el = sheet.current;
    if (!el) return;
    const h = el.scrollHeight;
    const scale = Math.min(window.innerWidth / SHEET_WIDTH, window.innerHeight / h);
    const next = { scale, left: (window.innerWidth - SHEET_WIDTH * scale) / 2, top: Math.max(0, (window.innerHeight - h * scale) / 2) };
    setFit((prev) => (prev && prev.scale === next.scale && prev.left === next.left && prev.top === next.top ? prev : next));
  };
  useLayoutEffect(measure, []);
  useEffect(() => {
    window.addEventListener('resize', measure);
    const ro = sheet.current ? new ResizeObserver(measure) : null;
    if (sheet.current) ro?.observe(sheet.current);
    return () => { window.removeEventListener('resize', measure); ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shell = `${body.variable} ${display.variable} min-h-screen [font-family:var(--lb-body)]`;
  if (props.empty) {
    return <div className={`${shell} flex items-center justify-center px-6`} style={{ background: C.floor }}><p style={{ color: C.muted }}>Nothing to show yet.</p></div>;
  }
  const { event, slots } = props;
  const term = q.trim().toLowerCase();
  const anyResults = slots.some((s) => s.categories.some((c) => c.entries.some((e) => e.wins || e.out)));

  return (
    <div className={`${shell} fixed inset-0 overflow-hidden`} style={{ background: C.floor, color: C.ink }}>
      <div ref={sheet} className="absolute px-6 py-5 origin-top-left"
        style={{ width: SHEET_WIDTH, left: fit?.left ?? 0, top: fit?.top ?? 0, transform: `scale(${fit?.scale ?? 1})`, visibility: fit ? 'visible' : 'hidden' }}>
        <header className="flex items-end justify-between gap-x-6 pb-3 mb-4 border-b-4" style={{ borderColor: C.court }}>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{event.name}{event.venue ? ` · ${event.venue}` : ''}</p>
            <h1 className="[font-family:var(--lb-display)] font-bold text-5xl leading-none mt-1" style={{ color: C.courtDeep }}>{event.day}</h1>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your name…" aria-label="Find your name"
            className="w-64 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 print:hidden"
            style={{ background: C.line, borderColor: C.rule }} />
        </header>

        <div className="grid grid-cols-[3fr_2fr] gap-5">
          {slots.map((s) => (
            <section key={s.from} className="rounded-xl overflow-hidden border" style={{ borderColor: C.rule, background: C.line }}>
              <div className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-2" style={{ background: C.court, color: C.line }}>
                <h2 className="[font-family:var(--lb-display)] font-bold text-3xl leading-none">{s.from} – {s.to}</h2>
                <p className="text-sm font-semibold">Please arrive by {s.from}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4">
                {s.categories.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <h3 className="[font-family:var(--lb-display)] font-semibold text-xl leading-tight pb-1 mb-1 border-b-2 flex items-baseline justify-between gap-2" style={{ borderColor: C.courtDeep }}>
                      <span>{c.label}</span>
                      <span className="text-sm font-medium shrink-0" style={{ color: C.muted }}>{c.entries.length} {c.doubles ? 'pairs' : 'players'}</span>
                    </h3>
                    <ol>
                      {c.entries.map((e, i) => <Name key={i} e={e} hit={!!term && e.name.toLowerCase().includes(term)} />)}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[13px]" style={{ color: C.muted }}>
          <p>
            Names in alphabetical order.{anyResults ? ' ✓ won a match · ★ champion · struck out: knocked out.' : ''}
          </p>
          <p><b style={{ color: C.ink }}>{event.nextDay}:</b> later rounds and all other categories. Live scores: rally-ops-hazel.vercel.app/leaderboard</p>
        </footer>
      </div>
    </div>
  );
}
