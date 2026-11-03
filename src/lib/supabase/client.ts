import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl, getSupabaseAnonKey } from './config';

let clientInstance: any = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  const isSecure = typeof window !== 'undefined' ? window.location.protocol === 'https:' : true;

  clientInstance = createBrowserClient<any>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      sameSite: isSecure ? 'none' : 'lax',
      secure: isSecure,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    },
  });

  if (typeof window !== 'undefined') {
    clientInstance.auth.onAuthStateChange((_event: any, session: any) => {
      const sameSiteAttr = isSecure ? 'SameSite=None; Secure' : 'SameSite=Lax';
      if (session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=604800; ${sameSiteAttr}`;
      } else {
        document.cookie = `sb-access-token=; path=/; max-age=0; ${sameSiteAttr}`;
      }
    });
  }

  return clientInstance;
}
