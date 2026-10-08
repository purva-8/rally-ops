'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';

type Line = { regId: string; person: string; category: string; note: string; amount: number; paid: boolean; pending: boolean };
type Bill = { headId: string; head: string; email: string | null; qid: string | null; mobile: string | null; lines: Line[]; due: number; paid: number; balance: number; pendingAmount: number };

type YetItem = { person: string; family: string; category: string; amount: number; why: string };
type Yet = { total: number; pending: YetItem[]; partners: YetItem[] };

export default function BillingTab() {
  const tournamentId = useTournamentStore((s) => s.tournamentId);
  const [bills, setBills] = useState<Bill[]>([]);
  const [yet, setYet] = useState<Yet | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    const r = await fetch(`/api/tournament/billing?tournamentId=${tournamentId}`);
    const d = await r.json().catch(() => ({}));
    setBills(d.bills ?? []);
    setYet(d.yetToBill ?? null);
    setLoading(false);
  }, [tournamentId]);
  useEffect(() => { load(); }, [load]);

  async function act(action: 'email' | 'markPaid', headIds?: string[]) {
    if (action === 'markPaid' && !confirm('Mark these bills as paid?')) return;
    setBusy(true); setNote('Working...');
    const r = await fetch('/api/tournament/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, tournamentId, headIds }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setNote(d.error ?? 'Failed');
    else if (action === 'email') setNote(`Emailed ${d.sent} bill${d.sent === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed` : ''}${d.noEmail ? `, ${d.noEmail} without an email` : ''}`);
    else { setNote(`Marked ${d.updated} entries paid`); await load(); }
    setBusy(false);
    setTimeout(() => setNote(''), 7000);
  }

  const total = bills.reduce((s, b) => s + b.due, 0);
  const paid = bills.reduce((s, b) => s + b.paid, 0);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Billing</h2>
          <p className="text-stone-400 text-sm">One bill per family, from approved entries only. Everything is due until you hit Mark paid. Doubles are split into halves.</p>
        </div>
        <button onClick={() => act('email')} disabled={busy || bills.every((b) => b.balance <= 0)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 disabled:opacity-40">
          Email bill to everyone with a balance
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[{ l: 'Total billed', v: total, c: 'text-stone-900' }, { l: 'Paid', v: paid, c: 'text-emerald-600' }, { l: 'To collect', v: total - paid, c: 'text-orange-600' }].map((x) => (
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
              <p className="text-xs text-stone-400">Not on any bill yet: {yet.pending.length} entr{yet.pending.length === 1 ? 'y' : 'ies'} waiting for approval, {yet.partners.length} partner half{yet.partners.length === 1 ? '' : 's'} waiting for the partner to enter</p>
            </div>
            <p className="text-lg font-black text-stone-700 shrink-0">QAR {yet.total} ▾</p>
          </summary>
          <div className="border-t border-stone-100 p-4 space-y-4">
            {[{ title: 'Waiting for your approval', items: yet.pending }, { title: 'Partner has not entered yet', items: yet.partners }].map((g) => g.items.length > 0 && (
              <div key={g.title}>
                <p className="text-xs font-semibold text-stone-500 mb-1">{g.title} · QAR {g.items.reduce((s, x) => s + x.amount, 0)}</p>
                <ul className="text-sm divide-y divide-stone-100">
                  {g.items.map((x, i) => (
                    <li key={i} className="py-1.5 flex justify-between gap-3">
                      <span className="text-stone-700">{x.person}{x.family && x.family !== x.person ? <span className="text-stone-400"> · {x.family}</span> : null} <span className="text-stone-400">· {x.category}</span><span className="block text-xs text-stone-400">{x.why}</span></span>
                      <span className="font-semibold text-stone-800 shrink-0">QAR {x.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
      {note && <p className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-3">{note}</p>}
      {loading && <p className="text-sm text-stone-400">Loading...</p>}
      {!loading && bills.length === 0 && <p className="text-sm text-stone-400">No approved entries with a fee yet.</p>}

      <div className="space-y-2">
        {bills.map((b) => (
          <div key={b.headId} className="bg-white rounded-xl border border-stone-200">
            <div className="flex items-center gap-3 p-4">
              <button onClick={() => setOpen(open === b.headId ? null : b.headId)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-stone-900 truncate">{b.head}</p>
                <p className="text-xs text-stone-400 truncate">{b.email ?? 'no email on file'}{b.mobile ? ` · ${b.mobile}` : ''} · {b.lines.length} entr{b.lines.length === 1 ? 'y' : 'ies'}</p>
              </button>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${b.balance > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{b.balance > 0 ? `QAR ${b.balance} due` : 'Paid'}</p>
                <p className="text-xs text-stone-400">of QAR {b.due}</p>
              </div>
              <button onClick={() => act('email', [b.headId])} disabled={busy || !b.email}
                className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg text-xs hover:bg-stone-50 disabled:opacity-40">Email bill</button>
              {b.balance > 0 && (
                <button onClick={() => act('markPaid', [b.headId])} disabled={busy}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-40">Mark paid</button>
              )}
            </div>
            {open === b.headId && (
              <ul className="border-t border-stone-100 px-4 py-2 text-sm">
                {b.lines.map((l) => (
                  <li key={l.regId} className="flex justify-between py-1.5 gap-3">
                    <span className="text-stone-700">{l.person} <span className="text-stone-400">· {l.category}{l.note ? ` · ${l.note}` : ''}</span></span>
                    <span className={l.paid ? 'text-emerald-600 font-semibold' : 'font-semibold text-stone-800'}>{l.paid ? 'Paid' : `QAR ${l.amount}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
