'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
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
        player_profiles ( full_name, mobile, gender ),
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

  const filtered = filter === 'all' ? registrations : registrations.filter((r) => r.status === filter);
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-stone-900">Registrations</h1>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-600 font-medium">{pendingCount} pending approval</p>
          )}
        </div>
        <a href="/admin" className="text-sm text-stone-500 hover:text-stone-900">← Admin</a>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors capitalize ${
                filter === f
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
              }`}
            >
              {f}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

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
            <div key={reg.id} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-stone-900">{reg.player_profiles?.full_name ?? '—'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[reg.status]}`}>
                      {reg.status}
                    </span>
                  </div>
                  <div className="text-sm text-stone-500 space-y-0.5">
                    <p>{CATEGORY_LABELS[reg.category] ?? reg.category} · {reg.tournaments?.name}</p>
                    {reg.partner_name && <p>Partner: {reg.partner_name}</p>}
                    {reg.player_profiles?.mobile && <p>📞 {reg.player_profiles.mobile}</p>}
                    {reg.emergency_contact && <p>🚨 {reg.emergency_contact}</p>}
                    <p className="text-xs text-stone-400 mt-1">
                      {reg.registration_code} · {new Date(reg.created_at).toLocaleString()}
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
