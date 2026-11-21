import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { CategoryIcon, Row, Stack, Text } from '@/components';
import { categoryLabel } from '@/domain/categorize';
import type { CategoryBar, MonthBar } from '../insights';

const CHART_HEIGHT = 140;
const MIN_BAR = 4;
const EMPTY_BAR = 2;

/** Bar height for a month: a thin line for empty months, at least 4 px otherwise. */
const barHeight = (share: number, max: number) =>
  share ? Math.max(MIN_BAR, (share / max) * CHART_HEIGHT) : EMPTY_BAR;

/** One bar per month, oldest first. */
export function MonthBars({
  months,
  money,
  label,
  testID,
}: {
  months: MonthBar[];
  money: (minor: number) => string;
  label: string;
  testID?: string;
}) {
  const styles = useStyles(createStyles);
  const theme = useTheme();
  const max = Math.max(...months.map(m => m.share), 1);
  return (
    <View style={styles.chart} accessibilityLabel={label} testID={testID}>
      {months.map(m => (
        <View key={m.key} style={styles.column}>
          <View style={styles.barArea}>
            <View
              style={[
                styles.bar,
                {
                  height: barHeight(m.share, max),
                  backgroundColor: m.share
                    ? theme.colors.primary
                    : theme.colors.border,
                },
              ]}
              accessibilityLabel={`${m.label}: ${money(m.share)}`}
            />
          </View>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {m.label.charAt(0)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Categories biggest first, each with a bar and its percentage. */
export function CategoryBars({
  categories,
  money,
  of,
  testID,
}: {
  categories: CategoryBar[];
  money: (minor: number) => string;
  /** "your share", "the group's spending": the caption's denominator. */
  of: string;
  testID?: string;
}) {
  const styles = useStyles(createStyles);
  const theme = useTheme();
  return (
    <Stack gap="md" px="lg" py="md" testID={testID}>
      {categories.map(c => (
        <Row key={c.key} gap="md">
          <CategoryIcon category={c.key} size={32} />
          <Stack flex={1} gap="xxs">
            <Row justify="space-between">
              <Text variant="bodyStrong">{categoryLabel(c.key)}</Text>
              <Text>{money(c.share)}</Text>
            </Row>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.round(c.fraction * 100)}%`,
                    backgroundColor: theme.colors.category[c.key],
                  },
                ]}
              />
            </View>
            <Text variant="caption" color="textSecondary">
              {Math.round(c.fraction * 100)}% of {of}
            </Text>
          </Stack>
        </Row>
      ))}
    </Stack>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      gap: t.spacing.xs,
    },
    column: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
    barArea: {
      height: CHART_HEIGHT,
      justifyContent: 'flex-end',
      width: '100%',
    },
    bar: { width: '100%', borderRadius: t.radius.sm },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: t.colors.border,
      overflow: 'hidden',
    },
    fill: { height: 6, borderRadius: 3 },
  });
