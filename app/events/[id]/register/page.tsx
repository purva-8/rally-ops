'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Tournament = {
  id: string;
  name: string;
  categories: string[];
  entry_fee: number;
  status: string;
};

type Profile = {
  id: string;
  full_name: string;
  gender: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  male_singles:   'Male Singles',
  female_singles: 'Female Singles',
  male_doubles:   'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
};

const DOUBLES_CATEGORIES = ['male_doubles', 'female_doubles', 'spouse_doubles'];

// Which genders are eligible per category
const GENDER_ELIGIBILITY: Record<string, string[]> = {
  male_singles:   ['male'],
  female_singles: ['female'],
  male_doubles:   ['male'],
  female_doubles: ['female'],
  spouse_doubles: ['male', 'female'],
};

type Step = 'category' | 'partner' | 'confirm' | 'done';

export default function RegisterPage() {
  const { id } = useParams<{ id: string }>();
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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push(`/login?redirect=/events/${id}/register`);
        return;
      }
      const [{ data: t }, { data: p }, { data: regs }] = await Promise.all([
        supabase.from('tournaments').select('id,name,categories,entry_fee,status').eq('id', id).single(),
        supabase.from('player_profiles').select('id,full_name,gender').eq('id', user.id).single(),
        supabase.from('registrations').select('category').eq('tournament_id', id).eq('player_id', user.id),
      ]);
      setTournament(t);
      setProfile(p);
      setExistingRegs(regs?.map((r) => r.category) ?? []);
      setLoading(false);
    });
  }, [id, router]);

  const eligibleCategories = tournament?.categories.filter((cat) => {
    if (existingRegs.includes(cat)) return false;
    if (!profile) return false;
    return GENDER_ELIGIBILITY[cat]?.includes(profile.gender) ?? true;
  }) ?? [];

  const isDoubles = DOUBLES_CATEGORIES.includes(selectedCategory);

  async function handleSubmit() {
    if (!profile || !tournament || !selectedCategory) return;
    setSubmitting(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.from('registrations').insert({
      tournament_id: tournament.id,
      player_id: profile.id,
      category: selectedCategory,
      partner_name: isDoubles ? partnerName : null,
      emergency_contact: emergencyContact || null,
      status: 'pending',
      payment_status: tournament.entry_fee > 0 ? 'unpaid' : 'waived',
    });
    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      setStep('done');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!tournament || tournament.status !== 'open') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-stone-600">Registration is not open for this tournament.</p>
          <Link href={`/events/${id}`} className="text-orange-600 text-sm mt-2 inline-block">← Back to tournament</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-900">← Back</Link>
          <span className="text-sm font-bold text-orange-600">RallyOps</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Register</h1>
          <p className="text-sm text-stone-500 mt-1">{tournament.name}</p>
        </div>

        {/* Progress */}
        {step !== 'done' && (
          <div className="flex gap-2 mb-8">
            {(['category', ...(isDoubles ? ['partner'] : []), 'confirm'] as Step[]).map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step === s ? 'bg-orange-600' : i < ['category', 'partner', 'confirm'].indexOf(step) ? 'bg-orange-300' : 'bg-stone-200'}`} />
            ))}
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
                  {tournament.entry_fee > 0 ? `QAR ${tournament.entry_fee}` : 'Free'}
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
            <h2 className="text-2xl font-bold text-stone-900 mb-2">You&apos;re registered!</h2>
            <p className="text-stone-500 text-sm mb-2">
              Your registration for <strong>{CATEGORY_LABELS[selectedCategory]}</strong> has been submitted.
            </p>
            <p className="text-stone-400 text-sm mb-8">
              The organizer will review and approve your entry. You&apos;ll be notified once confirmed.
            </p>
            <div className="space-y-3">
              <Link
                href={`/events/${id}/register`}
                onClick={() => { setStep('category'); setSelectedCategory(''); setPartnerName(''); }}
                className="block w-full border border-orange-300 text-orange-600 py-3 rounded-xl font-medium text-sm hover:bg-orange-50 transition-colors"
              >
                Register for another category
              </Link>
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
