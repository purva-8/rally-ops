'use client';

import { useEffect, useState } from 'react';
import { deviceBackups, keepBackup } from '@/lib/deskSafety';

const EVERY = 5 * 60 * 1000;

function download(json: string, name: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// While the admin page is open, a full backup of the event is kept on this device every 5 minutes (the last 3).
// Download backup saves a fresh one; if the server can't be reached, the last device copy is offered instead.
export default function BackupBar({ tournamentId }: { tournamentId: string }) {
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const take = async () => {
      const res = await fetch(`/api/tournament/backup?tournamentId=${tournamentId}`).catch(() => null);
      if (!res?.ok || stop) return;
      keepBackup(await res.text());
      setLast(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    };
    const first = setTimeout(take, 5000);
    const t = setInterval(take, EVERY);
    return () => { stop = true; clearTimeout(first); clearInterval(t); };
  }, [tournamentId]);

  async function now() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/tournament/backup?tournamentId=${tournamentId}`).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const json = await res.text();
      keepBackup(json);
      download(json, `rallyops-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
      setLast(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      return;
    }
    const kept = deviceBackups()[0];
    if (kept) {
      download(kept.json, `rallyops-backup-device-${kept.at.slice(0, 16).replace(/[:T]/g, '-')}.json`);
      setMsg(`The server can't be reached, so this is the copy kept on this device at ${new Date(kept.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    } else setMsg("The server can't be reached and this device has no backup yet.");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-stone-500">
      <button onClick={now} disabled={busy} className="px-3 py-1.5 border border-stone-200 bg-white rounded-lg text-stone-700 font-semibold hover:bg-stone-50 disabled:opacity-50">
        {busy ? 'Backing up…' : '⬇ Download backup'}
      </button>
      <span>{last ? `Auto backup on this device: ${last}` : 'Auto backup every 5 min while open'}</span>
      {msg && <span className="w-full text-amber-800">{msg}</span>}
    </div>
  );
}
