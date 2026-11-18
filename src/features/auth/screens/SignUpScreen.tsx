import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, Phone, User } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  CurrencyPicker,
  FormTextField,
  Screen,
  Stack,
  Text,
} from '@/components';
import type { AuthScreenProps } from '@/app/navigation/types';
import { env } from '@/lib/env';
import { signUp } from '../api';
import { toAppError } from '../errors';
import { signUpSchema, type SignUpValues } from '../schemas';

export function SignUpScreen({ navigation }: AuthScreenProps<'SignUp'>) {
  const styles = useStyles(createStyles);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      phone: '',
      defaultCurrency: 'INR',
      acceptedTerms: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit(async values => {
    setFormError(null);
    try {
      await signUp(values);
      // The auth listener switches to the main app on success.
    } catch (e) {
      const err = toAppError(e);
      if (err.code === 'confirmation_required') {
        // Opening the emailed link signs the user in from there.
        navigation.replace('CheckEmail', { email: values.email });
      } else {
        setFormError(err.message);
      }
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          Create your account to start splitting expenses.
        </Text>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="fullName"
          label="Full name"
          leadingIcon={User}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          testID="signup-name"
        />
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
          testID="signup-email"
        />
        <FormTextField
          control={control}
          name="password"
          label="Password"
          leadingIcon={Lock}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          helper="At least 8 characters"
          testID="signup-password"
        />
        <FormTextField
          control={control}
          name="phone"
          label="Phone number (optional)"
          leadingIcon={Phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          testID="signup-phone"
        />
        <Card style={styles.flush}>
          <Controller
            control={control}
            name="defaultCurrency"
            render={({ field }) => (
              <CurrencyPicker
                value={field.value}
                onChange={field.onChange}
                testID="signup-currency"
              />
            )}
          />
        </Card>
        <Controller
          control={control}
          name="acceptedTerms"
          render={({ field, fieldState }) => (
            <Stack gap="xxs">
              <View style={styles.consent}>
                <Checkbox
                  checked={field.value === true}
                  onChange={field.onChange}
                  testID="signup-terms"
                />
                <Text style={styles.consentText}>
                  I agree to the{' '}
                  <Text
                    color="primary"
                    onPress={() => Linking.openURL(env.termsUrl)}
                    accessibilityRole="link"
                    testID="signup-terms-link"
                  >
                    Terms & Conditions
                  </Text>{' '}
                  and{' '}
                  <Text
                    color="primary"
                    onPress={() => Linking.openURL(env.privacyPolicyUrl)}
                    accessibilityRole="link"
                    testID="signup-privacy-link"
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </View>
              {fieldState.error ? (
                <Text variant="caption" color="danger">
                  {fieldState.error.message}
                </Text>
              ) : null}
            </Stack>
          )}
        />
      </Stack>
      <Stack gap="md" style={styles.actions}>
        <Button
          title="Create account"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="signup-submit"
        />
        <Button
          title="I already have an account"
          variant="ghost"
          onPress={() => navigation.replace('LogIn')}
        />
      </Stack>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    // ListRow brings its own padding; the card only frames it.
    flush: { padding: 0, overflow: 'hidden' },
    actions: { marginTop: t.spacing.xl },
    consent: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    consentText: { flex: 1 },
  });
