import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react-native';
import {
  Banner,
  Button,
  FormTextField,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import { changePassword } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from '@/features/auth/schemas';

export function ChangePasswordScreen() {
  const navigation = useNavigation();
  // Opened from a reset or invite link: the app stays on this screen until
  // it's saved.
  const fromResetLink = useAuthStore(s => s.passwordResetPending);
  const isInvite = fromResetLink === 'invite';
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await changePassword(password);
      toast.show(isInvite ? 'You’re all set' : 'Password changed', 'success');
      if (!fromResetLink) {
        navigation.goBack();
      }
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        {isInvite ? (
          <Text color="textSecondary">
            Your friends added you to Sharelith. Choose a password so you can
            log in next time.
          </Text>
        ) : null}
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="password"
          label={isInvite ? 'Password' : 'New password'}
          leadingIcon={Lock}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          helper="At least 8 characters"
          testID="password-new"
        />
        <FormTextField
          control={control}
          name="confirm"
          label="Confirm new password"
          leadingIcon={Lock}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={() => onSubmit()}
          testID="password-confirm"
        />
        <Button
          testID="password-submit"
          title={isInvite ? 'Set password' : 'Change password'}
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
        />
      </Stack>
    </Screen>
  );
}
