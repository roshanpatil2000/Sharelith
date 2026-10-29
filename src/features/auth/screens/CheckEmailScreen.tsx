import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, MailCheck } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Banner,
  Button,
  FormTextField,
  Icon,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import type { AuthScreenProps } from '@/app/navigation/types';
import { resendSignUpEmail, verifySignUpCode } from '../api';
import { toAppError } from '../errors';
import { verifyCodeSchema, type VerifyCodeValues } from '../schemas';
import { useResendCooldown } from '../useResendCooldown';

/** Shown after sign-up when the account must be confirmed by email first. */
export function CheckEmailScreen({
  navigation,
  route,
}: AuthScreenProps<'CheckEmail'>) {
  const { email } = route.params;
  const styles = useStyles(createStyles);
  const cooldown = useResendCooldown();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<VerifyCodeValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      await verifySignUpCode(email, code);
      toast.show('Email confirmed', 'success');
      // Signed in: the navigator switches to the app.
    } catch (e) {
      setError(toAppError(e).message);
    }
  });

  const resend = async () => {
    setError(null);
    setSending(true);
    try {
      await resendSignUpEmail(email);
      cooldown.start();
      toast.show('Email sent again', 'success');
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Icon icon={MailCheck} size={36} color="primary" />
        </View>
        <Text variant="title" align="center">
          Check your email
        </Text>
        <Text color="textSecondary" align="center">
          We sent a link and a code to <Text variant="bodyStrong">{email}</Text>
          . Tap the link on this phone, or enter the code below.
        </Text>
        <Text variant="caption" color="textSecondary" align="center">
          Can’t find it? Check your spam folder.
        </Text>
      </View>
      <Stack gap="md">
        {error ? <Banner tone="danger" message={error} /> : null}
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
          testID="check-email-code"
        />
        <Button
          title="Confirm email"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="check-email-submit"
        />
        <Button
          title={
            cooldown.remaining > 0
              ? `Resend email in ${cooldown.remaining}s`
              : 'Resend email'
          }
          variant="secondary"
          fullWidth
          loading={sending}
          disabled={cooldown.remaining > 0}
          onPress={resend}
          testID="check-email-resend"
        />
        <Button
          title="Back to log in"
          variant="ghost"
          onPress={() => navigation.replace('LogIn', { email })}
          testID="check-email-login"
        />
      </Stack>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    hero: {
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.xxl,
      paddingBottom: t.spacing.xxl,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.sm,
    },
  });
