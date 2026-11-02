import React from 'react';
import {
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Zap,
  Wifi,
  Film,
  Shirt,
  HeartPulse,
  GraduationCap,
  Dumbbell,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  Coins,
  MoreHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryMeta {
  key: string;
  name: string;
  icon: LucideIcon;
  bg: string;
  color: string;
  border: string;
}

export const CATEGORY_DEFINITIONS: Record<string, CategoryMeta> = {
  // Food & Groceries
  'Oziq-ovqat': {
    key: 'Oziq-ovqat',
    name: 'Oziq-ovqat',
    icon: ShoppingBag,
    bg: '#FEF3C7',
    color: '#D97706',
    border: '#FDE68A',
  },
  // Dining Out & Cafes
  'Kafeler va Restoranlar': {
    key: 'Kafeler va Restoranlar',
    name: 'Kafeler va Restoranlar',
    icon: Utensils,
    bg: '#FFEDD5',
    color: '#EA580C',
    border: '#FED7AA',
  },
  // Transportation
  'Transport': {
    key: 'Transport',
    name: 'Transport',
    icon: Car,
    bg: '#DBEAFE',
    color: '#2563EB',
    border: '#BFDBFE',
  },
  // Housing / Rent
  'Uy-joy': {
    key: 'Uy-joy',
    name: 'Uy-joy',
    icon: Home,
    bg: '#FCE7F3',
    color: '#DB2777',
    border: '#FBCFE8',
  },
  'Uy': {
    key: 'Uy',
    name: 'Uy-joy',
    icon: Home,
    bg: '#FCE7F3',
    color: '#DB2777',
    border: '#FBCFE8',
  },
  // Utilities
  'Kommunal': {
    key: 'Kommunal',
    name: 'Kommunal to‘lovlar',
    icon: Zap,
    bg: '#E0F2FE',
    color: '#0284C7',
    border: '#BAE6FD',
  },
  // Internet & Phone
  'Aloqa va Internet': {
    key: 'Aloqa va Internet',
    name: 'Aloqa va Internet',
    icon: Wifi,
    bg: '#E0E7FF',
    color: '#4F46E5',
    border: '#C7D2FE',
  },
  // Entertainment
  "Ko'ngilochar": {
    key: "Ko'ngilochar",
    name: "Ko'ngilochar",
    icon: Film,
    bg: '#F3E8FF',
    color: '#9333EA',
    border: '#E9D5FF',
  },
  // Shopping & Clothes
  'Xaridlar': {
    key: 'Xaridlar',
    name: 'Xaridlar va Kiyim',
    icon: Shirt,
    bg: '#FFE4E6',
    color: '#E11D48',
    border: '#FECDD3',
  },
  // Health & Medicine
  'Salomatlik': {
    key: 'Salomatlik',
    name: 'Salomatlik va Tibbiyot',
    icon: HeartPulse,
    bg: '#FEE2E2',
    color: '#DC2626',
    border: '#FECACA',
  },
  // Education
  "Ta'lim": {
    key: "Ta'lim",
    name: "Ta'lim va Kurslar",
    icon: GraduationCap,
    bg: '#CCFBF1',
    color: '#0D9488',
    border: '#99F6E4',
  },
  // Personal care & Gym
  'Shaxsiy parvarish': {
    key: 'Shaxsiy parvarish',
    name: 'Shaxsiy parvarish va Sport',
    icon: Dumbbell,
    bg: '#EDE9FE',
    color: '#7C3AED',
    border: '#DDD6FE',
  },
  // Salary
  'Maosh': {
    key: 'Maosh',
    name: 'Ish haqi (Oylik)',
    icon: Briefcase,
    bg: '#DCFCE7',
    color: '#16A34A',
    border: '#BBF7D0',
  },
  // Freelance
  'Frilans': {
    key: 'Frilans',
    name: 'Frilans va Biznes',
    icon: Laptop,
    bg: '#CFFAFE',
    color: '#0891B2',
    border: '#A5F3FC',
  },
  // Investments
  'Investitsiyalar': {
    key: 'Investitsiyalar',
    name: 'Investitsiyalar',
    icon: TrendingUp,
    bg: '#D1FAE5',
    color: '#059669',
    border: '#A7F3D0',
  },
  // Gifts
  "Sovg'alar": {
    key: "Sovg'alar",
    name: "Sovg‘alar",
    icon: Gift,
    bg: '#FDF4FF',
    color: '#C026D3',
    border: '#F5D0FE',
  },
  // Auto / AI
  'Auto': {
    key: 'Auto',
    name: 'Auto (AI)',
    icon: Sparkles,
    bg: '#F0FDF4',
    color: '#15803D',
    border: '#86EFAC',
  },
  'Avto': {
    key: 'Avto',
    name: 'Auto (AI)',
    icon: Sparkles,
    bg: '#F0FDF4',
    color: '#15803D',
    border: '#86EFAC',
  },
  // Other Income
  'Boshqa daromad': {
    key: 'Boshqa daromad',
    name: 'Boshqa daromad',
    icon: Coins,
    bg: '#ECFDF5',
    color: '#047857',
    border: '#A7F3D0',
  },
  // Other Expenses / Misc
  'Boshqa': {
    key: 'Boshqa',
    name: 'Boshqa xarajatlar',
    icon: MoreHorizontal,
    bg: '#F3F4F6',
    color: '#4B5563',
    border: '#E5E7EB',
  },
};

/**
 * Returns normalized category metadata with its specific icon, colors, and title
 */
export function getCategoryMeta(rawName?: string, type: 'in' | 'ex' | 'income' | 'expense' = 'ex'): CategoryMeta {
  if (!rawName) {
    return (type === 'in' || type === 'income')
      ? CATEGORY_DEFINITIONS['Maosh']
      : CATEGORY_DEFINITIONS['Auto'];
  }

  // Exact match first
  if (CATEGORY_DEFINITIONS[rawName]) {
    return CATEGORY_DEFINITIONS[rawName];
  }

  const lower = rawName.toLowerCase();

  // Auto / AI category detection
  if (lower === 'auto' || lower === 'avto' || lower.includes('auto') || lower.includes('avto')) {
    return CATEGORY_DEFINITIONS['Auto'];
  }

  // Income categories
  if (lower.includes('maosh') || lower.includes('salary') || lower.includes('ish haqi')) {
    return CATEGORY_DEFINITIONS['Maosh'];
  }
  if (lower.includes('frilans') || lower.includes('freelance') || lower.includes('konsalting') || lower.includes('mijoz') || lower.includes('loyixa')) {
    return CATEGORY_DEFINITIONS['Frilans'];
  }
  if (lower.includes('invest') || lower.includes('dividend') || lower.includes('foiz') || lower.includes('jamg‘arma') || lower.includes('jamgarma')) {
    return CATEGORY_DEFINITIONS['Investitsiyalar'];
  }
  if (lower.includes('sovg') || lower.includes('gift') || lower.includes('grant') || lower.includes('mukofot')) {
    return CATEGORY_DEFINITIONS["Sovg'alar"];
  }
  if (type === 'in' || type === 'income') {
    return CATEGORY_DEFINITIONS['Boshqa daromad'];
  }

  // Expense categories
  if (lower.includes('oziq') || lower.includes('bozor') || lower.includes('grocer') || lower.includes('supermarket') || lower.includes('korzinka') || lower.includes('makro') || lower.includes('havas') || lower.includes('non') || lower.includes('go‘sht') || lower.includes('gosht')) {
    return CATEGORY_DEFINITIONS['Oziq-ovqat'];
  }
  if (lower.includes('kafe') || lower.includes('restoran') || lower.includes('dining') || lower.includes('ovqat') || lower.includes('choyxona') || lower.includes('coffee') || lower.includes('kofe') || lower.includes('fast food') || lower.includes('lavash') || lower.includes('osh') || lower.includes('somsa') || lower.includes('burger')) {
    return CATEGORY_DEFINITIONS['Kafeler va Restoranlar'];
  }
  if (lower.includes('trans') || lower.includes('taksi') || lower.includes('yandex') || lower.includes('yo‘l') || lower.includes('yol') || lower.includes('metro') || lower.includes('benzin') || lower.includes('yoqilg‘i') || lower.includes('gaz quyish') || lower.includes('zapravka') || lower.includes('avto')) {
    return CATEGORY_DEFINITIONS['Transport'];
  }
  if (lower.includes('uy') || lower.includes('ijara') || lower.includes('housing') || lower.includes('rent') || lower.includes('kvartira') || lower.includes('dom')) {
    return CATEGORY_DEFINITIONS['Uy-joy'];
  }
  if (lower.includes('kommunal') || lower.includes('utilities') || lower.includes('elektr') || lower.includes('gaz') || lower.includes('suv') || lower.includes('issiq suv') || lower.includes('musor') || lower.includes('svet')) {
    return CATEGORY_DEFINITIONS['Kommunal'];
  }
  if (lower.includes('aloqa') || lower.includes('internet') || lower.includes('wifi') || lower.includes('telefon') || lower.includes('beeline') || lower.includes('ucell') || lower.includes('mobiuz') || lower.includes('uztelecom')) {
    return CATEGORY_DEFINITIONS['Aloqa va Internet'];
  }
  if (lower.includes('ko‘ngil') || lower.includes('kongil') || lower.includes('entert') || lower.includes('kino') || lower.includes('cinema') || lower.includes('teatr') || lower.includes('o‘yin') || lower.includes('oyun') || lower.includes('park') || lower.includes('dam olish')) {
    return CATEGORY_DEFINITIONS["Ko'ngilochar"];
  }
  if (lower.includes('xarid') || lower.includes('shopping') || lower.includes('kiyim') || lower.includes('poyabzal') || lower.includes('texnika') || lower.includes('elektronika') || lower.includes('bozori')) {
    return CATEGORY_DEFINITIONS['Xaridlar'];
  }
  if (lower.includes('sog') || lower.includes('salomat') || lower.includes('health') || lower.includes('dorixona') || lower.includes('apteka') || lower.includes('shifoxona') || lower.includes('klinika') || lower.includes('doktor') || lower.includes('dori')) {
    return CATEGORY_DEFINITIONS['Salomatlik'];
  }
  if (lower.includes('ta’lim') || lower.includes('talim') || lower.includes('educat') || lower.includes('kurs') || lower.includes('maktab') || lower.includes('universitet') || lower.includes('kontrakt') || lower.includes('kitob') || lower.includes('repititor')) {
    return CATEGORY_DEFINITIONS["Ta'lim"];
  }
  if (lower.includes('parvarish') || lower.includes('personal') || lower.includes('sport') || lower.includes('zal') || lower.includes('fitness') || lower.includes('fitnes') || lower.includes('sartarosh') || lower.includes('go‘zallik')) {
    return CATEGORY_DEFINITIONS['Shaxsiy parvarish'];
  }

  return CATEGORY_DEFINITIONS['Boshqa'];
}

export interface CategoryIconProps {
  name?: string;
  type?: 'in' | 'ex' | 'income' | 'expense';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showBackground?: boolean;
}

export function CategoryIcon({
  name,
  type = 'ex',
  size = 'md',
  className = '',
  showBackground = true,
}: CategoryIconProps) {
  const meta = getCategoryMeta(name, type);
  const IconComponent = meta.icon;

  const sizeClasses = {
    xs: { container: 'h-6 w-6 rounded-lg', icon: 'h-3.5 w-3.5' },
    sm: { container: 'h-8 w-8 rounded-xl', icon: 'h-4 w-4' },
    md: { container: 'h-10 w-10 rounded-[14px]', icon: 'h-5 w-5' },
    lg: { container: 'h-12 w-12 rounded-2xl', icon: 'h-6 w-6' },
  };

  const { container, icon } = sizeClasses[size];

  if (!showBackground) {
    return <IconComponent className={`${icon} ${className}`} style={{ color: meta.color }} />;
  }

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 border transition-transform ${container} ${className}`}
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        borderColor: meta.border,
      }}
    >
      <IconComponent className={`${icon} stroke-[2.2]`} />
    </div>
  );
}

export default CategoryIcon;
