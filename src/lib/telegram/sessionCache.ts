/**
 * In-memory cache of Telegram users' Supabase sessions (#34, option A).
 *
 * The bot used to call signInWithPassword on every message and button press. Now a
 * user's access token (JWT) is reused until REFRESH_MARGIN before it expires, then the
 * bot signs in again. Per server instance, at most MAX_ENTRIES users (least recently
 * used are dropped). Tokens live only in memory: never logged, never stored.
 *
 * Trade-off: a deleted/locked user keeps access for at most the token's remaining life
 * (≤ 1 h by default), exactly like any issued JWT. All writes still go through RLS
 * as that user.
 */

export interface CachedTelegramSession {
  userId: string;
  accessToken: string;
  onboardingCompleted: boolean;
  /** Token expiry, ms since epoch. */
  expiresAtMs: number;
}

export const SESSION_REFRESH_MARGIN_MS = 5 * 60 * 1000;
export const SESSION_CACHE_MAX_ENTRIES = 1000;

export class TelegramSessionCache {
  private readonly entries = new Map<number, CachedTelegramSession>();
  private readonly maxEntries: number;
  private readonly refreshMarginMs: number;
  private readonly clock: () => number;

  // Plain fields (no constructor parameter properties): Node's type stripping runs these files directly.
  constructor(
    maxEntries: number = SESSION_CACHE_MAX_ENTRIES,
    refreshMarginMs: number = SESSION_REFRESH_MARGIN_MS,
    clock: () => number = Date.now
  ) {
    this.maxEntries = maxEntries;
    this.refreshMarginMs = refreshMarginMs;
    this.clock = clock;
  }

  /** A still-fresh session, or undefined (expired/near-expiry entries are removed). */
  get(telegramId: number): CachedTelegramSession | undefined {
    const entry = this.entries.get(telegramId);
    if (!entry) return undefined;
    if (entry.expiresAtMs - this.refreshMarginMs <= this.clock()) {
      this.entries.delete(telegramId);
      return undefined;
    }
    // Mark as recently used.
    this.entries.delete(telegramId);
    this.entries.set(telegramId, entry);
    return entry;
  }

  set(telegramId: number, session: CachedTelegramSession): void {
    if (!session.accessToken || !Number.isFinite(session.expiresAtMs)) return;
    if (session.expiresAtMs - this.refreshMarginMs <= this.clock()) return; // not worth caching
    this.entries.delete(telegramId);
    this.entries.set(telegramId, session);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  delete(telegramId: number): void {
    this.entries.delete(telegramId);
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Process-wide cache used by the bot. */
export const telegramSessionCache = new TelegramSessionCache();

/** Supabase returns `expires_at` in seconds; fall back to the JWT `exp` claim. */
export function sessionExpiryMs(expiresAtSeconds: number | undefined, accessToken: string): number {
  if (typeof expiresAtSeconds === 'number' && expiresAtSeconds > 0) return expiresAtSeconds * 1000;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1] || '', 'base64url').toString('utf8'));
    if (typeof payload?.exp === 'number') return payload.exp * 1000;
  } catch {
    // ignore
  }
  return NaN;
}
