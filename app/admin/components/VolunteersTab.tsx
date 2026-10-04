'use client';
import { useEffect, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';

type Vol = { name: string; mobile: string; familyHead: string; volunteer: boolean; remarks: string[]; status: string };

export default function VolunteersTab() {
  const tournamentId = useTournamentStore((s) => s.tournamentId);
  const [list, setList] = useState<Vol[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'all' | 'volunteers' | 'remarks'>('all');

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournament/volunteers?tournamentId=${tournamentId}`).then((r) => r.json()).then((d) => { setList(d.volunteers ?? []); setLoading(false); });
  }, [tournamentId]);

  const wa = (m: string) => `https://wa.me/${m.replace(/\D/g, '')}`;
  const shown = list.filter((v) => view === 'all' || (view === 'volunteers' ? v.volunteer : v.remarks.length > 0));
  const volunteers = list.filter((v) => v.volunteer);
  const copyAll = async () => {
    await navigator.clipboard?.writeText(volunteers.map((v) => `${v.name}\t${v.mobile}`).join('\n')).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Volunteers &amp; remarks</h2>
          <p className="text-stone-400 text-sm">People who ticked "I would like to volunteer" or left a remark when registering.</p>
        </div>
        {volunteers.length > 0 && (
          <button onClick={copyAll} className="px-4 py-2 border border-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50">
            {copied ? 'Copied' : `Copy ${volunteers.length} volunteer names and numbers`}
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-1.5 mb-4 flex gap-1 shadow-sm">
        {([['all', `All (${list.length})`], ['volunteers', `Volunteers (${volunteers.length})`], ['remarks', `Remarks (${list.filter((v) => v.remarks.length > 0).length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex-1 transition-colors ${view === k ? 'bg-orange-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}`}>{label}</button>
        ))}
      </div>
      {loading && <p className="text-sm text-stone-400">Loading...</p>}
      {!loading && list.length === 0 && <p className="text-sm text-stone-400">Nothing here yet.</p>}
      <div className="space-y-2">
        {shown.map((v, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-semibold text-stone-900">{v.name} {v.volunteer && <span className="ml-1 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5">Volunteer</span>}</p>
              <p className="text-xs text-stone-400">{v.familyHead ? `Family of ${v.familyHead} · ` : ''}{v.status}</p>
              {v.remarks.map((r, j) => <p key={j} className="text-sm text-stone-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">{r}</p>)}
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
