import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';

// Load .env.local
const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    process.env[k] = v;
  }
}

const secret =
  process.env.INTERNAL_AUTH_SECRET ||
  process.env.OPENROUTER_API_KEY ||
  process.env.AI_API_KEY ||
  process.env.GEMINI_API_KEY;

if (!secret) {
  throw new Error('INTERNAL_AUTH_SECRET yoki AI API kaliti .env.local faylida kerak');
}

// Create a valid internal auth header for firdavsove1@gmail.com
const userId = 'b7ddb69e-df81-449f-beff-0bedaa6ceafe';
const email = 'firdavsove1@gmail.com';
const ts = Date.now();
const nonce = crypto.randomBytes(8).toString('hex');
const meta = Buffer.from(JSON.stringify({ name: 'Eldor' })).toString('base64url');
const dataToSign = `${userId}:${email}:${ts}:${nonce}:${meta}`;
const sig = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
const internalToken = `${userId}:${email}:${ts}:${nonce}:${meta}:${sig}`;

async function testApi() {
  console.log('Testing /api/ai/advisor endpoint via local server...');
  const res = await fetch('http://localhost:3000/api/ai/advisor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-auth': internalToken,
      'Cookie': 'sb-test-auth-token=true',
    },
    body: JSON.stringify({
      question: '2026-yil sentabrda qancha daromad olganman?',
    }),
  });

  console.log(`Status: ${res.status}`);
  const json = await res.json();
  console.log('Response JSON:', JSON.stringify(json, null, 2));

  if (res.status === 200 && json.response?.answer) {
    console.log('\nSUCCESS: /api/ai/advisor successfully answered via OpenRouter AI!');
  } else {
    console.error('FAIL: Unexpected response', json);
    process.exit(1);
  }
}

testApi().catch((err) => {
  console.error('API test failed:', err);
  process.exit(1);
});
