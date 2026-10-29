import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '@/components';

/** The "S" app mark used on Welcome and the launch splash. */
export function AuthLogo({ size = 88 }: { size?: number }) {
  const styles = useStyles(createStyles);
  return (
    <View
      style={[styles.logo, { width: size, height: size }]}
      accessibilityLabel="Sharelith"
      accessible
    >
      <Text variant="display" color="textOnPrimary">
        S
      </Text>
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    logo: {
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...t.elevation[2],
    },
  });
