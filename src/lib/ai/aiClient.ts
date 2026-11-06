/**
 * UzHamyon Unified AI Client (Google Gemini API & OpenRouter Fallback)
 *
 * Uses Google Gemini API as the primary direct provider with model routing,
 * automatic retries, credit-safe max_tokens, and OpenRouter / deterministic fallback.
 */

import { callGeminiApi } from './geminiClient.ts';

function getApiKey(): string {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_API_KEY ||
    ''
  );
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
}

export interface AIResponse {
  text: string;
  isFallback: boolean;
  model: string;
}

/**
 * Sends a structured prompt to Gemini / OpenRouter via direct HTTPS API
 */
export async function generateAIContent(
  prompt: string,
  systemInstruction?: string,
  timeoutMs: number = 25000
): Promise<AIResponse> {
  // 1. Try Google Gemini API directly if GEMINI_API_KEY is configured
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const body: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500,
        },
      };

      if (systemInstruction) {
        body.system_instruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const geminiRes = await callGeminiApi(body, undefined, timeoutMs);
      if (geminiRes.text) {
        return {
          text: geminiRes.text,
          isFallback: false,
          model: geminiRes.model,
        };
      }
    } catch (geminiErr) {
      console.warn('[aiClient] Direct Gemini API failed, falling back to OpenRouter:', geminiErr);
    }
  }

  // 2. OpenRouter fallback
  const apiKey = getApiKey();
  const defaultModel = getModel();

  if (!apiKey) {
    return {
      text: 'AI API kaliti server muhitida sozlanmagan.',
      isFallback: true,
      model: 'deterministic_fallback',
    };
  }

  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: systemInstruction,
    });
  }
  messages.push({
    role: 'user',
    content: prompt,
  });

  const modelsToTry = [defaultModel, 'openai/gpt-4o-mini', 'deepseek/deepseek-chat'];

  for (const model of modelsToTry) {
    const payload = {
      model,
      messages,
      max_tokens: 600, // Credit-safe to avoid OpenRouter 402 error on max_tokens calculation
      temperature: 0.2,
    };

    // Attempt up to 2 times per model
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://uzhamyon.uz',
            'X-Title': 'UzHamyon AI Advisor',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          const data = await response.json();
          const choice = data.choices?.[0];
          const text = choice?.message?.content?.trim() || '';

          if (text) {
            return {
              text,
              isFallback: false,
              model: data.model || model,
            };
          }
        }

        // Handle rate-limits or temporary 5xx errors with retry
        if (attempt === 1 && (response.status === 429 || response.status >= 500)) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const errJson = await response.json().catch(() => ({}));
        console.warn(`OpenRouter API warning [${model}] (HTTP ${response.status}):`, errJson);
        // Break out of retry loop to try next model
        break;
      } catch (err: unknown) {
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        console.warn(`OpenRouter fetch error [${model}]:`, err instanceof Error ? err.message : err);
        break;
      }
    }
  }

  return {
    text: 'Moliyaviy tahlil xizmati hozirda deterministik qoidalar rejimida ishlamoqda.',
    isFallback: true,
    model: 'deterministic_fallback',
  };
}

// Backward compatibility alias
export const generateGeminiContent = generateAIContent;
export type GeminiResponse = AIResponse;
