'use client';

import { use, useState, useEffect } from 'react';
import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS } from '../../tournament/types';
import type { Set, Category } from '../../tournament/types';

function isSetWon(s: Set) {
  const a = s.player1Score;
  const b = s.player2Score;
  const maxScore = Math.max(a, b);
  if (maxScore < 21) return null;
  if (Math.abs(a - b) >= 2) return a > b ? 'player1' : 'player2';
  if (maxScore >= 30) return a > b ? 'player1' : 'player2';
  return null;
}

function setsWon(sets: Set[]) {
  let p1 = 0, p2 = 0;
  for (const s of sets) {
    const w = isSetWon(s);
    if (w === 'player1') p1++;
    if (w === 'player2') p2++;
  }
  return { p1, p2 };
}

export default function CoachPage({ params }: { params: Promise<{ courtId: string }> }) {
  const { courtId } = use(params);
  const { courts, matches, users, startMatch, updateScore, completeMatch, assignCourt } = useTournamentStore();

  const court = courts.find((c) => c.id === courtId);
  const coach = users.find((u) => u.courtId === courtId && u.role === 'coach');

  const courtMatches = matches.filter((m) => m.courtId === courtId);
  const liveMatch = courtMatches.find((m) => m.status === 'in_progress');
  const nextMatch = courtMatches.find((m) => m.status === 'upcoming');
  const completedMatches = courtMatches.filter((m) => m.status === 'completed');

  const allUpcoming = matches.filter((m) => m.status === 'upcoming');

  const [sets, setSets] = useState<Set[]>([{ player1Score: 0, player2Score: 0 }]);
  const [flash, setFlash] = useState<'player1' | 'player2' | null>(null);
  const [prev, setPrev] = useState<Set[] | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (liveMatch) {
      setSets(liveMatch.sets.length ? liveMatch.sets : [{ player1Score: 0, player2Score: 0 }]);
    }
  }, [liveMatch?.id]);

  if (!court) {
    return (
      <div className="min-h-screen bg-[#111827] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <p className="text-2xl font-bold">Court not found</p>
          <a href="/admin" className="mt-6 inline-block text-orange-400 underline text-lg">← Back to Admin</a>
        </div>
      </div>
    );
  }

  const handleScore = (player: 'player1' | 'player2') => {
    if (!liveMatch || winner) return;

    setPrev(JSON.parse(JSON.stringify(sets)));
    setShowUndo(true);

    const currentSetIdx = sets.length - 1;
    const field = player === 'player1' ? 'player1Score' : 'player2Score';
    const newSets = sets.map((s, i) =>
      i === currentSetIdx ? { ...s, [field]: s[field] + 1 } : s
    );

    setFlash(player);
    setTimeout(() => setFlash(null), 400);

    const setResult = isSetWon(newSets[currentSetIdx]);
    if (setResult) {
      const { p1, p2 } = setsWon(newSets);
      const winnerName = p1 >= 2 ? liveMatch.player1Name : p2 >= 2 ? liveMatch.player2Name : null;
      if (winnerName) {
        updateScore(liveMatch.id, newSets);
        setSets(newSets);
        setWinner(winnerName);
        setTimeout(() => { completeMatch(liveMatch.id); setWinner(null); setSets([{ player1Score: 0, player2Score: 0 }]); }, 3000);
      } else {
        const withNew = [...newSets, { player1Score: 0, player2Score: 0 }];
        setSets(withNew);
        updateScore(liveMatch.id, withNew);
      }
    } else {
      setSets(newSets);
      updateScore(liveMatch.id, newSets);
    }
  };

  const handleUndo = () => {
    if (!prev || !liveMatch) return;
    setSets(prev);
    updateScore(liveMatch.id, prev);
    setPrev(null);
    setShowUndo(false);
  };

  const handleStart = (matchId: string) => {
    startMatch(matchId);
    setSets([{ player1Score: 0, player2Score: 0 }]);
    setWinner(null);
    setShowPicker(false);
  };

  const handlePickMatch = (matchId: string) => {
    assignCourt(matchId, courtId, coach?.id || '', coach?.name || court.name);
    setShowPicker(false);
  };

  const currentSetIdx = sets.length - 1;
  const currentSet = sets[currentSetIdx];
  const { p1: p1SetsWon, p2: p2SetsWon } = setsWon(sets);

  if (showPicker) {
    const otherMatches = allUpcoming.filter((m) => m.courtId !== courtId);
    const thisCourtQueued = allUpcoming.filter((m) => m.courtId === courtId);

    return (
      <main className="min-h-screen bg-[#111827] text-white flex flex-col">
        <div className="bg-[#1F2937] px-5 py-4 flex items-center gap-4 border-b border-[#374151]">
          <button onClick={() => setShowPicker(false)} className="text-stone-400 text-2xl leading-none">←</button>
          <div>
            <p className="text-stone-400 text-xs uppercase tracking-widest">Select a Match</p>
            <p className="text-white text-xl font-bold">{court.name}</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-5 space-y-5 max-w-lg mx-auto w-full overflow-y-auto pb-10">
          {thisCourtQueued.length > 0 && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider font-semibold mb-3">Queued for this court</p>
              <div className="space-y-2">
                {thisCourtQueued.map((m) => (
                  <MatchPickCard key={m.id} match={m} onPick={() => handleStart(m.id)} label="Start" highlight />
                ))}
              </div>
            </div>
          )}

          {otherMatches.length > 0 && (
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-wider font-semibold mb-3">Pull from another court</p>
              <div className="space-y-2">
                {otherMatches.map((m) => (
                  <MatchPickCard key={m.id} match={m} onPick={() => handlePickMatch(m.id)} label="Pull here" />
                ))}
              </div>
            </div>
          )}

          {(() => {
            const unassigned = allUpcoming.filter((m) => !m.courtId);
            if (!unassigned.length) return null;
            return (
              <div>
                <p className="text-stone-400 text-xs uppercase tracking-wider font-semibold mb-3">Unassigned matches</p>
                <div className="space-y-2">
                  {unassigned.map((m) => (
                    <MatchPickCard key={m.id} match={m} onPick={() => handlePickMatch(m.id)} label="Assign here" />
                  ))}
                </div>
              </div>
            );
          })()}

          {allUpcoming.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <p className="text-stone-400 text-lg font-semibold">No upcoming matches left</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (winner) {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center text-white text-center px-6">
        <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <p className="text-3xl font-bold mb-2">Match Complete!</p>
        <p className="text-5xl font-black mt-4">{winner}</p>
        <p className="text-xl mt-4 text-stone-400">Wins the match!</p>
        <p className="text-sm text-stone-500 mt-8">Moving to next match…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#111827] text-white flex flex-col">
      <div className="bg-[#1F2937] px-5 py-4 flex items-center justify-between border-b border-[#374151]">
        <div>
          <p className="text-stone-400 text-xs uppercase tracking-widest font-semibold">{coach?.name || 'Coach'}</p>
          <p className="text-white text-xl font-bold">{court.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPicker(true)}
            className="bg-[#374151] hover:bg-[#4B5563] text-white text-sm px-4 py-2 rounded-xl font-semibold transition-colors"
          >
            Change Match
          </button>
          <a href="/admin" className="text-stone-400 text-sm border border-[#374151] px-3 py-2 rounded-xl hover:border-[#4B5563] transition-colors">
            Admin ↗
          </a>
        </div>
      </div>

      {liveMatch ? (
        <div className="flex flex-col flex-1 px-4 py-5 gap-4 max-w-lg mx-auto w-full">
          <div className="text-center">
            <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              ● LIVE · {CATEGORY_LABELS[liveMatch.category]} · {liveMatch.roundName}
            </span>
          </div>

          <div className="flex items-center justify-between px-2">
            <SetDots count={p1SetsWon} />
            <p className="text-stone-500 text-xs">Sets won</p>
            <SetDots count={p2SetsWon} align="right" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ScorePanel name={liveMatch.player1Name} score={currentSet.player1Score} flashing={flash === 'player1'} onTap={() => handleScore('player1')} setsWon={p1SetsWon} />
            <ScorePanel name={liveMatch.player2Name} score={currentSet.player2Score} flashing={flash === 'player2'} onTap={() => handleScore('player2')} setsWon={p2SetsWon} />
          </div>

          <p className="text-center text-stone-500 text-sm font-medium">
            Set {currentSetIdx + 1}
            {sets.slice(0, -1).length > 0 && (
              <span className="text-stone-600 ml-2">({sets.slice(0, -1).map((s) => `${s.player1Score}–${s.player2Score}`).join(', ')})</span>
            )}
          </p>

          {showUndo && (
            <button onClick={handleUndo} className="w-full py-3 bg-[#1F2937] hover:bg-[#374151] rounded-2xl text-stone-300 font-semibold text-base transition-colors">
              ↩ Undo Last Point
            </button>
          )}

          {nextMatch && (
            <div className="mt-2 bg-[#1F2937] rounded-2xl p-4 border border-[#374151]">
              <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">Up Next</p>
              <p className="text-white font-semibold">{nextMatch.player1Name} <span className="text-stone-500">vs</span> {nextMatch.player2Name}</p>
              <p className="text-stone-500 text-xs mt-0.5">{CATEGORY_LABELS[nextMatch.category]} · {nextMatch.roundName}</p>
            </div>
          )}
        </div>
      ) : nextMatch ? (
        <div className="flex flex-col flex-1 items-center justify-center px-6 gap-6">
          <p className="text-stone-400 text-sm uppercase tracking-widest font-semibold">Next Match</p>
          <div className="bg-[#1F2937] rounded-3xl p-8 w-full max-w-sm text-center border border-[#374151]">
            <p className="text-stone-500 text-xs mb-4">{CATEGORY_LABELS[nextMatch.category]} · {nextMatch.roundName}</p>
            <p className="text-white text-3xl font-black mb-2">{nextMatch.player1Name}</p>
            <p className="text-stone-500 text-xl font-bold my-2">VS</p>
            <p className="text-white text-3xl font-black">{nextMatch.player2Name}</p>
          </div>
          <button onClick={() => handleStart(nextMatch.id)}
            className="w-full max-w-sm py-6 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 rounded-3xl text-white text-3xl font-black shadow-lg transition-colors">
            START MATCH
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 items-center justify-center px-6 gap-6 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <p className="text-2xl font-bold text-white">No match queued</p>
          <p className="text-stone-400">Tap below to pick a match for this court</p>
          <button onClick={() => setShowPicker(true)}
            className="w-full max-w-sm py-5 bg-orange-600 hover:bg-orange-500 rounded-3xl text-white text-xl font-black transition-colors">
            Pick a Match
          </button>
        </div>
      )}

      {completedMatches.length > 0 && (
        <div className="px-4 pb-6 max-w-lg mx-auto w-full">
          <p className="text-stone-600 text-xs uppercase tracking-wider mb-2 font-semibold">Completed ({completedMatches.length})</p>
          <div className="space-y-2">
            {completedMatches.map((m) => (
              <div key={m.id} className="bg-[#1F2937] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#374151]">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.player1Name} vs {m.player2Name}</p>
                  <p className="text-stone-500 text-xs">Winner: <span className="text-stone-300 font-semibold">{m.winnerName}</span></p>
                </div>
                <p className="text-stone-600 text-xs shrink-0">{m.sets.map((s) => `${s.player1Score}–${s.player2Score}`).join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function MatchPickCard({ match, onPick, label, highlight }: {
  match: any; onPick: () => void; label: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 flex items-center gap-4 border ${highlight ? 'bg-[#1F2937] border-orange-500/50' : 'bg-[#1F2937]/60 border-[#374151]'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-lg leading-tight">
          {match.player1Name} <span className="text-stone-500 font-normal text-base">vs</span> {match.player2Name}
        </p>
        <p className="text-stone-500 text-sm mt-0.5">
          {CATEGORY_LABELS[match.category as Category]} · {match.roundName}
          {match.courtId && match.courtId !== '' && (
            <span className="text-stone-600 ml-2">· on another court</span>
          )}
        </p>
      </div>
      <button
        onClick={onPick}
        className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
          highlight ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-[#374151] hover:bg-[#4B5563] text-white'
        }`}
      >
        {label}
      </button>
    </div>
  );
}

function ScorePanel({ name, score, flashing, onTap, setsWon }: {
  name: string; score: number; flashing: boolean; onTap: () => void; setsWon: number;
}) {
  return (
    <button
      onClick={onTap}
      className={`flex flex-col items-center justify-between rounded-3xl p-5 select-none active:scale-95 transition-all duration-100 min-h-64 ${
        flashing ? 'bg-orange-400 scale-105' : 'bg-[#1F2937] hover:bg-[#374151]'
      } border-2 ${flashing ? 'border-orange-300' : 'border-[#374151]'}`}
    >
      <p className="text-stone-300 text-sm font-semibold text-center leading-tight">{name}</p>
      <p className={`font-black tabular-nums leading-none transition-all ${score >= 20 ? 'text-8xl text-orange-300' : 'text-8xl text-white'}`}>
        {score}
      </p>
      <div className="flex gap-1">
        {[0, 1].map((i) => (
          <span key={i} className={`w-3 h-3 rounded-full ${i < setsWon ? 'bg-orange-400' : 'bg-transparent border border-[#374151]'}`} />
        ))}
      </div>
      <p className="text-stone-600 text-xs mt-1">TAP TO SCORE</p>
    </button>
  );
}

function SetDots({ count, align = 'left' }: { count: number; align?: 'left' | 'right' }) {
  return (
    <div className={`flex gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      {[0, 1].map((i) => (
        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors ${i < count ? 'bg-orange-400 border-orange-400' : 'bg-transparent border-[#374151]'}`} />
      ))}
    </div>
  );
}
