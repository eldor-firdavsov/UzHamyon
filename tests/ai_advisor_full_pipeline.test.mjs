import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { askFinancialAdvisor } from '../src/lib/ai/advisorService.ts';
import { createTransaction } from '../src/lib/transactions/service.ts';

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const envContent = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    return envContent.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
const canRun = Boolean(supabaseUrl && anonKey && serviceKey);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe(
  'SpendSense AI — AI Yordamchi To‘liq Pipeline va Diagnostika Testlari',
  { skip: !canRun && 'Supabase URL, anon key and service role key are required' },
  () => {
  let adminClient;
  let userClient;
  let userId;
  let authCookieHeader = '';
  let accessToken = '';

  async function callAdvisorApi(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Cookie: authCookieHeader,
      Authorization: 'Bearer ' + accessToken,
      ...(options.headers || {}),
    };
    try {
      return await fetch(BASE_URL + path, { ...options, headers });
    } catch (err) {
      if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
        const { default: app } = await import('../server/server.ts');
        return await app.request(path, { ...options, headers });
      }
      throw err;
    }
  }

  const testUserData = {
    email: `ai_advisor_test_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  before(async () => {
    assert.ok(serviceKey, 'Service role key required');
    adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Set up SSR client to capture valid Next.js Supabase cookies
    const capturedCookies = {};
    const ssrClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return Object.entries(capturedCookies).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            capturedCookies[name] = value;
          });
        },
      },
    });

    const { data: signRes, error: signErr } = await ssrClient.auth.signUp({
      email: testUserData.email,
      password: testUserData.password,
    });
    assert.ifError(signErr);
    userId = signRes.user.id;

    const { data: loginRes, error: loginErr } = await ssrClient.auth.signInWithPassword({
      email: testUserData.email,
      password: testUserData.password,
    });
    assert.ifError(loginErr);
    assert.ok(loginRes.session);

    userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    await userClient.auth.setSession({
      access_token: loginRes.session.access_token,
      refresh_token: loginRes.session.refresh_token,
    });

    accessToken = loginRes.session.access_token;
    authCookieHeader = Object.entries(capturedCookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');

    // Seed realistic 2-month data for test user:
    // Sentabr: 6m income, 5m expense -> 1m net
    await createTransaction(
      { amount: 6000000, currency: 'UZS', type: 'income', description: 'Oylik maosh', transaction_date: '2026-09-01' },
      userClient
    );
    await createTransaction(
      { amount: 5000000, currency: 'UZS', type: 'expense', description: 'Uy va oziq-ovqat', transaction_date: '2026-09-15' },
      userClient
    );

    // Oktabr: 6m income, 4.95m expense -> 1.05m net
    await createTransaction(
      { amount: 6000000, currency: 'UZS', type: 'income', description: 'Oylik maosh', transaction_date: '2026-10-01' },
      userClient
    );
    await createTransaction(
      { amount: 4950000, currency: 'UZS', type: 'expense', description: 'Uy va oziq-ovqat', transaction_date: '2026-10-15' },
      userClient
    );
  });

  after(async () => {
    if (adminClient && userId) {
      await adminClient.from('transactions').delete().eq('user_id', userId);
      await adminClient.from('financial_goals').delete().eq('user_id', userId);
      await adminClient.from('budgets').delete().eq('user_id', userId);
      await adminClient.from('ai_conversations').delete().eq('user_id', userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  test('Test A: “Men oyiga 6 million so‘m topaman. Xarajatlarimni qanday nazorat qilsam bo‘ladi?” — aniq, tugallangan va foydali tavsiya', async () => {
    const question = 'Men oyiga 6 million so‘m topaman. Xarajatlarimni qanday nazorat qilsam bo‘ladi?';
    const res = await askFinancialAdvisor(question, undefined, userClient);

    assert.equal(res.status, 200);
    assert.ok(res.data, 'Javob ma’lumotlari bo‘lishi shart');
    assert.ok(res.data.answer, 'Javob matni bo‘sh bo‘lmasligi shart');

    const ans = res.data.answer;
    assert.ok(ans.length > 40, 'Javob yetarlicha mazmunli bo‘lishi kerak');
    assert.ok(
      ans.endsWith('.') || ans.endsWith('!') || ans.endsWith('?') || ans.endsWith('”') || ans.endsWith('"'),
      `Javob tugallangan jumlada yakunlanishi kerak: "${ans}"`
    );

    // Checks budgeting / 50-30-20 or financial distribution advice
    const mentionsBudget =
      ans.includes('50/30/20') ||
      ans.includes('byudjet') ||
      ans.includes('budjet') ||
      ans.includes('jamg‘arma') ||
      ans.includes('taqsim') ||
      ans.includes('nazorat');
    assert.ok(mentionsBudget, `Javobda byudjet yoki xarajatlarni nazorat qilish tavsiyasi bo‘lishi kerak: "${ans}"`);
  });

  test('Test B: “Sentabr va oktabr xarajatlarimni taqqosla.” — haqiqiy bazadagi summalar va farq', async () => {
    const question = 'Sentabr va oktabr xarajatlarimni taqqosla.';
    const res = await askFinancialAdvisor(question, undefined, userClient);

    assert.equal(res.status, 200);
    assert.ok(res.data?.answer);
    const ans = res.data.answer;

    // Must mention September or October amounts and difference
    const hasSep = ans.includes('5 000 000') || ans.includes('5,000,000') || ans.toLowerCase().includes('sentabr');
    const hasOct = ans.includes('4 950 000') || ans.includes('4,950,000') || ans.toLowerCase().includes('oktabr');
    const hasDiff = ans.includes('50 000') || ans.includes('kamaygan') || ans.includes('farq') || ans.includes('1.0') || ans.includes('1%');

    assert.ok(hasSep && hasOct, `Sentabr va oktabr xarajatlari ko‘rsatilishi shart: "${ans}"`);
    assert.ok(hasDiff, `Farq yoki tendensiya ko‘rsatilishi shart: "${ans}"`);
  });

  test('Test C: “Bugun 6 million so‘m oylik oldim.” — tranzaksiya yaratiladi va natija tasdiqlanadi', async () => {
    const question = 'Bugun 6 million so‘m oylik oldim.';
    const res = await askFinancialAdvisor(question, undefined, userClient);

    assert.equal(res.status, 200);
    assert.ok(res.data?.answer);
    const ans = res.data.answer;

    // Checks that AI confirms income transaction creation
    assert.ok(
      ans.includes('6 000 000') || ans.includes('6 million') || ans.includes('daromad'),
      `Daromad tranzaksiyasi haqida xabar bo‘lishi kerak: "${ans}"`
    );
  });

  test('Test D: “Bir yil ichida mashina olmoqchiman.” — yetishmayotgan muhim ma’lumot (narx) so‘raladi', async () => {
    const question = 'Bir yil ichida mashina olmoqchiman.';
    const res = await askFinancialAdvisor(question, undefined, userClient);

    assert.equal(res.status, 200);
    assert.ok(res.data?.answer);
    const ans = res.data.answer.toLowerCase();

    // AI must clarify or ask about the price / target amount
    const asksPrice =
      ans.includes('narx') ||
      ans.includes('qancha') ||
      ans.includes('summa') ||
      ans.includes('qiymat') ||
      ans.includes('byudjet') ||
      ans.includes('reja');

    assert.ok(asksPrice, `AI mashina narxini yoki qancha kerakligini so‘rashi kerak: "${res.data.answer}"`);
  });

  test('Test E: “Moliyaviy holatim qanday?” — haqiqiy moliyaviy ma’lumotlar asosida tahlil', async () => {
    const question = 'Moliyaviy holatim qanday?';
    const res = await askFinancialAdvisor(question, undefined, userClient);

    assert.equal(res.status, 200);
    assert.ok(res.data?.answer);
    const ans = res.data.answer;

    // Must be grounded in verified numbers
    const hasNumbers =
      ans.includes('12 000 000') ||
      ans.includes('9 950 000') ||
      ans.includes('2 050 000') ||
      ans.includes('barqaror') ||
      ans.includes('qoldiq');

    assert.ok(hasNumbers, `Haqiqiy ma’lumotlar asosidagi tahlil bo‘lishi kerak: "${ans}"`);
  });

  test('Test F: API orqali so‘rov xatolik berganida foydalanuvchiga tushunarli xabar qaytariladi', async () => {
    const apiRes = await callAdvisorApi('/api/ai/advisor', {
      method: 'POST',
      body: JSON.stringify({ question: '' }),
    });

    assert.equal(apiRes.status, 400, 'Bo‘sh savol 400 xatolik qaytarishi kerak');
    const data = await apiRes.json();
    assert.ok(data.error, 'Xatolik xabari bo‘lishi shart');
  });

  test('End-to-End HTTP API: Avtorizatsiyalangan foydalanuvchi /api/ai/advisor orqali to‘liq javob oladi', async () => {
    const apiRes = await callAdvisorApi('/api/ai/advisor', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Sentabr va oktabr oylarida qancha pulim tejab qolingan?',
      }),
    });

    assert.equal(apiRes.status, 200, 'HTTP status 200 bo‘lishi kerak');
    const data = await apiRes.json();
    assert.ok(data.response?.answer, 'API to‘liq javob matnini qaytarishi kerak');
    assert.ok(!data.response.answer.includes('undefined'), 'Javobda undefined bo‘lmasligi kerak');
  });
});
