'use client';

import { useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Participant, Category } from '../../tournament/types';

export default function ParticipantsTab() {
  const { participants, deleteParticipant, updateParticipant } = useTournamentStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<Category | ''>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const filtered = participants.filter((p) => {
    const matchSearch = !search || p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) || p.mobile.includes(search);
    const matchCat = !filterCat || p.categories.includes(filterCat);
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Participants</h2>
          <p className="text-gray-500 text-sm">{participants.length} total registrations</p>
        </div>
        <a href="/tournament" className="bg-orange-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-800 transition-colors">
          + Register New
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, mobile..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as Category | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <span className="text-5xl">👥</span>
          <p className="text-gray-500 mt-3">No participants found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Categories</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium hidden lg:table-cell">Reg ID</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {editId === p.id ? (
                        <div className="flex gap-2">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <button onClick={() => { updateParticipant(p.id, { fullName: editName }); setEditId(null); }}
                            className="text-orange-600 hover:text-orange-800 text-xs font-medium">Save</button>
                          <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-gray-800">{p.fullName}</p>
                          <p className="text-gray-500 text-xs capitalize">{p.gender}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-gray-700">{p.mobile}</p>
                      <p className="text-gray-500 text-xs">{p.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.categories.map((cat) => (
                          <span key={cat} className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                            {CATEGORY_LABELS[cat]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{p.registrationId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditId(p.id); setEditName(p.fullName); }}
                          className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                        <a href={`/stats/${p.id}`} target="_blank"
                          className="text-orange-600 hover:text-orange-800 text-sm font-medium">Stats ↗</a>
                        <button onClick={() => { if (confirm(`Delete ${p.fullName}?`)) deleteParticipant(p.id); }}
                          className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
