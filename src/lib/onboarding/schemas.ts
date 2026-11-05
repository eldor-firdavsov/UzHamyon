import { z } from 'zod';

export const onboardingNameSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, 'Iltimos, ismingizni kiriting')
    .max(50, 'Ism 50 ta belgidan oshmasligi kerak'),
});

export const ONBOARDING_GOAL_OPTIONS = [
  { id: 'car', label: 'Mashina uchun pul yig‘ish', icon: 'Car' },
  { id: 'house', label: 'Uy yoki katta xarid uchun jamg‘arish', icon: 'Home' },
  { id: 'savings', label: 'Ko‘proq pul jamg‘arish', icon: 'PiggyBank' },
  { id: 'cut_expenses', label: 'Xarajatlarni kamaytirish', icon: 'TrendingDown' },
  { id: 'track_money', label: 'Pulim qayerga ketayotganini tushunish', icon: 'Compass' },
  { id: 'emergency_fund', label: 'Moliyaviy zaxira yaratish', icon: 'ShieldCheck' },
  { id: 'reduce_debt', label: 'Qarzlarni kamaytirish', icon: 'CheckCircle' },
  { id: 'other', label: 'Boshqa maqsad', icon: 'Target' },
] as const;

export const onboardingGoalsSchema = z.object({
  goals: z.array(z.string()).min(1, 'Kamida bitta maqsadni tanlang'),
  custom_goal: z.string().trim().max(120).optional().nullable(),
});

export const onboardingIncomeSchema = z.object({
  declared_monthly_income: z
    .number({ message: 'Raqam kiriting' })
    .min(0, 'Daromad manfiy bo‘lishi mumkin emas'),
});

export const ONBOARDING_EXPENSE_CATEGORIES = [
  { id: 'housing', name: 'Uy-joy', icon: 'Home', defaultAmount: 0 },
  { id: 'groceries', name: 'Oziq-ovqat', icon: 'Utensils', defaultAmount: 0 },
  { id: 'transport', name: 'Transport', icon: 'Car', defaultAmount: 0 },
  { id: 'utilities', name: 'Kommunal to‘lovlar', icon: 'Zap', defaultAmount: 0 },
  { id: 'telecom', name: 'Aloqa va internet', icon: 'Wifi', defaultAmount: 0 },
  { id: 'health', name: 'Sog‘liq', icon: 'HeartPulse', defaultAmount: 0 },
  { id: 'education', name: 'Ta\'lim', icon: 'GraduationCap', defaultAmount: 0 },
  { id: 'entertainment', name: 'Ko‘ngilochar xarajatlar', icon: 'Film', defaultAmount: 0 },
  { id: 'shopping', name: 'Xaridlar', icon: 'ShoppingBag', defaultAmount: 0 },
  { id: 'other', name: 'Boshqa xarajatlar', icon: 'MoreHorizontal', defaultAmount: 0 },
] as const;

export const onboardingExpensesSchema = z.object({
  category_expenses: z.record(z.string(), z.number().min(0)),
  declared_monthly_expenses: z.number().min(0),
});

export const completeOnboardingSchema = z.object({
  first_name: z.string().trim().min(1, 'Ism kiritilishi shart'),
  declared_monthly_income: z.number().min(0).default(0),
  declared_monthly_expenses: z.number().min(0).default(0),
  goals: z.array(z.string()).default([]),
  custom_goal: z.string().trim().max(120).optional().nullable(),
  category_expenses: z.record(z.string(), z.number().min(0)).default({}),
});

export type OnboardingNameInput = z.infer<typeof onboardingNameSchema>;
export type OnboardingGoalsInput = z.infer<typeof onboardingGoalsSchema>;
export type OnboardingIncomeInput = z.infer<typeof onboardingIncomeSchema>;
export type OnboardingExpensesInput = z.infer<typeof onboardingExpensesSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
