import React, { useState } from 'react';
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
} from '@/components';
import { deleteAccount } from '@/features/auth/api';
import { useBalances } from '@/features/expenses/api';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import {
  deleteAccountSchema,
  type DeleteAccountValues,
} from '@/features/auth/schemas';

export function DeleteAccountScreen() {
  const userId = useUserId();
  const [formError, setFormError] = useState<string | null>(null);
  // A deleted account can't settle up, so balances must be cleared first.
  const { data: balances } = useBalances();
  const unsettled = (balances ?? []).length > 0;
  const { control, handleSubmit, formState } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await deleteAccount(userId!, password);
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          This permanently deletes your profile and can’t be undone. Enter your
          password to confirm.
        </Text>
        {unsettled ? (
          <Banner
            tone="info"
            message="You still owe or are owed money. Settle up with everyone first, so nobody is left with a balance they can’t clear."
          />
        ) : null}
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="password"
          label="Password"
          leadingIcon={Lock}
          password
          autoComplete="current-password"
          textContentType="password"
          testID="delete-password"
        />
        <Button
          title="Delete account"
          variant="danger"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          disabled={unsettled}
          onPress={onSubmit}
          testID="delete-submit"
        />
      </Stack>
    </Screen>
  );
}
