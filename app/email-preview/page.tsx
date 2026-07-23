'use client';

import { useState } from 'react';

const SAMPLE = {
  winner: { name: 'Rahul Sharma', email: 'rahul@test.com' },
  loser: { name: 'Vikram Nair', email: 'vikram@test.com' },
  category: 'Male Singles',
  round: 'Semifinal',
  court: 'Court 1',
  sets: [
    { player1Score: 21, player2Score: 18 },
    { player1Score: 19, player2Score: 21 },
    { player1Score: 21, player2Score: 15 },
  ],
};

const TOURNAMENT_NAME = 'Samanvayam Qatar';
const VENUE = 'Sports Complex, Main Hall';
const TOURNAMENT_DATE = 'Wednesday, 15 July 2026';

function scoreDisplay(sets: typeof SAMPLE.sets) {
  return sets.map((s) => `${Math.max(s.player1Score, s.player2Score)}–${Math.min(s.player1Score, s.player2Score)}`).join(', ');
}

function WinnerEmail({ data }: { data: typeof SAMPLE }) {
  const scores = scoreDisplay(data.sets);
  return (
    <div style={{ background: '#fff7ed', padding: '32px 16px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#ffffff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div style={{ background: '#ea580c', padding: '32px 32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
          <h1 style={{ color: '#ffffff', margin: 0, fontSize: 28, fontWeight: 800 }}>You Won!</h1>
          <p style={{ color: '#fed7aa', margin: '8px 0 0', fontSize: 15 }}>{TOURNAMENT_NAME}</p>
        </div>

        {/* Body */}
        <div style={{ padding: 32 }}>
          <p style={{ color: '#431407', fontSize: 17, margin: '0 0 8px' }}>Congratulations, <strong>{data.winner.name}</strong>! 🎉</p>
          <p style={{ color: '#7c2d12', fontSize: 15, margin: '0 0 24px' }}>You advanced in <strong>{data.category}</strong> — {data.round}.</p>

          {/* Score card */}
          <div style={{ background: '#fff7ed', border: '2px solid #fed7aa', borderRadius: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #fed7aa' }}>
              <div style={{ flex: 1, padding: 16, textAlign: 'center', borderRight: '1px solid #fed7aa' }}>
                <p style={{ margin: 0, color: '#9a3412', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Winner</p>
                <p style={{ margin: '4px 0 0', color: '#ea580c', fontSize: 18, fontWeight: 700 }}>{data.winner.name}</p>
              </div>
              <div style={{ padding: '16px 20px', textAlign: 'center', borderRight: '1px solid #fed7aa' }}>
                <p style={{ margin: 0, color: '#9a3412', fontSize: 22, fontWeight: 800 }}>VS</p>
              </div>
              <div style={{ flex: 1, padding: 16, textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#9a3412', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Opponent</p>
                <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 18, fontWeight: 700 }}>{data.loser.name}</p>
              </div>
            </div>
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#9a3412', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Score</p>
              <p style={{ margin: '4px 0 0', color: '#431407', fontSize: 20, fontWeight: 700 }}>{scores}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, background: '#f5f5f4', borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: '#78716c', fontSize: 11, textTransform: 'uppercase' }}>Category</p>
              <p style={{ margin: '4px 0 0', color: '#292524', fontSize: 14, fontWeight: 600 }}>{data.category}</p>
            </div>
            <div style={{ flex: 1, background: '#f5f5f4', borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: '#78716c', fontSize: 11, textTransform: 'uppercase' }}>Court</p>
              <p style={{ margin: '4px 0 0', color: '#292524', fontSize: 14, fontWeight: 600 }}>{data.court}</p>
            </div>
          </div>

          <p style={{ color: '#7c2d12', fontSize: 14, margin: '0 0 4px' }}>Watch for your next match schedule on the live bracket.</p>
          <p style={{ color: '#a8a29e', fontSize: 13, margin: 0 }}>{VENUE} · {TOURNAMENT_DATE}</p>
        </div>

        {/* Footer */}
        <div style={{ background: '#fff7ed', padding: '20px 32px', textAlign: 'center', borderTop: '1px solid #fed7aa' }}>
          <p style={{ color: '#c2410c', fontSize: 13, margin: 0, fontWeight: 600 }}>{TOURNAMENT_NAME}</p>
          <p style={{ color: '#a8a29e', fontSize: 12, margin: '4px 0 0' }}>{VENUE}</p>
        </div>
      </div>
    </div>
  );
}

function LoserEmail({ data }: { data: typeof SAMPLE }) {
  const scores = scoreDisplay(data.sets);
  return (
    <div style={{ background: '#fafaf9', padding: '32px 16px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#ffffff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div style={{ background: '#292524', padding: '32px 32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏸</div>
          <h1 style={{ color: '#ffffff', margin: 0, fontSize: 28, fontWeight: 800 }}>Match Result</h1>
          <p style={{ color: '#a8a29e', margin: '8px 0 0', fontSize: 15 }}>{TOURNAMENT_NAME}</p>
        </div>

        {/* Body */}
        <div style={{ padding: 32 }}>
          <p style={{ color: '#292524', fontSize: 17, margin: '0 0 8px' }}>Hi <strong>{data.loser.name}</strong>,</p>
          <p style={{ color: '#57534e', fontSize: 15, margin: '0 0 24px' }}>Thank you for competing in <strong>{data.category}</strong> — {data.round}. It was a great game!</p>

          {/* Score card */}
          <div style={{ background: '#f5f5f4', border: '2px solid #e7e5e4', borderRadius: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #e7e5e4' }}>
              <div style={{ flex: 1, padding: 16, textAlign: 'center', borderRight: '1px solid #e7e5e4' }}>
                <p style={{ margin: 0, color: '#78716c', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Winner</p>
                <p style={{ margin: '4px 0 0', color: '#ea580c', fontSize: 18, fontWeight: 700 }}>{data.winner.name}</p>
              </div>
              <div style={{ padding: '16px 20px', textAlign: 'center', borderRight: '1px solid #e7e5e4' }}>
                <p style={{ margin: 0, color: '#78716c', fontSize: 22, fontWeight: 800 }}>VS</p>
              </div>
              <div style={{ flex: 1, padding: 16, textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#78716c', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>You</p>
                <p style={{ margin: '4px 0 0', color: '#292524', fontSize: 18, fontWeight: 700 }}>{data.loser.name}</p>
              </div>
            </div>
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#78716c', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Score</p>
              <p style={{ margin: '4px 0 0', color: '#292524', fontSize: 20, fontWeight: 700 }}>{scores}</p>
            </div>
          </div>

          {/* Motivational */}
          <div style={{ background: '#fff7ed', borderLeft: '4px solid #ea580c', borderRadius: '0 8px 8px 0', padding: 16, marginBottom: 24 }}>
            <p style={{ margin: 0, color: '#9a3412', fontSize: 14, fontWeight: 600 }}>Keep your head up! 💪</p>
            <p style={{ margin: '6px 0 0', color: '#c2410c', fontSize: 13 }}>Every match is a learning experience. You played well — see you on the court!</p>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, background: '#f5f5f4', borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: '#78716c', fontSize: 11, textTransform: 'uppercase' }}>Category</p>
              <p style={{ margin: '4px 0 0', color: '#292524', fontSize: 14, fontWeight: 600 }}>{data.category}</p>
            </div>
            <div style={{ flex: 1, background: '#f5f5f4', borderRadius: 8, padding: 12 }}>
              <p style={{ margin: 0, color: '#78716c', fontSize: 11, textTransform: 'uppercase' }}>Court</p>
              <p style={{ margin: '4px 0 0', color: '#292524', fontSize: 14, fontWeight: 600 }}>{data.court}</p>
            </div>
          </div>

          <p style={{ color: '#a8a29e', fontSize: 13, margin: 0 }}>{VENUE} · {TOURNAMENT_DATE}</p>
        </div>

        {/* Footer */}
        <div style={{ background: '#f5f5f4', padding: '20px 32px', textAlign: 'center', borderTop: '1px solid #e7e5e4' }}>
          <p style={{ color: '#57534e', fontSize: 13, margin: 0, fontWeight: 600 }}>{TOURNAMENT_NAME}</p>
          <p style={{ color: '#a8a29e', fontSize: 12, margin: '4px 0 0' }}>{VENUE}</p>
        </div>
      </div>
    </div>
  );
}

export default function EmailPreviewPage() {
  const [view, setView] = useState<'winner' | 'loser'>('winner');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <div className="bg-orange-800 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-orange-300 hover:text-white text-sm">← Admin</a>
          <span className="text-orange-600">|</span>
          <span className="font-semibold">Email Preview</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('winner')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              view === 'winner' ? 'bg-orange-500 text-white' : 'bg-orange-900 text-orange-300 hover:bg-orange-700'
            }`}
          >
            🏆 Winner Email
          </button>
          <button
            onClick={() => setView('loser')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              view === 'loser' ? 'bg-orange-500 text-white' : 'bg-orange-900 text-orange-300 hover:bg-orange-700'
            }`}
          >
            🏸 Loser Email
          </button>
        </div>
      </div>

      {/* Subject line preview */}
      <div className="max-w-2xl mx-auto mt-6 px-4">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4 text-sm">
          <span className="text-gray-400 font-medium mr-2">Subject:</span>
          <span className="text-gray-800 font-semibold">
            {view === 'winner'
              ? `🏆 You Won! — ${SAMPLE.category} ${SAMPLE.round}`
              : `Match Result — ${SAMPLE.category} ${SAMPLE.round}`}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-6 flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-400 mr-2">To:</span>
            <span className="text-gray-800 font-semibold">
              {view === 'winner' ? `${SAMPLE.winner.name} <${SAMPLE.winner.email}>` : `${SAMPLE.loser.name} <${SAMPLE.loser.email}>`}
            </span>
          </div>
          <div className="ml-auto text-gray-400 text-xs">Sent automatically on match completion</div>
        </div>
      </div>

      {/* Email render */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        {view === 'winner' ? <WinnerEmail data={SAMPLE} /> : <LoserEmail data={SAMPLE} />}
      </div>
    </div>
  );
}
