// Run with: node --test tests/
// Expected values are worked out by hand here, not computed with the code under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameWinner, impossibleGame, matchResult, totalRoundsFor, roundLabel, winnerSide, nextRoundFor, validSets, bracketOrder, type BracketMatch } from '../lib/bracket.ts';

test('round names come from the bracket size, not from rounds that exist so far', () => {
  // 8 entrants -> 4 first-round slots -> 3 rounds: QF, SF, F
  assert.equal(totalRoundsFor(4), 3);
  assert.equal(roundLabel(0, 3), 'Quarterfinal');
  assert.equal(roundLabel(1, 3), 'Semifinal');
  assert.equal(roundLabel(2, 3), 'Final');
  // 2 entrants -> 1 slot -> the only match is the final
  assert.equal(totalRoundsFor(1), 1);
  assert.equal(roundLabel(0, 1), 'Final');
  // 17 entrants -> 32 draw -> 16 slots -> 5 rounds, round 1 is "Round 1"
  assert.equal(totalRoundsFor(16), 5);
  assert.equal(roundLabel(0, 5), 'Round 1');
  assert.equal(roundLabel(1, 5), 'Round 2');
  assert.equal(roundLabel(2, 5), 'Quarterfinal');
});

test('winner is whoever won more sets; level sets have no winner', () => {
  assert.equal(winnerSide([{ player1Score: 21, player2Score: 15 }, { player1Score: 21, player2Score: 18 }]), 1);
  assert.equal(winnerSide([{ player1Score: 15, player2Score: 21 }, { player1Score: 21, player2Score: 19 }, { player1Score: 20, player2Score: 22 }]), 2);
  assert.equal(winnerSide([{ player1Score: 21, player2Score: 15 }, { player1Score: 10, player2Score: 21 }]), null);
  assert.equal(winnerSide([]), null);
  assert.equal(winnerSide([{ player1Score: 0, player2Score: 0 }]), null);
});

test('set validation rejects junk', () => {
  assert.equal(validSets([{ player1Score: 21, player2Score: 19 }]), true);
  assert.equal(validSets([]), true);
  assert.equal(validSets([{ player1Score: -1, player2Score: 21 }]), false);
  assert.equal(validSets([{ player1Score: '21', player2Score: 3 }]), false);
  assert.equal(validSets([{ player1Score: 2.5, player2Score: 3 }]), false);
  assert.equal(validSets('x'), false);
});

const done = (id: string, round: number, position: number, w: string): BracketMatch =>
  ({ id, round, position, status: 'completed', winner_id: w, winner_name: w.toUpperCase() });

test('next round pairs slot 0 with 1 and 2 with 3, in saved position order', () => {
  // stored out of order on purpose
  const ms = [done('m3', 0, 3, 'd'), done('m1', 0, 1, 'b'), done('m0', 0, 0, 'a'), done('m2', 0, 2, 'c')];
  assert.deepEqual(nextRoundFor(ms, 0), [
    { position: 0, player1Id: 'a', player1Name: 'A', player2Id: 'b', player2Name: 'B' },
    { position: 1, player1Id: 'c', player1Name: 'C', player2Id: 'd', player2Name: 'D' },
  ]);
});

test('no next round while a match is unfinished, after it exists, or after the final', () => {
  const ms = [done('m0', 0, 0, 'a'), { id: 'm1', round: 0, position: 1, status: 'in_progress' }];
  assert.equal(nextRoundFor(ms, 0), null);
  const made = [done('m0', 0, 0, 'a'), done('m1', 0, 1, 'b'), { id: 'f', round: 1, position: 0, status: 'upcoming' }];
  assert.equal(nextRoundFor(made, 0), null);
  assert.equal(nextRoundFor([done('f', 1, 0, 'a')], 1), null);
});

test('old rows without a position fall back to creation time then id', () => {
  const a = { id: 'b', round: 0, status: 'x', created_at: '2026-01-01T00:00:00Z' };
  const b = { id: 'a', round: 0, status: 'x', created_at: '2026-01-01T00:00:01Z' };
  const c = { id: 'c', round: 0, status: 'x', created_at: '2026-01-01T00:00:01Z' };
  assert.deepEqual([c, b, a].sort(bracketOrder).map((m) => m.id), ['b', 'a', 'c']);
});

// Full knockout simulation for every entrant count the event could plausibly have.
// The first round is laid out the way the store builds it: byes first, then pairs.
test('every draw from 2 to 40 entrants ends with exactly one champion and nobody lost or duplicated', () => {
  for (let n = 2; n <= 40; n++) {
    let size = 1;
    while (size < n) size *= 2; // hand rule: smallest power of two >= n
    const byes = size - n;
    const players = Array.from({ length: n }, (_, i) => `p${i}`);
    const ms: BracketMatch[] = [];
    let pos = 0;
    for (let i = 0; i < byes; i++) ms.push({ id: `r0-${pos}`, round: 0, position: pos++, status: 'completed', winner_id: players[i], winner_name: players[i] });
    const active = players.slice(byes);
    assert.equal(active.length % 2, 0, `n=${n}: odd number left after byes`);
    const entrants = new Map<string, string[]>();
    for (let i = 0; i < active.length; i += 2) {
      const id = `r0-${pos}`;
      entrants.set(id, [active[i], active[i + 1]]);
      ms.push({ id, round: 0, position: pos++, status: 'upcoming' });
    }
    assert.equal(ms.length, size / 2, `n=${n}: first round should have size/2 slots`);
    const rounds = totalRoundsFor(ms.length);
    assert.equal(2 ** rounds, size, `n=${n}: rounds`);

    // the lower-numbered player always wins, so the champion must be p0
    const appearances = new Map<string, number>();
    for (let r = 0; r < rounds; r++) {
      for (const m of ms.filter((x) => x.round === r && x.status !== 'completed')) {
        const [a, b] = entrants.get(m.id)!;
        for (const p of [a, b]) appearances.set(`${r}:${p}`, (appearances.get(`${r}:${p}`) ?? 0) + 1);
        m.status = 'completed';
        m.winner_id = Number(a.slice(1)) < Number(b.slice(1)) ? a : b;
        m.winner_name = m.winner_id;
      }
      const next = nextRoundFor(ms, r);
      if (r === rounds - 1) { assert.equal(next, null, `n=${n}: nothing after the final`); break; }
      assert.ok(next, `n=${n}: round ${r + 2} should be created`);
      assert.equal(next!.length, ms.filter((x) => x.round === r).length / 2);
      for (const p of next!) {
        const id = `r${r + 1}-${p.position}`;
        entrants.set(id, [p.player1Id, p.player2Id]);
        ms.push({ id, round: r + 1, position: p.position, status: 'upcoming' });
      }
    }
    const finals = ms.filter((m) => m.round === rounds - 1);
    assert.equal(finals.length, 1, `n=${n}: one final`);
    assert.equal(finals[0]!.winner_id, 'p0', `n=${n}: champion`);
    for (const [k, v] of appearances) assert.equal(v, 1, `n=${n}: ${k} plays twice in one round`);
    // every entrant either got a bye or played round 1
    const inRound0 = new Set([...players.slice(0, byes), ...active]);
    assert.equal(inRound0.size, n);
  }
});

test('games 1 and 2 end when a side reaches 21, game 3 at 15; no 2-point lead', () => {
  const g = (a: number, b: number, i = 0) => gameWinner({ player1Score: a, player2Score: b }, i);
  assert.equal(g(21, 19), 1);
  assert.equal(g(21, 0), 1);
  assert.equal(g(19, 21, 1), 2);
  assert.equal(g(21, 20), 1);
  assert.equal(g(20, 18), null);
  assert.equal(g(0, 0), null);
  assert.equal(g(15, 14, 2), 1);
  assert.equal(g(9, 15, 2), 2);
  assert.equal(g(14, 13, 2), null);
  assert.equal(g(15, 10, 0), null, 'game 1 goes on past 15');
});

test('impossible game scores are recognised', () => {
  const i = (a: number, b: number, g = 0) => impossibleGame({ player1Score: a, player2Score: b }, g);
  assert.equal(i(25, 3), true);
  assert.equal(i(22, 20), true);
  assert.equal(i(21, 21), true);
  assert.equal(i(21, 20), false);
  assert.equal(i(15, 12), false); // still in play
  assert.equal(i(16, 10, 2), true);
  assert.equal(i(21, 3, 2), true);
  assert.equal(i(15, 14, 2), false);
});

test('best of three: needs two finished games and nothing after', () => {
  const s = (...p: number[][]) => p.map(([a, b]) => ({ player1Score: a, player2Score: b }));
  assert.deepEqual(matchResult(s([21, 15], [21, 18])), { winner: 1 });
  assert.deepEqual(matchResult(s([15, 21], [21, 20], [13, 15])), { winner: 2 });
  assert.ok('problem' in matchResult(s([21, 19])));
  assert.ok('problem' in matchResult(s([21, 15], [10, 21])));
  assert.ok('problem' in matchResult(s([21, 15], [21, 18], [15, 0])), 'no game 3 after 2-0');
  assert.ok('problem' in matchResult(s([21, 15], [18, 21], [21, 10])), 'game 3 is to 15');
  assert.ok('problem' in matchResult(s([21, 15], [20, 18])));
  assert.ok('problem' in matchResult(s([25, 3], [21, 0])));
});
