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
      <h2 className="text-lg font-bold text-stone-900 mb-6">Analytics</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Participants" value={participants.length} />
        <StatCard label="Total Matches" value={matches.length} />
        <StatCard label="Completed" value={totalCompleted} accent />
        <StatCard label="Courts" value={courts.length} />
      </div>

      {bracketGenerated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-bold text-stone-700 mb-4">Match Status</h3>
            <div className="space-y-3">
              <ProgressRow label="Completed" value={totalCompleted} total={matches.length} color="bg-emerald-500" />
              <ProgressRow label="In Progress" value={totalInProgress} total={matches.length} color="bg-orange-500" />
              <ProgressRow label="Upcoming" value={totalUpcoming} total={matches.length} color="bg-stone-200" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-bold text-stone-700 mb-4">Participants by Category</h3>
            <div className="space-y-3">
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

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="text-sm font-bold text-stone-700 mb-4">Category Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-2 text-stone-400 font-medium text-xs uppercase tracking-wide">Category</th>
                <th className="text-left py-2 text-stone-400 font-medium text-xs uppercase tracking-wide">Players</th>
                <th className="text-left py-2 text-stone-400 font-medium text-xs uppercase tracking-wide">Matches</th>
                <th className="text-left py-2 text-stone-400 font-medium text-xs uppercase tracking-wide">Done</th>
                <th className="text-left py-2 text-stone-400 font-medium text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {categories.map((cat) => {
                const players = participants.filter((p) => p.categories.includes(cat)).length;
                const catMatches = matches.filter((m) => m.category === cat);
                const done = catMatches.filter((m) => m.status === 'completed').length;
                const champion = catMatches.find((m) => m.roundName === 'Final' && m.status === 'completed')?.winnerName;
                return (
                  <tr key={cat} className="hover:bg-stone-50/50">
                    <td className="py-2.5 font-medium text-stone-800">{CATEGORY_LABELS[cat]}</td>
                    <td className="py-2.5 text-stone-600">{players}</td>
                    <td className="py-2.5 text-stone-600">{catMatches.length}</td>
                    <td className="py-2.5 text-stone-600">{done}</td>
                    <td className="py-2.5">
                      {champion ? (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                          {champion}
                        </span>
                      ) : players < 2 ? (
                        <span className="text-xs text-stone-300">Not enough players</span>
                      ) : catMatches.length === 0 ? (
                        <span className="text-xs text-stone-300">Not started</span>
                      ) : (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">In Progress</span>
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className={`text-3xl font-black ${accent ? 'text-orange-600' : 'text-stone-900'}`}>{value}</p>
      <p className="text-xs text-stone-400 font-medium mt-1">{label}</p>
    </div>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-stone-600 text-xs">{label}</span>
        <span className="text-stone-400 text-xs">{value} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
