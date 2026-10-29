import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(100, 'Name is too long');

export const phoneSchema = z
  .string()
  .trim()
  .refine(v => v === '' || /^\+?[0-9 ]{6,20}$/.test(v), {
    message: 'Enter a valid phone number',
  });

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6,8}$/, 'Enter the code from the email');

export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const signUpSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  defaultCurrency: currencySchema,
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LogInValues = z.infer<typeof logInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  code: codeSchema,
  password: passwordSchema,
});
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine(v => v.password === v.confirm, {
    message: 'Passwords don’t match',
    path: ['confirm'],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const verifyCodeSchema = z.object({ code: codeSchema });
export type VerifyCodeValues = z.infer<typeof verifyCodeSchema>;
