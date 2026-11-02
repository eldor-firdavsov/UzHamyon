/**
 * UzHamyon — Wise-Inspired Mobile Design Prototype Tokens
 *
 * Designed specifically for mobile validation at 390px (and 320px, 375px, 430px).
 * Color palette combines Wise's functional minimalism with high financial contrast.
 */

export const PROTOTYPE_TOKENS = {
  colors: {
    // Brand & Primary Accents
    primary: '#9FE870',          // Signature Wise-style bright lime
    primaryDark: '#163300',      // Deep forest green for high contrast text/buttons on primary
    primarySubtle: '#F0F9E9',    // Soft sage background for pills and badges
    
    // Neutrals & Surfaces
    background: '#F7F8F5',       // Warm off-white canvas
    surface: '#FFFFFF',          // Card & elevated surfaces
    surfaceElevated: '#FFFFFF',
    
    // Typography Colors
    textPrimary: '#171B16',      // Deep charcoal/off-black for primary numbers & headings
    textSecondary: '#697168',    // Warm muted gray for labels & subtitles
    textMuted: '#959E94',        // Lighter gray for secondary timestamps & hints
    
    // Borders & Dividers
    border: '#E8EBE5',          // Delicate hairline border
    borderSubtle: '#F0F2ED',
    
    // Financial Semantics
    income: '#26834A',           // Clear emerald green for positive flow (+)
    incomeSubtle: '#EDF7F0',
    expense: '#D64D4D',          // Restrained crimson for outflows (-)
    expenseSubtle: '#FDF1F1',
    neutralBadge: '#EAEFE6',
  },
  
  radii: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    card: '18px',               // Standard 16-20px card radius
    cardLarge: '22px',
    pill: '9999px',
  },
  
  shadows: {
    subtle: '0 1px 3px rgba(23, 27, 22, 0.04)',
    card: '0 2px 8px rgba(23, 27, 22, 0.04)',
    elevated: '0 8px 24px rgba(23, 27, 22, 0.08)',
    bottomNav: '0 12px 36px rgba(22, 51, 0, 0.12), 0 2px 8px rgba(23, 27, 22, 0.04)',
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    base: '16px',
    lg: '20px',
    xl: '24px',
    xxl: '32px',
  },
} as const;

export function formatUzbekCurrency(amount: number, options?: { showSign?: boolean; isExpense?: boolean }): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = options?.showSign ? (options.isExpense || amount < 0 ? '-' : '+') : '';
  return `${sign}${formatted} so‘m`;
}
