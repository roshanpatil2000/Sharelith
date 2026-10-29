import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '@/app/theme';
import { Screen, Stack } from '@/components';
import { AuthLogo } from '../components/AuthLogo';

/** Shown for the moment it takes to read the stored session on launch. */
export function SplashScreen() {
  const { colors } = useTheme();
  return (
    <Screen edges={['top', 'bottom']}>
      <Stack flex={1} align="center" justify="center" gap="xl">
        <AuthLogo />
        <ActivityIndicator color={colors.primary} />
      </Stack>
    </Screen>
  );
}
