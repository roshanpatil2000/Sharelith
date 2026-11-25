import { paypalPayUrl, paypalSchema, upiPayUrl, upiSchema } from '../pay';

describe('upiPayUrl', () => {
  it('encodes the payee and turns paise into rupees', () => {
    expect(
      upiPayUrl({ upiId: 'a.b@okicici', name: 'Asha & Co', minor: 12345 }),
    ).toBe(
      'upi://pay?pa=a.b%40okicici&pn=Asha%20%26%20Co&am=123.45&cu=INR&tn=Sharelith',
    );
  });
});

describe('paypalPayUrl', () => {
  it('adds the amount and currency', () => {
    expect(
      paypalPayUrl({ username: 'asha', minor: 500, currency: 'USD' }),
    ).toBe('https://paypal.me/asha/5.00USD');
  });
});

describe('schemas', () => {
  it('accepts empty or name@bank UPI IDs', () => {
    expect(upiSchema.safeParse('').success).toBe(true);
    expect(upiSchema.safeParse(' asha@okaxis ').data).toBe('asha@okaxis');
    expect(upiSchema.safeParse('asha').success).toBe(false);
    expect(upiSchema.safeParse('as ha@okaxis').success).toBe(false);
  });

  it('takes a PayPal.me link or a bare username', () => {
    expect(paypalSchema.safeParse('https://www.paypal.me/asha').data).toBe(
      'asha',
    );
    expect(paypalSchema.safeParse('paypal.me/asha').data).toBe('asha');
    expect(paypalSchema.safeParse('asha!').success).toBe(false);
  });
});
