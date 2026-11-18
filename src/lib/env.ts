/**
 * Small helpers for environment handling.
 *
 * Rule: in production a missing required secret must fail loudly with the
 * variable NAME (never its value). Outside production we keep convenient
 * fallbacks so local development and offline tests keep working.
 *
 * Imported with relative `.ts` paths from lib code so node:test can load it.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Constant-time string comparison (avoids leaking secret length/prefix through timing).
 * Works in Node and Edge runtimes (no node:crypto dependency).
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}
