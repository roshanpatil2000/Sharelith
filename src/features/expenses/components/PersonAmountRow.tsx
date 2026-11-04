import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Row, Stack, Text } from '@/components';

type Props = {
  name: string;
  value: string;
  onChange: (text: string) => void;
  /** Before the input, such as "₹". */
  prefix?: string;
  /** After the input, such as "%" or "shares". */
  suffix?: string;
  /** What this works out to, such as "₹250.00". */
  result?: string;
  /** Adjustments can be negative. */
  signed?: boolean;
  testID?: string;
};

/** One person's line in a split or payer list: name, a small input, result. */
export function PersonAmountRow({
  name,
  value,
  onChange,
  prefix,
  suffix,
  result,
  signed,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Row gap="md">
      <Stack style={styles.name} gap="xxs">
        <Text numberOfLines={1}>{name}</Text>
        {result ? (
          <Text
            variant="caption"
            color="textSecondary"
            testID={testID ? `${testID}-result` : undefined}
          >
            {result}
          </Text>
        ) : null}
      </Stack>
      <View style={styles.field}>
        {prefix ? <Text color="textSecondary">{prefix}</Text> : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          keyboardType={signed ? 'numbers-and-punctuation' : 'decimal-pad'}
          accessibilityLabel={`${name}${suffix ? `, ${suffix}` : ''}`}
          style={styles.input}
        />
        {suffix ? <Text color="textSecondary">{suffix}</Text> : null}
      </View>
    </Row>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    name: { flex: 1 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      width: 140,
      minHeight: t.hitTarget,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    input: {
      ...t.typography.body,
      flex: 1,
      textAlign: 'right',
      color: t.colors.textPrimary,
      paddingVertical: t.spacing.sm,
    },
  });
