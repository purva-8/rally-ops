'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTournamentStore } from '../tournament/store';
import type { Category } from '../tournament/types';
import { CATEGORY_LABELS } from '../tournament/types';

type Step = 'sport' | 'categories' | 'details' | 'courts';
type View = 'home' | 'setup';

const SPORTS = [
  { id: 'badminton', label: 'Badminton', sub: 'Best of 3 sets · 21 pts', available: true },
  { id: 'tennis',    label: 'Tennis',    sub: 'Coming soon',              available: false },
  { id: 'squash',    label: 'Squash',    sub: 'Coming soon',              available: false },
  { id: 'pickleball',label: 'Pickleball',sub: 'Coming soon',              available: false },
];

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
  const [step, setStep] = useState<Step>('sport');
  const [selectedSport, setSelectedSport] = useState('');
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
    setStep('sport');
    setSelectedSport('');
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
    const steps: Step[] = ['sport', 'categories', 'details', 'courts'];
    const stepIdx = steps.indexOf(step);

    return (
      <div className="min-h-screen bg-[#1C0A00] flex flex-col">
        <div className="px-6 pt-6 pb-2">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black text-white">R</div>
              <span className="text-sm font-bold text-white tracking-tight">RallyOps</span>
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

            {/* STEP 1 — Sport */}
            {step === 'sport' && (
              <div>
                <div className="mb-8 mt-2">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">Select your sport</h2>
                  <p className="text-white/40 text-sm">We'll tailor scoring and brackets for you.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {SPORTS.map((sport) => (
                    <button
                      key={sport.id}
                      onClick={() => sport.available && setSelectedSport(sport.id)}
                      disabled={!sport.available}
                      className={`relative p-5 rounded-2xl border text-left transition-all duration-150 ${
                        sport.available
                          ? selectedSport === sport.id
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                          : 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                      }`}
                    >
                      {!sport.available && (
                        <span className="absolute top-3 right-3 text-[10px] text-white/40 font-medium bg-white/5 px-2 py-0.5 rounded-full">Soon</span>
                      )}
                      {selectedSport === sport.id && (
                        <span className="absolute top-3 right-3 text-orange-400"><IconCheck className="w-4 h-4" /></span>
                      )}
                      <p className="text-white font-bold text-base mb-0.5">{sport.label}</p>
                      <p className="text-white/40 text-xs">{sport.sub}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep('categories')}
                  disabled={!selectedSport}
                  className="mt-6 w-full bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {/* STEP 2 — Categories */}
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
                  <button onClick={() => setStep('sport')} className="px-5 py-3 rounded-xl border border-white/15 text-white/60 text-sm font-medium hover:bg-white/5 transition-colors">Back</button>
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
                    {form.eventDate && <Row label="Date"  value={new Date(form.eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} />}
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
    <div className="min-h-screen bg-[#1C0A00] flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black text-white">R</div>
          <span className="text-sm font-bold text-white tracking-tight">RallyOps</span>
          <span className="ml-1.5 text-white/25 text-xs hidden sm:inline">Tournament Management</span>
        </div>
        <button
          onClick={handleNewTournament}
          className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          New Tournament
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {!isSetup ? (
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-600 rounded-2xl mb-7">
              <span className="text-2xl font-black text-white">R</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 leading-tight tracking-tight">
              Run your tournament.<br />
              <span className="text-orange-500">Not your spreadsheet.</span>
            </h1>
            <p className="text-white/40 text-base mb-8 leading-relaxed max-w-sm mx-auto">
              Brackets, live scoring, court management, and player registration — all in one place.
            </p>

            <button
              onClick={handleNewTournament}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-colors mb-6"
            >
              Set Up Your Tournament
            </button>

            <div className="flex items-center justify-center gap-6 text-white/25 text-xs">
              <span>Setup</span>
              <span className="w-4 h-px bg-white/15" />
              <span>Register Players</span>
              <span className="w-4 h-px bg-white/15" />
              <span>Run Live</span>
            </div>
            <p className="text-white/20 text-xs mt-6">Free · No account needed · Works on any device</p>
          </div>
        ) : (
          <div className="max-w-lg w-full">
            <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-4">Your Tournament</p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-600/30 flex items-center justify-center font-black text-orange-400 text-xl shrink-0">
                  R
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-extrabold text-white truncate tracking-tight">{tournamentName}</h2>
                  <p className="text-white/40 text-sm">{organizerName}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/30">
                    {venue     && <span>{venue}</span>}
                    {eventDate && <span>{new Date(eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
                {managerPassword && (
                  <div className="text-white/30" title="Password protected">
                    <IconLock className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: 'Players',   value: participants.length,                        color: 'text-white' },
                  { label: liveMatches > 0 ? 'Live Now' : 'Matches', value: liveMatches > 0 ? liveMatches : matches.length, color: liveMatches > 0 ? 'text-orange-400' : 'text-white' },
                  { label: 'Completed', value: completedMatches,                           color: 'text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-white/30 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={openDashboard}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {managerPassword && <IconLock className="w-4 h-4" />}
                  Open Dashboard
                </button>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/tournament`;
                    navigator.clipboard.writeText(url).then(() => alert('Player link copied!')).catch(() => {});
                  }}
                  className="w-full bg-white/5 hover:bg-white/8 text-white/60 border border-white/10 font-medium py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <IconLink className="w-4 h-4" />
                  Copy Registration Link
                </button>
              </div>
            </div>

            <button onClick={handleNewTournament} className="text-white/30 hover:text-white/60 text-xs transition-colors">
              + Start a new tournament
            </button>
          </div>
        )}
      </div>

      <footer className="px-6 py-4 border-t border-white/5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/20">
          <div className="flex items-center gap-4">
            <span className="text-white/40 font-semibold">RallyOps</span>
            <span>·</span>
            <a href="#" className="hover:text-white/40 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/40 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/40 transition-colors">Support</a>
          </div>
          <a href="https://purvahk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/40 transition-colors">
            Built by <span className="text-white/30">Purva</span>
          </a>
        </div>
      </footer>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-[#1C0A00] border border-white/10 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
            <div className="mb-6">
              <div className="w-10 h-10 bg-white/8 border border-white/10 rounded-xl flex items-center justify-center mb-4">
                <IconLock className="w-5 h-5 text-white/50" />
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight mb-1">Admin Access</h3>
              <p className="text-white/40 text-sm">Enter the manager password to continue</p>
            </div>
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              autoFocus
              className={`w-full bg-white/8 border rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none text-sm mb-2 ${
                passwordError ? 'border-red-500' : 'border-white/15 focus:border-orange-500'
              }`}
            />
            {passwordError && <p className="text-red-400 text-xs mb-3">Incorrect password. Try again.</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white/50 text-sm font-medium hover:bg-white/5 transition-colors">
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
