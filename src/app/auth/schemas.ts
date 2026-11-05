import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: 'Ism kiritilishi shart.' }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: 'Familiya kiritilishi shart.' }),
});

export type AuthActionResult = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};
