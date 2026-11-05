import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { askFinancialAdvisor, simulateBudgetScenario } from '../src/lib/ai/advisorService.ts';
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../src/lib/transactions/service.ts';
import {
  listBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
} from '../src/lib/budgets/service.ts';
import {
  listGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
} from '../src/lib/goals/service.ts';
import { listCategories, createCategory } from '../src/lib/categories/service.ts';
import { getAnalyticsSummary } from '../src/lib/analytics/service.ts';
import { getUserFinancialTimeline } from '../src/lib/timeline/financialTimeline.ts';
import {
  previewImport,
  commitImport,
  listImportJobs,
  getImportJob,
} from '../src/lib/imports/service.ts';
import { verifyTelegramWebAppData, getOrCreateTelegramUser } from '../src/lib/telegram/auth.ts';

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env.local:', e);
}

const app = new Hono();

app.use('*', cors());

function getClient(c: any): SupabaseClient {
  const authHeader = c.req.header('Authorization');
  const cookieHeader = c.req.header('Cookie');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase configuration missing');
  }

  let token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token && cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((v: string) => {
        const parts = v.trim().split('=');
        return [decodeURIComponent(parts[0]), decodeURIComponent(parts.slice(1).join('='))];
      })
    );
    for (const [k, v] of Object.entries(cookies)) {
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        try {
          const parsed = JSON.parse(v as string);
          token = Array.isArray(parsed) ? parsed[0] : ((parsed as any).access_token || parsed);
        } catch {
          token = v as string;
        }
        break;
      } else if (k === 'sb-access-token') {
        token = v as string;
        break;
      }
    }
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Health check endpoint
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'UzHamyon Backend API',
    architecture: 'Standalone Hono + Supabase RLS',
    timestamp: new Date().toISOString(),
  })
);

// -------------------------------------------------------------
// TELEGRAM AUTHENTICATION ENDPOINT
// -------------------------------------------------------------
app.post('/api/auth/telegram', async (c) => {
  try {
    const body = await c.req.json();
    const { initData } = body;

    if (!initData) {
      return c.json({ success: false, error: 'Telegram initData berilmadi' }, 400);
    }

    const verification = verifyTelegramWebAppData(initData);
    if (!verification.valid || !verification.user) {
      return c.json(
        { success: false, error: verification.error || 'Telegram avtorizatsiyasi tasdiqlanmadi' },
        401
      );
    }

    const authResult = await getOrCreateTelegramUser(verification.user);
    if (!authResult.success || !authResult.session) {
      return c.json(
        { success: false, error: authResult.error || 'Foydalanuvchi hisobini yuklab bo‘lmadi' },
        500
      );
    }

    // Set cookie on response for webview
    c.header(
      'Set-Cookie',
      `sb-access-token=${authResult.session.access_token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`
    );

    return c.json({
      success: true,
      user: authResult.user,
      session: authResult.session,
      onboarding_completed: authResult.onboarding_completed,
      isNewUser: authResult.isNewUser,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/auth/telegram:', err);
    return c.json({ success: false, error: `Server xatoligi: ${message}` }, 500);
  }
});

// -------------------------------------------------------------
// AI ADVISOR ENDPOINTS
// -------------------------------------------------------------
app.post('/api/ai/advisor', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.json();

    if (body.action === 'simulate') {
      const { categoryName, percentageReduction } = body;
      if (!categoryName || percentageReduction === undefined) {
        return c.json({ error: 'categoryName and percentageReduction are required for simulation' }, 400);
      }
      const simRes = await simulateBudgetScenario(categoryName, Number(percentageReduction), client);
      if (simRes.error) {
        return c.json({ error: simRes.error }, (simRes.status as any) || 400);
      }
      return c.json({ simulation: simRes.data }, 200);
    }

    const question = (body.question || body.message || body.prompt || '').trim();
    const conversationId = body.conversationId;
    if (!question) {
      return c.json({ error: 'question is required' }, 400);
    }

    const result = await askFinancialAdvisor(question, conversationId, client);
    if (result.error) {
      // AI is available only to authenticated Telegram Mini App users.
      // Never accept client-supplied financial context or fabricate guest answers.
      return c.json({ error: result.error }, (result.status as any) || 400);
    }

    return c.json(
      {
        response: result.data,
        answer: result.data?.answer,
        reply: result.data?.answer,
      },
      200
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error in AI Advisor';
    return c.json({ error: message }, 500);
  }
});

// -------------------------------------------------------------
// TRANSACTIONS ENDPOINTS
// -------------------------------------------------------------
app.get('/api/transactions', async (c) => {
  try {
    const client = getClient(c);
    const q = c.req.query();
    const filterParams = {
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      startDate: q.startDate || undefined,
      endDate: q.endDate || undefined,
      type: q.type || undefined,
      categoryId: q.categoryId || undefined,
      search: q.search || undefined,
      sortBy: q.sortBy || undefined,
      sortDirection: q.sortDirection || undefined,
    };

    const result = await listTransactions(filterParams, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.post('/api/transactions', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.json();
    const result = await createTransaction(body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ transaction: result.data }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/transactions/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await getTransaction(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ transaction: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.put('/api/transactions/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const result = await updateTransaction(id, body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ transaction: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.delete('/api/transactions/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await deleteTransaction(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

// -------------------------------------------------------------
// BUDGETS ENDPOINTS
// -------------------------------------------------------------
app.get('/api/budgets', async (c) => {
  try {
    const client = getClient(c);
    const q = c.req.query();
    const params = {
      month: q.month || undefined,
      currency: q.currency || undefined,
      includeCategory: q.includeCategory !== 'false',
    };
    const result = await listBudgets(client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.post('/api/budgets', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.json();
    const result = await createBudget(body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ budget: result.data }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/budgets/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await getBudget(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ budget: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.put('/api/budgets/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const result = await updateBudget(id, body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ budget: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.delete('/api/budgets/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await deleteBudget(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

// -------------------------------------------------------------
// GOALS ENDPOINTS
// -------------------------------------------------------------
app.get('/api/goals', async (c) => {
  try {
    const client = getClient(c);
    const q = c.req.query();
    const params = {
      currency: q.currency || undefined,
      status: q.status || undefined,
    };
    const result = await listGoals(client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.post('/api/goals', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.json();
    const result = await createGoal(body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ goal: result.data }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/goals/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await getGoal(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ goal: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.put('/api/goals/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const result = await updateGoal(id, body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ goal: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.delete('/api/goals/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await deleteGoal(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.post('/api/goals/:id/contributions', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const result = await contributeToGoal(id, body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ goal: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

// -------------------------------------------------------------
// CATEGORIES ENDPOINTS
// -------------------------------------------------------------
app.get('/api/categories', async (c) => {
  try {
    const client = getClient(c);
    const q = c.req.query();
    const type = q.type || undefined;
    const result = await listCategories({ type }, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ categories: result.data || [] }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.post('/api/categories', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.json();
    const result = await createCategory(body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ category: result.data }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

// -------------------------------------------------------------
// ANALYTICS & TIMELINE ENDPOINTS
// -------------------------------------------------------------
app.get('/api/analytics/summary', async (c) => {
  try {
    const client = getClient(c);
    const q = c.req.query();
    const result = await getAnalyticsSummary(q, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/timeline/available-months', async (c) => {
  try {
    const client = getClient(c);
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const timeline = await getUserFinancialTimeline(user.id, client);
    return c.json(timeline, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching financial timeline';
    return c.json({ error: message }, 500);
  }
});

// -------------------------------------------------------------
// IMPORTS (EXCEL / CSV) ENDPOINTS
// -------------------------------------------------------------
app.post('/api/imports/preview', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.parseBody();
    const file = body['file'];
    const mappingRaw = body['mapping'] as string | undefined;

    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file provided' }, 400);
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: 'File size exceeds 10MB limit' }, 400);
    }

    const filename = file.name;
    const lowerName = filename.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      return c.json(
        { error: 'Unsupported file format. Please upload a .csv, .xlsx, or .xls file.' },
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let userMapping = undefined;
    if (mappingRaw) {
      try {
        userMapping = JSON.parse(mappingRaw);
      } catch {
        return c.json({ error: 'Invalid mapping JSON format' }, 400);
      }
    }

    const result = await previewImport(buffer, filename, userMapping, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ preview: result.data }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error previewing import';
    return c.json({ error: message }, 500);
  }
});

app.post('/api/imports/commit', async (c) => {
  try {
    const client = getClient(c);
    const body = await c.req.json();
    const result = await commitImport(body, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json({ result: result.data }, (result.status as any) || 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error committing import';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/imports/jobs', async (c) => {
  try {
    const client = getClient(c);
    const result = await listImportJobs(client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error listing import jobs';
    return c.json({ error: message }, 500);
  }
});

app.get('/api/imports/jobs/:id', async (c) => {
  try {
    const client = getClient(c);
    const id = c.req.param('id');
    const result = await getImportJob(id, client);
    if (result.error) {
      return c.json({ error: result.error }, (result.status as any) || 400);
    }
    return c.json(result.data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error getting import job';
    return c.json({ error: message }, 500);
  }
});

const port = Number(process.env.API_PORT || 3001);
const isDirectRun = !process.env.NODE_TEST_CONTEXT && (!process.argv[1] || /server\.[tj]s$/.test(process.argv[1]));
if (isDirectRun) {
  console.log(`UzHamyon Hono API Server running on port ${port}...`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
