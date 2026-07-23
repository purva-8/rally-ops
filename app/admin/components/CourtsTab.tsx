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
          <h2 className="text-xl font-bold text-gray-800">Court Management</h2>
          <p className="text-gray-500 text-sm">{courts.length} courts configured</p>
        </div>
      </div>

      {/* Add court */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3">
        <input type="text" value={newCourtName} onChange={(e) => setNewCourtName(e.target.value)}
          placeholder="New court name (e.g. Court 5)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <button onClick={() => { if (newCourtName.trim()) { addCourt(newCourtName.trim()); setNewCourtName(''); } }}
          className="bg-orange-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-800 transition-colors">
          + Add Court
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {courts.map((court) => {
          const currentMatch = matches.find((m) => m.id === court.currentMatchId && m.status === 'in_progress');
          const assignedCoach = coaches.find((u) => u.courtId === court.id);

          return (
            <div key={court.id} className="bg-white rounded-xl border-2 border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🏟️</span>
                <h3 className="font-bold text-gray-800">{court.name}</h3>
                {currentMatch && (
                  <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">LIVE</span>
                )}
              </div>

              {currentMatch ? (
                <div className="bg-orange-50 rounded-lg p-3 mb-3 text-sm">
                  <p className="font-medium text-orange-800">In Progress</p>
                  <p className="text-orange-700 text-xs mt-1">{currentMatch.player1Name}</p>
                  <p className="text-orange-500 text-xs">vs</p>
                  <p className="text-orange-700 text-xs">{currentMatch.player2Name}</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-400 text-center">No active match</div>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-1">Assigned Referee</p>
                <select
                  value={assignedCoach?.id || ''}
                  onChange={(e) => {
                    const coach = coaches.find((u) => u.id === e.target.value);
                    if (coach) assignRefereeToCourt(court.id, coach.id, coach.name);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">No referee assigned</option>
                  {coaches.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {assignedCoach && (
                <a href={`/coach/${court.id}`}
                  className="mt-3 w-full block text-center text-sm bg-orange-700 text-white py-1.5 rounded-lg hover:bg-orange-800 transition-colors">
                  Open Referee View →
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Coaches list */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Referees</h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Assigned Court</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Referee Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coaches.map((u) => {
                const court = courts.find((c) => c.id === u.courtId);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      {court ? (
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">{court.name}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.courtId && (
                        <a href={`/coach/${u.courtId}`} className="text-orange-600 hover:text-orange-800 text-xs underline">
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
