'use client';

import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS } from '../../tournament/types';
import { formatDateTime } from '@/lib/format';

export default function ExportTab() {
  const { participants, matches, courts, tournamentId } = useTournamentStore();

  const exportParticipants = async () => {
    const XLSX = await import('xlsx');
    const data = participants.map((p) => ({
      'Registration ID': p.registrationId,
      'Full Name': p.fullName,
      'Mobile': p.mobile,
      'Email': p.email,
      'Gender': p.gender,
      'Date of Birth': p.dob,
      'Emergency Contact': p.emergencyContact,
      'Categories': p.categories.map((c) => CATEGORY_LABELS[c]).join(', '),
      'Partner Name': p.partnerName || '',
      'Registered At': formatDateTime(p.registeredAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, 'participants.xlsx');
  };

  const exportMatches = async () => {
    const XLSX = await import('xlsx');
    const data = matches.map((m) => ({
      'Match ID': m.id,
      'Category': CATEGORY_LABELS[m.category],
      'Round': m.roundName,
      'Player 1': m.player1Name,
      'Player 2': m.player2Name,
      'Court': courts.find((c) => c.id === m.courtId)?.name || '',
      'Referee': m.refereeName || '',
      'Status': m.status,
      'Scores': m.sets.map((s) => `${s.player1Score}-${s.player2Score}`).join(', '),
      'Winner': m.winnerName || '',
      'Completed At': m.completedAt ? formatDateTime(m.completedAt) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matches');
    XLSX.writeFile(wb, 'matches.xlsx');
  };

  const exportLeaderboard = async () => {
    const XLSX = await import('xlsx');
    const categories = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];
    const data: any[] = [];
    for (const cat of categories) {
      const catMatches = matches.filter((m) => m.category === cat);
      const winners = catMatches.filter((m) => m.status === 'completed').map((m) => ({
        category: CATEGORY_LABELS[cat],
        round: m.roundName,
        winner: m.winnerName,
        score: m.sets.map((s) => `${s.player1Score}-${s.player2Score}`).join(', '),
      }));
      data.push(...winners);
    }
    const ws = XLSX.utils.json_to_sheet(data.map((d) => ({
      'Category': d.category,
      'Round': d.round,
      'Winner': d.winner,
      'Score': d.score,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leaderboard');
    XLSX.writeFile(wb, 'leaderboard.xlsx');
  };

  const exportCourtActivity = async () => {
    const XLSX = await import('xlsx');
    const data = matches.filter((m) => m.courtId).map((m) => ({
      'Court': courts.find((c) => c.id === m.courtId)?.name || '',
      'Category': CATEGORY_LABELS[m.category],
      'Round': m.roundName,
      'Player 1': m.player1Name,
      'Player 2': m.player2Name,
      'Status': m.status,
      'Result': m.winnerName ? `${m.winnerName} won` : '',
      'Referee': m.refereeName || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Court Activity');
    XLSX.writeFile(wb, 'court_activity.xlsx');
  };

  const exportAll = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const p = participants.map((p) => ({
      'Registration ID': p.registrationId,
      'Full Name': p.fullName,
      'Mobile': p.mobile,
      'Email': p.email,
      'Gender': p.gender,
      'Categories': p.categories.map((c) => CATEGORY_LABELS[c]).join(', '),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(p), 'Participants');

    const m = matches.map((m) => ({
      'Category': CATEGORY_LABELS[m.category],
      'Round': m.roundName,
      'Player 1': m.player1Name,
      'Player 2': m.player2Name,
      'Score': m.sets.map((s) => `${s.player1Score}-${s.player2Score}`).join(', '),
      'Winner': m.winnerName || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(m.length ? m : [{}]), 'Matches');

    XLSX.writeFile(wb, 'tournament_report.xlsx');
  };

  const exports = [
    { label: 'Participants', desc: 'Name, phone, email, categories for all registrants', fn: exportParticipants },
    { label: 'Matches', desc: 'Match details, players, scores, courts, winners', fn: exportMatches },
    { label: 'Leaderboard', desc: 'Category rankings and winners by round', fn: exportLeaderboard },
    { label: 'Court Activity', desc: 'Court assignments and match history per court', fn: exportCourtActivity },
    { label: 'Full Report', desc: 'All sheets combined in one Excel file', fn: exportAll, primary: true },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-stone-900">Export Reports</h2>
        <p className="text-stone-400 text-sm">Download tournament data as Excel (.xlsx) files</p>
      </div>

      {tournamentId && (
        <div className="bg-white rounded-xl border border-orange-200 p-5 mb-6">
          <h3 className="text-sm font-bold text-stone-900">Live database export (CSV, opens in Excel)</h3>
          <p className="text-xs text-stone-400 mt-1 mb-4">
            Pulled straight from the database, so it always has every registration, including withdrawn and rejected ones.
            Dates are day/month/year.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { type: 'registrations', label: 'All registrations', desc: 'Every person, member, family link, category, fee and payment' },
              { type: 'matches', label: 'Fixtures & results', desc: 'Who plays whom, courts, scores and winners' },
              { type: 'audit', label: 'Change history', desc: 'Every add, edit and delete, with before and after' },
              { type: 'emails', label: 'Email log', desc: 'Every email sent to players, and any that failed' },
            ].map((e) => (
              <a
                key={e.type}
                href={`/api/tournament/export?tournamentId=${tournamentId}&type=${e.type}`}
                className="block text-left p-4 rounded-xl border border-stone-200 hover:border-orange-300 bg-stone-50 transition-colors"
              >
                <p className="text-sm font-semibold text-stone-900">{e.label} (.csv)</p>
                <p className="text-xs text-stone-400 mt-1">{e.desc}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {exports.map((exp) => (
          <button
            key={exp.label}
            onClick={exp.fn}
            className={`text-left bg-white rounded-xl border p-5 hover:shadow-sm transition-all group ${
              exp.primary ? 'border-orange-200 hover:border-orange-300' : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <h3 className={`font-bold mb-1 ${exp.primary ? 'text-orange-600' : 'text-stone-900'}`}>{exp.label}</h3>
            <p className="text-sm text-stone-400 mb-4 leading-relaxed">{exp.desc}</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 group-hover:text-stone-700 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a1 1 0 011 1v6.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L7 8.586V2a1 1 0 011-1z"/><path d="M2 12a1 1 0 011 1v1h10v-1a1 1 0 112 0v1a2 2 0 01-2 2H3a2 2 0 01-2-2v-1a1 1 0 011-1z"/></svg>
              Download .xlsx
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
        Export includes all current data. Complete all matches before generating final reports.
      </div>
    </div>
  );
}
