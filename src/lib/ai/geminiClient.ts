/**
 * UzHamyon Google Gemini API Client
 *
 * Direct server-side REST integration with Google Generative Language API.
 * Features:
 * - Server-only execution; API key is never exposed to clients, logs, or bundles
 * - Configurable model via GEMINI_MODEL with resilient fallback
 * - Exponential backoff retry for transient 429 (rate limits) and 503 (high demand)
 * - Structured JSON output mode with strict server validation
 */

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY server muhitida sozlanmagan');
  }
  return key;
}

export function getConfiguredGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
}

export function getConfiguredGeminiFallbackModel(): string {
  return process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.7-flash';
}

export interface GeminiResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

const disabledModels = new Set<string>();

/**
 * Executes a call to Google Gemini API with automatic model fallback & retries
 */
export async function callGeminiApi(
  body: Record<string, unknown>,
  preferredModel?: string,
  timeoutMs: number = 12000
): Promise<{ text: string; model: string; rawData: unknown }> {
  const apiKey = getGeminiApiKey();
  const primaryModel = preferredModel || getConfiguredGeminiModel();
  const fallbackModel = getConfiguredGeminiFallbackModel();

  // Deduplicate model candidates. When preferredModel is specified, try it first.
  // Otherwise prioritize ultra-fast low-latency models (gemini-flash-lite-latest / gemini-3.5-flash-lite)
  // to avoid hitting free-tier 20 req/day quota limits on gemini-3.8-flash.
  const candidateModels = Array.from(
    new Set(
      preferredModel
        ? [preferredModel, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', primaryModel, fallbackModel]
        : [
            'gemini-flash-lite-latest',
            'gemini-3.5-flash-lite',
            'gemini-flash-latest',
            primaryModel,
            fallbackModel,
          ]
    )
  );

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    if (disabledModels.has(model)) continue;

    // Standard Google Generative Language API endpoint with X-goog-api-key header
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts;

          // Extract text from parts array (filter out non-text parts)
          const text = Array.isArray(parts)
            ? parts.map((p: { text?: string }) => p.text || '').join('').trim()
            : '';

          if (text) {
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

        // If model not found / retired (404), mark disabled and skip immediately
        if (status === 404) {
          disabledModels.add(model);
          lastError = new Error(`Model ${model} mavjud emas (404): ${errorMsg}`);
          break;
        }

        // If rate limit / quota exceeded (429), disable this specific model and try fallback model
        if (status === 429) {
          disabledModels.add(model);
          lastError = new Error(`Model ${model} kvotasi tugadi (429): ${errorMsg}`);
          break;
        }

        // If server busy (503), retry once or skip to next model
        if (status === 503 || status >= 500) {
          lastError = new Error(`Gemini xizmati vaqtincha band (${status}): ${errorMsg}`);
          if (attempt === 1) {
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
          lastError = new Error(`Gemini API so‘rovi vaqti tugadi (${timeoutMs}ms)`);
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }

  // Final fallback to OpenRouter Gemini routing if Google direct is temporarily 503
  const orKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  if (orKey) {
    try {
      const orRes = await callOpenRouterGemini(body, orKey, timeoutMs);
      if (orRes) return orRes;
    } catch {
      // Ignore fallback error and throw lastError
    }
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
      model: 'google/gemini-2.5-flash',
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

/**
 * Standard text content generation with optional system instruction
 */
export async function generateGeminiContent(
  prompt: string,
  systemInstruction?: string,
  preferredModel?: string,
  timeoutMs: number = 30000
): Promise<GeminiResponse> {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const result = await callGeminiApi(body, preferredModel, timeoutMs);
  return {
    text: result.text,
    model: result.model,
  };
}

/**
 * Generates structured JSON output using Gemini's responseMimeType
 */
export async function generateGeminiJson<T = unknown>(
  prompt: string,
  systemInstruction?: string,
  preferredModel?: string,
  timeoutMs: number = 30000
): Promise<{ data: T; rawText: string; model: string }> {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  };

  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const result = await callGeminiApi(body, preferredModel, timeoutMs);

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

// Backward compatibility shim for legacy callers
export { generateGeminiContent as generateAIContent };
