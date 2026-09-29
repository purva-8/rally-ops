'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Avatar from '@/components/Avatar';
import { CATEGORY_LABELS, categoryFee, isDoublesCategory, isEligible, isSamanvayamTournament } from '@/lib/categories';

type Tournament = {
  id: string;
  name: string;
  categories: string[];
  entry_fee: number;
  status: string;
  venue: string;
  event_date: string;
  is_samanvayam: boolean;
};

type Profile = {
  id: string;
  full_name: string;
  gender: string;
  dob: string | null;
  qid: string | null;
  samanvayam_member: boolean;
  samanvayam_id?: string | null;
  parent_id: string | null;
  relationship?: string | null;
};

const PROFILE_COLS = 'id,full_name,gender,dob,qid,samanvayam_member,samanvayam_id,parent_id,relationship';

const RELATIONSHIPS = [
  { value: 'spouse',   label: 'Wife / Husband' },
  { value: 'son',      label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'parent',   label: 'Parent' },
  { value: 'other',    label: 'Other family member' },
];
const relLabel = (v?: string | null) => RELATIONSHIPS.find((r) => r.value === v)?.label ?? 'Family member';

type Step = 'identity' | 'who' | 'category' | 'partner' | 'confirm' | 'done';

const inputCls = 'w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';

function RegisterPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');
  const router = useRouter();

  const [step, setStep] = useState<Step>('category');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<string[]>([]);
  // Doubles partner per category: linked profile (id) when known, otherwise just a typed name
  const [partners, setPartners] = useState<Record<string, { id: string | null; name: string }>>({});
  const [qidSearch, setQidSearch] = useState<Record<string, string>>({});
  const [qidResults, setQidResults] = useState<Record<string, { id: string; name: string; gender: string | null; relationship: string | null }[]>>({});
  const [typedName, setTypedName] = useState<Record<string, boolean>>({});
  const [candidates, setCandidates] = useState<Record<string, { id: string; name: string }[]>>({});
  const [nameMatches, setNameMatches] = useState<Record<string, { id: string; name: string; hint: string }[] | null>>({});
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({});
  const [emergencyContact, setEmergencyContact] = useState('');
  const [existingRegs, setExistingRegs] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [identityForm, setIdentityForm] = useState({ dob: '', qid: '', member: false, sid: '' });
  const [savingIdentity, setSavingIdentity] = useState(false);

  // Samanvayam tournaments: the account holder can register family members too
  const [account, setAccount] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Profile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ full_name: '', relationship: '', gender: '', dob: '' });

  const samanvayam = tournament ? isSamanvayamTournament(tournament) : false;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push(`/login?redirect=/events/${id}/register`);
        return;
      }
      const profileFilter = profileId
        ? supabase.from('player_profiles').select(PROFILE_COLS).eq('id', profileId).single()
        : supabase.from('player_profiles').select(PROFILE_COLS).eq('auth_user_id', user.id).single();

      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('tournaments').select('id,name,categories,entry_fee,status,venue,event_date,is_samanvayam').eq('id', id).single(),
        profileFilter,
      ]);
      setTournament(t);
      setProfile(p);
      if (p) {
        const { data: regs } = await supabase.from('registrations').select('category').eq('tournament_id', id).eq('player_id', p.id).neq('status', 'withdrawn');
        setExistingRegs(regs?.map((r) => r.category) ?? []);
      }
      // Family members inherit QID/DOB/membership from the account holder, so only the
      // account holder ever sees the details step.
      const selfRegistering = !!p && !p.parent_id;
      const sam = !!t && isSamanvayamTournament(t);
      if (selfRegistering && sam) {
        setAccount(p);
        const { data: kids } = await supabase.from('player_profiles').select(PROFILE_COLS).eq('parent_id', p.id);
        setFamily(kids ?? []);
      }
      if (selfRegistering && (sam || !p.dob || !p.qid)) {
        setStep('identity');
        setIdentityForm({ dob: p.dob ?? '', qid: p.qid ?? '', member: p.samanvayam_member ?? false, sid: p.samanvayam_id ?? '' });
      }
      setLoading(false);
    });
  }, [id, router, profileId]);

  // Anyone who already entered a doubles category and named this person, so the second partner just taps their name
  useEffect(() => {
    if (step !== 'partner' || !profile) return;
    selected.filter(isDoublesCategory).forEach(async (cat) => {
      const res = await fetch(`/api/partner-candidates?tournamentId=${id}&category=${encodeURIComponent(cat)}&playerId=${profile.id}`);
      const d = await res.json().catch(() => ({ people: [] }));
      setCandidates((c) => ({ ...c, [cat]: d.people ?? [] }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, profile?.id]);

  async function loadRegsFor(personId: string) {
    const { data: regs } = await createClient().from('registrations').select('category').eq('tournament_id', id).eq('player_id', personId).neq('status', 'withdrawn');
    setExistingRegs(regs?.map((r) => r.category) ?? []);
  }

  async function saveIdentity() {
    if (!profile || !identityForm.dob.trim() || !identityForm.qid.trim()) return;
    setSavingIdentity(true);
    const supabase = createClient();
    const qid = identityForm.qid.trim();
    const { data, error } = await supabase
      .from('player_profiles')
      .update({ dob: identityForm.dob, qid, ...(samanvayam ? { samanvayam_member: identityForm.member, samanvayam_id: identityForm.sid.trim() || null } : {}) })
      .eq('id', profile.id)
      .select(PROFILE_COLS)
      .single();
    if (!error && data) {
      // Family registers under the same Qatar ID and membership
      if (family.length || data.qid !== profile.qid || data.samanvayam_member !== profile.samanvayam_member) {
        await supabase.from('player_profiles').update({ qid, samanvayam_member: data.samanvayam_member }).eq('parent_id', profile.id);
      }
      setProfile(data);
      setAccount(data);
      if (samanvayam && data.samanvayam_member) setStep('who');
      else setStep('category');
    }
    setSavingIdentity(false);
  }

  async function chooseMember(person: Profile) {
    setProfile(person);
    setSelected([]);
    setPartners({});
    setSubmitted([]);
    await loadRegsFor(person.id);
    setStep('category');
  }

  async function addFamilyMember() {
    if (!account || !memberForm.full_name.trim() || !memberForm.relationship || !memberForm.gender || !memberForm.dob) return;
    setAddingMember(true);
    const { data, error } = await createClient()
      .from('player_profiles')
      .insert({
        parent_id: account.id,
        full_name: memberForm.full_name.trim(),
        relationship: memberForm.relationship,
        gender: memberForm.gender,
        dob: memberForm.dob,
        qid: account.qid,
        samanvayam_member: true,
      })
      .select(PROFILE_COLS)
      .single();
    if (!error && data) {
      setFamily((prev) => [...prev, data]);
      setMemberForm({ full_name: '', relationship: '', gender: '', dob: '' });
      setShowAdd(false);
    }
    setAddingMember(false);
  }

  const eligibleCategories = tournament?.categories.filter((cat) => {
    if (existingRegs.includes(cat)) return false;
    if (!profile) return false;
    return isEligible(cat, profile.gender, profile.dob, tournament?.event_date ?? new Date().toISOString());
  }) ?? [];

  const doublesSelected = selected.filter(isDoublesCategory);
  const feeOf = (cat: string) => categoryFee(cat, tournament?.entry_fee ?? 0);
  const totalFee = selected.reduce((sum, cat) => sum + shareOf(cat), 0);

  const familyIds = [account, ...family].filter(Boolean).map((p) => p!.id);
  const partnerOptions = [account, ...family].filter((p): p is Profile => !!p && p.id !== profile?.id);

  // A doubles fee is per pair (30 + 30): every entry carries its own half, whoever files it.
  function shareOf(cat: string) {
    const fee = feeOf(cat);
    return isDoublesCategory(cat) ? fee / 2 : fee;
  }

  // "Use" looks the typed name up on the platform first (typos and case are fine); only if nobody is found is it kept as plain text
  async function useTypedName(cat: string) {
    const typed = (nameDraft[cat] ?? '').trim();
    if (!typed) return;
    const res = await fetch(`/api/partner-search?q=${encodeURIComponent(typed)}`);
    const d = await res.json().catch(() => ({ people: [] }));
    const found = (d.people ?? []).filter((p: { id: string }) => p.id !== profile?.id);
    if (found.length === 0) {
      setPartners((prev) => ({ ...prev, [cat]: { id: null, name: typed } }));
      setNameMatches((m) => ({ ...m, [cat]: null }));
    } else {
      setNameMatches((m) => ({ ...m, [cat]: found }));
    }
  }

  async function findPartner(cat: string) {
    const qid = (qidSearch[cat] ?? '').trim();
    if (qid.length < 6) return;
    const res = await fetch(`/api/partner-lookup?qid=${encodeURIComponent(qid)}`);
    const data = await res.json().catch(() => ({ people: [] }));
    setQidResults((r) => ({ ...r, [cat]: (data.people ?? []).filter((p: { id: string }) => p.id !== profile?.id) }));
  }

  function toggleCategory(cat: string) {
    setSelected((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }

  async function handleSubmit() {
    if (!profile || !tournament || selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError('');
    const supabase = createClient();
    // One insert for every chosen category: all of them save, or none do
    const { error } = await supabase
      .from('registrations')
      .insert(selected.map((cat) => ({
        tournament_id: tournament.id,
        player_id: profile.id,
        category: cat,
        partner_id: isDoublesCategory(cat) ? partners[cat]?.id ?? null : null,
        partner_name: isDoublesCategory(cat) ? (partners[cat]?.name ?? '').trim() : null,
        emergency_contact: emergencyContact || null,
        status: 'pending',
        payment_status: shareOf(cat) > 0 ? 'unpaid' : 'waived',
      })));
    if (error) {
      setError(error.code === '23505' ? 'This person is already registered in one of these categories.' : error.message);
      setSubmitting(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      fetch('/api/registration-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: profile.full_name,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          registrationCode: profile.qid ?? '',
          venue: tournament.venue,
          eventDate: tournament.event_date,
          entries: selected.map((cat) => ({
            label: CATEGORY_LABELS[cat] ?? cat,
            partner: isDoublesCategory(cat) ? (partners[cat]?.name ?? '').trim() : null,
            fee: shareOf(cat),
          })),
        }),
      }).catch(() => {});
    }
    setExistingRegs((prev) => [...prev, ...selected]);
    setSubmitted(selected);
    setSelected([]);
    setPartners({});
    setSubmitting(false);
    setStep('done');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-950 flex items-center justify-center">
        <div className="text-orange-300/60 text-sm">Loading...</div>
      </div>
    );
  }

  if (!tournament || tournament.status !== 'open') {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-stone-600">Registration is not open for this tournament.</p>
          <Link href={`/events/${id}`} className="text-orange-600 text-sm mt-2 inline-block">← Back to tournament</Link>
        </div>
      </div>
    );
  }

  const isFamilyMember = !!profile && !!account && profile.id !== account.id;
  const stepList: Step[] = [
    ...(account && (samanvayam || step === 'identity') ? ['identity' as Step] : []),
    ...(account && samanvayam && account.samanvayam_member ? ['who' as Step] : []),
    'category',
    ...(doublesSelected.length ? ['partner' as Step] : []),
    'confirm',
  ];

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-orange-950 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/events/${id}`} className="text-xs text-orange-400 hover:text-orange-200 transition-colors">← Back</Link>
          <span className="text-xs font-bold tracking-widest uppercase text-orange-300">RallyOps</span>
        </div>
      </header>

      <div className="bg-orange-950 text-white pb-8 pt-6 px-4">
        <div className="max-w-lg mx-auto">
          <p className="text-orange-400 text-xs font-bold tracking-widest uppercase mb-1">Registration</p>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          {(profile?.parent_id || isFamilyMember) && (
            <p className="text-orange-300 text-xs mt-2">Registering: <strong>{profile?.full_name}</strong> (managed by you)</p>
          )}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 -mt-2">

        {step !== 'done' && (
          <div className="flex gap-2 mb-8">
            {stepList.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step === s ? 'bg-orange-600' : i < stepList.indexOf(step) ? 'bg-orange-300' : 'bg-stone-200'}`} />
            ))}
          </div>
        )}

        {/* Step: Details (Qatar ID, date of birth, Samanvayam membership) */}
        {step === 'identity' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Your details</h2>
            <p className="text-sm text-stone-500 mb-6">
              Your Qatar ID is your registration reference for every category you enter, and your date of birth is used to
              check eligibility for age-based categories.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Qatar ID</label>
              <input
                type="text"
                value={identityForm.qid}
                onChange={(e) => setIdentityForm((f) => ({ ...f, qid: e.target.value }))}
                className={inputCls}
                placeholder="e.g. 28012345678"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
              <input
                type="date"
                value={identityForm.dob}
                onChange={(e) => setIdentityForm((f) => ({ ...f, dob: e.target.value }))}
                className={inputCls}
              />
            </div>
            {samanvayam && (
              <label className="flex items-start gap-3 mb-6 cursor-pointer select-none bg-white border border-stone-200 rounded-xl px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={identityForm.member}
                  onChange={(e) => setIdentityForm((f) => ({ ...f, member: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                <span>
                  <span className="block text-sm font-medium text-stone-800">I am a Samanvayam member <span className="text-stone-400 font-normal">(optional)</span></span>
                  <span className="block text-xs text-stone-400 mt-0.5">Members can register their wife or husband, sons and daughters from this account.</span>
                </span>
              </label>
            )}
            {samanvayam && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Samanvayam ID <span className="text-stone-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={identityForm.sid}
                  onChange={(e) => setIdentityForm((f) => ({ ...f, sid: e.target.value }))}
                  className={inputCls}
                  placeholder="Your membership number, if you have one"
                />
              </div>
            )}
            <button
              onClick={saveIdentity}
              disabled={savingIdentity || !identityForm.qid.trim() || !identityForm.dob.trim()}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-40"
            >
              {savingIdentity ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step: Who (members register themselves and family) */}
        {step === 'who' && account && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Who are you registering?</h2>
            <p className="text-sm text-stone-500 mb-4">Everyone registers under your Qatar ID ({account.qid}).</p>
            <div className="space-y-2 mb-4">
              {[account, ...family].map((person) => (
                <button
                  key={person.id}
                  onClick={() => chooseMember(person)}
                  className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 bg-white hover:border-orange-400 transition-colors flex items-center justify-between"
                >
                  <Avatar seed={person.id} size={40} gender={person.gender as never} className="mr-3" />
                  <div className="flex-1">
                    <div className="font-medium text-stone-800">{person.full_name}</div>
                    <div className="text-xs text-stone-400 mt-0.5 capitalize">
                      {person.id === account.id ? 'Myself' : relLabel(person.relationship)} · {person.gender}
                    </div>
                  </div>
                  <span className="text-orange-600 text-sm font-semibold">Register →</span>
                </button>
              ))}
            </div>

            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full border border-dashed border-orange-300 text-orange-600 py-3 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors"
              >
                + Add family member
              </button>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Full name</label>
                  <input type="text" value={memberForm.full_name} onChange={(e) => setMemberForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Relationship</label>
                  <select
                    value={memberForm.relationship}
                    onChange={(e) => {
                      const relationship = e.target.value;
                      setMemberForm((f) => ({ ...f, relationship, gender: relationship === 'son' ? 'male' : relationship === 'daughter' ? 'female' : f.gender }));
                    }}
                    className={inputCls}
                  >
                    <option value="">Select relationship</option>
                    {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Gender</label>
                  <select value={memberForm.gender} onChange={(e) => setMemberForm((f) => ({ ...f, gender: e.target.value }))} className={inputCls}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
                  <input type="date" value={memberForm.dob} onChange={(e) => setMemberForm((f) => ({ ...f, dob: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600">
                    Cancel
                  </button>
                  <button
                    onClick={addFamilyMember}
                    disabled={addingMember || !memberForm.full_name.trim() || !memberForm.relationship || !memberForm.gender || !memberForm.dob}
                    className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-40"
                  >
                    {addingMember ? 'Adding...' : 'Add member'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Categories (pick as many as you like) */}
        {step === 'category' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Select categories</h2>
            <p className="text-sm text-stone-500 mb-4">Pick every category {isFamilyMember ? `${profile?.full_name} wants` : 'you want'} to play. They are all registered together.</p>
            {eligibleCategories.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
                {existingRegs.length > 0
                  ? 'Already registered for every category available.'
                  : 'No categories match this player’s age and gender.'}
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {eligibleCategories.map((cat) => {
                  const on = selected.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`w-full text-left px-5 py-4 rounded-xl border transition-colors flex items-center gap-3 ${
                        on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 text-xs ${on ? 'bg-orange-600 border-orange-600 text-white' : 'border-stone-300'}`}>
                        {on ? '✓' : ''}
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium">{CATEGORY_LABELS[cat] ?? cat}</span>
                        <span className="block text-xs text-stone-400 mt-0.5">
                          {isDoublesCategory(cat) ? 'Needs a partner · ' : ''}{feeOf(cat) > 0 ? (isDoublesCategory(cat) ? `QAR ${feeOf(cat)} per pair (${feeOf(cat) / 2} each)` : `QAR ${feeOf(cat)}`) : 'Free'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {existingRegs.length > 0 && (
              <p className="text-xs text-stone-400 mb-4">Already registered: {existingRegs.map((c) => CATEGORY_LABELS[c] ?? c).join(', ')}</p>
            )}
            <div className="flex gap-3">
              {account && account.samanvayam_member && (
                <button onClick={() => setStep('who')} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-300">
                  ← Change person
                </button>
              )}
              {selected.length > 0 && (
                <button
                  onClick={() => setStep(doublesSelected.length ? 'partner' : 'confirm')}
                  className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors"
                >
                  Continue ({selected.length}) →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Partners (one per doubles category) */}
        {step === 'partner' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Choose your partners</h2>
            <p className="text-sm text-stone-500 mb-6">Pick from your family, or find a partner by their Qatar ID. A linked partner pays and sees their own half.</p>
            <div className="space-y-6 mb-6">
              {doublesSelected.map((cat) => {
                const chosen = partners[cat];
                return (
                  <div key={cat} className="bg-white rounded-2xl border border-stone-200 p-4">
                    <p className="text-sm font-semibold text-stone-800 mb-3">{CATEGORY_LABELS[cat] ?? cat}</p>

                    {chosen?.name ? (
                      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                        <span className="text-sm font-medium text-orange-800">{chosen.name}{chosen.id ? '' : ' (not on the platform)'}</span>
                        <button onClick={() => setPartners((p) => ({ ...p, [cat]: { id: null, name: '' } }))} className="text-xs text-orange-600 font-semibold">Change</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(candidates[cat] ?? []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-emerald-700">Already entered and named you</p>
                            {(candidates[cat] ?? []).map((c) => (
                              <button key={c.id} onClick={() => setPartners((prev) => ({ ...prev, [cat]: { id: c.id, name: c.name } }))}
                                className="w-full text-left px-4 py-2.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-sm font-medium text-emerald-900 hover:bg-emerald-100 transition-colors">
                                {c.name} <span className="text-xs font-normal text-emerald-700">· tap to pair up</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {partnerOptions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-stone-400">Your family</p>
                            {partnerOptions.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => setPartners((prev) => ({ ...prev, [cat]: { id: p.id, name: p.full_name } }))}
                                className="w-full text-left px-4 py-2.5 rounded-xl border border-stone-200 text-sm hover:border-orange-400 transition-colors"
                              >
                                {p.full_name} <span className="text-xs text-stone-400">· {p.id === account?.id ? 'Me' : relLabel(p.relationship)}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div>
                          <p className="text-xs text-stone-400 mb-1.5">Someone else, by Qatar ID</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={qidSearch[cat] ?? ''}
                              onChange={(e) => setQidSearch((q) => ({ ...q, [cat]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findPartner(cat); } }}
                              className={inputCls}
                              placeholder="Partner's Qatar ID"
                            />
                            <button onClick={() => findPartner(cat)} className="px-4 rounded-xl bg-stone-900 text-white text-sm font-semibold shrink-0">Find</button>
                          </div>
                          {qidResults[cat] && (
                            <div className="mt-2 space-y-2">
                              {qidResults[cat].length === 0 && <p className="text-xs text-stone-400">No one found with that ID yet.</p>}
                              {qidResults[cat].map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => setPartners((prev) => ({ ...prev, [cat]: { id: p.id, name: p.name } }))}
                                  className="w-full text-left px-4 py-2.5 rounded-xl border border-stone-200 text-sm hover:border-orange-400 transition-colors"
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {typedName[cat] ? (
                          <div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={nameDraft[cat] ?? ''}
                              onChange={(e) => setNameDraft((d) => ({ ...d, [cat]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (nameDraft[cat] ?? '').trim()) {
                                  e.preventDefault();
                                  useTypedName(cat);
                                }
                              }}
                              className={inputCls}
                              placeholder="Partner's full name"
                            />
                            <button
                              onClick={() => useTypedName(cat)}
                              disabled={!(nameDraft[cat] ?? '').trim()}
                              className="px-4 rounded-xl bg-stone-900 text-white text-sm font-semibold shrink-0 disabled:opacity-40"
                            >
                              Use
                            </button>
                          </div>
                          {nameMatches[cat] && (
                            <div className="mt-2 space-y-2">
                              <p className="text-xs font-semibold text-emerald-700">Is this who you mean?</p>
                              {nameMatches[cat]!.map((m) => (
                                <button key={m.id} onClick={() => { setPartners((prev) => ({ ...prev, [cat]: { id: m.id, name: m.name } })); setNameMatches((x) => ({ ...x, [cat]: null })); }}
                                  className="w-full text-left px-4 py-2.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-sm font-medium text-emerald-900 hover:bg-emerald-100">
                                  {m.name} {m.hint && <span className="text-xs font-normal text-emerald-700">· {m.hint}</span>}
                                </button>
                              ))}
                              <button onClick={() => { setPartners((prev) => ({ ...prev, [cat]: { id: null, name: (nameDraft[cat] ?? '').trim() } })); setNameMatches((x) => ({ ...x, [cat]: null })); }}
                                className="text-xs text-stone-500 underline">None of these, use "{(nameDraft[cat] ?? '').trim()}" as typed</button>
                            </div>
                          )}
                          </div>
                        ) : (
                          <button onClick={() => setTypedName((t) => ({ ...t, [cat]: true }))} className="text-xs text-orange-600 font-semibold">
                            Partner not on the platform? Type their name
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('category')} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-300">
                Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={doublesSelected.some((c) => !(partners[c]?.name ?? '').trim())}
                className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-6">Confirm your registration</h2>

            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Player</span>
                <span className="font-medium text-stone-900">{profile?.full_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Qatar ID</span>
                <span className="font-medium text-stone-900">{profile?.qid}</span>
              </div>
              <div className="border-t border-stone-100 pt-4 space-y-3">
                {selected.map((cat) => (
                  <div key={cat} className="flex justify-between gap-4 text-sm">
                    <span className="text-stone-700">
                      {CATEGORY_LABELS[cat] ?? cat}
                      {isDoublesCategory(cat) && (
                        <span className="block text-xs text-stone-400">
                          with {partners[cat]?.name} · pair QAR {feeOf(cat)} ({feeOf(cat) / 2} each){' · this entry ' + shareOf(cat)}
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-stone-900 shrink-0">{shareOf(cat) > 0 ? `QAR ${shareOf(cat)}` : 'Free'}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm border-t border-stone-100 pt-4">
                <span className="text-stone-500">Total</span>
                <span className="font-bold text-orange-600">{totalFee > 0 ? `QAR ${totalFee}` : 'Free'}</span>
              </div>
              {totalFee > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  Payment details will be shared by the organizer after your registration is approved.
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Emergency contact (optional)</label>
              <input type="text" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} className={inputCls} placeholder="Name and phone number" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(doublesSelected.length ? 'partner' : 'category')} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : `Submit ${selected.length > 1 ? `${selected.length} registrations` : 'registration'}`}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">
              {isFamilyMember ? `${profile?.full_name} is registered!` : 'You’re registered!'}
            </h2>
            <ul className="text-stone-600 text-sm mb-2 space-y-1">
              {submitted.map((c) => <li key={c}><strong>{CATEGORY_LABELS[c] ?? c}</strong></li>)}
            </ul>
            <p className="text-stone-400 text-sm mb-8">
              The organizer will review and approve the entries. You&apos;ll be notified once confirmed.
            </p>
            <div className="space-y-3">
              {eligibleCategories.length > 0 && (
                <button
                  onClick={() => setStep('category')}
                  className="block w-full border border-orange-300 text-orange-600 py-3 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors"
                >
                  Register for more categories
                </button>
              )}
              {account && account.samanvayam_member && (
                <button
                  onClick={() => setStep('who')}
                  className="block w-full border border-orange-300 text-orange-600 py-3 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors"
                >
                  Register another family member
                </button>
              )}
              <Link
                href="/my-entries"
                className="block w-full bg-stone-100 text-stone-700 py-3 rounded-xl font-medium text-sm hover:bg-stone-200 transition-colors"
              >
                View my entries
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}
