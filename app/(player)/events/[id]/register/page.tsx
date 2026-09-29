'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
  parent_id: string | null;
  relationship?: string | null;
};

const PROFILE_COLS = 'id,full_name,gender,dob,qid,samanvayam_member,parent_id,relationship';

const RELATIONSHIPS = [
  { value: 'spouse',   label: 'Wife / Husband' },
  { value: 'son',      label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'parent',   label: 'Parent' },
  { value: 'other',    label: 'Other family member' },
];
const relLabel = (v?: string | null) => RELATIONSHIPS.find((r) => r.value === v)?.label ?? 'Family member';

const CATEGORY_LABELS: Record<string, string> = {
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

const DOUBLES_CATEGORIES = ['male_doubles', 'female_doubles', 'spouse_doubles'];

// Which genders are eligible per category
const GENDER_ELIGIBILITY: Record<string, string[]> = {
  male_singles:   ['male'],
  female_singles: ['female'],
  male_doubles:   ['male'],
  female_doubles: ['female'],
  spouse_doubles: ['male', 'female'],
  boys_u13:  ['male'],
  boys_u15:  ['male'],
  boys_u18:  ['male'],
  girls_u13: ['female'],
  girls_u15: ['female'],
  girls_u18: ['female'],
};

// Max age (inclusive) allowed per junior category, as of the tournament date
const AGE_ELIGIBILITY: Record<string, number> = {
  boys_u13: 13, boys_u15: 15, boys_u18: 18,
  girls_u13: 13, girls_u15: 15, girls_u18: 18,
};

function ageOn(dob: string, onDate: string) {
  const birth = new Date(dob);
  const ref = new Date(onDate);
  let age = ref.getFullYear() - birth.getFullYear();
  const hadBirthday = ref.getMonth() > birth.getMonth() || (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  return age;
}

type Step = 'identity' | 'who' | 'category' | 'partner' | 'confirm' | 'done';

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

  const [selectedCategory, setSelectedCategory] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [existingRegs, setExistingRegs] = useState<string[]>([]);
  const [identityForm, setIdentityForm] = useState({ dob: '', qid: '' });
  // Samanvayam tournaments: the account holder can register family members too
  const [account, setAccount] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Profile[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ full_name: '', relationship: '', gender: '', dob: '' });
  const [savingIdentity, setSavingIdentity] = useState(false);

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
        const { data: regs } = await supabase.from('registrations').select('category').eq('tournament_id', id).eq('player_id', p.id);
        setExistingRegs(regs?.map((r) => r.category) ?? []);
      }
      // Kids inherit QID/DOB/membership from the parent at creation, so only the
      // self-registration path (no parent_id) ever needs the one-time identity step.
      const selfRegistering = !!p && !p.parent_id;
      if (selfRegistering && t?.is_samanvayam) {
        setAccount(p);
        setIsMember(p.samanvayam_member ?? false);
        const { data: kids } = await supabase.from('player_profiles').select(PROFILE_COLS).eq('parent_id', p.id);
        setFamily(kids ?? []);
      }
      if (selfRegistering && (!p.dob || !p.qid)) {
        setStep('identity');
        setIdentityForm({ dob: p.dob ?? '', qid: p.qid ?? '' });
      } else if (selfRegistering && t?.is_samanvayam) {
        setStep('who');
      }
      setLoading(false);
    });
  }, [id, router, profileId]);

  async function saveIdentity() {
    if (!profile || !identityForm.dob.trim() || !identityForm.qid.trim()) return;
    setSavingIdentity(true);
    const { data, error } = await createClient()
      .from('player_profiles')
      .update({ dob: identityForm.dob, qid: identityForm.qid.trim() })
      .eq('id', profile.id)
      .select()
      .single();
    if (!error && data) {
      setProfile(data);
      if (tournament?.is_samanvayam) { setAccount(data); setStep('who'); }
      else setStep('category');
    }
    setSavingIdentity(false);
  }

  async function chooseMember(person: Profile) {
    setProfile(person);
    setSelectedCategory('');
    setPartnerName('');
    const { data: regs } = await createClient().from('registrations').select('category').eq('tournament_id', id).eq('player_id', person.id);
    setExistingRegs(regs?.map((r) => r.category) ?? []);
    setStep('category');
  }

  async function confirmMembership(checked: boolean) {
    if (!account) return;
    if (checked) {
      const { data } = await createClient()
        .from('player_profiles').update({ samanvayam_member: true }).eq('id', account.id).select(PROFILE_COLS).single();
      if (data) { setAccount(data); setIsMember(true); }
    }
    // Non-members just register themselves
    else chooseMember(account);
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
    if (!(GENDER_ELIGIBILITY[cat]?.includes(profile.gender) ?? true)) return false;
    const maxAge = AGE_ELIGIBILITY[cat];
    if (maxAge && profile.dob) {
      const eventDate = tournament?.event_date ?? new Date().toISOString();
      if (ageOn(profile.dob, eventDate) > maxAge) return false;
    }
    return true;
  }) ?? [];

  const isDoubles = DOUBLES_CATEGORIES.includes(selectedCategory);

  async function handleSubmit() {
    if (!profile || !tournament || !selectedCategory) return;
    setSubmitting(true);
    setError('');
    const supabase = createClient();
    const { data: registration, error } = await supabase
      .from('registrations')
      .insert({
        tournament_id: tournament.id,
        player_id: profile.id,
        category: selectedCategory,
        partner_name: isDoubles ? partnerName : null,
        emergency_contact: emergencyContact || null,
        status: 'pending',
        payment_status: tournament.entry_fee > 0 ? 'unpaid' : 'waived',
      })
      .select('registration_code')
      .single();
    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        fetch('/api/registration-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            playerName: profile.full_name,
            tournamentName: tournament.name,
            category: selectedCategory,
            registrationCode: profile.qid ?? registration?.registration_code ?? '',
            venue: tournament.venue,
            eventDate: tournament.event_date,
          }),
        }).catch(() => {});
      }
      setStep('done');
    }
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
          {profile?.parent_id && (
            <p className="text-orange-300 text-xs mt-2">Registering: <strong>{profile.full_name}</strong> (managed by you)</p>
          )}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 -mt-2">

        {/* Progress */}
        {step !== 'done' && (
          <div className="flex gap-2 mb-8">
            {(['identity', ...(tournament.is_samanvayam && account ? ['who'] : []), 'category', ...(isDoubles ? ['partner'] : []), 'confirm'] as Step[])
              .filter((s) => s !== 'identity' || step === 'identity')
              .map((s, i, arr) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${step === s ? 'bg-orange-600' : i < arr.indexOf(step) ? 'bg-orange-300' : 'bg-stone-200'}`} />
              ))}
          </div>
        )}

        {/* Step: Identity (Qatar ID + date of birth, asked once) */}
        {step === 'identity' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Confirm your details</h2>
            <p className="text-sm text-stone-500 mb-6">
              We ask this once. Your Qatar ID becomes your registration reference across every category you enter,
              and your date of birth is used to check eligibility for age-based categories.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Qatar ID</label>
              <input
                type="text"
                value={identityForm.qid}
                onChange={(e) => setIdentityForm((f) => ({ ...f, qid: e.target.value }))}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="e.g. 28012345678"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
              <input
                type="date"
                value={identityForm.dob}
                onChange={(e) => setIdentityForm((f) => ({ ...f, dob: e.target.value }))}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={saveIdentity}
              disabled={savingIdentity || !identityForm.qid.trim() || !identityForm.dob.trim()}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-40"
            >
              {savingIdentity ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step: Who (Samanvayam tournaments: register yourself or family) */}
        {step === 'who' && account && (
          <div>
            {!isMember ? (
              <>
                <h2 className="text-base font-semibold text-stone-800 mb-1">Samanvayam membership</h2>
                <p className="text-sm text-stone-500 mb-6">
                  Samanvayam members can register their wife/husband, sons and daughters from one account.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => confirmMembership(true)}
                    className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 bg-white hover:border-orange-400 transition-colors"
                  >
                    <div className="font-medium text-stone-800">Yes, I am a Samanvayam member</div>
                    <div className="text-xs text-stone-400 mt-0.5">Register myself and my family</div>
                  </button>
                  <button
                    onClick={() => confirmMembership(false)}
                    className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 bg-white hover:border-orange-400 transition-colors"
                  >
                    <div className="font-medium text-stone-800">No, just me</div>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-stone-800 mb-1">Who are you registering?</h2>
                <p className="text-sm text-stone-500 mb-4">Everyone registers under your Qatar ID ({account.qid}).</p>
                <div className="space-y-2 mb-4">
                  {[account, ...family].map((person) => (
                    <button
                      key={person.id}
                      onClick={() => chooseMember(person)}
                      className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 bg-white hover:border-orange-400 transition-colors flex items-center justify-between"
                    >
                      <div>
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
                      <input
                        type="text"
                        value={memberForm.full_name}
                        onChange={(e) => setMemberForm((f) => ({ ...f, full_name: e.target.value }))}
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Relationship</label>
                      <select
                        value={memberForm.relationship}
                        onChange={(e) => {
                          const relationship = e.target.value;
                          setMemberForm((f) => ({ ...f, relationship, gender: relationship === 'son' ? 'male' : relationship === 'daughter' ? 'female' : f.gender }));
                        }}
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select relationship</option>
                        {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Gender</label>
                      <select
                        value={memberForm.gender}
                        onChange={(e) => setMemberForm((f) => ({ ...f, gender: e.target.value }))}
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">Date of birth</label>
                      <input
                        type="date"
                        value={memberForm.dob}
                        onChange={(e) => setMemberForm((f) => ({ ...f, dob: e.target.value }))}
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
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
              </>
            )}
          </div>
        )}

        {/* Step: Category */}
        {step === 'category' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-4">Select a category</h2>
            {eligibleCategories.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                You&apos;ve already registered for all categories you&apos;re eligible for.
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {eligibleCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-colors ${
                      selectedCategory === cat
                        ? 'border-orange-500 bg-orange-50 text-orange-800'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
                    }`}
                  >
                    <div className="font-medium">{CATEGORY_LABELS[cat]}</div>
                    {DOUBLES_CATEGORIES.includes(cat) && (
                      <div className="text-xs text-stone-400 mt-0.5">Requires a partner</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {account && (
              <button onClick={() => setStep('who')} className="w-full mb-3 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-300">
                ← Change person
              </button>
            )}
            {selectedCategory && (
              <button
                onClick={() => setStep(isDoubles ? 'partner' : 'confirm')}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* Step: Partner */}
        {step === 'partner' && (
          <div>
            <h2 className="text-base font-semibold text-stone-800 mb-1">Partner details</h2>
            <p className="text-sm text-stone-500 mb-6">Enter your partner&apos;s name. They don&apos;t need to register separately for doubles.</p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Partner&apos;s full name</label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Full name as on registration"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('category')} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-300">
                Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!partnerName.trim()}
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
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Category</span>
                <span className="font-medium text-stone-900">{CATEGORY_LABELS[selectedCategory]}</span>
              </div>
              {isDoubles && partnerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Partner</span>
                  <span className="font-medium text-stone-900">{partnerName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-stone-100 pt-4">
                <span className="text-stone-500">Entry fee</span>
                <span className="font-bold text-orange-600">
                  {tournament.entry_fee > 0 ? tournament.entry_fee : 'Free'}
                </span>
              </div>
              {tournament.entry_fee > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  Payment details will be shared by the organizer after your registration is approved.
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Emergency contact (optional)</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Name and phone number"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(isDoubles ? 'partner' : 'category')} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">{profile && account && profile.id !== account.id ? `${profile.full_name} is registered!` : 'You\u2019re registered!'}</h2>
            <p className="text-stone-500 text-sm mb-2">
              Your registration for <strong>{CATEGORY_LABELS[selectedCategory]}</strong> has been submitted.
            </p>
            <p className="text-stone-400 text-sm mb-8">
              The organizer will review and approve your entry. You&apos;ll be notified once confirmed.
            </p>
            <div className="space-y-3">
              <Link
                href={`/events/${id}/register`}
                onClick={() => {
                  setExistingRegs((prev) => [...prev, selectedCategory]);
                  setStep('category');
                  setSelectedCategory('');
                  setPartnerName('');
                }}
                className="block w-full border border-orange-300 text-orange-600 py-3 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors"
              >
                Register for another category
              </Link>
              {account && (
                <button
                  onClick={() => { setSelectedCategory(''); setPartnerName(''); setStep('who'); }}
                  className="block w-full border border-orange-300 text-orange-600 py-3 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors"
                >
                  Register a family member
                </button>
              )}
              <Link
                href={`/events/${id}`}
                className="block w-full bg-stone-100 text-stone-700 py-3 rounded-xl font-medium text-sm hover:bg-stone-200 transition-colors"
              >
                Back to tournament
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
