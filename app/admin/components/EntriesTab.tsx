'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS as SHARED_CATEGORY_LABELS, categoryFee, isDoublesCategory, sortCategories } from '@/lib/categories';
import { formatDateTime } from '@/lib/format';

type Registration = {
  id: string;
  player_id: string | null;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
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
  withdrawn: 'bg-stone-100 text-stone-500',
};

function displayName(r: Registration) {
  return r.player_profiles?.full_name ?? r.manual_name ?? '-';
}

// "VOLUNTEER | some remark" -> { volunteer, remark }
function parseNotes(notes?: string | null) {
  const parts = (notes ?? '').split('|').map((x) => x.trim()).filter(Boolean);
  return { volunteer: parts.includes('VOLUNTEER'), solved: parts.includes('RESOLVED'), remark: parts.filter((x) => x !== 'VOLUNTEER' && x !== 'RESOLVED' && x !== 'PAIRED' && x.toUpperCase() !== 'N/A').join(' | ') };
}
const waLink = (mobile: string) => `https://wa.me/${mobile.replace(/\D/g, '').replace(/^00/, '')}`;

function displayQid(r: Registration) {
  return r.player_profiles?.qid ?? r.manual_qid ?? r.registration_code;
}

type Person = { id: string; name: string; gender?: string; age?: number | null; hint?: string };

// Search the app's profiles by name (forgiving: typos, partial names) and pick one
function PersonPicker({ label, value, onPick, eventDate, allowTyped, typed, onType }: {
  label: string; value: Person | null; onPick: (p: Person | null) => void; eventDate?: string;
  allowTyped?: boolean; typed?: string; onType?: (v: string) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const timer = setTimeout(() => {
      fetch(`/api/partner-search?q=${encodeURIComponent(term)}${eventDate ? `&eventDate=${eventDate.slice(0, 10)}` : ''}`)
        .then((r) => r.json()).then((d) => setResults(d.people ?? [])).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, eventDate]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
        <span><span className="text-xs text-stone-500 mr-1.5">{label}</span><b className="text-stone-900">{value.name}</b>
          <span className="text-stone-500 text-xs ml-1.5">{[value.gender, value.age != null ? `${value.age} yrs` : '', value.hint].filter(Boolean).join(' · ')}</span></span>
        <button onClick={() => { onPick(null); setQ(''); }} className="text-xs text-stone-500 hover:text-stone-800">Change</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={allowTyped ? (typed ?? '') : q} onChange={(e) => { setQ(e.target.value); onType?.(e.target.value); }}
        placeholder={`${label}: search a name on the app${allowTyped ? ', or type a name' : ''}`}
        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
      {results && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">No one on the app by that name{allowTyped ? '. The typed name will be used.' : '.'}</p>}
          {results.map((p) => (
            <button key={p.id} onClick={() => { onPick(p); setResults(null); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-stone-100 last:border-b-0">
              <b className="text-stone-900">{p.name}</b>
              <span className="text-stone-500 text-xs ml-2">{[p.gender, p.age != null ? `${p.age} yrs` : '', p.hint].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EntriesTab() {
  const { tournamentId, eventDate } = useTournamentStore();
  const [tournamentName, setTournamentName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [entryFee, setEntryFee] = useState(0);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [bulkComment, setBulkComment] = useState('');
  const [mailNote, setMailNote] = useState('');
  const [issues, setIssues] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'oldest' | 'newest'>('newest');

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
  const [view, setView] = useState<'list' | 'register'>('list');
  const [mode, setMode] = useState<'app' | 'manual'>('app');
  const [pick, setPick] = useState<{ category: string; player: Person | null; partner: Person | null; partnerName: string }>({ category: '', player: null, partner: null, partnerName: '' });
  const [added, setAdded] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', mobile: '', qid: '', category: '', partnerName: '' });

  useEffect(() => {
    if (!tournamentId) return;
    fetchRegistrations();
    fetch(`/api/tournament/eligibility?tournamentId=${tournamentId}`).then((r) => r.json()).then((d) => setIssues(d.issues ?? {})).catch(() => {});
    createClient().from('tournaments').select('name, categories, entry_fee').eq('id', tournamentId).single()
      .then(({ data }) => {
        if (data) { setTournamentName(data.name); setCategories(data.categories ?? []); setEntryFee(Number(data.entry_fee ?? 0)); }
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
    const { data, error } = await supabase
      .from('registrations')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null, review_comment: comments[id]?.trim() || null })
      .eq('id', id)
      .select('id');
    if (error || !data?.length) {
      alert(`Not saved: ${error?.message ?? 'you may not have permission to change this entry'}`);
      setUpdating(null);
      return;
    }
    // The player gets one email covering all their decided entries (daily, or via Send updates)
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, status, review_comment: comments[id]?.trim() || null } : r)));
    setUpdating(null);
  }

  async function bulkUpdateStatus(status: 'approved' | 'rejected') {
    // A withdrawn entry stays withdrawn: the player took it back, so bulk actions skip it
    const ids = Array.from(selectedIds).filter((i) => registrations.find((r) => r.id === i)?.status !== 'withdrawn');
    if (ids.length === 0) return;
    const flagged = ids.filter((i) => issues[i]);
    if (status === 'approved' && flagged.length && !confirm(`${flagged.length} of the selected entries break a rule (marked with a red warning). Approve them anyway?`)) return;
    setBulkUpdating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('registrations')
      .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null, review_comment: bulkComment.trim() || null })
      .in('id', ids)
      .select('id');
    const done = new Set((data ?? []).map((r) => r.id));
    if (error || done.size < ids.length) alert(`${ids.length - done.size} of ${ids.length} entries were not saved${error ? `: ${error.message}` : ''}`);
    setRegistrations((prev) => prev.map((r) => (done.has(r.id) ? { ...r, status, review_comment: bulkComment.trim() || null } : r)));
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
      // Nobody plays free: billed under their own name (they are not on the platform), like every other entry
      payment_status: categoryFee(addForm.category, entryFee) > 0 ? 'unpaid' : 'waived',
    });
    if (error) alert(`Entry not added: ${error.message}`);
    if (!error) {
      setAdded({ ok: true, text: `Added ${addForm.name.trim()} to ${CATEGORY_LABELS[addForm.category] ?? addForm.category}` });
      setAddForm({ name: '', email: '', mobile: '', qid: '', category: '', partnerName: '' });
      fetchRegistrations();
    }
    setAdding(false);
  }

  // Someone with a profile on the app, entered by an organizer: approved straight away
  async function handleAddProfile() {
    if (!tournamentId || !pick.player || !pick.category) return;
    setAdding(true);
    const doubles = isDoublesCategory(pick.category);
    const res = await fetch('/api/tournament/registrations/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, category: pick.category, playerId: pick.player.id,
        partnerId: doubles ? pick.partner?.id ?? null : null, partnerName: doubles && !pick.partner ? pick.partnerName.trim() || null : null }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({})) ?? {};
    if (res?.ok) {
      setAdded({ ok: true, text: `Added ${d.name}${d.partner ? ` & ${d.partner}` : ''} to ${CATEGORY_LABELS[pick.category] ?? pick.category}` });
      setPick((p) => ({ ...p, player: null, partner: null, partnerName: '' }));
      fetchRegistrations();
    } else setAdded({ ok: false, text: d.error ?? 'No connection. Not added.' });
    setAdding(false);
  }

  // Everything entered here is approved, so the list is every entry; anything not approved is labelled
  const byStatus = registrations;
  const q = search.trim().toLowerCase();
  const filtered = byStatus
    .filter((r) => !catFilter || r.category === catFilter)
    .filter((r) => !q || [displayName(r), r.partner_name, r.player_profiles?.mobile, r.manual_mobile, displayQid(r)].some((x) => String(x ?? '').toLowerCase().includes(q)))
    .sort((a, b) => sort === 'name' ? displayName(a).trim().localeCompare(displayName(b).trim())
      : sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  const catsHere = Array.from(new Set(byStatus.map((r) => r.category))).sort((a, b) => (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b));
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-stone-900">Entries</h2>
        <p className="text-stone-400 text-sm">{registrations.filter((r) => r.status === 'approved').length} entries
          {pendingCount > 0 && ` · ${pendingCount} waiting for approval`}</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-1.5 mb-4 flex gap-1 shadow-sm">
        {([['register', 'Register new'], ['list', 'All entries']] as const).map(([v, label]) => (
          <button key={v} onClick={() => { setView(v); setAdded(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-1 ${view === v ? 'bg-orange-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'register' && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
          <div className="flex gap-1 mb-4 text-sm">
            {([['app', 'Has a profile on the app'], ['manual', 'Not on the app']] as const).map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setAdded(null); }}
                className={`px-3 py-1.5 rounded-lg font-medium border ${mode === m ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'app' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <select value={pick.category} onChange={(e) => setPick((p) => ({ ...p, category: e.target.value }))}
                className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500 sm:col-span-2">
                <option value="">Category *</option>
                {sortCategories(categories).map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>)}
              </select>
              <PersonPicker label="Player" value={pick.player} onPick={(player) => setPick((p) => ({ ...p, player }))} eventDate={eventDate} />
              {isDoublesCategory(pick.category) && (
                <PersonPicker label="Partner" value={pick.partner} onPick={(partner) => setPick((p) => ({ ...p, partner }))} eventDate={eventDate}
                  allowTyped typed={pick.partnerName} onType={(partnerName) => setPick((p) => ({ ...p, partnerName }))} />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name *" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Category *</option>
                {sortCategories(categories).map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>)}
              </select>
              <input value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email (for confirmation)" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <input value={addForm.mobile} onChange={(e) => setAddForm((f) => ({ ...f, mobile: e.target.value }))}
                placeholder="Mobile" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <input value={addForm.qid} onChange={(e) => setAddForm((f) => ({ ...f, qid: e.target.value }))}
                placeholder="Qatar ID *" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <input value={addForm.partnerName} onChange={(e) => setAddForm((f) => ({ ...f, partnerName: e.target.value }))}
                placeholder="Partner name (doubles only)" className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {mode === 'app' ? (
              <button onClick={handleAddProfile} disabled={adding || !pick.player || !pick.category}
                className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                {adding ? 'Adding...' : 'Add entry'}
              </button>
            ) : (
              <button onClick={handleAddEntry} disabled={adding || !addForm.name.trim() || !addForm.category || !addForm.qid.trim()}
                className="bg-[#111827] hover:bg-[#1F2937] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                {adding ? 'Adding...' : 'Add entry'}
              </button>
            )}
            <span className="text-xs text-stone-400">Entries added here are approved straight away.</span>
          </div>
          {added && <p className={`text-sm mt-3 ${added.ok ? 'text-emerald-700' : 'text-red-600 font-medium'}`}>{added.ok ? '✓ ' : ''}{added.text}</p>}
        </div>
      )}

      {view === 'list' && <>
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, partner, phone or Qatar ID"
          className="flex-1 min-w-[200px] px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All categories</option>
          {catsHere.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'oldest' | 'newest')}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="name">Name A to Z</option>
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>
      {mailNote && <p className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-3">{mailNote}</p>}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-3 mb-4 flex items-center justify-between shadow-sm">
          <label className="flex items-center gap-2 text-sm text-stone-600 font-medium cursor-pointer select-none">
            <input type="checkbox" checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
              onChange={() => toggleSelectAll(filtered.map((r) => r.id))}
              className="w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500" />
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all ${filtered.length}`}
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
          <p>{registrations.length ? 'No entries match.' : 'No entries yet.'}</p>
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
                    const { volunteer, remark, solved } = parseNotes(reg.notes);
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
                        {remark && <p className={`text-sm rounded-lg px-3 py-2 mt-2 border ${solved ? 'text-stone-500 bg-stone-50 border-stone-200' : 'text-stone-800 bg-amber-50 border-amber-200'}`}><span className={`text-[11px] font-bold uppercase tracking-wide block ${solved ? 'text-stone-400' : 'text-amber-700'}`}>{solved ? 'Remark from player · solved' : 'Remark from player'}</span>{remark}</p>}
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
      </>}
    </div>
  );
}
