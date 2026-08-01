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
      <div className="min-h-screen bg-[#111827] flex flex-col">
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
    <div className="min-h-screen flex flex-col bg-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`}</style>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center text-sm font-black text-white">R</div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">RallyOps</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#roles" className="hover:text-slate-900 transition-colors">Who it's for</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5">Log in</a>
          <button
            onClick={handleNewTournament}
            className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Get started free
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden px-6 pt-20 pb-24 flex flex-col items-center text-center"
        style={{
          backgroundColor: '#EEF2FF',
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <div className="absolute left-[-60px] top-1/2 -translate-y-1/2 text-[420px] font-black text-indigo-200/40 select-none pointer-events-none leading-none hidden lg:block">R</div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Tournament management for organizations
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.05] tracking-tight mb-2">
            Run your tournament.
          </h1>
          <div className="relative inline-block mb-8">
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl text-slate-800 leading-[1.1]"
              style={{ fontFamily: "'Dancing Script', cursive" }}
            >
              Not your spreadsheet.
            </h1>
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 600 16" preserveAspectRatio="none" fill="none">
              <path d="M4,10 Q100,2 200,10 Q300,18 400,10 Q500,2 596,10" stroke="#f97316" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>

          <p className="text-slate-500 text-xl leading-relaxed max-w-xl mx-auto mb-10">
            Your organization hosts the tournament. RallyOps handles everything else — registration, brackets, live scoring, coach views, and the leaderboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <button
              onClick={handleNewTournament}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-orange-200"
            >
              Set up your tournament
            </button>
            <a
              href="/events"
              className="w-full sm:w-auto border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-8 py-4 rounded-xl text-base transition-colors text-center"
            >
              View as player
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 text-slate-400 text-sm">
            <span>Free to use</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>No setup fees</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>Works on any device</span>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section id="roles" className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">Built for everyone in the room</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">One platform. Three views.</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto">Everyone gets exactly what they need — nothing more, nothing less.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                badge: 'Org Head',
                color: 'bg-violet-50 border-violet-200 text-violet-700',
                dot: 'bg-violet-500',
                title: 'You run the show.',
                desc: 'Set up categories, courts, and dates. Share one link for registrations. On match day, your admin dashboard shows every match, every score, every bracket in real time. Fix anything with a tap.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75" />
                  </svg>
                ),
              },
              {
                badge: 'Players',
                color: 'bg-orange-50 border-orange-200 text-orange-700',
                dot: 'bg-orange-500',
                title: 'Just show up and play.',
                desc: 'Register once, get your profile. See your draw, your next match, and your results. The app notifies you when it\'s your turn. No paper, no confusion.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
              {
                badge: 'Coaches',
                color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                dot: 'bg-emerald-500',
                title: 'Score on the fly.',
                desc: 'A dedicated court view shows the active match. Update points live as the rally happens. Multiple courts, multiple coaches — all synced instantly.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                ),
              },
            ].map((role) => (
              <div key={role.badge} className="bg-slate-50 border border-slate-100 rounded-2xl p-7">
                <div className={`inline-flex items-center gap-1.5 border text-xs font-bold px-2.5 py-1 rounded-full mb-5 ${role.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${role.dot}`} />
                  {role.badge}
                </div>
                <div className="text-slate-700 mb-3">{role.icon}</div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2 tracking-tight">{role.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="px-6 py-20" style={{ backgroundColor: '#F8FAFF' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">Simple by design</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">From setup to podium in five steps.</h2>
          </div>

          <div className="space-y-4">
            {[
              { n: '01', title: 'Create your tournament', desc: 'Pick your sport, set your categories (Men\'s Singles, Mixed Doubles, Spouse Doubles — whatever you run), add courts and dates. Done in under 5 minutes.' },
              { n: '02', title: 'Share one registration link', desc: 'Send the link to your players. They sign up, fill their profile, and pick their categories. You see everyone in your admin panel as they register.' },
              { n: '03', title: 'Go live on match day', desc: 'Hit "Launch." RallyOps generates brackets automatically based on registered players. Courts are assigned. The leaderboard goes live.' },
              { n: '04', title: 'Coaches score in real time', desc: 'Each coach gets a court view on their phone. As points are played, they tap to update the score. Brackets and standings update instantly for everyone.' },
              { n: '05', title: 'Players track themselves', desc: 'Players open the app to see their next match, their court, the live leaderboard, and their full match history. No announcements needed.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-6 bg-white border border-slate-100 rounded-2xl p-6">
                <span className="text-2xl font-black text-slate-200 shrink-0 w-10 text-right leading-none pt-0.5">{step.n}</span>
                <div>
                  <h3 className="font-extrabold text-slate-900 mb-1 tracking-tight">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">No extra apps. No spreadsheets. No chaos.</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Auto brackets', desc: 'Generated the moment you launch, based on who registered.' },
              { title: 'Live scoring', desc: 'Coaches update points court-side. Scores sync everywhere.' },
              { title: 'Leaderboard', desc: 'Rankings update in real time as matches complete.' },
              { title: 'Player profiles', desc: 'Every player has a profile with their history and results.' },
              { title: 'Admin dashboard', desc: 'Org head sees and controls everything from one screen.' },
              { title: 'Coach view', desc: 'Distraction-free scoring UI, built for the sideline.' },
              { title: 'Court management', desc: 'Track which matches are on which court, live.' },
              { title: 'Notifications', desc: 'Players get notified when their match is up.' },
            ].map((f) => (
              <div key={f.title} className="border border-slate-100 rounded-xl p-5 hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                <div className="w-2 h-2 rounded-full bg-orange-500 mb-3" />
                <h4 className="font-bold text-slate-900 text-sm mb-1">{f.title}</h4>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="px-6 py-24 text-center"
        style={{
          backgroundColor: '#EEF2FF',
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Ready to run your next tournament?
          </h2>
          <p className="text-slate-500 text-lg mb-8">Free to set up. No card required. Works on any device.</p>
          <button
            onClick={handleNewTournament}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-10 py-4 rounded-xl text-base transition-colors shadow-lg shadow-orange-200"
          >
            Set up your tournament now
          </button>

          {isSetup && (
            <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 text-left shadow-sm">
              <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mb-4">Active Tournament</p>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center font-black text-orange-600 text-xl shrink-0">R</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-extrabold text-slate-900 truncate tracking-tight">{tournamentName}</h3>
                  <p className="text-slate-500 text-sm">{organizerName}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-400">
                    {venue && <span>{venue}</span>}
                    {eventDate && <span>{new Date(eventDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
                {managerPassword && <div className="text-slate-400"><IconLock className="w-4 h-4" /></div>}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Players',   value: participants.length,  color: 'text-slate-800' },
                  { label: liveMatches > 0 ? 'Live' : 'Matches', value: liveMatches > 0 ? liveMatches : matches.length, color: liveMatches > 0 ? 'text-orange-500' : 'text-slate-800' },
                  { label: 'Done',      value: completedMatches,     color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={openDashboard} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  {managerPassword && <IconLock className="w-4 h-4" />}
                  Open Dashboard
                </button>
                <button
                  onClick={() => { const url = `${window.location.origin}/tournament`; navigator.clipboard.writeText(url).then(() => alert('Player link copied!')).catch(() => {}); }}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-medium py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <IconLink className="w-4 h-4" />
                  Copy Link
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-5 border-t border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-orange-600 rounded-md flex items-center justify-center text-[10px] font-black text-white">R</div>
              <span className="text-slate-600 font-bold">RallyOps</span>
            </div>
            <span>·</span>
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Support</a>
          </div>
          <a href="https://purvahk.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">
            Built by <span className="text-slate-500 font-medium">Purva</span>
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
