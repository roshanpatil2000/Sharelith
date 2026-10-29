import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AppError } from '@/features/auth/errors';

/**
 * Asks the send-test-email Edge Function to email the signed-in user via
 * Mailtrap. Resolves to the address it was sent to.
 */
export async function sendTestEmail(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ to: string }>(
    'send-test-email',
    { method: 'POST' },
  );
  if (error) {
    let detail = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      detail = body?.error ?? detail;
    }
    throw new AppError(`Test email failed: ${detail}`, 'test_email_failed');
  }
  return data?.to ?? '';
}
