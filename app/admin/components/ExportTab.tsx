'use client';

import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS } from '../../tournament/types';

export default function ExportTab() {
  const { participants, matches, courts } = useTournamentStore();

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
      'Registered At': new Date(p.registeredAt).toLocaleString(),
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
      'Completed At': m.completedAt ? new Date(m.completedAt).toLocaleString() : '',
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

    // Participants
    const p = participants.map((p) => ({
      'Registration ID': p.registrationId,
      'Full Name': p.fullName,
      'Mobile': p.mobile,
      'Email': p.email,
      'Gender': p.gender,
      'Categories': p.categories.map((c) => CATEGORY_LABELS[c]).join(', '),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(p), 'Participants');

    // Matches
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
    {
      label: 'Participants Sheet',
      desc: 'Name, Phone, Email, Categories for all registered participants',
      icon: '👥',
      color: 'border-blue-200 hover:bg-blue-50',
      fn: exportParticipants,
    },
    {
      label: 'Matches Sheet',
      desc: 'Match details, players, scores, winners, courts',
      icon: '🏸',
      color: 'border-orange-200 hover:bg-orange-50',
      fn: exportMatches,
    },
    {
      label: 'Leaderboard Sheet',
      desc: 'Category rankings, winners by round',
      icon: '🏆',
      color: 'border-yellow-200 hover:bg-yellow-50',
      fn: exportLeaderboard,
    },
    {
      label: 'Court Activity Sheet',
      desc: 'Court assignments, match history by court',
      icon: '🏟️',
      color: 'border-purple-200 hover:bg-purple-50',
      fn: exportCourtActivity,
    },
    {
      label: 'Full Tournament Report',
      desc: 'All sheets combined in one Excel file',
      icon: '📦',
      color: 'border-gray-300 hover:bg-gray-50',
      fn: exportAll,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Export Reports</h2>
        <p className="text-gray-500 text-sm">Download tournament data as Excel (.xlsx) files</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map((exp) => (
          <button
            key={exp.label}
            onClick={exp.fn}
            className={`text-left bg-white rounded-xl border-2 p-5 transition-colors ${exp.color}`}
          >
            <span className="text-3xl">{exp.icon}</span>
            <h3 className="font-bold text-gray-800 mt-3 mb-1">{exp.label}</h3>
            <p className="text-sm text-gray-500">{exp.desc}</p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gray-700">
              <span>⬇️</span> Download .xlsx
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Note:</strong> Exports include all data currently in the system. Make sure all matches are completed before generating final reports.
      </div>
    </div>
  );
}
