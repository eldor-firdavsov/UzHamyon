/**
 * AI client compatibility shim forwarding all requests to OpenRouter unified AI Client
 */
export {
  generateAIContent,
  generateGeminiContent,
  type AIResponse,
  type GeminiResponse,
} from './aiClient.ts';
