import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Button, Screen, Stack, Text, toast } from '@/components';
import { useSessionStore } from '@/lib/sessionStore';

export function WelcomeScreen() {
  const styles = useStyles(createStyles);
  const signInDev = useSessionStore(s => s.signInDev);
  const comingSoon = () => toast.show('Sign in arrives in Phase 1');

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} padded>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text variant="display" color="textOnPrimary">
            S
          </Text>
        </View>
        <Text variant="display" align="center">
          Sharelith
        </Text>
        <Text color="textSecondary" align="center">
          Split bills with friends, track shared expenses and settle up.
        </Text>
      </View>
      <Stack gap="md">
        <Button title="Sign up" size="lg" fullWidth onPress={comingSoon} />
        <Button
          title="Log in"
          size="lg"
          variant="secondary"
          fullWidth
          onPress={comingSoon}
        />
        {__DEV__ ? (
          <Button
            title="Skip to app (dev)"
            variant="ghost"
            onPress={signInDev}
            testID="dev-skip"
          />
        ) : null}
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
    logo: {
      width: 88,
      height: 88,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.md,
      ...t.elevation[2],
    },
  });
