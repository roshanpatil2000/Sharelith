import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react-native';
import {
  Banner,
  Button,
  FormTextField,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import { sendVerificationEmail, verifyEmailCode } from '../api';
import { useUserEmail } from '../authStore';
import { toAppError } from '../errors';
import { verifyCodeSchema, type VerifyCodeValues } from '../schemas';
import { useResendCooldown } from '../useResendCooldown';

export function VerifyEmailScreen() {
  const navigation = useNavigation();
  const email = useUserEmail() ?? '';
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const cooldown = useResendCooldown(60, false);
  const { control, handleSubmit, formState } = useForm<VerifyCodeValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: '' },
  });

  const send = async () => {
    setFormError(null);
    setSending(true);
    try {
      await sendVerificationEmail(email);
      setSent(true);
      cooldown.start();
    } catch (e) {
      setFormError(toAppError(e).message);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = handleSubmit(async ({ code }) => {
    setFormError(null);
    try {
      await verifyEmailCode(email, code);
      toast.show('Email confirmed', 'success');
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          {sent ? 'We sent an email to ' : 'We’ll email a link to '}
          <Text variant="bodyStrong">{email}</Text>
          {sent
            ? '. Tap the link on this phone, or enter the code from it below.'
            : ' to confirm it’s yours.'}
        </Text>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        {sent ? (
          <>
            <FormTextField
              control={control}
              name="code"
              label="Code"
              leadingIcon={KeyRound}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={8}
              onSubmitEditing={() => onSubmit()}
              testID="verify-code"
            />
            <Button
              title="Confirm email"
              size="lg"
              fullWidth
              loading={formState.isSubmitting}
              onPress={onSubmit}
              testID="verify-submit"
            />
            <Button
              title={
                cooldown.remaining > 0
                  ? `Resend code in ${cooldown.remaining}s`
                  : 'Resend code'
              }
              variant="ghost"
              disabled={cooldown.remaining > 0 || sending}
              onPress={send}
            />
          </>
        ) : (
          <Button
            title="Send email"
            size="lg"
            fullWidth
            loading={sending}
            onPress={send}
            testID="verify-send"
          />
        )}
      </Stack>
    </Screen>
  );
}
