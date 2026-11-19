/**
 * UzHamyon AI client — the ONE client for Gemini and the OpenRouter fallback (#45).
 *
 * - generateGeminiJson(): structured JSON (action extraction, text and voice)
 * - generateAIContent(): free text (AI advisor), never throws
 *
 * Direct server-side REST integration with Google Generative Language API.
 * Features:
 * - Server-only execution; API key is never exposed to clients, logs, or bundles
 * - Configurable model via GEMINI_MODEL with resilient fallback
 * - Exponential backoff retry for transient 429 (rate limits) and 503 (high demand)
 * - Structured JSON output mode with strict server validation
 */

import { AiBudget, AiBudgetExceededError, MIN_USEFUL_REMAINING_MS } from './aiBudget.ts';

function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

function getOpenRouterKey(): string | undefined {
  return (process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || '').trim() || undefined;
}

export function getConfiguredGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
}

export function getConfiguredGeminiFallbackModel(): string {
  return process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.7-flash';
}

/**
 * Models temporarily skipped after an error, with an expiry time.
 * 429 (quota) recovers when the quota resets, so it is only skipped for a while;
 * 404 (retired / unknown model) is skipped longer.
 */
export const MODEL_DISABLE_TTL_MS = {
  rateLimited: 10 * 60 * 1000,
  notFound: 60 * 60 * 1000,
};
const disabledModels = new Map<string, number>();

function isModelDisabled(model: string, now: number = Date.now()): boolean {
  const until = disabledModels.get(model);
  if (until === undefined) return false;
  if (until <= now) {
    disabledModels.delete(model);
    return false;
  }
  return true;
}

function disableModel(model: string, ttlMs: number, now: number = Date.now()): void {
  disabledModels.set(model, now + ttlMs);
}

/** Test helpers. */
export function _getModelDisabledUntil(model: string): number | undefined {
  return disabledModels.get(model);
}
export function _resetDisabledModels(): void {
  disabledModels.clear();
}

export interface GeminiCallOptions {
  /** Shared time budget for the whole Telegram update. */
  budget?: AiBudget;
  /**
   * 'cheap' (default): lite models first (text extraction, decision Q3).
   * 'primary': GEMINI_MODEL first, then the fallback list (voice, Phase 2).
   */
  modelOrder?: 'cheap' | 'primary';
  /**
   * OpenRouter fallback is text-only. Set false when the request carries audio/media,
   * otherwise it would answer without the media.
   */
  allowOpenRouter?: boolean;
  /** Extra parts appended after the text part (e.g. inlineData audio). */
  extraParts?: Array<Record<string, unknown>>;
  /**
   * Ask Gemini 3.x models for low "thinking" (default true). Per the Gemini docs "low" is
   * "fewest tokens, lowest latency"; gemini-3.8-flash otherwise thinks at "medium".
   */
  lowLatency?: boolean;
}

/**
 * Models that rejected thinkingConfig (400) — never send it to them again in this process.
 */
const thinkingUnsupported = new Set<string>();

/** True for models where we send thinkingConfig.thinkingLevel = LOW (explicit gemini-3.* names only). */
export function shouldSendLowThinking(model: string): boolean {
  return /^gemini-3(\.\d+)?-/.test(model) && !thinkingUnsupported.has(model);
}

/** Request body for one model: adds thinkingConfig only where it is supported. */
export function bodyForModel(
  body: Record<string, unknown>,
  model: string,
  lowLatency: boolean
): Record<string, unknown> {
  if (!lowLatency || !shouldSendLowThinking(model)) return body;
  const generationConfig = { ...((body.generationConfig as Record<string, unknown>) || {}) };
  generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
  return { ...body, generationConfig };
}

/** Model try-order for one call. */
export function buildCandidateModels(
  preferredModel: string | undefined,
  primaryModel: string,
  fallbackModel: string,
  modelOrder: 'cheap' | 'primary' = 'cheap'
): string[] {
  if (modelOrder === 'primary') {
    // Used for audio. The big flash models (GEMINI_MODEL, fallback, flash-latest) were seen
    // timing out / returning 503 "high demand" for 20 s+ while gemini-3.5-flash-lite answered
    // audio in ~1 s (2026-11-19). So audio starts with the fast lite models too; the big
    // models stay as later fallbacks.
    return Array.from(
      new Set([
        'gemini-3.5-flash-lite',
        'gemini-flash-lite-latest',
        preferredModel || primaryModel,
        primaryModel,
        fallbackModel,
        'gemini-flash-latest',
      ])
    );
  }
  return Array.from(
    new Set(
      preferredModel
        ? [preferredModel, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', primaryModel, fallbackModel]
        : ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', primaryModel, fallbackModel]
    )
  );
}

/**
 * Executes a call to Google Gemini API with automatic model fallback & retries
 */
export async function callGeminiApi(
  body: Record<string, unknown>,
  preferredModel?: string,
  timeoutMs: number = 12000,
  options: GeminiCallOptions = {}
): Promise<{ text: string; model: string; rawData: unknown }> {
  const { budget } = options;
  const apiKey = getGeminiApiKey();
  const primaryModel = preferredModel || getConfiguredGeminiModel();
  const fallbackModel = getConfiguredGeminiFallbackModel();

  // Deduplicate model candidates. When preferredModel is specified, try it first.
  // Otherwise prioritize ultra-fast low-latency models (gemini-flash-lite-latest / gemini-3.5-flash-lite)
  // to avoid hitting free-tier 20 req/day quota limits on gemini-3.8-flash.
  // Without a Gemini key, go straight to the OpenRouter fallback (if configured).
  const candidateModels = apiKey
    ? buildCandidateModels(preferredModel, primaryModel, fallbackModel, options.modelOrder)
    : [];

  let lastError: Error | null = apiKey ? null : new Error('GEMINI_API_KEY server muhitida sozlanmagan');

  for (const model of candidateModels) {
    if (isModelDisabled(model)) continue;

    // Standard Google Generative Language API endpoint with X-goog-api-key header
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (budget && !budget.canStart()) {
        throw new AiBudgetExceededError();
      }
      const attemptTimeout = budget ? budget.timeoutFor(timeoutMs) : timeoutMs;
      const requestBody = bodyForModel(body, model, options.lowLatency !== false);
      const startedAt = Date.now();
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey as string,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(attemptTimeout),
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts;

          // Extract text from parts array (skip non-text and thought-summary parts)
          const text = Array.isArray(parts)
            ? parts
                .filter((p: { thought?: boolean }) => !p.thought)
                .map((p: { text?: string }) => p.text || '')
                .join('')
                .trim()
            : '';

          if (text) {
            console.log(`[perf] gemini model=${model} ms=${Date.now() - startedAt}`);
            return {
              text,
              model: data.modelVersion || model,
              rawData: data,
            };
          }
        }

        const status = response.status;
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${status}`;

        // thinkingConfig not accepted by this model: remember and retry once without it.
        if (status === 400 && requestBody !== body && /thinking/i.test(errorMsg)) {
          thinkingUnsupported.add(model);
          lastError = new Error(`Model ${model} thinkingConfig qabul qilmadi: ${errorMsg}`);
          if (attempt === 1) continue;
          break;
        }

        // If model not found / retired (404), mark disabled and skip immediately
        if (status === 404) {
          disableModel(model, MODEL_DISABLE_TTL_MS.notFound);
          lastError = new Error(`Model ${model} mavjud emas (404): ${errorMsg}`);
          break;
        }

        // If rate limit / quota exceeded (429), disable this specific model and try fallback model
        if (status === 429) {
          disableModel(model, MODEL_DISABLE_TTL_MS.rateLimited);
          lastError = new Error(`Model ${model} kvotasi tugadi (429): ${errorMsg}`);
          break;
        }

        // If server busy (503), retry once or skip to next model
        if (status === 503 || status >= 500) {
          lastError = new Error(`Gemini xizmati vaqtincha band (${status}): ${errorMsg}`);
          if (attempt === 1 && (!budget || budget.canStart(MIN_USEFUL_REMAINING_MS + 500))) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          break;
        }

        // For other client errors (400, 401, 403), record and try next model
        lastError = new Error(`Gemini API xatoligi (${status}): ${errorMsg}`);
        break;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'TimeoutError') {
          // A timeout already used the whole per-call slice: do not retry the same model.
          lastError = new Error(`Gemini API so‘rovi vaqti tugadi (${attemptTimeout}ms)`);
          break;
        }
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === 1 && (!budget || budget.canStart(MIN_USEFUL_REMAINING_MS + 500))) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }

  // Final fallback to OpenRouter Gemini routing if Google direct is temporarily 503
  const orKey = getOpenRouterKey();
  if (orKey && options.allowOpenRouter !== false && (!budget || budget.canStart())) {
    try {
      const orRes = await callOpenRouterGemini(body, orKey, budget ? budget.timeoutFor(timeoutMs) : timeoutMs);
      if (orRes) return orRes;
    } catch {
      // Ignore fallback error and throw lastError
    }
  }

  if (budget && !budget.canStart()) {
    throw new AiBudgetExceededError();
  }
  throw lastError || new Error('Barcha Gemini modellari javob bermadi');
}

/**
 * Fallback to OpenRouter with Gemini model if Google direct experiences high-demand 503
 */
async function callOpenRouterGemini(
  geminiBody: Record<string, unknown>,
  orKey: string,
  timeoutMs: number
): Promise<{ text: string; model: string; rawData: unknown } | null> {
  const contents = geminiBody.contents as Array<{ role?: string; parts?: Array<{ text?: string }> }> | undefined;
  const sysInst = geminiBody.system_instruction as { parts?: Array<{ text?: string }> } | undefined;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (sysInst?.parts?.[0]?.text) {
    messages.push({ role: 'system', content: sysInst.parts[0].text });
  }

  if (Array.isArray(contents)) {
    for (const c of contents) {
      const txt = c.parts?.map((p) => p.text || '').join('') || '';
      if (txt) messages.push({ role: 'user', content: txt });
    }
  }

  if (messages.length === 0) return null;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://uzhamyon.uz',
      'X-Title': 'UzHamyon AI Advisor',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash',
      messages,
      max_tokens: 1500,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.ok) {
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) {
      return {
        text,
        model: data.model || 'openrouter-gemini-2.5-flash',
        rawData: data,
      };
    }
  }

  return null;
}

export interface AIResponse {
  text: string;
  /** true = no AI answered; the caller should answer from verified facts instead. */
  isFallback: boolean;
  model: string;
}

const AI_FALLBACK_TEXT = 'Moliyaviy tahlil xizmati hozirda deterministik qoidalar rejimida ishlamoqda.';

/**
 * Free-text generation (AI advisor): Gemini models, then OpenRouter. Never throws —
 * on failure or a spent budget it returns isFallback: true.
 */
export async function generateAIContent(
  prompt: string,
  systemInstruction?: string,
  timeoutMs: number = 25000,
  options: { budget?: AiBudget } = {}
): Promise<AIResponse> {
  if (!getGeminiApiKey() && !getOpenRouterKey()) {
    return { text: 'AI API kaliti server muhitida sozlanmagan.', isFallback: true, model: 'deterministic_fallback' };
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  try {
    const result = await callGeminiApi(body, undefined, timeoutMs, { budget: options.budget });
    return { text: result.text, isFallback: false, model: result.model };
  } catch (err) {
    console.warn('[ai] All AI providers failed:', err instanceof Error ? err.message : err);
    return { text: AI_FALLBACK_TEXT, isFallback: true, model: 'deterministic_fallback' };
  }
}

/**
 * Generates structured JSON output using Gemini's responseMimeType
 */
export async function generateGeminiJson<T = unknown>(
  prompt: string,
  systemInstruction?: string,
  preferredModel?: string,
  timeoutMs: number = 30000,
  options: GeminiCallOptions = {}
): Promise<{ data: T; rawText: string; model: string }> {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...(options.extraParts || [])],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      // Enough for 10 actions + summary + transcript; keeps a runaway answer short.
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const result = await callGeminiApi(body, preferredModel, timeoutMs, options);

  let cleanJson = result.text.trim();
  // Strip markdown code fences if model enclosed JSON in ```json ... ```
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    const parsed = JSON.parse(cleanJson) as T;
    return {
      data: parsed,
      rawText: result.text,
      model: result.model,
    };
  } catch {
    throw new Error(`Gemini qaytargan JSON formati noto‘g‘ri: ${cleanJson.slice(0, 150)}`);
  }
}

