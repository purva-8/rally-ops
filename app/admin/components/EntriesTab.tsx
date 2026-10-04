'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS as SHARED_CATEGORY_LABELS } from '@/lib/categories';
import { formatDateTime } from '@/lib/format';

type Registration = {
  id: string;
  player_id: string | null;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  review_comment?: string | null;
  notes?: string | null;
  partner_name: string | null;
  emergency_contact: string | null;
  registration_code: string;
  created_at: string;
  manual_name: string | null;
  manual_email: string | null;
  manual_mobile: string | null;
  manual_qid: string | null;
  player_profiles: { full_name: string; mobile: string | null; gender: string; qid: string | null } | null;
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

function displayName(r: Registration) {
  return r.player_profiles?.full_name ?? r.manual_name ?? '-';
}

// "VOLUNTEER | some remark" -> { volunteer, remark }
function parseNotes(notes?: string | null) {
  const parts = (notes ?? '').split('|').map((x) => x.trim()).filter(Boolean);
  return { volunteer: parts.includes('VOLUNTEER'), remark: parts.filter((x) => x !== 'VOLUNTEER' && x.toUpperCase() !== 'N/A').join(' | ') };
}
const waLink = (mobile: string) => `https://wa.me/${mobile.replace(/\D/g, '').replace(/^00/, '')}`;

function displayQid(r: Registration) {
  return r.player_profiles?.qid ?? r.manual_qid ?? r.registration_code;
}

export default function EntriesTab() {
  const { tournamentId } = useTournamentStore();
  const [tournamentName, setTournamentName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [bulkComment, setBulkComment] = useState('');
  const [mailNote, setMailNote] = useState('');
  const [issues, setIssues] = useState<Record<string, string[]>>({});

  async function emailDecisions(ids: string[]) {
    setMailNote('Sending...');
    const res = await fetch('/api/tournament/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, registrationIds: ids }),
    });
    const d = await res.json().catch(() => ({}));
    setMailNote(res.ok ? `Emailed ${d.decisions} player${d.decisions === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed` : ''}` : (d.error ?? 'Failed'));
    setTimeout(() => setMailNote(''), 6000);
  }
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', mobile: '', qid: '', category: '', partnerName: '' });

  useEffect(() => {
    if (!tournamentId) return;
    fetchRegistrations();
    fetch(`/api/tournament/eligibility?tournamentId=${tournamentId}`).then((r) => r.json()).then((d) => setIssues(d.issues ?? {})).catch(() => {});
    createClient().from('tournaments').select('name, categories').eq('id', tournamentId).single()
      .then(({ data }) => {
        if (data) { setTournamentName(data.name); setCategories(data.categories ?? []); }
      });
  }, [tournamentId]);

  async function fetchRegistrations() {
    const supabase = createClient();
    const { data } = await supabase
      .from('registrations')
      .select(`
        id, player_id, category, status, review_comment, notes, partner_name, emergency_contact, registration_code, created_at,
        manual_name, manual_email, manual_mobile, manual_qid,
        player_profiles!registrations_player_id_fkey ( full_name, mobile, gender, qid )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });
    setRegistrations((data as unknown as Registration[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    if (status === 'approved' && issues[id] && !confirm(`This entry breaks a rule:\n\n${issues[id].join('\n')}\n\nApprove it anyway?`)) return;
    setUpdating(id);
    const supabase = createClient();
    await supabase
      .from('registrations')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null, review_comment: comments[id]?.trim() || null })
      .eq('id', id);
    // The player gets one email covering all their decided entries (daily, or via Send updates)
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, status, review_comment: comments[id]?.trim() || null } : r)));
    setUpdating(null);
  }

  async function bulkUpdateStatus(status: 'approved' | 'rejected') {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const flagged = ids.filter((i) => issues[i]);
    if (status === 'approved' && flagged.length && !confirm(`${flagged.length} of the selected entries break a rule (marked with a red warning). Approve them anyway?`)) return;
    setBulkUpdating(true);
    const supabase = createClient();
    await supabase
      .from('registrations')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null, review_comment: bulkComment.trim() || null })
      .in('id', ids);
    setRegistrations((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status, review_comment: bulkComment.trim() || null } : r)));
    setSelectedIds(new Set());
    setBulkComment('');
    setBulkUpdating(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }

  async function handleAddEntry() {
    if (!tournamentId || !addForm.name.trim() || !addForm.category || !addForm.qid.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase.from('registrations').insert({
      tournament_id: tournamentId,
      player_id: null,
      category: addForm.category,
      manual_name: addForm.name.trim(),
      manual_email: addForm.email.trim() || null,
      manual_mobile: addForm.mobile.trim() || null,
      manual_qid: addForm.qid.trim(),
      partner_name: addForm.partnerName.trim() || null,
      status: 'approved',
      payment_status: 'waived',
    });
    if (!error) {
      setAddForm({ name: '', email: '', mobile: '', qid: '', category: '', partnerName: '' });
      setShowAddForm(false);
      fetchRegistrations();
    }
    setAdding(false);
  }

  const filtered = filter === 'all' ? registrations : registrations.filter((r) => r.status === filter);
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Entries</h2>
          <p className="text-stone-400 text-sm">{registrations.length} total registrations</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Register new'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
          <h3 className="text-sm font-bold text-stone-800 mb-3">Manually register a player</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            <input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name *" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">Category *</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
              ))}
            </select>
            <input value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email (for confirmation)" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <input value={addForm.mobile} onChange={(e) => setAddForm((f) => ({ ...f, mobile: e.target.value }))}
              placeholder="Mobile" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <input value={addForm.qid} onChange={(e) => setAddForm((f) => ({ ...f, qid: e.target.value }))}
              placeholder="Qatar ID *" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <input value={addForm.partnerName} onChange={(e) => setAddForm((f) => ({ ...f, partnerName: e.target.value }))}
              placeholder="Partner name (doubles only)" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 sm:col-span-2" />
          </div>
          <button onClick={handleAddEntry} disabled={adding || !addForm.name.trim() || !addForm.category || !addForm.qid.trim()}
            className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            {adding ? 'Adding...' : 'Add entry'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 p-1.5 mb-4 flex gap-1 shadow-sm">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button key={f} onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize flex-1 ${
              filter === f ? 'bg-orange-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {mailNote && <p className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-3">{mailNote}</p>}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-3 mb-4 flex items-center justify-between shadow-sm">
          <label className="flex items-center gap-2 text-sm text-stone-600 font-medium cursor-pointer select-none">
            <input type="checkbox" checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
              onChange={() => toggleSelectAll(filtered.map((r) => r.id))}
              className="w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500" />
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </label>
          {selectedIds.size > 0 && (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                placeholder="Comment for the player (optional)"
                className="hidden sm:block w-56 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button onClick={() => emailDecisions(Array.from(selectedIds))}
                className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors">
                Email {selectedIds.size}
              </button>
              <button onClick={() => bulkUpdateStatus('rejected')} disabled={bulkUpdating}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
                Reject {selectedIds.size}
              </button>
              <button onClick={() => bulkUpdateStatus('approved')} disabled={bulkUpdating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40">
                {bulkUpdating ? 'Updating...' : `Approve ${selectedIds.size}`}
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse h-20" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-stone-400 bg-white rounded-xl border border-stone-200">
          <p>No {filter === 'all' ? '' : filter} entries yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((reg) => (
          <div key={reg.id} className={`bg-white rounded-xl border p-5 transition-colors ${selectedIds.has(reg.id) ? 'border-orange-300 bg-orange-50/30' : 'border-stone-200'}`}>
            <div className="flex items-start justify-between gap-4">
              <input type="checkbox" checked={selectedIds.has(reg.id)} onChange={() => toggleSelect(reg.id)}
                className="w-4 h-4 mt-1 rounded border-stone-300 text-orange-600 focus:ring-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-stone-900">{displayName(reg)}</span>
                  {!reg.player_profiles && <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">Manual</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[reg.status]}`}>{reg.status}</span>
                </div>
                <div className="text-sm text-stone-500 space-y-0.5">
                  <p>{CATEGORY_LABELS[reg.category] ?? reg.category}</p>
                  {reg.partner_name && <p>Partner: {reg.partner_name}</p>}
                  {(() => {
                    const mobile = reg.player_profiles?.mobile ?? reg.manual_mobile;
                    const { volunteer, remark } = parseNotes(reg.notes);
                    return (
                      <>
                        {mobile && (
                          <p className="flex items-center gap-2 flex-wrap">
                            <span>{mobile}</span>
                            <a href={`tel:${mobile.replace(/\s/g, '')}`} className="text-xs font-semibold text-stone-600 border border-stone-200 rounded-md px-2 py-0.5 hover:bg-stone-50">Call</a>
                            <a href={waLink(mobile)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5 hover:bg-emerald-50">WhatsApp</a>
                          </p>
                        )}
                        {volunteer && <p><span className="text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5">Volunteer</span></p>}
                        {remark && <p className="text-sm text-stone-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2"><span className="text-[11px] font-bold uppercase tracking-wide text-amber-700 block">Remark from player</span>{remark}</p>}
                      </>
                    );
                  })()}
                  {issues[reg.id]?.map((m) => (
                    <p key={m} className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 mt-2">⚠ {m}. Reject this entry.</p>
                  ))}
                  {reg.emergency_contact && <p>Emergency: {reg.emergency_contact}</p>}
                  <p className="text-xs text-stone-400 mt-1">{displayQid(reg)} · {formatDateTime(reg.created_at)}</p>
                  {reg.status === 'pending' ? (
                    <input
                      type="text"
                      value={comments[reg.id] ?? ''}
                      onChange={(e) => setComments((c) => ({ ...c, [reg.id]: e.target.value }))}
                      placeholder="Comment for the player (optional)"
                      className="mt-2 w-full px-3 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  ) : reg.review_comment ? (
                    <p className="text-xs text-stone-500 mt-2 italic">Comment: {reg.review_comment}</p>
                  ) : null}
                </div>
              </div>

              {reg.status === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => updateStatus(reg.id, 'rejected')} disabled={updating === reg.id}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
                    Reject
                  </button>
                  <button onClick={() => updateStatus(reg.id, 'approved')} disabled={updating === reg.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40">
                    {updating === reg.id ? '...' : 'Approve'}
                  </button>
                </div>
              )}

              {reg.status !== 'pending' && (
                <button onClick={() => emailDecisions([reg.id])}
                  className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg text-xs hover:bg-stone-50 transition-colors shrink-0">
                  Email
                </button>
              )}

              {reg.status === 'approved' && (
                <button onClick={() => updateStatus(reg.id, 'rejected')} disabled={updating === reg.id}
                  className="px-3 py-1.5 border border-stone-200 text-stone-500 rounded-lg text-xs hover:border-red-300 hover:text-red-600 transition-colors shrink-0">
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
