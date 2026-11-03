/**
 * Utility functions for formatting and parsing numbers with space gaps (thousands separators).
 * Example: 100000 -> "100 000"
 */

/**
 * Formats a raw number or input string with thousands separator spaces ("gaps").
 * E.g.
 * 100000 -> "100 000"
 * "100000" -> "100 000"
 * "100 000" -> "100 000"
 * "100000.5" -> "100 000.5"
 * "100000." -> "100 000." (preserves trailing dot while user is typing decimals)
 * "100000,5" -> "100 000.5"
 */
export function formatNumberWithGaps(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (!str.trim()) return '';

  // Standardize commas to dots for decimals
  const normalized = str.replace(/,/g, '.');
  const endsWithDot = normalized.endsWith('.');

  // Split into integer part and decimal part
  const parts = normalized.split('.');
  let rawInt = parts[0].replace(/\D/g, ''); // strip non-digits

  // Remove leading zeros unless it's just "0"
  if (rawInt.length > 1 && rawInt.startsWith('0')) {
    rawInt = rawInt.replace(/^0+(?=\d)/, '');
  }

  if (!rawInt && parts.length === 1) return '';

  const formattedInt = rawInt ? rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '0';

  if (parts.length > 1) {
    const rawDec = parts[1].replace(/\D/g, '').slice(0, 2); // max 2 decimal places
    return endsWithDot && rawDec.length === 0
      ? `${formattedInt}.`
      : `${formattedInt}.${rawDec}`;
  }

  return formattedInt;
}

/**
 * Parses a string formatted with gaps into a standard number.
 * E.g. "100 000" -> 100000, "100 000.5" -> 100000.5
 */
export function parseNumberFromGaps(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/\s+/g, '').replace(/,/g, '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Returns clean unformatted number string without spaces suitable for DB or validation.
 * E.g. "100 000.50" -> "100000.50"
 */
export function cleanNumberGaps(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\s+/g, '').replace(/,/g, '.');
}
