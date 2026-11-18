/**
 * Escapes a dynamic value for Telegram messages sent with parse_mode: 'HTML'.
 *
 * Telegram's HTML mode only needs `&`, `<` and `>` escaped in text, but we also
 * escape `"` so the same helper is safe inside attribute values (e.g. href="").
 * Every user name, AI-generated text, description or DB error that goes into a
 * Telegram message MUST pass through this function.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
