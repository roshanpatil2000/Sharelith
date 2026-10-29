import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabaseMock } from '@/test/supabaseMock';
import { sendTestEmail } from '../api';

describe('sendTestEmail', () => {
  it('invokes the Edge Function and returns the recipient', async () => {
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: { to: 'asha@example.com' },
      error: null,
    } as never);
    await expect(sendTestEmail()).resolves.toBe('asha@example.com');
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      'send-test-email',
      { method: 'POST' },
    );
  });

  it("surfaces the function's error message", async () => {
    const response = new Response(
      JSON.stringify({ error: 'MAILTRAP_API_TOKEN is not set' }),
      { status: 500 },
    );
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(response),
    } as never);
    await expect(sendTestEmail()).rejects.toThrow(
      'Test email failed: MAILTRAP_API_TOKEN is not set',
    );
  });
});
