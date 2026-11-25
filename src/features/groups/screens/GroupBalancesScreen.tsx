import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Scale } from 'lucide-react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  AmountText,
  Avatar,
  Button,
  EmptyState,
  ErrorView,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Stack,
  Text,
  toast,
} from '@/components';
import { formatMoney } from '@/domain/money';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { useGroupMemberBalances } from '@/features/expenses/api';
import { useSendReminder } from '@/features/friends/api';
import { useGroup } from '../api';
import { memberNets, suggestedPayments } from '../settlePlan';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupBalances'>;

/** Everyone's balance in a group, and the payments that would settle it. */
export function GroupBalancesScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const me = useUserId();
  const { data: group } = useGroup(groupId);
  const balances = useGroupMemberBalances(groupId);
  const remind = useSendReminder();

  if (balances.isError) {
    return <ErrorView onRetry={() => balances.refetch()} />;
  }
  if (balances.isLoading || !group) {
    return (
      <Screen padded>
        <Stack gap="md" py="lg">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      </Screen>
    );
  }

  const rows = balances.data ?? [];
  const nets = memberNets(rows);
  const payments = suggestedPayments(rows);
  const nameOf = (id: string) =>
    id === me ? 'You' : group.names[id] ?? 'Someone';
  const first = (id: string) => nameOf(id).split(' ')[0]!;

  if (payments.length === 0) {
    return (
      <Screen padded>
        <EmptyState
          icon={Scale}
          title="Everyone’s settled up"
          message="No one in this group owes anything."
        />
      </Screen>
    );
  }

  const members = group.members
    .map(m => m.id)
    .sort((a, b) => Number(nets.has(b)) - Number(nets.has(a)));

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <SectionHeader title="Balances" />
      {members.map(id => {
        const mine = nets.get(id);
        return (
          <ListRow
            key={id}
            title={nameOf(id)}
            subtitle={
              mine
                ? mine
                    .map(
                      n =>
                        `${n.minor > 0 ? 'gets back' : 'owes'} ${formatMoney(
                          Math.abs(n.minor),
                          n.currency,
                        )}`,
                    )
                    .join(' · ')
                : 'settled up'
            }
            leading={<Avatar name={nameOf(id)} />}
            trailing={
              mine?.length === 1 ? (
                <AmountText
                  minor={mine[0]!.minor}
                  currency={mine[0]!.currency}
                />
              ) : null
            }
            testID={`balances-member-${id}`}
          />
        );
      })}

      <SectionHeader title="Suggested payments" />
      {payments.map(p => {
        const involved = p.from === me || p.to === me;
        const owedToMe = p.to === me;
        return (
          <ListRow
            key={`${p.currency}:${p.from}:${p.to}`}
            title={`${first(p.from)} ${p.from === me ? 'pay' : 'pays'} ${
              p.to === me ? 'you' : first(p.to)
            }`}
            subtitle={formatMoney(p.minor, p.currency)}
            leading={<Avatar name={nameOf(p.from)} size="sm" />}
            trailing={
              involved ? (
                <Row gap="xs">
                  {owedToMe ? (
                    <Button
                      title="Remind"
                      size="sm"
                      variant="outline"
                      loading={remind.isPending && remind.variables === p.from}
                      onPress={() =>
                        remind.mutate(p.from, {
                          onSuccess: () =>
                            toast.show(`Reminded ${first(p.from)}`),
                          onError: e =>
                            toast.show(toAppError(e).message, 'error'),
                        })
                      }
                      testID={`balances-remind-${p.from}`}
                    />
                  ) : null}
                  <Button
                    title="Settle"
                    size="sm"
                    onPress={() => navigation.navigate('SettleUp', { groupId })}
                    testID={`balances-settle-${p.from}-${p.to}`}
                  />
                </Row>
              ) : null
            }
            testID={`balances-payment-${p.from}-${p.to}`}
          />
        );
      })}
      <Stack p="lg">
        <Text variant="caption" color="textSecondary">
          {group.simplify_debts
            ? 'Simplify debts is on, so Settle up suggests these payments.'
            : 'These are the fewest payments that would settle the group. Turn on Simplify debts in group settings to settle this way.'}
        </Text>
      </Stack>
    </Screen>
  );
}
