'use client';

import { useState, useEffect } from 'react';
import { useTournamentStore } from '../../tournament/store';

type Staff = {
  id: string;
  email: string;
  name: string;
  role: 'coach' | 'admin';
  court_id: string | null;
  status: 'invited' | 'active';
};

export default function CourtsTab() {
  const { courts, matches, tournamentId, addCourt } = useTournamentStore();
  const [newCourtName, setNewCourtName] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCourt, setInviteCourt] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (!tournamentId) { setLoadingStaff(false); return; }
    fetchStaff();
  }, [tournamentId]);

  async function fetchStaff() {
    if (!tournamentId) return;
    setLoadingStaff(true);
    const res = await fetch(`/api/tournament/staff?tournamentId=${tournamentId}`);
    const data = await res.json();
    setStaff(data.staff ?? []);
    setLoadingStaff(false);
  }

  async function handleInvite() {
    if (!tournamentId || !inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    const res = await fetch('/api/tournament/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, name: inviteName.trim(), email: inviteEmail.trim(), courtId: inviteCourt || null, role: 'coach' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteError(data.error ?? 'Failed to send invite');
      setInviting(false);
      return;
    }
    setInviteName('');
    setInviteEmail('');
    setInviteCourt('');
    setInviting(false);
    fetchStaff();
  }

  async function handleRemoveStaff(id: string) {
    if (!confirm('Remove this coach invite?')) return;
    await fetch(`/api/tournament/staff?id=${id}`, { method: 'DELETE' });
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  const coaches = staff.filter((s) => s.role === 'coach');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Court Management</h2>
          <p className="text-stone-400 text-sm">{courts.filter((c) => coaches.some((co) => co.court_id === c.id)).length} of {courts.length} courts have a coach assigned</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-3 mb-6 flex gap-3">
        <input type="text" value={newCourtName} onChange={(e) => setNewCourtName(e.target.value)}
          placeholder={courts.length >= 10 ? 'Maximum of 10 courts reached' : 'New court name (e.g. Court 5)'}
          disabled={courts.length >= 10}
          onKeyDown={(e) => { if (e.key === 'Enter' && newCourtName.trim() && courts.length < 10) { addCourt(newCourtName.trim()); setNewCourtName(''); } }}
          className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50" />
        <button onClick={() => { if (newCourtName.trim() && courts.length < 10) { addCourt(newCourtName.trim()); setNewCourtName(''); } }}
          disabled={courts.length >= 10}
          className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          Add Court
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {courts.filter((court) => coaches.some((c) => c.court_id === court.id)).map((court) => {
          const currentMatch = matches.find((m) => m.id === court.currentMatchId && m.status === 'in_progress');
          const assignedCoach = coaches.find((c) => c.court_id === court.id);

          return (
            <div key={court.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-stone-900">{court.name}</h3>
                {currentMatch && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                  </span>
                )}
              </div>

              {currentMatch ? (
                <div className="bg-stone-50 rounded-lg p-3 mb-3 border border-stone-100">
                  <p className="text-xs font-semibold text-stone-500 mb-1.5">In Progress</p>
                  <p className="text-sm font-semibold text-stone-800">{currentMatch.player1Name}</p>
                  <p className="text-xs text-stone-400 my-0.5">vs</p>
                  <p className="text-sm font-semibold text-stone-800">{currentMatch.player2Name}</p>
                </div>
              ) : (
                <div className="bg-stone-50 rounded-lg p-3 mb-3 text-sm text-stone-300 text-center border border-stone-100">No active match</div>
              )}

              <div>
                <p className="text-xs text-stone-400 font-medium mb-1">Assigned Coach</p>
                {assignedCoach ? (
                  <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{assignedCoach.name}</p>
                      <p className="text-[11px] text-stone-400">{assignedCoach.status === 'active' ? 'Active' : 'Invite pending'}</p>
                    </div>
                    {assignedCoach.status === 'active' && (
                      <a href={`/coach/${court.id}?tournamentId=${tournamentId}`} target="_blank" rel="noreferrer"
                        className="text-orange-600 hover:text-orange-700 text-xs font-semibold shrink-0">
                        Coach View
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-stone-300 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">No coach invited yet</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <h3 className="text-base font-bold text-stone-900 mb-1">Invite a Coach</h3>
        <p className="text-stone-400 text-sm mb-4">They'll get an email to create an account or sign in — no shared passwords.</p>
        <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col sm:flex-row gap-2.5">
          <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)}
            placeholder="Coach name"
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="coach@email.com"
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <select value={inviteCourt} onChange={(e) => setInviteCourt(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">No court yet</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={handleInvite} disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0">
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        {inviteError && <p className="text-red-500 text-xs mt-2">{inviteError}</p>}
      </div>

      <div>
        <h3 className="text-base font-bold text-stone-900 mb-4">Coaches</h3>
        {loadingStaff ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-300 text-sm">Loading...</div>
        ) : coaches.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-300 text-sm">No coaches invited yet.</div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Court</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {coaches.map((s) => {
                  const court = courts.find((c) => c.id === s.court_id);
                  return (
                    <tr key={s.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-semibold text-stone-800">{s.name}</td>
                      <td className="px-4 py-3 text-stone-500 hidden md:table-cell">{s.email}</td>
                      <td className="px-4 py-3">
                        {court ? (
                          <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">{court.name}</span>
                        ) : (
                          <span className="text-stone-300 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {s.status === 'active' ? 'Active' : 'Invite pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleRemoveStaff(s.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
