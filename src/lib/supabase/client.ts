import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let clientInstance: any = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL);

  const supabaseAnonKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    );
  }

  clientInstance = createSupabaseClient<any>(supabaseUrl, supabaseAnonKey);

  if (typeof window !== 'undefined') {
    clientInstance.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
      } else {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax`;
      }
    });
  }

  return clientInstance;
}
