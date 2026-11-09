import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import {
  INTERNAL_AUTH_HEADER,
  verifyInternalAuth,
  type VerifiedInternalUser,
} from '@/lib/auth/internalAuth';

import { getSupabaseUrl, getSupabaseAnonKey } from './config';

function extractAccessTokenFromCookies(cookieStore: { getAll: () => Array<{ name: string; value: string }> }): string | null {
  const direct = cookieStore.getAll().find((c) => c.name === 'sb-access-token')?.value;
  if (direct) return direct;

  const all = cookieStore.getAll();
  const authCookies = all
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (authCookies.length === 0) return null;

  try {
    let combined = authCookies.map((c) => c.value).join('');
    if (combined.startsWith('base64-')) {
      combined = Buffer.from(combined.slice(7), 'base64').toString('utf8');
    }
    const parsed = JSON.parse(combined);
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }
    if (parsed && typeof parsed.access_token === 'string') {
      return parsed.access_token;
    }
  } catch {}

  return null;
}

export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  let verifiedUser: VerifiedInternalUser | null = null;

  // Must have Supabase auth cookies present to be eligible for internal identity reuse
  const hasSupabaseCookie = allCookies.some((c) =>
    c.name.startsWith('sb-')
  );

  let reqHeaders: Headers | null = null;
  if (hasSupabaseCookie) {
    try {
      reqHeaders = await headers();
      const rawToken = reqHeaders.get(INTERNAL_AUTH_HEADER);
      if (rawToken) {
        verifiedUser = verifyInternalAuth(rawToken);
      }
    } catch {
      // headers() might not be available in non-request contexts
    }
  } else {
    try {
      reqHeaders = await headers();
    } catch {}
  }

  const authHeader = reqHeaders?.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const accessToken = bearerToken || extractAccessTokenFromCookies(cookieStore);

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have proxy/middleware refreshing user sessions.
        }
      },
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });

  const originalGetUser = client.auth.getUser.bind(client.auth);

  if (verifiedUser) {
    // Cryptographically verified by middleware with valid session cookies!
    // Instant return eliminates redundant overseas HTTPS roundtrip safely.
    client.auth.getUser = (async (jwt?: string) => {
      if (jwt) {
        return originalGetUser(jwt);
      }
      return {
        data: {
          user: {
            id: verifiedUser!.id,
            email: verifiedUser!.email || undefined,
            app_metadata: {},
            user_metadata: verifiedUser!.metadata || {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      };
    }) as typeof originalGetUser;
  } else {
    // Request-scoped memoization: within the same HTTP request render tree,
    // subsequent calls to getUser() reuse the in-flight or resolved promise.
    let cachedUserPromise: ReturnType<typeof originalGetUser> | null = null;
    client.auth.getUser = ((jwt?: string) => {
      if (jwt) {
        return originalGetUser(jwt);
      }
      if (!cachedUserPromise) {
        cachedUserPromise = originalGetUser().then(async (res) => {
          if (!res.data?.user) {
            const accessToken = cookieStore.get('sb-access-token')?.value;
            if (accessToken) {
              const tokenRes = await originalGetUser(accessToken);
              if (tokenRes.data?.user) {
                return tokenRes;
              }
            }
          }
          return res;
        });
      }
      return cachedUserPromise;
    }) as typeof originalGetUser;
  }

  return client;
});

