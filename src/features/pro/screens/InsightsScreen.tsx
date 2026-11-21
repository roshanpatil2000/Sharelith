import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BarChart3, Crown } from 'lucide-react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import {
  Card,
  CategoryIcon,
  EmptyState,
  ErrorView,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from '@/components';
import { formatMoney } from '@/domain/money';
import { useIsPro } from '../pro';
import { currenciesOf, summarize, useInsights } from '../insights';

const MONTHS = 12;
const CHART_HEIGHT = 140;

/** Bar height for a month: a thin line for empty months, at least 4 px otherwise. */
const barHeight = (share: number, max: number) =>
  share ? Math.max(MIN_BAR, (share / max) * CHART_HEIGHT) : EMPTY_BAR;
const MIN_BAR = 4;
const EMPTY_BAR = 2;

const categoryName = (key: string) =>
  key.charAt(0).toUpperCase() + key.slice(1);

/** Spending by month and category over the last year (Sharelith Pro). */
export function InsightsScreen() {
  const isPro = useIsPro();
  const navigation = useNavigation();
  const styles = useStyles(createStyles);
  const theme = useTheme();
  const { data: rows, isLoading, isError, refetch } = useInsights(MONTHS);
  const currencies = useMemo(() => currenciesOf(rows ?? []), [rows]);
  const [picked, setPicked] = useState<string | null>(null);
  const currency =
    picked && currencies.includes(picked) ? picked : currencies[0];
  const summary = useMemo(
    () => (rows && currency ? summarize(rows, currency, MONTHS) : null),
    [rows, currency],
  );

  if (!isPro) {
    return (
      <Screen padded>
        <EmptyState
          icon={Crown}
          title="Insights are part of Pro"
          message="See where your money goes: your spending by month and category, with charts."
          actionLabel="See Sharelith Pro"
          onAction={() => navigation.navigate('Pro')}
        />
      </Screen>
    );
  }
  if (isError) {
    return <ErrorView onRetry={refetch} />;
  }
  if (isLoading || !rows) {
    return (
      <Screen padded>
        <Stack gap="lg" py="lg">
          <Skeleton height={80} />
          <Skeleton height={CHART_HEIGHT + 40} />
          <Skeleton height={160} />
        </Stack>
      </Screen>
    );
  }
  if (!summary || summary.totalShare === 0) {
    return (
      <Screen padded>
        <EmptyState
          icon={BarChart3}
          title="Nothing to show yet"
          message="Add expenses and your spending for the last 12 months will show here."
        />
      </Screen>
    );
  }

  const max = Math.max(...summary.months.map(m => m.share), 1);
  const money = (minor: number) => formatMoney(minor, summary.currency);

  return (
    <Screen scroll>
      <Stack gap="md" p="lg">
        {currencies.length > 1 ? (
          <SegmentedControl
            segments={currencies.map(c => ({ value: c, label: c }))}
            value={summary.currency}
            onChange={setPicked}
            testID="insights-currency"
          />
        ) : null}
        <Card>
          <Row p="lg" justify="space-between">
            <Stack gap="xxs">
              <Text color="textSecondary">Your share</Text>
              <Text variant="title" testID="insights-share">
                {money(summary.totalShare)}
              </Text>
            </Stack>
            <Stack gap="xxs" align="flex-end">
              <Text color="textSecondary">You paid</Text>
              <Text variant="title">{money(summary.totalPaid)}</Text>
            </Stack>
          </Row>
          <Text variant="caption" color="textSecondary" style={styles.caption}>
            Last 12 months · {summary.expenseCount}{' '}
            {summary.expenseCount === 1 ? 'expense' : 'expenses'}
          </Text>
        </Card>
      </Stack>

      <SectionHeader title="By month" />
      <View
        style={styles.chart}
        accessibilityLabel="Your share by month"
        testID="insights-months"
      >
        {summary.months.map(m => (
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

      <SectionHeader title="By category" />
      <Stack gap="md" px="lg" py="md" testID="insights-categories">
        {summary.categories.map(c => (
          <Row key={c.key} gap="md">
            <CategoryIcon category={c.key} size={32} />
            <Stack flex={1} gap="xxs">
              <Row justify="space-between">
                <Text variant="bodyStrong">{categoryName(c.key)}</Text>
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
                {Math.round(c.fraction * 100)}% of your share
              </Text>
            </Stack>
          </Row>
        ))}
      </Stack>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    caption: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md },
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
