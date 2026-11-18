/**
 * Centralized Supabase configuration.
 *
 * Production: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.
 * A missing value throws a clear error instead of silently pointing at a hard-coded project.
 * Development / tests: the dev project values below are used as a fallback.
 *
 * Note: `process.env.NEXT_PUBLIC_*` must be accessed directly (not via `process.env?.`)
 * so Next.js can inline the values into the browser bundle.
 */

const DEV_FALLBACK_SUPABASE_URL = 'https://omzreoaaownshtzpqsdt.supabase.co';
const DEV_FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tenJlb2Fhb3duc2h0enBxc2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTE0MTgsImV4cCI6MjEwNjUyNzQxOH0.qJ9QvMQohfov_XQiF1Bc40S5aD4nfUNeHP11t4LSo5g';

function readNextPublicUrl(): string | undefined {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
  } catch {
    return undefined; // `process` is not defined (e.g. Vite browser bundle)
  }
}

function readNextPublicAnonKey(): string | undefined {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
  } catch {
    return undefined;
  }
}

function readViteEnv(name: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((import.meta as any).env?.[name] as string | undefined) || undefined;
  } catch {
    return undefined;
  }
}

function isProductionBuild(): boolean {
  try {
    return process.env.NODE_ENV === 'production';
  } catch {
    return false;
  }
}

export function getSupabaseUrl(): string {
  const value =
    readNextPublicUrl() || readViteEnv('VITE_SUPABASE_URL') || readViteEnv('NEXT_PUBLIC_SUPABASE_URL');
  if (value) return value;
  if (isProductionBuild()) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL muhit o‘zgaruvchisi sozlanmagan');
  }
  return DEV_FALLBACK_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  const value =
    readNextPublicAnonKey() ||
    readViteEnv('VITE_SUPABASE_ANON_KEY') ||
    readViteEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (value) return value;
  if (isProductionBuild()) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY muhit o‘zgaruvchisi sozlanmagan');
  }
  return DEV_FALLBACK_SUPABASE_ANON_KEY;
}

export function getSupabaseServiceRoleKey(): string {
  // Do NOT trim: this value is part of the derived Telegram password key, which must stay
  // byte-for-byte identical to what existing users were created with.
  try {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  } catch {
    return '';
  }
}
