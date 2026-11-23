import { z } from 'zod';

export const createBudgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Limit nomi kiritilishi shart')
    .max(100, 'Limit nomi 100 belgidan oshmasligi kerak'),
  amount: z
    .number({ message: 'Summa to‘g‘ri son bo‘lishi kerak' })
    .positive('Limit summasi musbat bo‘lishi kerak')
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Summada verguldan keyin 2 tadan ortiq raqam bo‘lmasligi kerak'),
  currency: z
    .string()
    .trim()
    .length(3, 'Valyuta 3 harfli ISO kod bo‘lishi kerak (masalan, UZS)')
    .transform((s) => s.toUpperCase())
    .default('UZS'),
  period_type: z.enum(['monthly', 'weekly', 'custom']).default('monthly'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Boshlanish sanasi YYYY-MM-DD formatida bo‘lishi kerak'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tugash sanasi YYYY-MM-DD formatida bo‘lishi kerak'),
  category_id: z
    .string()
    .uuid('Kategoriya ID si noto‘g‘ri')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
}).refine(
  (data) => data.end_date >= data.start_date,
  {
    message: 'Tugash sanasi boshlanish sanasidan oldin bo‘lmasligi kerak',
    path: ['end_date'],
  }
);

export const updateBudgetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  amount: z
    .number()
    .positive('Limit summasi musbat bo‘lishi kerak')
    .refine((val) => {
      const decimals = String(val).split('.')[1];
      return !decimals || decimals.length <= 2;
    }, 'Summada verguldan keyin 2 tadan ortiq raqam bo‘lmasligi kerak')
    .optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase())
    .optional(),
  period_type: z.enum(['monthly', 'weekly', 'custom']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return data.end_date >= data.start_date;
    }
    return true;
  },
  {
    message: 'Tugash sanasi boshlanish sanasidan oldin bo‘lmasligi kerak',
    path: ['end_date'],
  }
);

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export type BudgetStatus = 'on_track' | 'near_limit' | 'over_budget';

export interface BudgetWithProgress {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  currency: string;
  period_type: 'monthly' | 'weekly' | 'custom';
  start_date: string;
  end_date: string;
  spent: number;
  remaining: number;
  percentageUsed: number;
  status: BudgetStatus;
  category?: {
    id: string;
    name: string;
    type: string;
    color: string | null;
    icon: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}
