import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    env[k] = v;
    process.env[k] = v;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function runTest() {
  console.log('1. Authenticating test user for HTTP API testing...');
  const testEmail = `test_hono_ai_${Date.now()}@example.com`;
  const testPassword = 'Password123!Secure';

  const { data: signUpData, error: signErr } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signErr) {
    console.error('Sign up error:', signErr);
    process.exit(1);
  }

  const token = signUpData.session?.access_token;
  if (!token) {
    console.error('No session access_token returned');
    process.exit(1);
  }

  console.log(`User created and authenticated: ${testEmail}`);

  console.log('2. Sending POST request to http://localhost:3001/api/ai/advisor ...');
  const response = await fetch('http://localhost:3001/api/ai/advisor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      question: 'UzHamyon orqali budjetni qanday rejalashtirishim mumkin?',
    }),
  });

  console.log(`HTTP Status: ${response.status}`);
  const json = await response.json();
  console.log('API Response:\n', JSON.stringify(json, null, 2));

  if (response.status === 200 && json.response?.answer) {
    console.log('\nSUCCESS: OpenRouter AI successfully responded through the Hono API server!');
  } else {
    console.error('FAIL: Unexpected response:', json);
    process.exit(1);
  }

  // Cleanup test user
  await adminClient.auth.admin.deleteUser(signUpData.user.id);
  console.log('Cleaned up test user.');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
