'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS as SHARED_CATEGORY_LABELS } from '@/lib/categories';
import { formatDateTime } from '@/lib/format';

type Registration = {
  id: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  partner_name: string | null;
  emergency_contact: string | null;
  payment_status: string;
  created_at: string;
  registration_code: string;
  player_profiles: {
    full_name: string;
    mobile: string | null;
    gender: string;
  } | null;
  tournaments: {
    name: string;
  } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  ...SHARED_CATEGORY_LABELS,
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
  boys_u13: 'Boys U13',
  boys_u15: 'Boys U15',
  boys_u18: 'Boys U18',
  girls_u13: 'Girls U13',
  girls_u15: 'Girls U15',
  girls_u18: 'Girls U18',
};

const STATUS_COLORS = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  async function fetchRegistrations() {
    const supabase = createClient();
    const { data } = await supabase
      .from('registrations')
      .select(`
        id, category, status, partner_name, emergency_contact,
        payment_status, created_at, registration_code,
        player_profiles!registrations_player_id_fkey ( full_name, mobile, gender ),
        tournaments ( name )
      `)
      .order('created_at', { ascending: false });
    setRegistrations((data as unknown as Registration[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setUpdating(id);
    const supabase = createClient();
    await supabase
      .from('registrations')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null })
      .eq('id', id);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    setUpdating(null);
  }

  async function bulkUpdateStatus(status: 'approved' | 'rejected') {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkUpdating(true);
    const supabase = createClient();
    await supabase
      .from('registrations')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null })
      .in('id', ids);
    setRegistrations((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, status } : r))
    );
    setSelectedIds(new Set());
    setBulkUpdating(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }

  const filtered = filter === 'all' ? registrations : registrations.filter((r) => r.status === filter);
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-[#111827] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-bold tracking-widest uppercase text-orange-400">RallyOps</span>
            <span className="text-orange-800 text-xs">·</span>
            <span className="text-xs text-orange-300/60">Admin</span>
          </div>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            Registrations
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingCount}</span>
            )}
          </h1>
        </div>
        <a href="/admin" className="text-xs text-orange-400 hover:text-orange-200 transition-colors">← Admin</a>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-stone-200 p-1.5 mb-6 flex gap-1 shadow-sm">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize flex-1 ${
                filter === f
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk action bar */}
        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-3 mb-4 flex items-center justify-between shadow-sm">
            <label className="flex items-center gap-2 text-sm text-stone-600 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
                onChange={() => toggleSelectAll(filtered.map((r) => r.id))}
                className="w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </label>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => bulkUpdateStatus('rejected')}
                  disabled={bulkUpdating}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  Reject {selectedIds.size}
                </button>
                <button
                  onClick={() => bulkUpdateStatus('approved')}
                  disabled={bulkUpdating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
                >
                  {bulkUpdating ? 'Updating...' : `Approve ${selectedIds.size}`}
                </button>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse h-20" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-stone-400">
            <p>No {filter === 'all' ? '' : filter} registrations yet.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((reg) => (
            <div key={reg.id} className={`bg-white rounded-xl border p-5 transition-colors ${selectedIds.has(reg.id) ? 'border-orange-300 bg-orange-50/30' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <input
                  type="checkbox"
                  checked={selectedIds.has(reg.id)}
                  onChange={() => toggleSelect(reg.id)}
                  className="w-4 h-4 mt-1 rounded border-stone-300 text-orange-600 focus:ring-orange-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-stone-900">{reg.player_profiles?.full_name ?? '-'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[reg.status]}`}>
                      {reg.status}
                    </span>
                  </div>
                  <div className="text-sm text-stone-500 space-y-0.5">
                    <p>{CATEGORY_LABELS[reg.category] ?? reg.category} · {reg.tournaments?.name}</p>
                    {reg.partner_name && <p>Partner: {reg.partner_name}</p>}
                    {reg.player_profiles?.mobile && <p>{reg.player_profiles.mobile}</p>}
                    {reg.emergency_contact && <p>Emergency: {reg.emergency_contact}</p>}
                    <p className="text-xs text-stone-400 mt-1">
                      {reg.registration_code} · {formatDateTime(reg.created_at)}
                    </p>
                  </div>
                </div>

                {reg.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(reg.id, 'rejected')}
                      disabled={updating === reg.id}
                      className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateStatus(reg.id, 'approved')}
                      disabled={updating === reg.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
                    >
                      {updating === reg.id ? '...' : 'Approve'}
                    </button>
                  </div>
                )}

                {reg.status === 'approved' && (
                  <button
                    onClick={() => updateStatus(reg.id, 'rejected')}
                    disabled={updating === reg.id}
                    className="px-3 py-1.5 border border-stone-200 text-stone-500 rounded-lg text-xs hover:border-red-300 hover:text-red-600 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
