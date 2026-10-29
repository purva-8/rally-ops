'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { changeFor, payState, type PayState } from '@/lib/payments';

type Line = { regId: string; person: string; category: string; note: string; amount: number; paid: boolean; pending: boolean };
type Payment = { id: string; received: number; change: number; amount: number; note: string | null; at: string };
type Bill = { headId: string; head: string; email: string | null; qid: string | null; mobile: string | null; lines: Line[]; due: number; paid: number; balance: number; pendingAmount: number; payments: Payment[]; latest: string; offPlatform?: boolean };
type Removal = { id: string; label: string; headId: string | null; at: string };

type YetItem = { person: string; family: string; category: string; amount: number; why: string };
type Yet = { total: number; pending: YetItem[] };

type ApiResult = { error?: string; sent?: number; failed?: number; noEmail?: number; desk?: number; paymentId?: string; removalId?: string };

type Filter = 'all' | PayState | 'desk';
type Sort = 'name' | 'dueHigh' | 'dueLow' | 'totalHigh' | 'newest' | 'oldest';
const FILTERS: { v: Filter; l: string }[] = [
  { v: 'all', l: 'All' }, { v: 'due', l: 'Not paid' }, { v: 'partial', l: 'Part paid' }, { v: 'paid', l: 'Paid' }, { v: 'refund', l: 'Give back' }, { v: 'desk', l: 'Not on the platform' },
];
const SORTS: { v: Sort; l: string }[] = [
  { v: 'name', l: 'Name A–Z' }, { v: 'dueHigh', l: 'Highest due' }, { v: 'dueLow', l: 'Lowest due' }, { v: 'totalHigh', l: 'Biggest bill' }, { v: 'newest', l: 'Newest entries' }, { v: 'oldest', l: 'Oldest entries' },
];
const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function BillingTab() {
  const tournamentId = useTournamentStore((s) => s.tournamentId);
  const [bills, setBills] = useState<Bill[]>([]);
  const [removals, setRemovals] = useState<Removal[]>([]);
  const [ledger, setLedger] = useState(true);
  const [yet, setYet] = useState<Yet | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean; undo?: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');

  const load = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`/api/tournament/billing?tournamentId=${tournamentId}`);
    const d = await r.json().catch(() => ({}));
    setBills(d.bills ?? []);
    setRemovals(d.removals ?? []);
    setLedger(d.ledger !== false);
    setYet(d.yetToBill ?? null);
    setLoading(false);
  }, [tournamentId]);
  useEffect(() => { load(); }, [load]);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch('/api/tournament/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, ...body }),
    }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    return { ok: !!r?.ok, d: d as ApiResult };
  }
  function flash(text: string, ok = true, undo?: () => void) {
    setNote({ text, ok, undo });
    setTimeout(() => setNote((n) => (n?.text === text ? null : n)), undo ? 15000 : 7000);
  }

  async function email(headIds?: string[]) {
    if (!headIds && !confirm('Email every bill that still has something due?')) return;
    flash('Sending...');
    const { ok, d } = await call({ action: 'email', headIds });
    if (!ok) return flash(d.error ?? 'Failed', false);
    flash(`Emailed ${d.sent} bill${d.sent === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed` : ''}${d.noEmail ? `, ${d.noEmail} without an email` : ''}${d.desk ? `, ${d.desk} not on the platform (collect at the desk)` : ''}`, !d.failed);
  }

  async function pay(b: Bill, received: number, change: number, memo: string) {
    const { ok, d } = await call({ action: 'pay', headId: b.headId, received, change, note: memo });
    if (!ok) return flash(d.error ?? 'Not saved', false);
    setPaying(null);
    await load();
    const what = received === 0 ? `gave back QAR ${change} to ${b.head}` : `QAR ${received} from ${b.head}${change ? `, QAR ${change} change` : ''}`;
    flash(`Recorded: ${what}`, true, () => undoPayment(d.paymentId!, b.head));
  }
  async function undoPayment(id: string, head: string) {
    const { ok, d } = await call({ action: 'undoPayment', paymentId: id });
    if (!ok) return flash(d.error ?? 'Could not undo', false);
    await load();
    flash(`Payment undone for ${head}`);
  }
  async function remove(b: Bill, l: Line) {
    const pair = l.note.startsWith('with ');
    if (!confirm(`Take ${l.person} · ${l.category} off the bills?${pair ? `\n\nThis removes the pair (${l.note.split(' · ')[0]}): the partner's half comes off their bill too.` : ''}\n\nYou can undo this.`)) return;
    const { ok, d } = await call({ action: 'remove', regId: l.regId, headId: b.headId });
    if (!ok) return flash(d.error ?? 'Not removed', false);
    await load();
    flash(`Removed ${l.person} · ${l.category}`, true, () => restore(d.removalId!));
  }
  async function restore(id: string) {
    const { ok, d } = await call({ action: 'restore', removalId: id });
    if (!ok) return flash(d.error ?? 'Could not put it back', false);
    await load();
    flash('Entry is back on the bills');
  }

  // Grand totals over every bill
  const total = bills.reduce((s, b) => s + b.due, 0);
  const collected = bills.reduce((s, b) => s + b.paid, 0);
  const toCollect = bills.reduce((s, b) => s + Math.max(0, b.balance), 0);
  const toGiveBack = bills.reduce((s, b) => s + Math.max(0, -b.balance), 0);
  const offCount = bills.filter((b) => b.offPlatform).length;

  // Search by the head's name, email, mobile or QID, or the name of anyone on the bill
  const q = query.trim().toLowerCase();
  const inFilter = (b: Bill, f: Filter) => f === 'all' || (f === 'desk' ? !!b.offPlatform : payState(b.due, b.paid) === f);
  const shown = bills
    .filter((b) => inFilter(b, filter))
    .filter((b) => !q || [b.head, b.email, b.mobile, b.qid, ...b.lines.map((l) => l.person)].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => {
      switch (sort) {
        case 'dueHigh': return b.balance - a.balance || a.head.localeCompare(b.head);
        case 'dueLow': return a.balance - b.balance || a.head.localeCompare(b.head);
        case 'totalHigh': return b.due - a.due || a.head.localeCompare(b.head);
        case 'newest': return b.latest.localeCompare(a.latest);
        case 'oldest': return a.latest.localeCompare(b.latest);
        default: return Number(!!a.offPlatform) - Number(!!b.offPlatform) || a.head.trim().localeCompare(b.head.trim());
      }
    });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Billing</h2>
          <p className="text-stone-400 text-sm">One bill per family head, with only that family&apos;s people on it: each person pays their own fee, half for doubles. Everyone not on the platform gets a bill of their own{offCount ? ` (${offCount})` : ''}. Take cash with <b>Take payment</b>: it works out the change, and a part payment leaves the rest due.</p>
        </div>
        <button onClick={() => email()} disabled={busy || bills.every((b) => b.balance <= 0)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 disabled:opacity-40">
          Email bill to everyone with a balance
        </button>
      </div>

      {!ledger && (
        <p className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
          Taking payments needs a one-time database update: run <code>supabase/bill_payments.sql</code> in Supabase → SQL editor, then reload.
        </p>
      )}

      <div className={`grid gap-3 mb-5 ${toGiveBack ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {[{ l: 'Total billed', v: total, c: 'text-stone-900' }, { l: 'Collected', v: collected, c: 'text-emerald-600' }, { l: 'To collect', v: toCollect, c: 'text-orange-600' },
          ...(toGiveBack ? [{ l: 'To give back', v: toGiveBack, c: 'text-sky-700' }] : [])].map((x) => (
          <div key={x.l} className="bg-white rounded-xl border border-stone-200 p-4 text-center">
            <p className={`text-2xl font-black ${x.c}`}>QAR {x.v}</p>
            <p className="text-xs text-stone-400 mt-0.5">{x.l}</p>
          </div>
        ))}
      </div>

      {yet && yet.total > 0 && (
        <details className="mb-4 bg-white rounded-xl border border-stone-200">
          <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-stone-900">Yet to be billed</p>
              <p className="text-xs text-stone-400">Not on any bill yet: {yet.pending.length} entr{yet.pending.length === 1 ? 'y' : 'ies'} waiting for approval</p>
            </div>
            <p className="text-lg font-black text-stone-700 shrink-0">QAR {yet.total} ▾</p>
          </summary>
          <ul className="border-t border-stone-100 p-4 text-sm divide-y divide-stone-100">
            {yet.pending.map((x, i) => (
              <li key={i} className="py-1.5 flex justify-between gap-3">
                <span className="text-stone-700">{x.person}{x.family && x.family !== x.person ? <span className="text-stone-400"> · {x.family}</span> : null} <span className="text-stone-400">· {x.category}</span></span>
                <span className="font-semibold text-stone-800 shrink-0">QAR {x.amount}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {removals.length > 0 && (
        <details className="mb-4 bg-white rounded-xl border border-stone-200">
          <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-stone-900">Taken off the bills</p>
            <p className="text-xs text-stone-400">{removals.length} entr{removals.length === 1 ? 'y' : 'ies'} ▾</p>
          </summary>
          <ul className="border-t border-stone-100 p-4 text-sm divide-y divide-stone-100">
            {removals.map((r) => (
              <li key={r.id} className="py-1.5 flex items-center justify-between gap-3">
                <span className="text-stone-700">{r.label} <span className="text-stone-400">· {time(r.at)}</span></span>
                <button onClick={() => restore(r.id)} disabled={busy} className="px-2.5 py-1 border border-stone-200 rounded-lg text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-40">Put back</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {note && (
        <div className={`sticky top-2 z-10 text-sm rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-3 border ${note.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span>{note.text}</span>
          {note.undo && <button onClick={() => { const u = note.undo!; setNote(null); u(); }} disabled={busy} className="font-semibold underline shrink-0">Undo</button>}
        </div>
      )}
      {loading && <p className="text-sm text-stone-400">Loading...</p>}
      {!loading && bills.length === 0 && <p className="text-sm text-stone-400">No approved entries with a fee yet.</p>}

      {bills.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, mobile or QID"
              className="flex-1 min-w-[200px] px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-orange-400" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort"
              className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-700">
              {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button key={f.v} onClick={() => setFilter(f.v)}
                className={`px-2.5 py-1 rounded-full text-xs border ${filter === f.v ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
                {f.l} <span className="opacity-60">{bills.filter((b) => inFilter(b, f.v)).length}</span>
              </button>
            ))}
            {(q || filter !== 'all') && <span className="text-xs text-stone-400 ml-1">{shown.length} of {bills.length}</span>}
          </div>
        </div>
      )}
      {bills.length > 0 && shown.length === 0 && <p className="text-sm text-stone-400">No bill matches.</p>}

      <div className="space-y-2">
        {shown.map((b) => {
          const st = payState(b.due, b.paid);
          return (
            <div key={b.headId} className="bg-white rounded-xl border border-stone-200">
              <div className="flex items-center gap-3 p-4 flex-wrap sm:flex-nowrap">
                <button onClick={() => setOpen(open === b.headId ? null : b.headId)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-stone-900 truncate">{b.head}{b.offPlatform && <span className="ml-2 text-[10px] font-semibold text-stone-500 bg-stone-100 rounded px-1.5 py-0.5 align-middle">Not on the platform</span>}</p>
                  <p className="text-xs text-stone-400 truncate">{b.offPlatform ? 'Not emailed, pay at the desk' : b.email ?? 'no email on file'}{b.mobile ? ` · ${b.mobile}` : ''} · {b.lines.length} entr{b.lines.length === 1 ? 'y' : 'ies'}</p>
                </button>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${st === 'paid' ? 'text-emerald-600' : st === 'refund' ? 'text-sky-700' : 'text-orange-600'}`}>
                    {st === 'paid' ? 'Paid' : st === 'refund' ? `Give back QAR ${-b.balance}` : `QAR ${b.balance} due`}
                  </p>
                  <p className="text-xs text-stone-400">{st === 'partial' ? `paid ${b.paid} of ${b.due}` : `of QAR ${b.due}`}</p>
                </div>
                {b.offPlatform
                  ? <span className="px-1 text-xs text-stone-400 hidden sm:inline">At the desk</span>
                  : <button onClick={() => email([b.headId])} disabled={busy || !b.email}
                      className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg text-xs hover:bg-stone-50 disabled:opacity-40">Email bill</button>}
                {st !== 'paid' && (
                  <button onClick={() => { setPaying(paying === b.headId ? null : b.headId); setOpen(b.headId); }} disabled={busy || !ledger}
                    className={`px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 ${st === 'refund' ? 'bg-sky-700 text-white hover:bg-sky-800' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                    {st === 'refund' ? 'Give back' : 'Take payment'}
                  </button>
                )}
              </div>
              {paying === b.headId && <PayBox key={`${b.headId}-${b.balance}`} bill={b} busy={busy} onPay={(r, c, m) => pay(b, r, c, m)} onCancel={() => setPaying(null)} />}
              {open === b.headId && (
                <div className="border-t border-stone-100 px-4 py-2 text-sm">
                  <ul>
                    {b.lines.map((l, i) => (
                      <li key={`${l.regId}-${i}`} className="flex items-center justify-between py-1.5 gap-3">
                        <span className="text-stone-700">{l.person} <span className="text-stone-400">· {l.category}{l.note ? ` · ${l.note}` : ''}</span></span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className={l.paid ? 'text-emerald-600 font-semibold' : 'font-semibold text-stone-800'}>{l.paid ? 'Paid' : `QAR ${l.amount}`}</span>
                          {ledger && <button onClick={() => remove(b, l)} disabled={busy} title="Take this entry off the bill"
                            className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-40">Remove</button>}
                        </span>
                      </li>
                    ))}
                    {b.lines.length === 0 && <li className="py-1.5 text-stone-400">No entries left on this bill.</li>}
                  </ul>
                  {b.payments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed border-stone-200">
                      <p className="text-xs font-semibold text-stone-500 mb-1">Payments</p>
                      <ul>
                        {b.payments.map((p) => (
                          <li key={p.id} className="flex items-center justify-between py-1 gap-3 text-xs">
                            <span className="text-stone-600">
                              {time(p.at)} · {p.received === 0 ? `gave back QAR ${p.change}` : `received QAR ${p.received}${p.change ? `, change QAR ${p.change}` : ''}`}
                              {p.note ? <span className="text-stone-400"> · {p.note}</span> : null}
                            </span>
                            <span className="flex items-center gap-3 shrink-0">
                              <span className={`font-semibold ${p.amount < 0 ? 'text-sky-700' : 'text-emerald-600'}`}>{p.amount < 0 ? '−' : '+'}QAR {Math.abs(p.amount)}</span>
                              <button onClick={() => { if (confirm('Undo this payment?')) undoPayment(p.id, b.head); }} disabled={busy} className="text-stone-400 hover:text-red-600 disabled:opacity-40">Undo</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Cash in hand: type what they gave, see the change or what is still due, record it
function PayBox({ bill, busy, onPay, onCancel }: { bill: Bill; busy: boolean; onPay: (received: number, change: number, note: string) => void; onCancel: () => void }) {
  const refund = bill.balance < 0;
  const owed = Math.max(0, bill.balance);
  const [cash, setCash] = useState(refund ? String(-bill.balance) : '');
  const [giveChange, setGiveChange] = useState(true);
  const [memo, setMemo] = useState('');
  const amount = Number(cash);
  const valid = cash.trim() !== '' && Number.isFinite(amount) && amount > 0 && Math.round(amount * 100) === amount * 100;
  const change = valid && giveChange ? changeFor(bill.balance, amount) : 0;
  const after = valid ? owed - (amount - change) : owed;

  if (refund) {
    return (
      <div className="border-t border-stone-100 bg-sky-50/50 px-4 py-3 text-sm space-y-2">
        <p className="text-stone-700">They have paid QAR {-bill.balance} more than this bill now costs.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-stone-600">Giving back QAR</label>
          <input type="number" inputMode="decimal" min={0} value={cash} onChange={(e) => setCash(e.target.value)} className="w-28 px-2 py-1.5 border border-stone-300 rounded-lg" />
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-[140px] px-2 py-1.5 border border-stone-300 rounded-lg" />
          <button onClick={() => onPay(0, amount, memo)} disabled={busy || !valid || amount > -bill.balance} className="px-3 py-1.5 bg-sky-700 text-white rounded-lg text-xs disabled:opacity-40">Record given back</button>
          <button onClick={onCancel} className="px-2 py-1.5 text-xs text-stone-500">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-stone-100 bg-green-50/40 px-4 py-3 text-sm space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-stone-600">Due <b className="text-stone-900">QAR {owed}</b>. Cash received QAR</span>
        <input type="number" inputMode="decimal" min={0} autoFocus value={cash} onChange={(e) => setCash(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && valid && !busy) onPay(amount, change, memo); }}
          className="w-28 px-2 py-1.5 border border-stone-300 rounded-lg" />
        <button onClick={() => setCash(String(owed))} className="px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 bg-white">Exact {owed}</button>
        {[50, 100, 200, 500].filter((n) => n > owed).slice(0, 2).map((n) => (
          <button key={n} onClick={() => setCash(String(n))} className="px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 bg-white">{n} note</button>
        ))}
      </div>
      {valid && (
        <div className="rounded-lg bg-white border border-stone-200 px-3 py-2 space-y-1">
          {amount > owed ? (
            <>
              <p className="text-base font-bold text-sky-700">Give change: QAR {changeFor(bill.balance, amount)}</p>
              <label className="flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={giveChange} onChange={(e) => setGiveChange(e.target.checked)} />
                Change handed back (untick if they leave it with us: it shows as owed back to them)
              </label>
            </>
          ) : amount < owed ? (
            <p className="text-base font-bold text-orange-600">Part payment: QAR {after} still due after this</p>
          ) : (
            <p className="text-base font-bold text-emerald-600">Exact: bill paid in full</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note (optional), e.g. paid by Anil" className="flex-1 min-w-[160px] px-2 py-1.5 border border-stone-300 rounded-lg" />
        <button onClick={() => onPay(amount, change, memo)} disabled={busy || !valid}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-40">
          {valid && amount < owed ? `Record part payment QAR ${amount}` : 'Record payment'}
        </button>
        <button onClick={onCancel} className="px-2 py-1.5 text-xs text-stone-500">Cancel</button>
      </div>
    </div>
  );
}
