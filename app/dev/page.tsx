'use client';
import { useEffect, useState } from 'react';

type Row = Record<string, any>;
const PROFILE_FIELDS = ['full_name', 'mobile', 'gender', 'dob', 'qid', 'samanvayam_member', 'samanvayam_id', 'relationship'];
const REG_FIELDS = ['status', 'payment_status', 'payment_ref', 'partner_name', 'review_comment'];

export default function DevPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => { fetch('/api/dev/me').then((r) => r.json()).then((d) => setOk(d.ok)).catch(() => setOk(false)); }, []);

  const search = async () => {
    const r = await fetch(`/api/dev/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    setPeople(d.people ?? []);
  };
  useEffect(() => { if (ok) search(); /* eslint-disable-next-line */ }, [ok]);

  const open = async (id: string) => {
    setMsg('');
    const r = await fetch(`/api/dev/profile?id=${id}`);
    setDetail(await r.json());
  };
  const save = async (table: string, id: string, patch: Row) => {
    const r = await fetch('/api/dev/update', { method: 'POST', body: JSON.stringify({ table, id, patch }) });
    const d = await r.json();
    setMsg(d.ok ? 'Saved (logged in change history)' : d.error);
    if (d.ok && detail?.account) open(detail.account.id);
  };
  const restore = async (auditId: number) => {
    if (!confirm('Undo this change?')) return;
    const r = await fetch('/api/dev/restore', { method: 'POST', body: JSON.stringify({ auditId }) });
    const d = await r.json();
    setMsg(d.ok ? d.result : d.error);
    if (detail?.account) open(detail.account.id);
  };
  const impersonate = async (profileId: string) => {
    if (!confirm('Open a one-time sign-in link for this account? This is recorded.')) return;
    const r = await fetch('/api/dev/impersonate', { method: 'POST', body: JSON.stringify({ profileId }) });
    const d = await r.json();
    if (d.link) {
      await navigator.clipboard?.writeText(d.link).catch(() => {});
      setLink(d.link);
      setMsg(`Link ready for ${d.email}. Copy it, open a private window, paste it in the address bar. Do not open it in this window, it would sign you out. It works once.`);
    } else { setLink(''); setMsg(d.error); }
  };

  if (ok === null) return <p className="p-8 text-stone-500">Checking access…</p>;
  if (!ok) return <p className="p-8 text-stone-700">Not available.</p>;

  const Field = ({ table, row, name }: { table: string; row: Row; name: string }) => {
    const [v, setV] = useState(String(row[name] ?? ''));
    return (
      <label className="block text-xs text-stone-500">
        {name}
        <div className="flex gap-1">
          <input className="flex-1 border rounded px-2 py-1 text-sm text-stone-900" value={v} onChange={(e) => setV(e.target.value)} />
          {v !== String(row[name] ?? '') && (
            <button className="text-xs px-2 rounded bg-orange-500 text-white" onClick={() => save(table, row.id, { [name]: name === 'samanvayam_member' ? v === 'true' : v })}>Save</button>
          )}
        </div>
      </label>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Developer section</h1>
      <div className="flex gap-2">
        <input className="flex-1 border rounded px-3 py-2" placeholder="Name, Qatar ID, mobile or Samanvayam ID" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button className="px-4 rounded bg-stone-900 text-white" onClick={search}>Search</button>
      </div>
      {msg && <p className="text-sm bg-amber-50 border border-amber-200 rounded p-2 text-stone-800">{msg}</p>}
      {link && (
        <div className="flex gap-2">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 border rounded px-2 py-1 text-xs text-stone-700" />
          <button className="px-3 rounded bg-stone-900 text-white text-sm" onClick={() => navigator.clipboard?.writeText(link)}>Copy</button>
        </div>
      )}

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <ul className="space-y-1 max-h-[70vh] overflow-auto">
          {Array.from(new Set(people.map((p) => p.parent_id ?? p.id))).map((hid) => {
            const head = people.find((p) => p.id === hid);
            const members = people.filter((p) => p.parent_id === hid).sort((x, y) => String(x.full_name).localeCompare(String(y.full_name)));
            if (!head) return null;
            return (
              <li key={hid} className="border rounded overflow-hidden">
                <button onClick={() => open(head.id)} className="w-full text-left p-2 bg-stone-50 hover:bg-stone-100">
                  <p className="text-sm font-semibold text-stone-900">{head.full_name}</p>
                  <p className="text-xs text-stone-500">{head.qid ?? 'no QID'} · account · {members.length} member{members.length === 1 ? '' : 's'}</p>
                </button>
                {members.map((m) => (
                  <button key={m.id} onClick={() => open(m.id)} className="w-full text-left py-1.5 pl-6 pr-2 border-t hover:bg-stone-50">
                    <p className="text-sm text-stone-800">{m.full_name}</p>
                    <p className="text-xs text-stone-500">{m.relationship ?? 'member'}{m.qid ? ` · ${m.qid}` : ''}</p>
                  </button>
                ))}
              </li>
            );
          })}
        </ul>

        {detail?.account && (
          <div className="space-y-4">
            <div className="border rounded p-3">
              <p className="text-sm text-stone-600">Login email: <b>{detail.email ?? 'none'}</b></p>
              <button className="mt-2 text-sm px-3 py-1 rounded bg-stone-900 text-white" onClick={() => impersonate(detail.account.id)}>Sign in as this account</button>
            </div>
            {detail.household.map((p: Row) => (
              <div key={p.id} className="border rounded p-3">
                <p className="font-semibold text-stone-900 mb-2">{p.full_name} <span className="text-xs text-stone-400">{p.parent_id ? p.relationship : 'account holder'}</span></p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {PROFILE_FIELDS.map((f) => <Field key={f} table="player_profiles" row={p} name={f} />)}
                </div>
              </div>
            ))}
            <div className="border rounded p-3">
              <p className="font-semibold text-stone-900 mb-2">Entries</p>
              {(detail.registrations ?? []).map((r: Row) => (
                <div key={r.id} className="border-t pt-2 mt-2">
                  <p className="text-sm text-stone-800">{r.category} · {r.tournaments?.name}</p>
                  <div className="grid sm:grid-cols-2 gap-2 mt-1">
                    {REG_FIELDS.map((f) => <Field key={f} table="registrations" row={r} name={f} />)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border rounded p-3">
              <p className="font-semibold text-stone-900 mb-2">Change history (newest first)</p>
              {(detail.history ?? []).map((h: Row) => (
                <div key={h.id} className="flex items-center justify-between text-xs border-t py-1 text-stone-700">
                  <span>{new Date(h.at).toLocaleString('en-GB')} · {h.action} · {h.table_name}</span>
                  {(h.action === 'UPDATE' || h.action === 'DELETE' || h.action === 'DEV_EDIT') && (
                    <button className="px-2 py-0.5 rounded border" onClick={() => restore(h.id)}>Undo</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
