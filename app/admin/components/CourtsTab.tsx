'use client';

import { useState } from 'react';
import { useTournamentStore } from '../../tournament/store';

export default function CourtsTab() {
  const { courts, users, matches, assignRefereeToCourt, addCourt } = useTournamentStore();
  const [newCourtName, setNewCourtName] = useState('');
  const coaches = users.filter((u) => u.role === 'coach');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Court Management</h2>
          <p className="text-stone-400 text-sm">{courts.length} courts configured</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-3 mb-6 flex gap-3">
        <input type="text" value={newCourtName} onChange={(e) => setNewCourtName(e.target.value)}
          placeholder="New court name (e.g. Court 5)"
          onKeyDown={(e) => { if (e.key === 'Enter' && newCourtName.trim()) { addCourt(newCourtName.trim()); setNewCourtName(''); } }}
          className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <button onClick={() => { if (newCourtName.trim()) { addCourt(newCourtName.trim()); setNewCourtName(''); } }}
          className="bg-[#111827] hover:bg-[#1F2937] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          Add Court
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {courts.map((court) => {
          const currentMatch = matches.find((m) => m.id === court.currentMatchId && m.status === 'in_progress');
          const assignedCoach = coaches.find((u) => u.courtId === court.id);

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
                <p className="text-xs text-stone-400 font-medium mb-1">Assigned Referee</p>
                <select
                  value={assignedCoach?.id || ''}
                  onChange={(e) => {
                    const coach = coaches.find((u) => u.id === e.target.value);
                    if (coach) assignRefereeToCourt(court.id, coach.id, coach.name);
                  }}
                  className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-stone-50"
                >
                  <option value="">No referee assigned</option>
                  {coaches.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {assignedCoach && (
                <a href={`/coach/${court.id}`}
                  className="mt-3 w-full block text-center text-sm bg-orange-600 hover:bg-orange-500 text-white py-1.5 rounded-lg transition-colors font-semibold">
                  Open Referee View
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-base font-bold text-stone-900 mb-4">Referees</h3>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Court</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {coaches.map((u) => {
                const court = courts.find((c) => c.id === u.courtId);
                return (
                  <tr key={u.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-semibold text-stone-800">{u.name}</td>
                    <td className="px-4 py-3 text-stone-500 hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-3">
                      {court ? (
                        <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">{court.name}</span>
                      ) : (
                        <span className="text-stone-300 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.courtId && (
                        <a href={`/coach/${u.courtId}`} className="text-orange-600 hover:text-orange-700 text-xs font-semibold">
                          Open Dashboard
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
