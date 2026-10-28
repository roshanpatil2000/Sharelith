import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';

export type TextFieldProps = TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
  leadingIcon?: LucideIcon;
  trailing?: React.ReactNode;
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>;
};

export function TextField({
  label,
  helper,
  error,
  leadingIcon,
  trailing,
  style,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextFieldProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          focused && styles.focused,
          !!error && styles.errored,
        ]}
      >
        {leadingIcon ? (
          <Icon icon={leadingIcon} size={18} color="textSecondary" />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          {...rest}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="textSecondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: { gap: t.spacing.xs },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: t.hitTarget,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    focused: { borderColor: t.colors.primary },
    errored: { borderColor: t.colors.danger },
    input: {
      ...t.typography.body,
      flex: 1,
      color: t.colors.textPrimary,
      paddingVertical: t.spacing.sm,
    },
  });
