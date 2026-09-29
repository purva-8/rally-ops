'use client';

import { useTournamentStore } from '../store';
import { formatDate } from '@/lib/format';

const eligibility = [
  {
    label: 'Male Singles',
    icon: '🏸',
    color: 'bg-blue-50 border-blue-200',
    rules: ['Open to all male participants', 'Any age group', 'Individual entry'],
  },
  {
    label: 'Female Singles',
    icon: '🏸',
    color: 'bg-pink-50 border-pink-200',
    rules: ['Open to all female participants', 'Any age group', 'Individual entry'],
  },
  {
    label: 'Male Doubles',
    icon: '👬',
    color: 'bg-indigo-50 border-indigo-200',
    rules: ['Two male players per team', 'Both must register', 'Partner must be specified'],
  },
  {
    label: 'Female Doubles',
    icon: '👭',
    color: 'bg-purple-50 border-purple-200',
    rules: ['Two female players per team', 'Both must register', 'Partner must be specified'],
  },
  {
    label: 'Spouse Doubles',
    icon: '💑',
    color: 'bg-rose-50 border-rose-200',
    rules: ['Mixed gender team (husband & wife)', 'Must be married couple', 'Both must register'],
  },
];

export default function TournamentInfo() {
  const { tournamentName, eventDate, venue, registrationDeadline } = useTournamentStore();

  const fmtDate = (d: string) =>
    d ? formatDate(d) : 'TBD';

  return (
    <div className="space-y-6">
      {/* Tournament Card */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-orange-100">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">🏆</span>
          <div>
            <h2 className="text-2xl font-bold text-orange-800">{tournamentName}</h2>
            <p className="text-orange-600 text-sm">Official Tournament Registration</p>
          </div>
        </div>
        <div className="space-y-3">
          <InfoRow icon="📅" label="Event Date" value={fmtDate(eventDate)} />
          <InfoRow icon="📍" label="Venue" value={venue} />
          <InfoRow icon="⏰" label="Registration Deadline" value={fmtDate(registrationDeadline)} />
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-orange-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🏅</span> Tournament Categories
        </h3>
        <div className="space-y-3">
          {eligibility.map((cat) => (
            <div key={cat.label} className={`rounded-xl border p-4 ${cat.color}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{cat.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800">{cat.label}</p>
                  <ul className="mt-1 space-y-0.5">
                    {cat.rules.map((r) => (
                      <li key={r} className="text-sm text-gray-600 flex items-center gap-1.5">
                        <span className="text-orange-500 text-xs">✓</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex gap-3">
          <span className="text-xl">ℹ️</span>
          <p className="text-sm text-amber-800">
            <strong>Multi-category Notice:</strong> Participants may register for multiple categories as long as they meet the eligibility requirements for each category.
          </p>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-orange-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>📋</span> Rules & Regulations
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            'Matches are played in best-of-3 sets format.',
            'Each set is played to 21 points.',
            'Players must check in at their assigned court 10 minutes before the match.',
            'Players not present within 5 minutes of scheduled time forfeit the match.',
            'Coaching is permitted only between sets.',
            'Tournament committee decisions are final.',
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-orange-600 font-bold mt-0.5">{i + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
