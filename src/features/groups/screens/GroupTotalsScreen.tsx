import React, { useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart3, Crown } from 'lucide-react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorView,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from '@/components';
import { formatMoney } from '@/domain/money';
import { useUserId } from '@/features/auth/authStore';
import { useIsPro } from '@/features/pro/pro';
import { currenciesOf, summarize } from '@/features/pro/insights';
import {
  CategoryBars,
  MonthBars,
} from '@/features/pro/components/SpendingCharts';
import { useGroup } from '../api';
import {
  asGroupRows,
  totalsIn,
  useGroupSpending,
  useMemberSpending,
} from '../totals';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupTotals'>;

const MONTHS = 12;

/** What a group spent, your part of it, who paid, and charts (Pro). */
export function GroupTotalsScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const me = useUserId();
  const isPro = useIsPro();
  const { data: group } = useGroup(groupId);
  const spending = useGroupSpending(groupId);
  const members = useMemberSpending(groupId);

  const chartRows = useMemo(
    () => asGroupRows(spending.data ?? []),
    [spending.data],
  );
  const currencies = useMemo(() => currenciesOf(chartRows), [chartRows]);
  const [picked, setPicked] = useState<string | null>(null);
  const currency =
    picked && currencies.includes(picked) ? picked : currencies[0];

  if (spending.isError || members.isError) {
    return (
      <ErrorView
        onRetry={() => {
          spending.refetch();
          members.refetch();
        }}
      />
    );
  }
  if (spending.isLoading || members.isLoading) {
    return (
      <Screen padded>
        <Stack gap="lg" py="lg">
          <Skeleton height={100} />
          <Skeleton height={180} />
        </Stack>
      </Screen>
    );
  }
  if (!currency) {
    return (
      <Screen padded>
        <EmptyState
          icon={BarChart3}
          title="No spending yet"
          message="Add expenses to this group and its totals will show here."
        />
      </Screen>
    );
  }

  const money = (minor: number) => formatMoney(minor, currency);
  const totals = totalsIn(spending.data ?? [], currency);
  const summary = summarize(chartRows, currency, MONTHS);
  const people = (members.data ?? []).filter(m => m.currency === currency);
  const nameOf = (id: string) =>
    id === me ? 'You' : group?.names[id] ?? 'Someone';

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <Stack gap="md" p="lg">
        {currencies.length > 1 ? (
          <SegmentedControl
            segments={currencies.map(c => ({ value: c, label: c }))}
            value={currency}
            onChange={setPicked}
            testID="totals-currency"
          />
        ) : null}
        <Card>
          <Stack p="lg" gap="md">
            <Stack gap="xxs">
              <Text color="textSecondary">Total group spending</Text>
              <Text variant="title" testID="totals-group">
                {money(totals.total)}
              </Text>
            </Stack>
            <Row justify="space-between">
              <Stack gap="xxs">
                <Text color="textSecondary">Your share</Text>
                <Text variant="bodyStrong" testID="totals-share">
                  {money(totals.myShare)}
                </Text>
              </Stack>
              <Stack gap="xxs" align="flex-end">
                <Text color="textSecondary">You paid</Text>
                <Text variant="bodyStrong" testID="totals-paid">
                  {money(totals.myPaid)}
                </Text>
              </Stack>
            </Row>
            <Text variant="caption" color="textSecondary">
              All time · {totals.count}{' '}
              {totals.count === 1 ? 'expense' : 'expenses'}
            </Text>
          </Stack>
        </Card>
      </Stack>

      <SectionHeader title="Who paid" />
      {people.map(p => (
        <ListRow
          key={p.user_id}
          title={nameOf(p.user_id)}
          subtitle={`Share ${money(p.share_minor)}`}
          leading={<Avatar name={nameOf(p.user_id)} />}
          trailing={<Text variant="bodyStrong">{money(p.paid_minor)}</Text>}
          testID={`totals-member-${p.user_id}`}
        />
      ))}

      {isPro ? (
        <>
          <SectionHeader title="By month" />
          <MonthBars
            months={summary.months}
            money={money}
            label="Group spending by month"
            testID="totals-months"
          />
          <SectionHeader title="By category" />
          <CategoryBars
            categories={summary.categories}
            money={money}
            of="the group’s spending"
            testID="totals-categories"
          />
        </>
      ) : (
        <Stack gap="sm" p="lg" align="center">
          <Text color="textSecondary" align="center">
            See this group’s spending by month and category with Pro.
          </Text>
          <Button
            title="See Sharelith Pro"
            icon={Crown}
            variant="secondary"
            onPress={() => navigation.navigate('Pro')}
            testID="totals-pro"
          />
        </Stack>
      )}
    </Screen>
  );
}
