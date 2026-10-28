import React, { useEffect, useReducer, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { currencyExponent, currencySymbol, parseToMinor } from '@/domain/money';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';

type Props = {
  /** Amount in minor units. */
  value: number;
  currency: string;
  onChange: (minor: number) => void;
  onCurrencyPress?: () => void;
  autoFocus?: boolean;
  testID?: string;
};

function minorToInput(minor: number, currency: string): string {
  if (minor === 0) {
    return '';
  }
  const exp = currencyExponent(currency);
  const whole = Math.floor(minor / 10 ** exp);
  const frac = minor % 10 ** exp;
  return frac === 0
    ? String(whole)
    : `${whole}.${String(frac).padStart(exp, '0')}`;
}

/**
 * Large amount entry. Keeps the raw text locally so partial input like "12."
 * survives, and only reports valid minor-unit amounts upward.
 */
export function AmountInput({
  value,
  currency,
  onChange,
  onCurrencyPress,
  autoFocus,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const [text, setText] = useState(() => minorToInput(value, currency));
  // Re-rendering makes TextInput restore `text` over a rejected native edit.
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // Sync when the parent changes the value (e.g. reset), unless it already matches.
  useEffect(() => {
    if (parseToMinor(text, currency) !== value) {
      setText(minorToInput(value, currency));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);

  const symbol = currencySymbol(currency);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onCurrencyPress}
        disabled={!onCurrencyPress}
        accessibilityLabel={`Currency ${currency}`}
        style={styles.currency}
      >
        <Text variant="title">{symbol}</Text>
      </Pressable>
      <TextInput
        testID={testID}
        value={text}
        autoFocus={autoFocus}
        keyboardType={
          currencyExponent(currency) === 0 ? 'number-pad' : 'decimal-pad'
        }
        placeholder="0.00"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        accessibilityLabel="Amount"
        onChangeText={next => {
          const minor = parseToMinor(next, currency);
          if (minor === null) {
            forceRender(); // Reject keystrokes that make the amount invalid.
            return;
          }
          setText(next);
          onChange(minor);
        }}
        style={styles.input}
      />
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: t.colors.primary,
      paddingVertical: t.spacing.xs,
    },
    currency: {
      minWidth: t.hitTarget,
      height: t.hitTarget,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: t.spacing.sm,
    },
    input: {
      ...t.typography.amountLarge,
      flex: 1,
      color: t.colors.textPrimary,
      padding: 0,
    },
  });
