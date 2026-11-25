import React, { useEffect, useLayoutEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BarChart3,
  HandCoins,
  Receipt,
  Settings,
  UserPlus,
} from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  AvatarStack,
  BalanceSummary,
  Button,
  Divider,
  EmptyState,
  ErrorView,
  FAB,
  IconButton,
  Screen,
  Stack,
  Text,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { useUserId } from '@/features/auth/authStore';
import { useRefreshExpenses } from '@/features/expenses/api';
import { ExpenseList } from '@/features/expenses/components/ExpenseList';
import { groupsKey, useGroup } from '../api';
import { useGroupBalances } from '../balances';
import { groupTypeLabel, memberCountLabel } from '../groupTypes';
import { GroupCover } from '../components/GroupCover';
import { ExportButton } from '@/features/pro/components/ExportButton';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

function GroupSettingsHeaderButton() {
  const navigation = useNavigation();
  const { groupId } =
    useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>().params;
  return (
    <IconButton
      icon={Settings}
      accessibilityLabel="Group settings"
      color="primary"
      onPress={() => navigation.navigate('GroupSettings', { groupId })}
      testID="group-settings"
    />
  );
}

export function GroupDetailScreen({ route }: Props) {
  const { groupId } = route.params;
  const styles = useStyles(createStyles);
  const navigation = useNavigation();
  const { data: group, isError, refetch } = useGroup(groupId);
  const refreshExpenses = useRefreshExpenses();
  const balances = useGroupBalances();
  const userId = useUserId();
  const qc = useQueryClient();

  // Removed or deleted elsewhere: the Groups list is stale too.
  const gone = group === null;
  useEffect(() => {
    if (gone) {
      qc.invalidateQueries({ queryKey: groupsKey(userId), exact: true });
    }
  }, [gone, qc, userId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      // The name is the screen's own heading.
      title: '',
      headerRight: group
        ? () => (
            <View style={styles.headerButtons}>
              <ExportButton
                title={group.name}
                groupId={group.id}
                nameOf={id =>
                  id === userId ? 'You' : group.names[id] ?? 'Someone'
                }
              />
              <GroupSettingsHeaderButton />
            </View>
          )
        : undefined,
    });
  }, [navigation, group, userId, styles.headerButtons]);

  if (isError) {
    return <ErrorView onRetry={refetch} />;
  }
  if (group === null) {
    // Deleted, or you left / were removed.
    return (
      <Screen>
        <EmptyState
          icon={Receipt}
          title="You’re not in this group"
          message="It may have been deleted, or you were removed."
        />
      </Screen>
    );
  }
  if (!group) {
    return <Screen>{null}</Screen>;
  }

  return (
    <Screen
      scroll
      edges={['bottom', 'left', 'right']}
      overlay={
        <FAB
          testID="group-add-expense"
          onPress={() => navigation.navigate('AddExpense', { groupId })}
        />
      }
      onRefresh={() => Promise.all([refetch(), refreshExpenses()])}
    >
      <View style={styles.header}>
        <GroupCover type={group.type} uri={group.cover_url} size="lg" />
        <Stack gap="xs">
          <Text variant="title">{group.name}</Text>
          <Text color="textSecondary">
            {groupTypeLabel(group.type)} ·{' '}
            {memberCountLabel(group.members.length)}
          </Text>
          {group.description ? (
            <Text color="textSecondary">{group.description}</Text>
          ) : null}
        </Stack>
        <AvatarStack
          people={group.members.map(m => ({
            name: m.full_name,
            uri: m.avatar_url,
          }))}
          max={6}
        />
        <BalanceSummary balances={balances[group.id] ?? []} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actions}
        contentContainerStyle={styles.actionsContent}
      >
        {(balances[group.id] ?? []).length > 0 ? (
          <Button
            title="Settle up"
            icon={HandCoins}
            size="sm"
            style={styles.action}
            onPress={() => navigation.navigate('SettleUp', { groupId })}
            testID="group-settle-up"
          />
        ) : null}
        <Button
          title="Totals"
          icon={BarChart3}
          size="sm"
          style={styles.action}
          variant="outline"
          accessibilityLabel="Group totals"
          onPress={() => navigation.navigate('GroupTotals', { groupId })}
          testID="group-totals"
        />
        <Button
          title="Add people"
          icon={UserPlus}
          size="sm"
          style={styles.action}
          variant="outline"
          onPress={() => navigation.navigate('AddGroupMembers', { groupId })}
          testID="group-add-people"
        />
      </ScrollView>
      <Divider />
      <ExpenseList
        groupId={groupId}
        names={group.names}
        emptyMessage="Expenses you add to this group will show here."
      />
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
    },
    header: {
      alignItems: 'flex-start',
      gap: t.spacing.md,
      padding: t.spacing.lg,
      backgroundColor: t.colors.surface,
    },
    actions: { flexGrow: 0, backgroundColor: t.colors.surface },
    // Full touch height, and the same shape for the filled and outlined ones.
    action: { minHeight: t.hitTarget, borderRadius: t.radius.pill },
    actionsContent: {
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.lg,
    },
  });
