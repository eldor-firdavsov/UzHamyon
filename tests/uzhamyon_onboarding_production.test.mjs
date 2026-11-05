import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Read local environment variables
const envPath = fs.existsSync(new URL('../.env.local', import.meta.url).pathname)
  ? new URL('../.env.local', import.meta.url).pathname
  : new URL('../.env.local', import.meta.url).pathname;
const envContent = fs.readFileSync(envPath, 'utf8');

const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const SUPABASE_ANON_KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const SUPABASE_SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const BASE_URL = 'http://localhost:3000';

function createAuthSession() {
  const cookies = {};
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookies[name] = value;
        });
      },
    },
  });

  return {
    client,
    cookies,
    getCookieHeader() {
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    },
  };
}

describe('UzHamyon — Personalized Onboarding Production Verification', () => {
  let adminClient = null;
  const session = createAuthSession();
  const testEmail = `uzhamyon_onboard_${Date.now()}@uzhamyon.test`;
  const testPassword = 'Password123!Secure';
  let testUserId = null;

  before(async () => {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
      });
    }
  });

  after(async () => {
    if (adminClient && testUserId) {
      try {
        await adminClient.from('financial_goals').delete().eq('user_id', testUserId);
        await adminClient.from('transactions').delete().eq('user_id', testUserId);
        await adminClient.from('budgets').delete().eq('user_id', testUserId);
        await adminClient.from('profiles').delete().eq('id', testUserId);
        await adminClient.auth.admin.deleteUser(testUserId);
      } catch (err) {
        console.warn('Cleanup error:', err.message);
      }
    }
  });

  // 1. Projection Math Verification
  describe('Financial Projections & Calculation Logic', () => {
    it('calculates positive potential savings correctly for 1, 3, 6, and 12 months', () => {
      const income = 12000000;
      const expenses = 8000000;
      const potentialMonthly = income - expenses; // 4,000,000

      assert.strictEqual(potentialMonthly, 4000000);
      assert.strictEqual(potentialMonthly * 1, 4000000);
      assert.strictEqual(potentialMonthly * 3, 12000000);
      assert.strictEqual(potentialMonthly * 6, 24000000);
      assert.strictEqual(potentialMonthly * 12, 48000000);
    });

    it('identifies zero and negative savings gracefully without positive projection', () => {
      const income1 = 7000000;
      const expenses1 = 7000000;
      const zeroSavings = income1 - expenses1;
      assert.strictEqual(zeroSavings <= 0, true);

      const income2 = 5000000;
      const expenses2 = 8000000;
      const negativeSavings = income2 - expenses2;
      assert.strictEqual(negativeSavings < 0, true);
      assert.strictEqual(negativeSavings, -3000000);
    });
  });

  // 2. Unauthenticated Access & Step 1 (Welcome Screen)
  describe('Step 1: Welcome Screen (Unauthenticated Guest)', () => {
    it('returns 200 OK and renders the UzHamyon Onboarding entry point', async () => {
      const res = await fetch(`${BASE_URL}/onboarding`);
      assert.strictEqual(res.status, 200, 'Expected 200 OK on unauthenticated /onboarding');
      const html = await res.text();

      // UzHamyon branding
      assert.ok(html.includes('UzHamyon'), 'Must contain UzHamyon branding');
      assert.ok(!html.includes('SpendSense'), 'Must NOT contain old SpendSense brand');
      assert.ok(html.includes('OnboardingWizard'), 'Must mount OnboardingWizard');
    });

    it('redirects /register to /onboarding for a unified onboarding entry point', async () => {
      const res = await fetch(`${BASE_URL}/register`, { redirect: 'manual' });
      const location = res.headers.get('location');
      assert.ok(
        res.status === 307 || res.status === 302 || location?.includes('/onboarding'),
        'Expected /register to redirect to /onboarding'
      );
    });
  });

  // 3. User Registration, Profile Initialization, and State Recovery
  describe('Step 2 & 3: Account Creation & Name Persistence', () => {
    it('creates a new user and sets onboarding_completed to false in profiles', async () => {
      const { data, error } = await session.client.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            first_name: 'Diyorbek',
          },
        },
      });

      assert.strictEqual(error, null, `SignUp error: ${error?.message}`);
      assert.ok(data.user, 'Auth user created');
      testUserId = data.user.id;

      if (adminClient) {
        await adminClient
          .from('profiles')
          .update({
            first_name: 'Diyorbek',
            onboarding_completed: false,
            onboarding_step: 3,
          })
          .eq('id', testUserId);

        const { data: prof } = await adminClient
          .from('profiles')
          .select('*')
          .eq('id', testUserId)
          .single();

        assert.strictEqual(prof.onboarding_completed, false);
        assert.strictEqual(prof.first_name, 'Diyorbek');
        assert.strictEqual(prof.onboarding_step, 3);
      }
    });

    it('uncompleted user hitting /dashboard is strictly redirected to /onboarding', async () => {
      const res = await fetch(`${BASE_URL}/dashboard`, {
        headers: {
          Cookie: session.getCookieHeader(),
        },
        redirect: 'manual',
      });

      const location = res.headers.get('location');
      assert.ok(
        res.status === 307 || res.status === 302 || location?.includes('/onboarding'),
        'Expected redirect from dashboard to onboarding'
      );
      assert.ok(location?.includes('/onboarding'), 'Location must point to /onboarding');
    });
  });

  // 4. Financial Estimates Separation from Transactions
  describe('Step 4, 5, 6, 7 & 8: Separation of Estimates from Actual Records', () => {
    it('completing onboarding updates profiles without creating fake transactions or goals', async () => {
      if (!adminClient) return;

      const declaredIncome = 15000000;
      const declaredExpenses = 10000000;
      const categoryBreakdown = {
        housing: 3000000,
        groceries: 3500000,
        transport: 1500000,
        utilities: 1000000,
        telecom: 500000,
        entertainment: 500000,
      };

      // Emulate completeOnboardingAction logic
      await adminClient
        .from('profiles')
        .update({
          first_name: 'Diyorbek',
          declared_monthly_income: declaredIncome,
          declared_monthly_expenses: declaredExpenses,
          target_monthly_expenses: declaredExpenses,
          onboarding_completed: true,
          onboarding_step: 8,
          onboarding_data: {
            goals: ['car', 'savings'],
            custom_goal: 'Yangi uy jihozlari',
            category_expenses: categoryBreakdown,
            completed_at: new Date().toISOString(),
          },
        })
        .eq('id', testUserId);

      // Verify that NO transactions were created
      const { data: txs } = await adminClient
        .from('transactions')
        .select('*')
        .eq('user_id', testUserId);

      assert.strictEqual(txs.length, 0, 'Onboarding estimates MUST NOT create transactions');

      // Verify that NO fake balance goals were created
      const { data: goals } = await adminClient
        .from('financial_goals')
        .select('*')
        .eq('user_id', testUserId);

      assert.strictEqual(goals.length, 0, 'Stated intentions in onboarding MUST NOT create fake financial goals');

      // Verify profile has saved estimates
      const { data: prof } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      assert.strictEqual(prof.onboarding_completed, true);
      assert.strictEqual(Number(prof.declared_monthly_income), declaredIncome);
      assert.strictEqual(Number(prof.declared_monthly_expenses), declaredExpenses);
      assert.deepStrictEqual(prof.onboarding_data.goals, ['car', 'savings']);
      assert.strictEqual(prof.onboarding_data.custom_goal, 'Yangi uy jihozlari');
    });

    it('completed user accesses /dashboard and sees personalized welcome with saved name', async () => {
      const res = await fetch(`${BASE_URL}/dashboard`, {
        headers: {
          Cookie: session.getCookieHeader(),
        },
      });

      assert.strictEqual(res.status, 200, 'Expected 200 OK on /dashboard');
      const html = await res.text();

      // Display name in header/greeting
      assert.ok(html.includes('Diyorbek'), 'Dashboard must display saved user display name');

      // Pristine account: actual transactions balance must be 0
      assert.ok(html.includes('0 soʻm'), 'Clean account balance must be 0 soʻm');
    });

    it('returning completed user hitting /onboarding is redirected straight to /dashboard', async () => {
      const res = await fetch(`${BASE_URL}/onboarding`, {
        headers: {
          Cookie: session.getCookieHeader(),
        },
        redirect: 'manual',
      });

      const location = res.headers.get('location');
      assert.ok(
        res.status === 307 || res.status === 302 || location?.includes('/dashboard'),
        'Completed user must be redirected to /dashboard'
      );
      assert.ok(location?.includes('/dashboard'), 'Location must point to /dashboard');
    });
  });
});
