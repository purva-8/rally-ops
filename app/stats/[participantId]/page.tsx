'use client';

import { use, useRef, useState } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS } from '../../tournament/types';
import type { Match } from '../../tournament/types';

interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsConceded: number;
  categoriesPlayed: string[];
  highestRound: string;
  isChampion: boolean;
  championCategories: string[];
  winRate: number;
  longestRally: number; // highest single set score
  matchHistory: { opponent: string; result: 'W' | 'L'; score: string; category: string; round: string }[];
}

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];

function computeStats(participantId: string, matches: Match[]): PlayerStats {
  const played = matches.filter(
    (m) => m.status === 'completed' && (m.player1Id === participantId || m.player2Id === participantId)
  );

  let wins = 0, losses = 0, setsWon = 0, setsLost = 0, pointsScored = 0, pointsConceded = 0;
  let longestRally = 0;
  const categoriesSet = new Set<string>();
  const championCategories: string[] = [];
  let highestRoundIdx = -1;
  const matchHistory: PlayerStats['matchHistory'] = [];

  for (const m of played) {
    const isP1 = m.player1Id === participantId;
    const won = m.winnerId === participantId;
    won ? wins++ : losses++;
    categoriesSet.add(CATEGORY_LABELS[m.category]);

    const roundIdx = ROUND_ORDER.indexOf(m.roundName);
    if (roundIdx > highestRoundIdx) highestRoundIdx = roundIdx;

    if (m.roundName === 'Final' && won) championCategories.push(CATEGORY_LABELS[m.category]);

    for (const s of m.sets) {
      const myScore = isP1 ? s.player1Score : s.player2Score;
      const oppScore = isP1 ? s.player2Score : s.player1Score;
      if (myScore > oppScore) setsWon++; else setsLost++;
      pointsScored += myScore;
      pointsConceded += oppScore;
      longestRally = Math.max(longestRally, myScore, oppScore);
    }

    const opponent = isP1 ? m.player2Name : m.player1Name;
    const scoreStr = m.sets.map((s) => {
      const my = isP1 ? s.player1Score : s.player2Score;
      const opp = isP1 ? s.player2Score : s.player1Score;
      return `${my}-${opp}`;
    }).join(', ');

    matchHistory.push({ opponent, result: won ? 'W' : 'L', score: scoreStr, category: CATEGORY_LABELS[m.category], round: m.roundName });
  }

  return {
    matchesPlayed: played.length,
    wins,
    losses,
    setsWon,
    setsLost,
    pointsScored,
    pointsConceded,
    categoriesPlayed: Array.from(categoriesSet),
    highestRound: highestRoundIdx >= 0 ? ROUND_ORDER[highestRoundIdx] : 'Did not play',
    isChampion: championCategories.length > 0,
    championCategories,
    winRate: played.length > 0 ? Math.round((wins / played.length) * 100) : 0,
    longestRally,
    matchHistory,
  };
}

export default function StatsPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = use(params);
  const { participants, matches, tournamentName } = useTournamentStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const participant = participants.find((p) => p.id === participantId);
  const stats = participant ? computeStats(participantId, matches) : null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current!, { scale: 2, backgroundColor: null, useCORS: true });
      const link = document.createElement('a');
      link.download = `${participant?.fullName.replace(' ', '_')}_RallyOps_Stats.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!participant || !stats) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏸</div>
          <p className="text-gray-600">Player not found.</p>
          <a href="/admin" className="text-orange-600 underline mt-2 block">Back to Admin</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-8 px-4">
      {/* Action buttons — outside the card so they don't appear in the screenshot */}
      <div className="max-w-lg mx-auto mb-4 flex gap-3 justify-end">
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 bg-white border border-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
        >
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-60"
        >
          {downloading ? 'Saving...' : '⬇️ Save as Image'}
        </button>
      </div>

      {/* THE CARD */}
      <div ref={cardRef} className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="relative bg-gradient-to-br from-orange-600 to-orange-800 px-8 pt-8 pb-6 overflow-hidden">
            {/* decorative court lines */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white" />
              <div className="absolute top-4 left-4 right-4 bottom-4 border border-white rounded-full" />
            </div>

            <div className="relative">
              {stats.isChampion && (
                <div className="inline-flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full mb-3">
                  🏆 CHAMPION — {stats.championCategories.join(' & ')}
                </div>
              )}
              <h1 className="text-3xl font-black text-white tracking-tight">{participant.fullName}</h1>
              <p className="text-orange-200 text-sm mt-1">{tournamentName}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {stats.categoriesPlayed.map((cat) => (
                  <span key={cat} className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Big shuttlecock */}
            <div className="absolute right-6 top-6 text-6xl opacity-20 select-none">🏸</div>
          </div>

          {/* Main stats grid */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <StatBox label="Matches" value={stats.matchesPlayed} sub="played" />
            <StatBox label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.wins}W · ${stats.losses}L`} highlight />
            <StatBox label="Highest Round" value={stats.highestRound.split(' ').slice(-1)[0]} sub={stats.highestRound} small />
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <StatBox label="Sets Won" value={stats.setsWon} sub={`Lost ${stats.setsLost}`} />
            <StatBox label="Points For" value={stats.pointsScored} sub={`Agst ${stats.pointsConceded}`} />
            <StatBox label="Best Set" value={stats.longestRally} sub="points in a set" />
          </div>

          {/* Match history */}
          {stats.matchHistory.length > 0 && (
            <div className="px-6 py-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Match History</h3>
              <div className="space-y-2">
                {stats.matchHistory.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.result === 'W' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.result}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">vs {m.opponent}</p>
                      <p className="text-xs text-gray-400">{m.category} · {m.round}</p>
                    </div>
                    <span className="text-xs font-mono text-gray-500 flex-shrink-0">{m.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-orange-600 tracking-tight">RallyOps</p>
              <p className="text-xs text-gray-400">rallyops.app</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Badminton Tournament</p>
              <p className="text-xs text-gray-400">Management Platform</p>
            </div>
            <div className="text-2xl">🏸</div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto mt-6 text-center">
        <p className="text-xs text-gray-400">Share this card on WhatsApp, Instagram, or anywhere you like!</p>
        <a href="/admin" className="text-orange-600 text-sm underline mt-2 block">← Back to Admin</a>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, highlight, small }: {
  label: string; value: string | number; sub: string; highlight?: boolean; small?: boolean;
}) {
  return (
    <div className="py-5 px-4 text-center">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-black leading-none ${small ? 'text-lg' : 'text-3xl'} ${highlight ? 'text-orange-600' : 'text-gray-800'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
