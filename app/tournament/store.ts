'use client';

import { create } from 'zustand';
import { entryLabel } from '@/lib/categories';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { TournamentState, Participant, Match, Court, User, Category, Set } from './types';

function generateRegistrationId() {
  return 'TRN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Round ${round + 1}`;
}

// Courts that matches refer to but this browser has never seen (added on another device, or court-5 and up)
function withMatchCourts(courts: Court[], matches: Match[]) {
  const extra = Array.from(new Set(matches.map((m) => m.courtId).filter((id): id is string => !!id && !courts.some((c) => c.id === id))));
  return extra.length ? [...courts, ...extra.map((id) => ({ id, name: courtName(id) }))] : courts;
}

export function courtName(id: string) {
  const n = /^court-(\d+)$/.exec(id);
  return n ? `Court ${n[1]}` : 'Court';
}

type SaveResult = { match?: Match; nextMatches?: Match[]; error?: string };

// Saves for one match go out one at a time, in order: a coach tapping quickly must not have an older
// score land after a newer one
const saveQueues = new Map<string, Promise<unknown>>();

// Every score/court change goes through the server; a failure is kept in saveError so the screen can say so
function saveMatch(body: Record<string, unknown>): Promise<SaveResult> {
  const key = String(body.matchId);
  const run = (saveQueues.get(key) ?? Promise.resolve()).then(() => postMatch(body));
  saveQueues.set(key, run.catch(() => {}));
  return run;
}

async function postMatch(body: Record<string, unknown>): Promise<SaveResult> {
  try {
    const res = await fetch('/api/tournament/matches/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? `Save failed (${res.status})` };
    return data;
  } catch {
    return { error: 'No connection. The last change was not saved.' };
  }
}

interface Actions {
  setTournamentId: (id: string) => void;
  loadParticipants: (participants: Participant[]) => void;
  loadMatches: (matches: Match[]) => void;
  setupTournament: (data: { tournamentName: string; organizerName: string; venue: string; eventDate: string; registrationDeadline: string; courtCount: number; managerPassword: string; selectedCategories: Category[] }) => void;
  addParticipant: (data: Omit<Participant, 'id' | 'registrationId' | 'registeredAt'>) => Participant;
  updateParticipant: (id: string, data: Partial<Participant>) => void;
  deleteParticipant: (id: string) => void;
  generateCategoryBracket: (category: Category, orderedParticipantIds: string[], byeParticipantIds: string[]) => void;
  assignCourt: (matchId: string, courtId: string, refereeId: string, refereeName: string) => void;
  startMatch: (matchId: string) => void;
  updateScore: (matchId: string, sets: Set[]) => void;
  completeMatch: (matchId: string) => Promise<boolean>;
  saveError: string | null;
  clearSaveError: () => void;
  addCourt: (name: string) => void;
  assignRefereeToCourt: (courtId: string, refereeId: string, refereeName: string) => void;
  addUser: (user: Omit<User, 'id'>) => User;
  reset: () => void;
}

const DEFAULT_COURTS: Court[] = [
  { id: 'court-1', name: 'Court 1' },
  { id: 'court-2', name: 'Court 2' },
  { id: 'court-3', name: 'Court 3' },
  { id: 'court-4', name: 'Court 4' },
];

const initialState: TournamentState & { tournamentId: string | null } = {
  tournamentId: null,
  isSetup: false,
  sport: null,
  organizerName: '',
  tournamentName: '',
  eventDate: '',
  venue: '',
  registrationDeadline: '',
  managerPassword: '',
  selectedCategories: ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'],
  participants: [],
  matches: [],
  courts: DEFAULT_COURTS,
  users: [],
  bracketGenerated: false,
};

export const useTournamentStore = create<TournamentState & Actions & { _hasHydrated: boolean; setHasHydrated: (v: boolean) => void }>()(
  persist(
    (set, get) => ({
      ...initialState,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setTournamentId: (id) => set({ tournamentId: id }),

      loadParticipants: (participants) => set({ participants }),

      loadMatches: (matches) => set((s) => ({ matches, bracketGenerated: matches.length > 0, courts: withMatchCourts(s.courts, matches) })),

      saveError: null,
      clearSaveError: () => set({ saveError: null }),

      setupTournament: ({ tournamentName, organizerName, venue, eventDate, registrationDeadline, courtCount, managerPassword, selectedCategories }) => {
        const courts: Court[] = Array.from({ length: courtCount }, (_, i) => ({
          id: `court-${i + 1}`,
          name: `Court ${i + 1}`,
        }));
        set({ isSetup: true, sport: 'badminton', tournamentName, organizerName, venue, eventDate, registrationDeadline, managerPassword, selectedCategories, courts });
      },

      addParticipant: (data) => {
        const participant: Participant = {
          ...data,
          id: uuidv4(),
          registrationId: generateRegistrationId(),
          registeredAt: new Date().toISOString(),
        };
        set((s) => ({ participants: [...s.participants, participant] }));
        return participant;
      },

      updateParticipant: (id, data) =>
        set((s) => ({
          participants: s.participants.map((p) => (p.id === id ? { ...p, ...data } : p)),
        })),

      deleteParticipant: (id) =>
        set((s) => ({ participants: s.participants.filter((p) => p.id !== id) })),

      generateCategoryBracket: (category, orderedParticipantIds, byeParticipantIds) => {
        const { participants } = get();
        const byeSet = new Set(byeParticipantIds);
        // One person has a participant row per category (same id), so match on the category too,
        // otherwise a doubles entry can pick up the partner from another category
        const catPlayers = orderedParticipantIds
          .map((id) => participants.find((p) => p.id === id && p.categories.includes(category)))
          .filter((p): p is Participant => !!p);
        if (catPlayers.length < 2) return;

        // Rounds halve (an odd one out waits a round), so n entries take ceil(log2 n) rounds
        const totalRounds = Math.ceil(Math.log2(catPlayers.length));
        const roundName = getRoundName(0, totalRounds - 1);

        const byePlayers = catPlayers.filter((p) => byeSet.has(p.id));
        const activePlayers = catPlayers.filter((p) => !byeSet.has(p.id));

        const round1: Match[] = byePlayers.map((p, i) => ({
          id: uuidv4(),
          category,
          round: 0,
          position: i,
          roundName,
          player1Id: p.id,
          player1Name: entryLabel(p.fullName, p.partnerName, category),
          status: 'completed',
          isBye: true,
          winnerId: p.id,
          winnerName: entryLabel(p.fullName, p.partnerName, category),
          sets: [],
        }));

        for (let i = 0; i < activePlayers.length; i += 2) {
          const p1 = activePlayers[i];
          const p2 = activePlayers[i + 1];
          round1.push({
            id: uuidv4(),
            category,
            round: 0,
            position: round1.length,
            roundName,
            player1Id: p1.id,
            player1Name: entryLabel(p1.fullName, p1.partnerName, category),
            player2Id: p2.id,
            player2Name: entryLabel(p2.fullName, p2.partnerName, category),
            status: 'upcoming',
            sets: [],
          });
        }

        set((s) => ({ matches: [...s.matches, ...round1], bracketGenerated: true }));
      },

      assignCourt: (matchId, courtId, refereeId, refereeName) => {
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, courtId, refereeId, refereeName } : m
          ),
          courts: s.courts.map((c) =>
            c.id === courtId ? { ...c, currentMatchId: matchId, refereeId, refereeName } : c
          ),
        }));
        const { tournamentId, matches } = get();
        if (!tournamentId) return;
        const match = matches.find((m) => m.id === matchId);
        saveMatch({ matchId, sets: match?.sets ?? [], courtId, refereeId, refereeName })
          .then((r) => r.error && set({ saveError: r.error }));
      },

      startMatch: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, status: 'in_progress', sets: [{ player1Score: 0, player2Score: 0 }] } : m
          ),
        }));
        const { tournamentId } = get();
        if (!tournamentId) return;
        saveMatch({ matchId, sets: [{ player1Score: 0, player2Score: 0 }], status: 'in_progress' })
          .then((r) => r.error && set({ saveError: r.error }));
      },

      updateScore: (matchId, sets) => {
        set((s) => ({
          matches: s.matches.map((m) => (m.id === matchId ? { ...m, sets } : m)),
        }));
        const { tournamentId, matches } = get();
        if (!tournamentId) return;
        const match = matches.find((m) => m.id === matchId);
        saveMatch({ matchId, sets, status: match?.status, courtId: match?.courtId })
          .then((r) => r.error && set({ saveError: r.error }));
      },

      // The server decides the winner from the sets and creates the next round when this one is finished
      completeMatch: async (matchId) => {
        const { matches, tournamentId } = get();
        const match = matches.find((m) => m.id === matchId);
        if (!match) return false;
        if (!tournamentId) {
          set({ saveError: 'This bracket is not linked to an event, so results cannot be saved.' });
          return false;
        }
        const r = await saveMatch({ matchId, sets: match.sets, status: 'completed', courtId: match.courtId });
        if (r.error || !r.match) {
          set({ saveError: r.error ?? 'Result not saved' });
          return false;
        }
        const saved = r.match;
        const next = r.nextMatches ?? [];
        set((s) => ({
          saveError: null,
          matches: [
            ...s.matches.map((m) => (m.id === matchId ? { ...m, ...saved } : m)),
            ...next.filter((n) => !s.matches.some((m) => m.id === n.id)),
          ],
        }));
        return true;
      },

      // Court ids are court-N so a coach's link and match rows mean the same court on every device
      addCourt: (name) =>
        set((s) => {
          let n = s.courts.length + 1;
          while (s.courts.some((c) => c.id === `court-${n}`)) n++;
          return { courts: [...s.courts, { id: `court-${n}`, name }] };
        }),

      assignRefereeToCourt: (courtId, refereeId, refereeName) =>
        set((s) => ({
          courts: s.courts.map((c) => (c.id === courtId ? { ...c, refereeId, refereeName } : c)),
          users: s.users.map((u) => (u.id === refereeId ? { ...u, courtId } : u)),
        })),

      addUser: (data) => {
        const user: User = { ...data, id: uuidv4() };
        set((s) => ({ users: [...s.users, user] }));
        return user;
      },

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'tournament-store',
      // Bumping this discards anything an older build left in the browser (demo/seed data, old tournaments)
      version: 2,
      migrate: () => ({ ...initialState }) as never,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
