import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Lock } from 'lucide-react-native';
import {
  Banner,
  Button,
  FormTextField,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import type { AuthScreenProps } from '@/app/navigation/types';
import { requestPasswordReset, resetPassword } from '../api';
import { toAppError } from '../errors';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';
import { useResendCooldown } from '../useResendCooldown';

export function ResetPasswordScreen({
  route,
}: AuthScreenProps<'ResetPassword'>) {
  const { email } = route.params;
  const [formError, setFormError] = useState<string | null>(null);
  const cooldown = useResendCooldown();
  const { control, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ code, password }) => {
    setFormError(null);
    try {
      await resetPassword(email, code, password);
      toast.show('Password updated', 'success');
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  const resend = async () => {
    try {
      await requestPasswordReset(email);
      cooldown.start();
      toast.show('New code sent');
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  };

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          We sent an email to <Text variant="bodyStrong">{email}</Text>. Tap the
          link on this phone, or enter the code from it below with your new
          password.
        </Text>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="code"
          label="Code"
          leadingIcon={KeyRound}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={8}
          testID="reset-code"
        />
        <FormTextField
          control={control}
          name="password"
          label="New password"
          leadingIcon={Lock}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          helper="At least 8 characters"
          testID="reset-password"
        />
        <Button
          title="Set new password"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="reset-submit"
        />
        <Button
          title={
            cooldown.remaining > 0
              ? `Resend code in ${cooldown.remaining}s`
              : 'Resend code'
          }
          variant="ghost"
          disabled={cooldown.remaining > 0}
          onPress={resend}
        />
      </Stack>
    </Screen>
  );
}
