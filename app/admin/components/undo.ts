import type { Match } from '../../tournament/types';

// Asks, then puts a match back to "to be played". Returns a message for the screen, or null if cancelled.
export async function undoResult(match: Match): Promise<{ ok: boolean; message: string } | null> {
  const what = match.status === 'completed' ? `the result (${match.winnerName} won)` : 'the score so far';
  if (!confirm(`Undo ${what} for ${match.player1Name} vs ${match.player2Name}?\n\nThe match goes back to "to be played" with no score. If the next round was drawn from it and hasn't started, that round is removed and drawn again once this match has a result.`)) return null;
  try {
    const res = await fetch('/api/tournament/matches/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.error ?? `Not undone (${res.status})` };
    const removed = (data.removedIds ?? []).length;
    return { ok: true, message: `Undone: ${match.player1Name} vs ${match.player2Name} is back to be played.${removed ? ` ${removed} later-round match${removed === 1 ? '' : 'es'} removed until it's played.` : ''}` };
  } catch {
    return { ok: false, message: 'No connection. Nothing was undone.' };
  }
}
