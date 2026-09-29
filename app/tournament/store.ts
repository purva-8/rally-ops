'use client';

import { create } from 'zustand';
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

function determineWinner(sets: Set[], p1Id: string, p2Id: string, p1Name: string, p2Name: string) {
  let p1Wins = 0;
  let p2Wins = 0;
  for (const s of sets) {
    if (s.player1Score > s.player2Score) p1Wins++;
    else if (s.player2Score > s.player1Score) p2Wins++;
  }
  if (p1Wins > p2Wins) return { winnerId: p1Id, winnerName: p1Name };
  if (p2Wins > p1Wins) return { winnerId: p2Id, winnerName: p2Name };
  return null;
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
  completeMatch: (matchId: string) => void;
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

const DEFAULT_USERS: User[] = [
  { id: 'admin-1', name: 'Admin', email: 'admin@tournament.com', role: 'admin' },
  { id: 'coach-1', name: 'Coach Raj', email: 'raj@tournament.com', role: 'coach', courtId: 'court-1' },
  { id: 'coach-2', name: 'Coach Priya', email: 'priya@tournament.com', role: 'coach', courtId: 'court-2' },
  { id: 'coach-3', name: 'Coach Arjun', email: 'arjun@tournament.com', role: 'coach', courtId: 'court-3' },
  { id: 'coach-4', name: 'Coach Meera', email: 'meera@tournament.com', role: 'coach', courtId: 'court-4' },
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
  users: DEFAULT_USERS,
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

      loadMatches: (matches) => set({ matches, bracketGenerated: matches.length > 0 }),

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
        const catPlayers = orderedParticipantIds
          .map((id) => participants.find((p) => p.id === id))
          .filter((p): p is Participant => !!p);
        if (catPlayers.length < 2) return;

        const size = Math.pow(2, Math.ceil(Math.log2(catPlayers.length)));
        const totalRounds = Math.log2(size);
        const roundName = getRoundName(0, totalRounds - 1);

        const byePlayers = catPlayers.filter((p) => byeSet.has(p.id));
        const activePlayers = catPlayers.filter((p) => !byeSet.has(p.id));

        const round1: Match[] = byePlayers.map((p) => ({
          id: uuidv4(),
          category,
          round: 0,
          roundName,
          player1Id: p.id,
          player1Name: p.fullName,
          status: 'completed',
          isBye: true,
          winnerId: p.id,
          winnerName: p.fullName,
          sets: [],
        }));

        for (let i = 0; i < activePlayers.length; i += 2) {
          const p1 = activePlayers[i];
          const p2 = activePlayers[i + 1];
          round1.push({
            id: uuidv4(),
            category,
            round: 0,
            roundName,
            player1Id: p1.id,
            player1Name: p1.fullName,
            player2Id: p2.id,
            player2Name: p2.fullName,
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
        fetch('/api/tournament/matches/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, sets: match?.sets ?? [], courtId, refereeId, refereeName }),
        }).catch(() => {});
      },

      startMatch: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, status: 'in_progress', sets: [{ player1Score: 0, player2Score: 0 }] } : m
          ),
        }));
        const { tournamentId } = get();
        if (!tournamentId) return;
        fetch('/api/tournament/matches/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, sets: [{ player1Score: 0, player2Score: 0 }], status: 'in_progress' }),
        }).catch(() => {});
      },

      updateScore: (matchId, sets) => {
        set((s) => ({
          matches: s.matches.map((m) => (m.id === matchId ? { ...m, sets } : m)),
        }));
        const { tournamentId, matches } = get();
        if (!tournamentId) return;
        const match = matches.find((m) => m.id === matchId);
        fetch('/api/tournament/matches/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId,
            sets,
            status: match?.status,
            courtId: match?.courtId,
            refereeId: match?.refereeId,
            refereeName: match?.refereeName,
          }),
        }).catch(() => {});
      },

      completeMatch: (matchId) => {
        const { matches, participants, courts } = get();
        const match = matches.find((m) => m.id === matchId);
        if (!match) return;

        const result = determineWinner(match.sets, match.player1Id, match.player2Id ?? '', match.player1Name, match.player2Name ?? '');
        if (!result) return;

        const { winnerId, winnerName } = result;
        const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
        const loserName = winnerId === match.player1Id ? match.player2Name : match.player1Name;
        const completedAt = new Date().toISOString();

        // Send result emails if participants have emails
        const winnerParticipant = participants.find((p) => p.id === winnerId);
        const loserParticipant = participants.find((p) => p.id === loserId);
        const court = courts.find((c) => c.id === match.courtId);

        if (winnerParticipant?.email && loserParticipant?.email) {
          fetch('/api/send-match-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: match.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              round: match.roundName,
              court: court?.name || 'Court',
              sets: match.sets,
              winner: { name: winnerName, email: winnerParticipant.email },
              loser: { name: loserName, email: loserParticipant.email },
            }),
          }).catch(() => {}); // fire and forget
        }

        // Persist final match result to DB
        const { tournamentId } = get();
        if (tournamentId) {
          fetch('/api/tournament/matches/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId,
              sets: match.sets,
              status: 'completed',
              winnerId,
              winnerName,
              courtId: match.courtId,
              refereeId: match.refereeId,
              refereeName: match.refereeName,
            }),
          }).catch(() => {});
        }

        // Find if there are other completed matches in the same round for this category
        const updatedMatches = matches.map((m) =>
          m.id === matchId ? { ...m, status: 'completed' as const, winnerId, winnerName, completedAt } : m
        );

        // Check if next round needs to be created
        const categoryMatches = updatedMatches.filter(
          (m) => m.category === match.category && m.round === match.round
        );
        const allCompleted = categoryMatches.every((m) => m.status === 'completed');

        if (allCompleted) {
          const winners = categoryMatches.map((m) => ({
            id: m.winnerId!,
            name: m.winnerName!,
          }));

          if (winners.length >= 2) {
            const totalCurrentRounds = updatedMatches
              .filter((m) => m.category === match.category)
              .reduce((max, m) => Math.max(max, m.round), 0);

            const nextRound = match.round + 1;
            const totalRounds = totalCurrentRounds + 1;
            const nextMatches: Match[] = [];

            for (let i = 0; i < winners.length; i += 2) {
              if (i + 1 < winners.length) {
                nextMatches.push({
                  id: uuidv4(),
                  category: match.category,
                  round: nextRound,
                  roundName: getRoundName(nextRound, totalRounds),
                  player1Id: winners[i].id,
                  player1Name: winners[i].name,
                  player2Id: winners[i + 1].id,
                  player2Name: winners[i + 1].name,
                  status: 'upcoming',
                  sets: [],
                });
              }
            }

            set({ matches: [...updatedMatches, ...nextMatches] });
          } else {
            set({ matches: updatedMatches });
          }
        } else {
          set({ matches: updatedMatches });
        }
      },

      addCourt: (name) =>
        set((s) => ({ courts: [...s.courts, { id: uuidv4(), name }] })),

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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
