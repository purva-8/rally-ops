import { createAdminClient } from '@/lib/supabase/admin';
import { categoryFee, isDoublesCategory } from '@/lib/categories';
import { sendMails, type Mail } from '@/lib/email';
import {
  decisionEmail, fixtureEmail, resultEmail,
  type Decision, type Fixture, type Result,
} from '@/lib/emailTemplates';

// Finds everything that changed since the last run and sends one email per person per topic.
// A row is only marked as notified after its email was accepted, so a failure is retried next run.

type Admin = ReturnType<typeof createAdminClient>;
type Recipient = { email: string; name: string };
type Summary = { decisions: number; fixtures: number; results: number; failed: number; skipped: number };

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function inChunks<T>(ids: string[], run: (part: string[]) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (const part of chunk(ids, 100)) out.push(...((await run(part)).data ?? []));
  return out;
}

// person (player profile id) -> the account holder who gets the email
export async function resolveRecipients(admin: Admin, personIds: string[]) {
  const unique = Array.from(new Set(personIds.filter(Boolean)));
  const people = await inChunks<any>(unique, (p) => admin.from('player_profiles').select('id, full_name, parent_id, auth_user_id').in('id', p));
  const parentIds = Array.from(new Set(people.map((p) => p.parent_id).filter(Boolean)));
  const parents = await inChunks<any>(parentIds, (p) => admin.from('player_profiles').select('id, full_name, parent_id, auth_user_id').in('id', p));
  const profileById = new Map<string, any>([...people, ...parents].map((p) => [p.id, p]));

  const authIds = Array.from(new Set([...profileById.values()].filter((p) => !p.parent_id && p.auth_user_id).map((p) => p.auth_user_id as string)));
  const emailByAuth = new Map<string, string>();
  for (const part of chunk(authIds, 20)) {
    await Promise.all(part.map(async (uid) => {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data?.user?.email) emailByAuth.set(uid, data.user.email);
    }));
  }

  const nameOf = (id: string) => profileById.get(id)?.full_name ?? '';
  const recipientOf = new Map<string, Recipient | null>();
  for (const id of unique) {
    const p = profileById.get(id);
    const account = p?.parent_id ? profileById.get(p.parent_id) : p;
    const email = account?.auth_user_id ? emailByAuth.get(account.auth_user_id) : undefined;
    recipientOf.set(id, email ? { email, name: account.full_name } : null);
  }
  return { recipientOf, nameOf };
}

function scoreString(sets: { player1_score: number; player2_score: number }[], flip: boolean) {
  return sets.map((s) => (flip ? `${s.player2_score}-${s.player1_score}` : `${s.player1_score}-${s.player2_score}`)).join(', ');
}

export async function runNotifications(opts: { tournamentId?: string; registrationIds?: string[] } = {}): Promise<Summary> {
  const admin = createAdminClient();
  const summary: Summary = { decisions: 0, fixtures: 0, results: 0, failed: 0, skipped: 0 };

  let tq = admin.from('tournaments').select('id, name, entry_fee');
  if (opts.tournamentId) tq = tq.eq('id', opts.tournamentId);
  const { data: tournaments } = await tq;

  for (const t of tournaments ?? []) {
    // With specific entries, only their decision email goes out (resent even if sent before)
    await sendDecisions(admin, t, summary, opts.registrationIds);
    if (opts.registrationIds) continue;
    await sendFixtures(admin, t, summary);
    await sendResults(admin, t, summary);
  }
  return summary;
}

async function sendDecisions(admin: Admin, t: { id: string; name: string; entry_fee: number }, summary: Summary, only?: string[]) {
  let rq = admin
    .from('registrations')
    .select('id, player_id, partner_id, category, partner_name, status, review_comment, manual_name, manual_email')
    .eq('tournament_id', t.id)
    .in('status', ['approved', 'rejected']);
  rq = only ? rq.in('id', only) : rq.is('decision_notified_at', null);
  const { data: regs } = await rq;
  if (!regs?.length) return;

  const { recipientOf, nameOf } = await resolveRecipients(admin, regs.flatMap((r) => [r.player_id, r.partner_id]).filter(Boolean));

  type Group = { to: Recipient; items: Decision[]; ids: string[] };
  const groups = new Map<string, Group>();
  const unreachable: string[] = [];
  for (const r of regs) {
    const to: Recipient | null = r.player_id
      ? recipientOf.get(r.player_id) ?? null
      : r.manual_email ? { email: r.manual_email, name: r.manual_name ?? 'there' } : null;
    if (!to) { unreachable.push(r.id); continue; }
    const g = groups.get(to.email) ?? { to, items: [], ids: [] };
    g.items.push({
      player: r.player_id ? nameOf(r.player_id) : r.manual_name ?? '',
      category: r.category,
      partner: isDoublesCategory(r.category) ? r.partner_name : null,
      status: r.status as 'approved' | 'rejected',
      comment: r.review_comment,
      // A linked partner in another household pays their own half of a doubles pair
      fee: (() => {
        const fee = categoryFee(r.category, Number(t.entry_fee ?? 0));
        return isDoublesCategory(r.category) ? fee / 2 : fee;
      })(),
    });
    g.ids.push(r.id);
    groups.set(to.email, g);
  }

  const list = [...groups.values()];
  const mails: Mail[] = list.map((g) => ({
    to: g.to.email, kind: 'decision', tournamentId: t.id,
    subject: `Your entries for ${t.name}: decision`,
    html: decisionEmail({ name: g.to.name, tournamentName: t.name, items: g.items }),
  }));
  const results = await sendMails(mails);
  const now = new Date().toISOString();
  const done = [...unreachable];
  results.forEach((res, i) => {
    if (res.ok) { done.push(...list[i].ids); summary.decisions++; }
    else summary.failed++;
  });
  summary.skipped += unreachable.length;
  for (const part of chunk(done, 100)) await admin.from('registrations').update({ decision_notified_at: now }).in('id', part);
}

async function loadMatchContext(admin: Admin, tournamentId: string) {
  const { data: all } = await admin
    .from('matches')
    .select('id, category, round, player1_id, player1_name, player2_id, player2_name, court_id, status, winner_id, scheduled_at, fixture_notified_at, result_notified_at')
    .eq('tournament_id', tournamentId);
  const matches = all ?? [];
  const lastRound = new Map<string, number>();
  for (const m of matches) lastRound.set(m.category, Math.max(lastRound.get(m.category) ?? 0, m.round));
  const roundName = (m: { category: string; round: number }) => {
    const fromEnd = (lastRound.get(m.category) ?? 0) - m.round;
    return fromEnd === 0 ? 'Final' : fromEnd === 1 ? 'Semifinal' : fromEnd === 2 ? 'Quarterfinal' : `Round ${m.round + 1}`;
  };
  return { matches, roundName, isFinal: (m: { category: string; round: number }) => (lastRound.get(m.category) ?? 0) === m.round };
}

async function sendFixtures(admin: Admin, t: { id: string; name: string }, summary: Summary) {
  const { matches, roundName, isFinal } = await loadMatchContext(admin, t.id);
  const todo = matches.filter((m) => m.status === 'upcoming' && m.player1_id && m.player2_id && !m.fixture_notified_at);
  if (!todo.length) return;

  const { recipientOf } = await resolveRecipients(admin, todo.flatMap((m) => [m.player1_id, m.player2_id]));

  type Group = { to: Recipient; items: Fixture[]; matchIds: Set<string>; final: boolean };
  const groups = new Map<string, Group>();
  const unreachableOnly: string[] = [];
  for (const m of todo) {
    let reached = false;
    for (const [me, meName, opp] of [
      [m.player1_id, m.player1_name, m.player2_name],
      [m.player2_id, m.player2_name, m.player1_name],
    ] as const) {
      const to = recipientOf.get(me);
      if (!to) continue;
      reached = true;
      const g = groups.get(to.email) ?? { to, items: [], matchIds: new Set<string>(), final: false };
      g.items.push({ player: meName, opponent: opp ?? 'TBD', category: m.category, round: roundName(m), when: m.scheduled_at, court: m.court_id, isFinal: isFinal(m) });
      g.matchIds.add(m.id);
      groups.set(to.email, g);
    }
    if (!reached) unreachableOnly.push(m.id);
  }

  const list = [...groups.values()];
  const mails: Mail[] = list.map((g) => {
    const hasFinal = g.items.some((i) => i.isFinal);
    return {
      to: g.to.email, kind: hasFinal ? 'final' : 'fixture', tournamentId: t.id,
      subject: hasFinal ? `Final day: your final at ${t.name}` : `Your matches at ${t.name}`,
      html: fixtureEmail({ name: g.to.name, tournamentName: t.name, items: g.items }),
    };
  });
  const results = await sendMails(mails);
  const failedMatches = new Set<string>();
  results.forEach((res, i) => {
    if (res.ok) summary.fixtures++;
    else { summary.failed++; list[i].matchIds.forEach((id) => failedMatches.add(id)); }
  });
  const done = todo.map((m) => m.id).filter((id) => !failedMatches.has(id));
  summary.skipped += unreachableOnly.length;
  const now = new Date().toISOString();
  for (const part of chunk(done, 100)) await admin.from('matches').update({ fixture_notified_at: now }).in('id', part);
}

async function sendResults(admin: Admin, t: { id: string; name: string }, summary: Summary) {
  const { matches, roundName, isFinal } = await loadMatchContext(admin, t.id);
  const todo = matches.filter((m) => m.status === 'completed' && m.player1_id && m.player2_id && !m.result_notified_at);
  if (!todo.length) return;

  const sets = await inChunks<any>(todo.map((m) => m.id), (p) => admin.from('match_sets').select('match_id, set_number, player1_score, player2_score').in('match_id', p).order('set_number'));
  const { recipientOf } = await resolveRecipients(admin, todo.flatMap((m) => [m.player1_id, m.player2_id]));

  type Group = { to: Recipient; items: Result[]; matchIds: Set<string> };
  const groups = new Map<string, Group>();
  const unreachableOnly: string[] = [];
  for (const m of todo) {
    const matchSets = sets.filter((s) => s.match_id === m.id);
    let reached = false;
    for (const [me, meName, opp, isP1] of [
      [m.player1_id, m.player1_name, m.player2_name, true],
      [m.player2_id, m.player2_name, m.player1_name, false],
    ] as const) {
      const to = recipientOf.get(me);
      if (!to) continue;
      reached = true;
      const g = groups.get(to.email) ?? { to, items: [], matchIds: new Set<string>() };
      g.items.push({
        player: meName, opponent: opp ?? '', category: m.category, round: roundName(m),
        won: m.winner_id === me, score: scoreString(matchSets, !isP1), isFinal: isFinal(m),
      });
      g.matchIds.add(m.id);
      groups.set(to.email, g);
    }
    if (!reached) unreachableOnly.push(m.id);
  }

  const list = [...groups.values()];
  const mails: Mail[] = list.map((g) => ({
    to: g.to.email, kind: 'result', tournamentId: t.id,
    subject: g.items.some((i) => i.isFinal && i.won) ? `Champion! Your result at ${t.name}` : `Your match results at ${t.name}`,
    html: resultEmail({ name: g.to.name, tournamentName: t.name, items: g.items }),
  }));
  const results = await sendMails(mails);
  const failedMatches = new Set<string>();
  results.forEach((res, i) => {
    if (res.ok) summary.results++;
    else { summary.failed++; list[i].matchIds.forEach((id) => failedMatches.add(id)); }
  });
  const done = todo.map((m) => m.id).filter((id) => !failedMatches.has(id));
  summary.skipped += unreachableOnly.length;
  const now = new Date().toISOString();
  for (const part of chunk(done, 100)) await admin.from('matches').update({ result_notified_at: now }).in('id', part);
}
