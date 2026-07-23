'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTournamentStore } from '../tournament/store';
import type { Category } from '../tournament/types';
import { CATEGORY_LABELS } from '../tournament/types';

type Step = 'sport' | 'categories' | 'details' | 'courts';
type View = 'home' | 'setup';

const SPORTS = [
  { id: 'badminton', label: 'Badminton', emoji: '🏸', available: true, sub: 'Best of 3 sets · 21 pts' },
  { id: 'tennis', label: 'Tennis', emoji: '🎾', available: false },
  { id: 'squash', label: 'Squash', emoji: '🟡', available: false },
  { id: 'pickleball', label: 'Pickleball', emoji: '🏓', available: false },
];

const ALL_CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'male_singles', label: 'Men\'s Singles', icon: '🧑' },
  { id: 'female_singles', label: 'Women\'s Singles', icon: '👩' },
  { id: 'male_doubles', label: 'Men\'s Doubles', icon: '👬' },
  { id: 'female_doubles', label: 'Women\'s Doubles', icon: '👭' },
  { id: 'spouse_doubles', label: 'Spouse Doubles', icon: '👫' },
];

export default function RallyOpsHome() {
  const router = useRouter();
  const store = useTournamentStore();
  const { isSetup, tournamentName, organizerName, eventDate, venue, participants, matches, managerPassword, reset } = store;

  const [view, setView] = useState<View>('home');
  const [step, setStep] = useState<Step>('sport');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedCats, setSelectedCats] = useState<Category[]>(['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles']);
  const [form, setForm] = useState({ tournamentName: '', organizerName: '', venue: '', eventDate: '', registrationDeadline: '', courtCount: 4, managerPassword: '' });

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const toggleCat = (cat: Category) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSetup = () => {
    store.setupTournament({
      ...form,
      courtCount: Number(form.courtCount),
      selectedCategories: selectedCats,
    });
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
    if (sessionStorage.getItem('rally-unlocked') || !managerPassword) {
      router.push('/admin');
    } else {
      setPasswordError(false);
      setPasswordInput('');
      setShowPasswordModal(true);
    }
  };

  // ── SETUP WIZARD ─────────────────────────────────────────────────────────────
  if (view === 'setup') {
    const steps: Step[] = ['sport', 'categories', 'details', 'courts'];
    const stepIdx = steps.indexOf(step);

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-950 via-orange-900 to-amber-900 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-8 pb-2">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏸</span>
              <span className="text-xl font-black text-white tracking-tight">RallyOps</span>
            </div>
            <button onClick={() => setView('home')} className="text-orange-300 hover:text-white text-sm transition-colors">✕ Cancel</button>
          </div>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2 py-4">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIdx ? 'w-8 bg-orange-400' : i < stepIdx ? 'w-4 bg-orange-600' : 'w-4 bg-orange-900'}`} />
          ))}
        </div>

        <div className="flex-1 px-6 pb-10 overflow-y-auto">
          <div className="max-w-2xl mx-auto">

            {/* STEP 1 — Sport */}
            {step === 'sport' && (
              <div>
                <div className="text-center mb-8 mt-2">
                  <h2 className="text-3xl font-black text-white mb-2">Select your sport</h2>
                  <p className="text-orange-300 text-sm">We'll tailor the flow and scoring for you.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {SPORTS.map((sport) => (
                    <button key={sport.id} onClick={() => sport.available && setSelectedSport(sport.id)}
                      disabled={!sport.available}
                      className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                        sport.available
                          ? selectedSport === sport.id
                            ? 'border-orange-400 bg-orange-400/20 shadow-lg shadow-orange-900/50'
                            : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                          : 'border-white/5 bg-white/[0.03] opacity-40 cursor-not-allowed'
                      }`}>
                      {!sport.available && <span className="absolute top-3 right-3 text-xs text-orange-400 font-medium bg-orange-900/60 px-2 py-0.5 rounded-full">Soon</span>}
                      {selectedSport === sport.id && <span className="absolute top-3 right-3 text-orange-400 text-lg">✓</span>}
                      <div className="text-4xl mb-3">{sport.emoji}</div>
                      <p className="text-white font-bold text-lg">{sport.label}</p>
                      {sport.sub && <p className="text-orange-300 text-xs mt-1">{sport.sub}</p>}
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep('categories')} disabled={!selectedSport}
                  className="mt-8 w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Continue →
                </button>
              </div>
            )}

            {/* STEP 2 — Categories */}
            {step === 'categories' && (
              <div>
                <div className="text-center mb-8 mt-2">
                  <h2 className="text-3xl font-black text-white mb-2">Which categories?</h2>
                  <p className="text-orange-300 text-sm">Tap to select all the events you'll run. You can always adjust later.</p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center mb-8">
                  {ALL_CATEGORIES.map((cat) => {
                    const selected = selectedCats.includes(cat.id);
                    return (
                      <button key={cat.id} onClick={() => toggleCat(cat.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-full border-2 font-semibold text-sm transition-all duration-150 ${
                          selected
                            ? 'bg-orange-400 border-orange-400 text-white shadow-lg shadow-orange-900/40'
                            : 'bg-white/5 border-white/20 text-orange-200 hover:border-orange-400/60 hover:bg-white/10'
                        }`}>
                        <span>{cat.icon}</span>
                        {cat.label}
                        {selected && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6 text-center">
                  <p className="text-orange-300 text-sm">
                    {selectedCats.length === 0
                      ? 'Select at least one category to continue'
                      : `${selectedCats.length} categor${selectedCats.length === 1 ? 'y' : 'ies'} selected`}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('sport')} className="px-6 py-4 rounded-2xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors">← Back</button>
                  <button onClick={() => setStep('details')} disabled={selectedCats.length === 0}
                    className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 — Details */}
            {step === 'details' && (
              <div>
                <div className="text-center mb-8 mt-2">
                  <h2 className="text-3xl font-black text-white mb-2">Tournament details</h2>
                  <p className="text-orange-300 text-sm">Tell us about your event</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-5">
                  <Field label="Tournament name" required>
                    <input type="text" placeholder="e.g. Samanvayam Qatar Open 2026" value={form.tournamentName}
                      onChange={(e) => setForm({ ...form, tournamentName: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-orange-300/60 focus:outline-none focus:border-orange-400 text-sm" />
                  </Field>
                  <Field label="Organizer / Club name" required>
                    <input type="text" placeholder="e.g. Samanvayam Sports Club" value={form.organizerName}
                      onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-orange-300/60 focus:outline-none focus:border-orange-400 text-sm" />
                  </Field>
                  <Field label="Venue">
                    <input type="text" placeholder="e.g. Sports Complex, Doha" value={form.venue}
                      onChange={(e) => setForm({ ...form, venue: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-orange-300/60 focus:outline-none focus:border-orange-400 text-sm" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Event date">
                      <input type="date" value={form.eventDate}
                        onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-400 text-sm" />
                    </Field>
                    <Field label="Reg. deadline">
                      <input type="date" value={form.registrationDeadline}
                        onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-400 text-sm" />
                    </Field>
                  </div>
                  <Field label="Manager password" >
                    <input type="password" placeholder="Set a password to protect the admin panel"
                      value={form.managerPassword}
                      onChange={(e) => setForm({ ...form, managerPassword: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-orange-300/60 focus:outline-none focus:border-orange-400 text-sm" />
                    <p className="text-orange-400/70 text-xs mt-1.5">Optional. Keeps the dashboard locked for others — you won't need to re-enter every session.</p>
                  </Field>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep('categories')} className="px-6 py-4 rounded-2xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors">← Back</button>
                  <button onClick={() => setStep('courts')} disabled={!form.tournamentName || !form.organizerName}
                    className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 — Courts */}
            {step === 'courts' && (
              <div>
                <div className="text-center mb-8 mt-2">
                  <h2 className="text-3xl font-black text-white mb-2">How many courts?</h2>
                  <p className="text-orange-300 text-sm">You can always add more from the dashboard</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                  <div className="flex items-center justify-center gap-6 py-6">
                    <button onClick={() => setForm({ ...form, courtCount: Math.max(1, form.courtCount - 1) })}
                      className="w-14 h-14 rounded-full bg-white/10 border border-white/20 text-white text-2xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center">−</button>
                    <div className="text-center">
                      <span className="text-7xl font-black text-white">{form.courtCount}</span>
                      <p className="text-orange-300 mt-1">courts</p>
                    </div>
                    <button onClick={() => setForm({ ...form, courtCount: Math.min(20, form.courtCount + 1) })}
                      className="w-14 h-14 rounded-full bg-white/10 border border-white/20 text-white text-2xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Array.from({ length: form.courtCount }, (_, i) => (
                      <span key={i} className="text-xs bg-orange-500/30 text-orange-200 px-3 py-1 rounded-full">Court {i + 1}</span>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-5 bg-white/5 rounded-2xl p-5 border border-white/10">
                  <p className="text-orange-300 text-xs font-bold uppercase tracking-widest mb-3">Summary</p>
                  <div className="space-y-2 text-sm">
                    <Row label="Sport" value="🏸 Badminton" />
                    <Row label="Categories" value={selectedCats.map((c) => CATEGORY_LABELS[c]).join(', ')} />
                    <Row label="Tournament" value={form.tournamentName} />
                    <Row label="Organizer" value={form.organizerName} />
                    {form.venue && <Row label="Venue" value={form.venue} />}
                    {form.eventDate && <Row label="Date" value={new Date(form.eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} />}
                    <Row label="Courts" value={`${form.courtCount} courts`} />
                    {form.managerPassword && <Row label="Password" value="••••••••" />}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep('details')} className="px-6 py-4 rounded-2xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors">← Back</button>
                  <button onClick={handleSetup} className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-400 transition-colors">
                    Launch Tournament 🚀
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
  const liveMatches = matches.filter((m) => m.status === 'in_progress').length;
  const completedMatches = matches.filter((m) => m.status === 'completed').length;

  return (
    <div className="min-h-screen bg-orange-950 flex flex-col">
      {/* Navbar */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-orange-900/60">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏸</span>
          <div>
            <span className="text-lg font-black text-white tracking-tight">RallyOps</span>
            <span className="ml-2 text-orange-500 text-xs font-medium hidden sm:inline">Tournament Management</span>
          </div>
        </div>
        <button onClick={handleNewTournament}
          className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          + New Tournament
        </button>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        {!isSetup ? (
          /* Empty state */
          <div className="max-w-md w-full">
            <div className="text-6xl mb-5">🏸</div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
              Run your tournament.<br />
              <span className="text-orange-400">Not your spreadsheet.</span>
            </h1>
            <p className="text-orange-300 text-base mb-8 leading-relaxed">
              Brackets, live scoring, court management, and player registration — all in one place.
            </p>

            <button onClick={handleNewTournament}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-colors mb-4">
              Set Up Your Tournament →
            </button>

            {/* How it works — compact inline */}
            <div className="flex items-center justify-center gap-3 text-orange-400 text-xs mt-6">
              <span>⚙️ Setup</span>
              <span className="text-orange-700">→</span>
              <span>👥 Register</span>
              <span className="text-orange-700">→</span>
              <span>🏆 Run Live</span>
            </div>
            <p className="text-orange-700 text-xs mt-6">Free · No account needed · Works on any device</p>
          </div>
        ) : (
          /* Tournament card */
          <div className="max-w-lg w-full">
            <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-4">Your Tournament</p>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-left mb-4">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-3xl flex-shrink-0">🏸</div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-white truncate">{tournamentName}</h2>
                  <p className="text-orange-300 text-sm">{organizerName}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-orange-500">
                    {venue && <span>📍 {venue}</span>}
                    {eventDate && <span>📅 {new Date(eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
                {managerPassword && (
                  <div className="text-orange-400 text-lg" title="Password protected">🔒</div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-white">{participants.length}</p>
                  <p className="text-orange-400 text-xs mt-0.5">Players</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-black ${liveMatches > 0 ? 'text-orange-400' : 'text-white'}`}>{liveMatches > 0 ? liveMatches : matches.length}</p>
                  <p className="text-orange-400 text-xs mt-0.5">{liveMatches > 0 ? 'Live Now' : 'Matches'}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-green-400">{completedMatches}</p>
                  <p className="text-orange-400 text-xs mt-0.5">Completed</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button onClick={openDashboard}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {managerPassword ? '🔒' : '⚙️'} Open Dashboard
                </button>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/tournament`;
                    navigator.clipboard.writeText(url).then(() => alert('Player link copied! Share it with participants.')).catch(() => {});
                  }}
                  className="w-full bg-white/5 hover:bg-white/10 text-orange-200 border border-white/10 font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                  🔗 Copy Player Registration Link
                </button>
              </div>
            </div>

            <button onClick={handleNewTournament} className="text-orange-600 hover:text-orange-400 text-xs transition-colors">
              + Start a new tournament
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 py-5 border-t border-orange-900/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-orange-700">
          <div className="flex items-center gap-4">
            <span className="text-orange-600 font-semibold">RallyOps</span>
            <span>·</span>
            <a href="#" className="hover:text-orange-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-orange-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-orange-500 transition-colors">Support</a>
          </div>
          <a href="https://purvahk.com" target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">
            Made with love, dedication & coffee by <span className="text-orange-600">Purva</span> ☕
          </a>
        </div>
      </footer>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <div className="bg-orange-950 border border-orange-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-xl font-black text-white mb-1">Admin Access</h3>
              <p className="text-orange-400 text-sm">Enter the manager password to continue</p>
            </div>
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              autoFocus
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-orange-400/60 focus:outline-none text-sm mb-2 ${
                passwordError ? 'border-red-500' : 'border-white/20 focus:border-orange-400'
              }`}
            />
            {passwordError && <p className="text-red-400 text-xs mb-3 text-center">Incorrect password. Try again.</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/20 text-orange-300 text-sm font-medium hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button onClick={handleUnlock}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm transition-colors">
                Unlock →
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
      <label className="block text-orange-200 text-xs font-bold uppercase tracking-widest mb-1.5">
        {label} {required && <span className="text-orange-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-orange-300 flex-shrink-0">{label}</span>
      <span className="text-white font-medium text-right truncate">{value}</span>
    </div>
  );
}
