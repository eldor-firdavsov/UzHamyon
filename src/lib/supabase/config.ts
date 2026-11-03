/**
 * Centralized Supabase Configuration with Safe Production Public Fallbacks
 */

export const DEFAULT_SUPABASE_URL = 'https://omzreoaaownshtzpqsdt.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tenJlb2Fhb3duc2h0enBxc2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTE0MTgsImV4cCI6MjEwNjUyNzQxOH0.qJ9QvMQohfov_XQiF1Bc40S5aD4nfUNeHP11t4LSo5g';

export function getSupabaseUrl(): string {
  return (
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL
  );
}

export function getSupabaseAnonKey(): string {
  return (
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

export function getSupabaseServiceRoleKey(): string {
  return (
    (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    ''
  );
}
