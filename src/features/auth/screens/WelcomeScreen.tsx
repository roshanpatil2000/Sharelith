import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Button, Screen, Stack, Text } from '@/components';
import type { AuthScreenProps } from '@/app/navigation/types';
import { AuthLogo } from '../components/AuthLogo';

export function WelcomeScreen({ navigation }: AuthScreenProps<'Welcome'>) {
  const styles = useStyles(createStyles);
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} padded>
      <View style={styles.hero}>
        <AuthLogo />
        <Text variant="display" align="center" style={styles.title}>
          Sharelith
        </Text>
        <Text color="textSecondary" align="center">
          Split bills with friends, track shared expenses and settle up.
        </Text>
      </View>
      <Stack gap="md">
        <Button
          title="Sign up"
          size="lg"
          fullWidth
          testID="welcome-signup"
          onPress={() => navigation.navigate('SignUp')}
        />
        <Button
          title="Log in"
          size="lg"
          variant="secondary"
          fullWidth
          testID="welcome-login"
          onPress={() => navigation.navigate('LogIn')}
        />
      </Stack>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
    },
    title: { marginTop: t.spacing.md },
  });
