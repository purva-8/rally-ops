'use client';

import { useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../tournament/types';
import type { Category } from '../../tournament/types';

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
          <h2 className="text-lg font-bold text-stone-900">Participants</h2>
          <p className="text-stone-400 text-sm">{participants.length} total registrations</p>
        </div>
        <a href="/tournament" className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Register new
        </a>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-3 mb-4 flex flex-col sm:flex-row gap-2.5">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, mobile…"
          className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as Category | '')}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-stone-300" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
          </div>
          <p className="text-stone-400 text-sm">No participants found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Categories</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Reg ID</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      {editId === p.id ? (
                        <div className="flex gap-2 items-center">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)}
                            className="border border-stone-200 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <button onClick={() => { updateParticipant(p.id, { fullName: editName }); setEditId(null); }}
                            className="text-orange-600 hover:text-orange-700 text-xs font-semibold">Save</button>
                          <button onClick={() => setEditId(null)} className="text-stone-300 hover:text-stone-500 text-xs">✕</button>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-stone-900">{p.fullName}</p>
                          <p className="text-stone-400 text-xs capitalize">{p.gender}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-stone-700">{p.mobile}</p>
                      <p className="text-stone-400 text-xs">{p.email}</p>
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
                      <span className="font-mono text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded">{p.registrationId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => { setEditId(p.id); setEditName(p.fullName); }}
                          className="text-stone-500 hover:text-stone-700 text-xs font-medium">Edit</button>
                        <a href={`/stats/${p.id}`} target="_blank"
                          className="text-orange-600 hover:text-orange-700 text-xs font-medium">Stats</a>
                        <button onClick={() => { if (confirm(`Delete ${p.fullName}?`)) deleteParticipant(p.id); }}
                          className="text-red-400 hover:text-red-600 text-xs">Delete</button>
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
