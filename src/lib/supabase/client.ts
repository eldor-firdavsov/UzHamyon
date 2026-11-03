import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from './config';

let clientInstance: any = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

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
