import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '@/app/theme';

/**
 * Tabs as round icon buttons in a side system strip, like the closed iPhone
 * Duo's: the strip beside the app already holds the clock and camera, so the
 * tabs sit at its foot instead of taking a bar across the bottom.
 */
export function StripTabBar({
  state,
  descriptors,
  navigation,
  insets: barInsets,
  side,
}: BottomTabBarProps & { side: 'left' | 'right' }) {
  const styles = useStyles(createStyles);
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const width = side === 'right' ? insets.right : insets.left;

  return (
    <View
      style={[
        styles.strip,
        side === 'right' ? styles.right : styles.left,
        { width, bottom: barInsets.bottom + t.spacing.md },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={[styles.button, focused && styles.focused]}
            testID={`strip-tab-${route.name}`}
          >
            {options.tabBarIcon?.({
              focused,
              color: focused ? t.colors.primary : t.colors.textSecondary,
              size: 22,
            })}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    strip: {
      position: 'absolute',
      alignItems: 'center',
      gap: t.spacing.md,
    },
    right: { right: 0 },
    left: { left: 0 },
    button: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    focused: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
  });
