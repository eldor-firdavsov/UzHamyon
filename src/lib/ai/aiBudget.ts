/**
 * A shared time budget for all AI calls made while handling ONE Telegram update.
 *
 * The webhook has maxDuration = 30 s. If AI calls keep retrying past that, Vercel kills
 * the function and the user gets nothing. With a budget, every call gets at most
 * `perCallMs` and never more than what is left, and once the budget is spent we stop
 * calling AI and tell the user to try again.
 */

export const TELEGRAM_AI_BUDGET_MS = 25_000;
export const DEFAULT_PER_CALL_TIMEOUT_MS = 10_000;
/** Below this many ms left, do not start another AI request. */
export const MIN_USEFUL_REMAINING_MS = 2_000;

export class AiBudgetExceededError extends Error {
  constructor() {
    super('AI time budget exhausted');
    this.name = 'AiBudgetExceededError';
  }
}

export class AiBudget {
  readonly deadline: number;
  readonly perCallMs: number;
  private readonly clock: () => number;

  constructor(totalMs: number = TELEGRAM_AI_BUDGET_MS, perCallMs: number = DEFAULT_PER_CALL_TIMEOUT_MS, clock: () => number = Date.now) {
    this.clock = clock;
    this.deadline = clock() + totalMs;
    this.perCallMs = perCallMs;
  }

  remaining(): number {
    return Math.max(0, this.deadline - this.clock());
  }

  /** True if there is enough time left to start another request. */
  canStart(minMs: number = MIN_USEFUL_REMAINING_MS): boolean {
    return this.remaining() >= minMs;
  }

  /** Timeout for the next request: min(requested, perCall, remaining). */
  timeoutFor(requestedMs?: number): number {
    return Math.max(0, Math.min(requestedMs ?? this.perCallMs, this.perCallMs, this.remaining()));
  }

  /** Throws AiBudgetExceededError when there is not enough time left. */
  assertCanStart(minMs: number = MIN_USEFUL_REMAINING_MS): void {
    if (!this.canStart(minMs)) throw new AiBudgetExceededError();
  }
}

export function isAiBudgetExceeded(err: unknown): boolean {
  return err instanceof AiBudgetExceededError || (err instanceof Error && err.name === 'AiBudgetExceededError');
}
