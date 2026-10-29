import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail } from 'lucide-react-native';
import { Banner, Button, FormTextField, Screen, Stack } from '@/components';
import type { AuthScreenProps } from '@/app/navigation/types';
import { signIn } from '../api';
import { toAppError } from '../errors';
import { logInSchema, type LogInValues } from '../schemas';

export function LogInScreen({ navigation, route }: AuthScreenProps<'LogIn'>) {
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState, getValues } = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    defaultValues: { email: route.params?.email ?? '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="email"
          label="Email address"
          leadingIcon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          testID="login-email"
        />
        <FormTextField
          control={control}
          name="password"
          label="Password"
          leadingIcon={Lock}
          password
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => onSubmit()}
          testID="login-password"
        />
        <Button
          title="Log in"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="login-submit"
        />
        <Button
          title="Forgot your password?"
          variant="ghost"
          onPress={() =>
            navigation.navigate('ForgotPassword', {
              email: getValues('email'),
            })
          }
        />
      </Stack>
    </Screen>
  );
}
