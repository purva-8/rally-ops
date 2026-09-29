import { CATEGORY_LABELS as SHARED_LABELS } from '@/lib/categories';

export type Gender = 'male' | 'female';

// Categories are plain ids now (see lib/categories.ts for labels and eligibility)
export type Category = string;

export const CATEGORY_LABELS: Record<string, string> = SHARED_LABELS;

const COLOR_POOL = [
  'bg-blue-100 text-blue-800', 'bg-pink-100 text-pink-800', 'bg-indigo-100 text-indigo-800',
  'bg-purple-100 text-purple-800', 'bg-rose-100 text-rose-800', 'bg-cyan-100 text-cyan-800',
  'bg-teal-100 text-teal-800', 'bg-sky-100 text-sky-800', 'bg-fuchsia-100 text-fuchsia-800',
  'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-emerald-100 text-emerald-800',
];

// Every category gets a stable colour, including ones added later
export const CATEGORY_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, id: string) => {
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLOR_POOL[h % COLOR_POOL.length];
  },
});

export interface Participant {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  gender: Gender;
  dob: string;
  emergencyContact: string;
  categories: Category[];
  partnerId?: string;
  partnerName?: string;
  registrationId: string;
  registeredAt: string;
  familyGroupId?: string;
}

export type MatchStatus = 'upcoming' | 'in_progress' | 'completed';

export interface Set {
  player1Score: number;
  player2Score: number;
}

export interface Match {
  id: string;
  category: Category;
  round: number;
  roundName: string;
  player1Id: string;
  player1Name: string;
  player2Id?: string;
  player2Name?: string;
  isBye?: boolean;
  courtId?: string;
  refereeId?: string;
  refereeName?: string;
  status: MatchStatus;
  sets: Set[];
  winnerId?: string;
  winnerName?: string;
  scheduledAt?: string;
  completedAt?: string;
}

export interface Court {
  id: string;
  name: string;
  refereeId?: string;
  refereeName?: string;
  currentMatchId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'coach' | 'participant';
  courtId?: string;
}

export interface TournamentState {
  tournamentId: string | null;
  isSetup: boolean;
  sport: 'badminton' | null;
  organizerName: string;
  tournamentName: string;
  eventDate: string;
  venue: string;
  registrationDeadline: string;
  managerPassword: string;
  selectedCategories: Category[];
  participants: Participant[];
  matches: Match[];
  courts: Court[];
  users: User[];
  bracketGenerated: boolean;
}
