'use client';
import { useEffect, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';

type Vol = { name: string; mobile: string; familyHead: string; remarks: string; status: string };

export default function VolunteersTab() {
  const tournamentId = useTournamentStore((s) => s.tournamentId);
  const [list, setList] = useState<Vol[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournament/volunteers?tournamentId=${tournamentId}`).then((r) => r.json()).then((d) => { setList(d.volunteers ?? []); setLoading(false); });
  }, [tournamentId]);

  const wa = (m: string) => `https://wa.me/${m.replace(/\D/g, '')}`;
  const copyAll = async () => {
    await navigator.clipboard?.writeText(list.map((v) => `${v.name}\t${v.mobile}`).join('\n')).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Volunteers</h2>
          <p className="text-stone-400 text-sm">People who ticked "I would like to volunteer" when registering.</p>
        </div>
        {list.length > 0 && (
          <button onClick={copyAll} className="px-4 py-2 border border-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50">
            {copied ? 'Copied' : `Copy ${list.length} names and numbers`}
          </button>
        )}
      </div>
      {loading && <p className="text-sm text-stone-400">Loading...</p>}
      {!loading && list.length === 0 && <p className="text-sm text-stone-400">Nobody has volunteered yet.</p>}
      <div className="space-y-2">
        {list.map((v, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-semibold text-stone-900">{v.name}</p>
              <p className="text-xs text-stone-400">{v.familyHead ? `Family of ${v.familyHead} · ` : ''}{v.status}</p>
              {v.remarks && <p className="text-xs text-stone-500 mt-1">Remarks: {v.remarks}</p>}
            </div>
            {v.mobile ? (
              <div className="flex items-center gap-2">
                <a href={`tel:${v.mobile}`} className="text-sm font-medium text-stone-800">{v.mobile}</a>
                <a href={wa(v.mobile)} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">WhatsApp</a>
              </div>
            ) : <span className="text-xs text-amber-600">No number on file</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
