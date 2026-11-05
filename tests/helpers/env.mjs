import fs from 'node:fs';

export function readEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    return env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export function getServiceRoleKey() {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY');
}
