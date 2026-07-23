'use client';

import { useTournamentStore } from '../../tournament/store';
import { CATEGORY_LABELS } from '../../tournament/types';
import type { Category } from '../../tournament/types';

export default function AnalyticsTab() {
  const { participants, matches, courts, bracketGenerated, selectedCategories } = useTournamentStore();

  const categories: Category[] = selectedCategories.length > 0 ? selectedCategories : ['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'];

  const totalCompleted = matches.filter((m) => m.status === 'completed').length;
  const totalInProgress = matches.filter((m) => m.status === 'in_progress').length;
  const totalUpcoming = matches.filter((m) => m.status === 'upcoming').length;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Analytics Overview</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👥" label="Participants" value={participants.length} color="bg-orange-50 border-orange-200" />
        <StatCard icon="🏆" label="Total Matches" value={matches.length} color="bg-amber-50 border-amber-200" />
        <StatCard icon="✓" label="Completed" value={totalCompleted} color="bg-green-50 border-green-200" />
        <StatCard icon="🏟️" label="Courts" value={courts.length} color="bg-stone-50 border-stone-200" />
      </div>

      {/* Match status */}
      {bracketGenerated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4">Match Status</h3>
            <div className="space-y-3">
              <ProgressRow label="Completed" value={totalCompleted} total={matches.length} color="bg-orange-500" />
              <ProgressRow label="In Progress" value={totalInProgress} total={matches.length} color="bg-orange-500" />
              <ProgressRow label="Upcoming" value={totalUpcoming} total={matches.length} color="bg-gray-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4">Participants by Category</h3>
            <div className="space-y-2">
              {categories.map((cat) => {
                const count = participants.filter((p) => p.categories.includes(cat)).length;
                return (
                  <ProgressRow key={cat} label={CATEGORY_LABELS[cat]} value={count} total={participants.length} color="bg-orange-500" />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-bold text-gray-800 mb-4">Category Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-600 font-medium">Category</th>
                <th className="text-left py-2 text-gray-600 font-medium">Players</th>
                <th className="text-left py-2 text-gray-600 font-medium">Matches</th>
                <th className="text-left py-2 text-gray-600 font-medium">Completed</th>
                <th className="text-left py-2 text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat) => {
                const players = participants.filter((p) => p.categories.includes(cat)).length;
                const catMatches = matches.filter((m) => m.category === cat);
                const done = catMatches.filter((m) => m.status === 'completed').length;
                const champion = catMatches.find((m) => m.roundName === 'Final' && m.status === 'completed')?.winnerName;
                return (
                  <tr key={cat} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-800">{CATEGORY_LABELS[cat]}</td>
                    <td className="py-2 text-gray-600">{players}</td>
                    <td className="py-2 text-gray-600">{catMatches.length}</td>
                    <td className="py-2 text-gray-600">{done}</td>
                    <td className="py-2">
                      {champion ? (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                          🥇 {champion}
                        </span>
                      ) : players < 2 ? (
                        <span className="text-xs text-gray-400">Not enough players</span>
                      ) : catMatches.length === 0 ? (
                        <span className="text-xs text-gray-400">Not started</span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">In Progress</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </div>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
