import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const currencyRegex = /^[A-Z]{3}$/;

export const createTransactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Izoh kiritilishi shart')
    .max(255, 'Izoh 255 belgidan oshmasligi kerak'),
  amount: z
    .union([z.number(), z.string()])
    .transform((val, ctx) => {
      const num = typeof val === 'number' ? val : Number(val.trim());
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Summa to‘g‘ri son bo‘lishi kerak',
        });
        return z.NEVER;
      }
      return num;
    })
    .pipe(
      z
        .number()
        .positive('Summa musbat bo‘lishi kerak')
        .refine(
          (val) => {
            const str = val.toFixed(10).replace(/0+$/, '');
            const decimals = str.split('.')[1];
            return !decimals || decimals.length <= 2;
          },
          { message: 'Summada verguldan keyin 2 tadan ortiq raqam bo‘lmasligi kerak' }
        )
    ),
  type: z.enum(['income', 'expense'], {
    message: 'Tranzaksiya turi daromad yoki xarajat bo‘lishi kerak',
  }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(currencyRegex, 'Valyuta 3 ta katta harfli ISO kod bo‘lishi kerak (masalan, UZS)')
    .default('UZS'),
  transaction_date: z
    .string()
    .regex(dateRegex, 'Sana YYYY-MM-DD formatida bo‘lishi kerak')
    .refine(
      (val) => {
        const parts = val.split('-').map(Number);
        if (parts.length !== 3) return false;
        const [year, month, day] = parts;
        const d = new Date(Date.UTC(year, month - 1, day));
        return (
          d.getUTCFullYear() === year &&
          d.getUTCMonth() === month - 1 &&
          d.getUTCDate() === day
        );
      },
      { message: 'Bunday sana mavjud emas' }
    ),
  transaction_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Vaqt HH:mm formatida bo‘lishi kerak')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  category_id: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  merchant: z
    .string()
    .trim()
    .max(255, 'Do‘kon nomi 255 belgidan oshmasligi kerak')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  notes: z
    .string()
    .trim()
    .max(1000, 'Izoh 1000 belgidan oshmasligi kerak')
    .optional()
    .nullable()
    .transform((val) => (val === '' || val === undefined ? null : val)),
  source: z.enum(['manual', 'csv', 'excel', 'recurring', 'telegram_ai', 'telegram_voice']).default('manual'),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionFilterSchema = z
  .object({
    startDate: z
      .string()
      .regex(dateRegex, 'Boshlanish sanasi YYYY-MM-DD formatida bo‘lishi kerak')
      .optional()
      .nullable(),
    endDate: z
      .string()
      .regex(dateRegex, 'Tugash sanasi YYYY-MM-DD formatida bo‘lishi kerak')
      .optional()
      .nullable(),
    type: z.enum(['income', 'expense', 'all']).default('all'),
    categoryId: z.string().optional().nullable(),
    search: z.string().trim().max(100).optional().nullable(),
    sortBy: z.enum(['date', 'amount']).default('date'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Tugash sanasi boshlanish sanasidan oldin bo‘lmasligi kerak',
      path: ['endDate'],
    }
  );

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
