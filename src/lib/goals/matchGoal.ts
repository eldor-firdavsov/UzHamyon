/**
 * One goal-matching rule for the AI flow (#30). Mirrors SQL public.find_user_goal()
 * in migration 013 — keep both in sync.
 *
 *   no name   → newest in_progress goal (or none)
 *   with name → exact name first, then "one name contains the other";
 *               in_progress before completed; newest first;
 *               cancelled goals are never matched automatically.
 */

export interface MatchableGoal {
  id: string;
  name: string;
  status?: string | null;
  updated_at?: string | null;
}

export function normalizeGoalName(name: string | null | undefined): string {
  return (name || '')
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function updatedMs(g: MatchableGoal): number {
  const t = g.updated_at ? Date.parse(g.updated_at) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function findUserGoal<T extends MatchableGoal>(goals: T[], name?: string | null): T | null {
  const query = normalizeGoalName(name);

  if (!query) {
    const active = goals
      .filter((g) => g.status === 'in_progress')
      .sort((a, b) => updatedMs(b) - updatedMs(a));
    return active[0] ?? null;
  }

  const candidates = goals
    .filter((g) => g.status === 'in_progress' || g.status === 'completed')
    .map((g) => ({ g, n: normalizeGoalName(g.name) }))
    .filter(({ n }) => n && (n === query || n.includes(query) || query.includes(n)));

  candidates.sort((a, b) => {
    const exact = Number(b.n === query) - Number(a.n === query);
    if (exact) return exact;
    const active = Number(b.g.status === 'in_progress') - Number(a.g.status === 'in_progress');
    if (active) return active;
    return updatedMs(b.g) - updatedMs(a.g);
  });

  return candidates[0]?.g ?? null;
}

/** Goal status after a money / target change: 'cancelled' stays cancelled (#31). */
export function nextGoalStatus(
  currentStatus: string | null | undefined,
  currentAmount: number,
  targetAmount: number
): 'in_progress' | 'completed' | 'cancelled' {
  if (currentStatus === 'cancelled') return 'cancelled';
  return currentAmount >= targetAmount ? 'completed' : 'in_progress';
}
