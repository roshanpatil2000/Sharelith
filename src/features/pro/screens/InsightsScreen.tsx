import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BarChart3, Crown } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Card,
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
import { CategoryBars, MonthBars } from '../components/SpendingCharts';

const MONTHS = 12;
const CHART_HEIGHT = 140;

/** Spending by month and category over the last year (Sharelith Pro). */
export function InsightsScreen() {
  const isPro = useIsPro();
  const navigation = useNavigation();
  const styles = useStyles(createStyles);
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
      <MonthBars
        months={summary.months}
        money={money}
        label="Your share by month"
        testID="insights-months"
      />

      <SectionHeader title="By category" />
      <CategoryBars
        categories={summary.categories}
        money={money}
        of="your share"
        testID="insights-categories"
      />
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    caption: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md },
  });
