'use client';

import { useTournamentStore } from '../../tournament/store';

const now = new Date().toISOString();

const DEMO_PARTICIPANTS = [
  { id: 'p1', fullName: 'Rahul Sharma', mobile: '9876543210', email: 'rahul@test.com', gender: 'male' as const, dob: '1990-05-10', emergencyContact: 'Priya 9876543200', categories: ['male_singles', 'male_doubles'] as any, partnerName: 'Vikram Nair', registrationId: 'TRN-DEMO01', registeredAt: now },
  { id: 'p2', fullName: 'Vikram Nair', mobile: '9876543211', email: 'vikram@test.com', gender: 'male' as const, dob: '1988-03-22', emergencyContact: 'Anita 9876543201', categories: ['male_singles', 'male_doubles'] as any, partnerName: 'Rahul Sharma', registrationId: 'TRN-DEMO02', registeredAt: now },
  { id: 'p3', fullName: 'Arjun Mehta', mobile: '9876543212', email: 'arjun@test.com', gender: 'male' as const, dob: '1992-07-15', emergencyContact: 'Kavya 9876543202', categories: ['male_singles'] as any, registrationId: 'TRN-DEMO03', registeredAt: now },
  { id: 'p4', fullName: 'Suresh Kumar', mobile: '9876543213', email: 'suresh@test.com', gender: 'male' as const, dob: '1985-11-30', emergencyContact: 'Meena 9876543203', categories: ['male_singles'] as any, registrationId: 'TRN-DEMO04', registeredAt: now },
  { id: 'p5', fullName: 'Priya Patel', mobile: '9876543214', email: 'priya@test.com', gender: 'female' as const, dob: '1993-02-18', emergencyContact: 'Raj 9876543204', categories: ['female_singles', 'female_doubles'] as any, partnerName: 'Anita Singh', registrationId: 'TRN-DEMO05', registeredAt: now },
  { id: 'p6', fullName: 'Anita Singh', mobile: '9876543215', email: 'anita@test.com', gender: 'female' as const, dob: '1991-09-05', emergencyContact: 'Ravi 9876543205', categories: ['female_singles', 'female_doubles'] as any, partnerName: 'Priya Patel', registrationId: 'TRN-DEMO06', registeredAt: now },
];

const DEMO_MATCHES = [
  { id: 'm1', category: 'male_singles' as const, round: 0, roundName: 'Semifinal', player1Id: 'p1', player1Name: 'Rahul Sharma', player2Id: 'p2', player2Name: 'Vikram Nair', courtId: 'court-1', refereeId: 'coach-1', refereeName: 'Coach Raj', status: 'in_progress' as const, sets: [{ player1Score: 14, player2Score: 11 }] },
  { id: 'm2', category: 'male_singles' as const, round: 0, roundName: 'Semifinal', player1Id: 'p3', player1Name: 'Arjun Mehta', player2Id: 'p4', player2Name: 'Suresh Kumar', courtId: 'court-1', refereeId: 'coach-1', refereeName: 'Coach Raj', status: 'upcoming' as const, sets: [] },
  { id: 'm3', category: 'female_singles' as const, round: 0, roundName: 'Final', player1Id: 'p5', player1Name: 'Priya Patel', player2Id: 'p6', player2Name: 'Anita Singh', courtId: 'court-1', refereeId: 'coach-1', refereeName: 'Coach Raj', status: 'upcoming' as const, sets: [] },
  { id: 'm4', category: 'male_doubles' as const, round: 0, roundName: 'Final', player1Id: 'p1', player1Name: 'Rahul & Vikram', player2Id: 'p3', player2Name: 'Arjun & Suresh', courtId: 'court-1', refereeId: 'coach-1', refereeName: 'Coach Raj', status: 'completed' as const, sets: [{ player1Score: 21, player2Score: 18 }, { player1Score: 19, player2Score: 21 }, { player1Score: 21, player2Score: 15 }], winnerId: 'p1', winnerName: 'Rahul & Vikram', completedAt: now },
];

const DEMO_COURTS = [
  { id: 'court-1', name: 'Court 1', refereeId: 'coach-1', refereeName: 'Coach Raj', currentMatchId: 'm1' },
  { id: 'court-2', name: 'Court 2' },
  { id: 'court-3', name: 'Court 3' },
  { id: 'court-4', name: 'Court 4' },
];

export default function SeedButton() {
  const store = useTournamentStore();

  const loadDemo = () => {
    if (!confirm('This will replace all current data with demo data. Continue?')) return;
    // Directly write to localStorage then reload
    const current = JSON.parse(localStorage.getItem('tournament-store') || '{}');
    const next = {
      ...current,
      state: {
        ...((current.state) || {}),
        isSetup: true,
        sport: 'badminton',
        tournamentName: 'Demo Open 2026',
        organizerName: 'RallyOps Demo',
        venue: 'Sports Complex',
        eventDate: '2026-08-01',
        registrationDeadline: '2026-07-25',
        participants: DEMO_PARTICIPANTS,
        matches: DEMO_MATCHES,
        courts: DEMO_COURTS,
        bracketGenerated: true,
      },
    };
    localStorage.setItem('tournament-store', JSON.stringify(next));
    window.location.reload();
  };

  const clearAll = () => {
    if (!confirm('Clear all data?')) return;
    localStorage.removeItem('tournament-store');
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={loadDemo}
        className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
      >
        🎲 Load Demo Data
      </button>
      <button
        onClick={clearAll}
        className="border border-red-300 text-red-500 hover:bg-red-50 text-sm px-3 py-2 rounded-lg transition-colors"
      >
        Clear All
      </button>
    </div>
  );
}
