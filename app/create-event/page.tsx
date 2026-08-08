'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'categories' | 'details' | 'rules' | 'review';

const CATEGORIES = [
  { id: 'male_singles',   label: "Men's Singles",   icon: '🏸' },
  { id: 'female_singles', label: "Women's Singles",  icon: '🏸' },
  { id: 'male_doubles',   label: "Men's Doubles",    icon: '🏸' },
  { id: 'female_doubles', label: "Women's Doubles",  icon: '🏸' },
  { id: 'mixed_doubles',  label: 'Mixed Doubles',    icon: '🏸' },
  { id: 'spouse_doubles', label: 'Spouse Doubles',   icon: '🏸' },
];

const STEP_ORDER: Step[] = ['categories', 'details', 'rules', 'review'];

function ProgressDots({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={`rounded-full transition-all duration-200 ${
            i === idx ? 'w-6 h-2 bg-orange-500' : i < idx ? 'w-2 h-2 bg-orange-300' : 'w-2 h-2 bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

function IconCheck() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('categories');
  const sport = 'badminton';
  const [categories, setCategories] = useState<string[]>(['male_singles', 'female_singles', 'male_doubles', 'female_doubles']);
  const [customCategory, setCustomCategory] = useState('');
  const [form, setForm] = useState({
    name: '',
    venue: '',
    event_date: '',
    registration_close_at: '',
    entry_fee: '',
    status: 'open' as 'upcoming' | 'open',
    max_participants: '',
  });
  const [rules, setRules] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleCat(id: string) {
    setCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  function addCustomCategory() {
    const label = customCategory.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!id || categories.includes(id)) return;
    setCategories((prev) => [...prev, id]);
    setCustomCategory('');
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function next() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  }

  function back() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  async function handleCreate() {
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('You must be signed in to create an event.'); setSaving(false); return; }

    const { data, error: err } = await supabase.from('tournaments').insert({
      name: form.name.trim(),
      sport,
      venue: form.venue.trim() || null,
      event_date: form.event_date || null,
      registration_close_at: form.registration_close_at || null,
      status: form.status,
      entry_fee: form.entry_fee ? Number(form.entry_fee) : 0,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      categories,
      rules: rules.trim() || null,
      eligibility: eligibility.trim() || null,
      created_by: user.id,
    }).select('id').single();

    if (err || !data) {
      setError(err?.message ?? 'Failed to create event. Please try again.');
      setSaving(false);
      return;
    }

    router.push(`/events/${data.id}`);
  }

  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="RallyOps" className="h-8 w-auto object-contain" />
        </div>
        <button onClick={() => router.push('/events')} className="text-sm text-white/40 hover:text-white transition-colors">
          Cancel
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <ProgressDots step={step} />

          {/* STEP: Sport */}
          {/* STEP: Categories */}
          {step === 'categories' && (
            <div>
              <h1 className="text-2xl font-extrabold text-white text-center mb-1">Select categories</h1>
              <p className="text-sm text-white/40 text-center mb-8">Choose which events players can register for.</p>
              <div className="space-y-2 mb-4">
                {CATEGORIES.map((c) => {
                  const selected = categories.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCat(c.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                        selected
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-white/10 hover:border-white/30 bg-white/5'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-white/60'}`}>{c.label}</span>
                      {selected && (
                        <span className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white shrink-0">
                          <IconCheck />
                        </span>
                      )}
                    </button>
                  );
                })}
                {categories.filter((id) => !CATEGORIES.some((c) => c.id === id)).map((id) => (
                  <div key={id} className="w-full flex items-center justify-between p-4 rounded-2xl border border-orange-500 bg-orange-500/10">
                    <span className="text-sm font-semibold text-white capitalize">{id.replace(/_/g, ' ')}</span>
                    <button onClick={() => toggleCat(id)} className="text-white/40 hover:text-white text-xs font-semibold shrink-0">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-8">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } }}
                  placeholder="Don't see your category? Type it here"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  disabled={!customCategory.trim()}
                  className="px-4 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors shrink-0"
                >
                  Add
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={back} className="flex-1 border border-white/20 text-white/60 hover:text-white py-3.5 rounded-2xl font-bold text-sm transition-colors">
                  Back
                </button>
                <button
                  onClick={next}
                  disabled={categories.length === 0}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP: Details */}
          {step === 'details' && (
            <div>
              <h1 className="text-2xl font-extrabold text-white text-center mb-1">Event details</h1>
              <p className="text-sm text-white/40 text-center mb-8">Basic info players will see when browsing.</p>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Event name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Summer Open 2026"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Venue *</label>
                  <input
                    type="text"
                    required
                    value={form.venue}
                    onChange={(e) => set('venue', e.target.value)}
                    placeholder="e.g. Main Sports Hall, Dubai"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/40 mb-1.5">Event date *</label>
                    <input
                      type="date"
                      required
                      value={form.event_date}
                      onChange={(e) => set('event_date', e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/40 mb-1.5">Registration closes *</label>
                    <input
                      type="datetime-local"
                      required
                      value={form.registration_close_at}
                      onChange={(e) => set('registration_close_at', e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/40 mb-1.5">Entry fee (0 = free) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={form.entry_fee}
                      onChange={(e) => set('entry_fee', e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/40 mb-1.5">Max participants *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={form.max_participants}
                      onChange={(e) => set('max_participants', e.target.value)}
                      placeholder="No limit"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Registration status *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['open', 'upcoming'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('status', s)}
                        className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                          form.status === s
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {s === 'open' ? 'Open now' : 'Upcoming'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={back} className="flex-1 border border-white/20 text-white/60 hover:text-white py-3.5 rounded-2xl font-bold text-sm transition-colors">
                  Back
                </button>
                <button
                  onClick={next}
                  disabled={!form.name.trim() || !form.venue.trim() || !form.event_date || !form.registration_close_at || form.entry_fee === '' || !form.max_participants}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP: Rules */}
          {step === 'rules' && (
            <div>
              <h1 className="text-2xl font-extrabold text-white text-center mb-1">Rules & eligibility</h1>
              <p className="text-sm text-white/40 text-center mb-8">Shown to players before they register. Optional.</p>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Eligibility requirements</label>
                  <textarea
                    rows={3}
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    placeholder="e.g. Men's Singles: Open to all skill levels.\nWomen's Singles: Age 16+.\nMixed Doubles: One player must be a club member."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5">Tournament rules</label>
                  <textarea
                    rows={5}
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    placeholder={`1. Matches follow BWF scoring rules (21 points, best of 3 sets).\n2. Players must report 10 minutes before scheduled time.\n3. No-show after 10 minutes = walkover.`}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-colors resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={back} className="flex-1 border border-white/20 text-white/60 hover:text-white py-3.5 rounded-2xl font-bold text-sm transition-colors">
                  Back
                </button>
                <button onClick={next} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors">
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP: Review */}
          {step === 'review' && (
            <div>
              <h1 className="text-2xl font-extrabold text-white text-center mb-1">Review & publish</h1>
              <p className="text-sm text-white/40 text-center mb-8">Double-check everything before going live.</p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 mb-8">
                <div>
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1">Event</p>
                  <p className="text-white font-bold text-lg">{form.name}</p>
                  <p className="text-white/50 text-sm capitalize">{sport} · {form.status === 'open' ? 'Open for registration' : 'Upcoming'}</p>
                </div>
                {(form.venue || form.event_date) && (
                  <div>
                    <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1">Where & when</p>
                    {form.venue && <p className="text-white/70 text-sm">{form.venue}</p>}
                    {form.event_date && (
                      <p className="text-white/70 text-sm">
                        {new Date(form.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">Categories ({categories.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <span key={c} className="text-xs bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2.5 py-1 rounded-full font-medium">
                        {catLabel(c)}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1">Entry fee</p>
                  <p className="text-white/70 text-sm">{form.entry_fee ? `${form.entry_fee} per player` : 'Free'}</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-xl mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={back} className="flex-1 border border-white/20 text-white/60 hover:text-white py-3.5 rounded-2xl font-bold text-sm transition-colors">
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors"
                >
                  {saving ? 'Publishing...' : 'Publish event'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
