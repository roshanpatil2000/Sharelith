import {
  changePasswordSchema,
  logInSchema,
  resetPasswordSchema,
  signUpSchema,
} from '../schemas';

const validSignUp = {
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  password: 'correct-horse',
  phone: '',
  defaultCurrency: 'INR',
};

const firstError = (r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => (r.success ? undefined : r.error?.issues[0]?.message);

describe('signUpSchema', () => {
  it('accepts a valid sign-up and trims name and email', () => {
    const r = signUpSchema.safeParse({
      ...validSignUp,
      fullName: '  Asha Rao ',
      email: ' asha@example.com ',
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      fullName: 'Asha Rao',
      email: 'asha@example.com',
    });
  });

  it.each([
    [{ fullName: '  ' }, 'Enter your name'],
    [{ email: '' }, 'Enter your email'],
    [{ email: 'not-an-email' }, 'Enter a valid email address'],
    [{ password: 'short' }, 'Use at least 8 characters'],
    [{ phone: '12ab' }, 'Enter a valid phone number'],
  ])('rejects %o', (patch, message) => {
    expect(
      firstError(signUpSchema.safeParse({ ...validSignUp, ...patch })),
    ).toBe(message);
  });

  it('accepts an international phone number', () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, phone: '+91 98765 43210' })
        .success,
    ).toBe(true);
  });
});

describe('logInSchema', () => {
  it('only requires a non-empty password', () => {
    expect(
      logInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success,
    ).toBe(true);
    expect(
      firstError(logInSchema.safeParse({ email: 'a@b.co', password: '' })),
    ).toBe('Enter your password');
  });
});

describe('resetPasswordSchema', () => {
  it('requires a 6–8 digit code', () => {
    const ok = { code: '123456', password: 'new-password' };
    expect(resetPasswordSchema.safeParse(ok).success).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ ...ok, code: '12345678' }).success,
    ).toBe(true);
    expect(
      firstError(resetPasswordSchema.safeParse({ ...ok, code: '12ab56' })),
    ).toBe('Enter the code from the email');
  });
});

describe('changePasswordSchema', () => {
  it('requires matching passwords', () => {
    const r = changePasswordSchema.safeParse({
      password: 'new-password',
      confirm: 'other-password',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ['confirm'],
      message: 'Passwords don’t match',
    });
  });
});
