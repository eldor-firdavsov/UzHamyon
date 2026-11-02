import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local manually
try {
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
} catch (e) {
  console.warn('Could not load .env.local:', e.message);
}

import { generateAIContent } from '../src/lib/ai/aiClient.ts';

async function runTest() {
  console.log('--- 1. Testing OpenRouter Direct generateAIContent ---');
  console.log('Key configured:', !!process.env.OPENROUTER_API_KEY);
  console.log('Model configured:', process.env.OPENROUTER_MODEL);

  const prompt = `OYLIK FOYDALANUVCHI STATISTIKASI:
- Oylik daromad: 12 000 000 soʻm
- Oylik xarajat: 7 500 000 soʻm
- Jamg'arish maqsadi: Yangi noutbuk (8 000 000 soʻm, to'plangan: 3 500 000 soʻm)

USER QUESTION: Qolgan 4 500 000 soʻmni noutbuk uchun qancha vaqtda yigʻa olaman?`;

  const systemInstruction = `Siz UzHamyon shaxsiy moliya platformasining aqlli moliyaviy maslahatchisisiz.
Foydalanuvchiga berilgan faktlar asosida aniq va lo'nda javob bering.`;

  const start = Date.now();
  const res = await generateAIContent(prompt, systemInstruction);
  const duration = Date.now() - start;

  console.log(`Response time: ${duration}ms`);
  console.log(`Model used: ${res.model}`);
  console.log(`Is fallback: ${res.isFallback}`);
  console.log(`AI Output:\n${res.text}\n`);

  if (res.isFallback) {
    console.error('FAIL: Received fallback response instead of live AI answer');
    process.exit(1);
  }

  if (!res.text || res.text.length < 20) {
    console.error('FAIL: Response too short or empty');
    process.exit(1);
  }

  console.log('SUCCESS: Live OpenRouter AI generated a comprehensive Uzbek response!');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
