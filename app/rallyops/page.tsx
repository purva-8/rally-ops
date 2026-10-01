'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTournamentStore } from '../tournament/store';
import type { Category } from '../tournament/types';
import { CATEGORY_LABELS } from '../tournament/types';
import { formatDate } from '@/lib/format';

type Step = 'categories' | 'details' | 'courts';
type View = 'home' | 'setup';

const ALL_CATEGORIES: { id: Category; label: string }[] = [
  { id: 'male_singles',   label: "Men's Singles" },
  { id: 'female_singles', label: "Women's Singles" },
  { id: 'male_doubles',   label: "Men's Doubles" },
  { id: 'female_doubles', label: "Women's Doubles" },
  { id: 'spouse_doubles', label: 'Spouse Doubles' },
];

function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function IconLock({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );
}

function IconLink({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
    </svg>
  );
}

export default function RallyOpsHome() {
  const router = useRouter();
  const store = useTournamentStore();
  const { isSetup, tournamentName, organizerName, eventDate, venue, participants, matches, managerPassword, reset } = store;

  const [view, setView] = useState<View>('home');
  const [step, setStep] = useState<Step>('categories');
  const [selectedCats, setSelectedCats] = useState<Category[]>(['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles']);
  const [form, setForm] = useState({ tournamentName: '', organizerName: '', venue: '', eventDate: '', registrationDeadline: '', courtCount: 4, managerPassword: '' });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const toggleCat = (cat: Category) =>
    setSelectedCats((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  const handleSetup = () => {
    store.setupTournament({ ...form, courtCount: Number(form.courtCount), selectedCategories: selectedCats });
    router.push('/admin');
  };

  const handleNewTournament = () => {
    if (isSetup) reset();
    setStep('categories');
    setSelectedCats(['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles']);
    setForm({ tournamentName: '', organizerName: '', venue: '', eventDate: '', registrationDeadline: '', courtCount: 4, managerPassword: '' });
    setView('setup');
  };

  const handleUnlock = () => {
    if (!managerPassword || passwordInput === managerPassword) {
      sessionStorage.setItem('rally-unlocked', '1');
      router.push('/admin');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  const openDashboard = () => {
    if (sessionStorage.getItem('rally-unlocked') || !managerPassword) router.push('/admin');
    else { setPasswordError(false); setPasswordInput(''); setShowPasswordModal(true); }
  };

  // ── SETUP WIZARD ─────────────────────────────────────────────────────────────
  if (view === 'setup') {
    const steps: Step[] = ['categories', 'details', 'courts'];
    const stepIdx = steps.indexOf(step);

    return (
      <div className="min-h-screen bg-[#111827] flex flex-col">
        <div className="px-6 pt-6 pb-2">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="RallyOps" className="h-14 w-auto object-contain" />
            </div>
            <button onClick={() => setView('home')} className="text-white/40 hover:text-white text-sm transition-colors">Cancel</button>
          </div>
        </div>

        <div className="flex justify-center gap-2 py-4">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 rounded-full transition-all duration-300 ${i === stepIdx ? 'w-8 bg-orange-500' : i < stepIdx ? 'w-4 bg-orange-700' : 'w-4 bg-white/10'}`} />
          ))}
        </div>

        <div className="flex-1 px-6 pb-10 overflow-y-auto">
          <div className="max-w-lg mx-auto">

            {/* STEP 1 — Categories */}
            {step === 'categories' && (
              <div>
                <div className="mb-8 mt-2">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">Which categories?</h2>
                  <p className="text-white/40 text-sm">Select all events you'll run. Adjustable later.</p>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {ALL_CATEGORIES.map((cat) => {
                    const selected = selectedCats.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCat(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all duration-150 ${
                          selected
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-white/5 border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'
                        }`}
                      >
                        {selected && <IconCheck className="w-3.5 h-3.5" />}
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-white/30 text-xs mb-6">
                  {selectedCats.length === 0 ? 'Select at least one category' : `${selectedCats.length} categor${selectedCats.length === 1 ? 'y' : 'ies'} selected`}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setView('home')} className="px-5 py-3 rounded-xl border border-white/15 text-white/60 text-sm font-medium hover:bg-white/5 transition-colors">Back</button>
                  <button
                    onClick={() => setStep('details')}
                    disabled={selectedCats.length === 0}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 — Details */}
            {step === 'details' && (
              <div>
                <div className="mb-8 mt-2">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">Tournament details</h2>
                  <p className="text-white/40 text-sm">Tell us about your event</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <Field label="Tournament name" required>
                    <input type="text" placeholder="e.g. Samanvayam Qatar Open 2026" value={form.tournamentName}
                      onChange={(e) => setForm({ ...form, tournamentName: e.target.value })}
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-orange-500 text-sm" />
                  </Field>
                  <Field label="Organizer / Club name" required>
                    <input type="text" placeholder="e.g. Samanvayam Sports Club" value={form.organizerName}
                      onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-orange-500 text-sm" />
                  </Field>
                  <Field label="Venue">
                    <input type="text" placeholder="e.g. Sports Complex, Doha" value={form.venue}
                      onChange={(e) => setForm({ ...form, venue: e.target.value })}
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-orange-500 text-sm" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Event date">
                      <input type="date" value={form.eventDate}
                        onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 text-sm" />
                    </Field>
                    <Field label="Reg. deadline">
                      <input type="date" value={form.registrationDeadline}
                        onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 text-sm" />
                    </Field>
                  </div>
                  <Field label="Manager password">
                    <input type="password" placeholder="Protects the admin panel (optional)"
                      value={form.managerPassword}
                      onChange={(e) => setForm({ ...form, managerPassword: e.target.value })}
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-orange-500 text-sm" />
                    <p className="text-white/25 text-xs mt-1.5">Optional. Keeps the dashboard locked for others.</p>
                  </Field>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep('categories')} className="px-5 py-3 rounded-xl border border-white/15 text-white/60 text-sm font-medium hover:bg-white/5 transition-colors">Back</button>
                  <button
                    onClick={() => setStep('courts')}
                    disabled={!form.tournamentName || !form.organizerName}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 — Courts */}
            {step === 'courts' && (
              <div>
                <div className="mb-8 mt-2">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">How many courts?</h2>
                  <p className="text-white/40 text-sm">You can add more from the dashboard later</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-center gap-8 py-4">
                    <button
                      onClick={() => setForm({ ...form, courtCount: Math.max(1, form.courtCount - 1) })}
                      className="w-12 h-12 rounded-xl bg-white/8 border border-white/15 text-white text-xl font-bold hover:bg-white/12 transition-colors flex items-center justify-center"
                    >
                      −
                    </button>
                    <div className="text-center">
                      <span className="text-6xl font-black text-white">{form.courtCount}</span>
                      <p className="text-white/40 text-sm mt-1">courts</p>
                    </div>
                    <button
                      onClick={() => setForm({ ...form, courtCount: Math.min(20, form.courtCount + 1) })}
                      className="w-12 h-12 rounded-xl bg-white/8 border border-white/15 text-white text-xl font-bold hover:bg-white/12 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                    {Array.from({ length: form.courtCount }, (_, i) => (
                      <span key={i} className="text-xs bg-white/8 text-white/50 px-2.5 py-1 rounded-full">Court {i + 1}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Summary</p>
                  <div className="space-y-2">
                    <Row label="Sport"       value="Badminton" />
                    <Row label="Categories"  value={selectedCats.map((c) => CATEGORY_LABELS[c]).join(', ')} />
                    <Row label="Tournament"  value={form.tournamentName} />
                    <Row label="Organizer"   value={form.organizerName} />
                    {form.venue    && <Row label="Venue"  value={form.venue} />}
                    {form.eventDate && <Row label="Date"  value={formatDate(form.eventDate)} />}
                    <Row label="Courts"      value={`${form.courtCount} courts`} />
                    {form.managerPassword && <Row label="Password" value="••••••••" />}
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep('details')} className="px-5 py-3 rounded-xl border border-white/15 text-white/60 text-sm font-medium hover:bg-white/5 transition-colors">Back</button>
                  <button
                    onClick={handleSetup}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    Launch Tournament
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── HOME PAGE ─────────────────────────────────────────────────────────────────
  const liveMatches      = matches.filter((m) => m.status === 'in_progress').length;
  const completedMatches = matches.filter((m) => m.status === 'completed').length;

  return (
    <div className={`flex flex-col bg-white ${isSetup ? "min-h-screen" : "h-screen overflow-hidden"}`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`}</style>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="RallyOps" className="h-14 w-auto object-contain" />
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden px-6 py-10 flex-1 flex flex-col items-center justify-center text-center"
        style={{
          backgroundColor: '#EEF2FF',
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <div className="absolute left-[-60px] top-1/2 -translate-y-1/2 text-[420px] font-black text-indigo-200/40 select-none pointer-events-none leading-none hidden lg:block">R</div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.05] tracking-tight mb-2">
            Run your tournament.
          </h1>
          <div className="relative inline-block mb-6">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl text-slate-800 leading-[1.1]"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Not your spreadsheet.
            </h1>
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 600 16" preserveAspectRatio="none" fill="none">
              <path d="M4,10 Q100,2 200,10 Q300,18 400,10 Q500,2 596,10" stroke="#f97316" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>

          <p className="text-slate-500 text-lg leading-relaxed max-w-xl mx-auto mb-8">
            Your organization hosts the tournament. RallyOps handles everything else: registration, brackets, live scoring, coach views, and the leaderboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/login"
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-orange-200 inline-block"
            >
              Log in OR Sign up
            </a>
          </div>
        </div>
      </section>

      {/* ── ACTIVE TOURNAMENT ── */}

      {/* ── FOOTER ── */}
      <footer className="px-6 py-5 border-t border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-orange-600 rounded-md flex items-center justify-center text-[10px] font-black text-white">R</div>
              <span className="text-slate-600 font-bold">RallyOps</span>
            </div>
            <span>·</span>
            <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-slate-600 transition-colors">Terms</a>
            <a href="/support" className="hover:text-slate-600 transition-colors">Support</a>
          </div>
          <a href="https://www.linkedin.com/in/purva-hk/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-slate-600 transition-colors">
            <span>built by <span className="text-slate-500 font-medium">purva</span></span>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-label="LinkedIn"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
          </a>
        </div>
      </footer>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <div className="mb-6">
              <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center mb-4">
                <IconLock className="w-5 h-5 text-slate-500" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight mb-1">Admin Access</h3>
              <p className="text-slate-500 text-sm">Enter the manager password to continue</p>
            </div>
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              autoFocus
              className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none text-sm mb-2 ${
                passwordError ? 'border-red-400' : 'border-slate-200 focus:border-orange-500'
              }`}
            />
            {passwordError && <p className="text-red-500 text-xs mb-3">Incorrect password. Try again.</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleUnlock}
                className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-colors">
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-orange-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-white/30 shrink-0">{label}</span>
      <span className="text-white/70 text-right truncate">{value}</span>
    </div>
  );
}
