export type Gender = 'male' | 'female';

export type Category =
  | 'male_singles'
  | 'female_singles'
  | 'male_doubles'
  | 'female_doubles'
  | 'spouse_doubles';

export const CATEGORY_LABELS: Record<Category, string> = {
  male_singles: 'Male Singles',
  female_singles: 'Female Singles',
  male_doubles: 'Male Doubles',
  female_doubles: 'Female Doubles',
  spouse_doubles: 'Spouse Doubles',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  male_singles: 'bg-blue-100 text-blue-800',
  female_singles: 'bg-pink-100 text-pink-800',
  male_doubles: 'bg-indigo-100 text-indigo-800',
  female_doubles: 'bg-purple-100 text-purple-800',
  spouse_doubles: 'bg-rose-100 text-rose-800',
};

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
  player2Id: string;
  player2Name: string;
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
