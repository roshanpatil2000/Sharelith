import React, { useEffect, useLayoutEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Receipt, Settings } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  AvatarStack,
  BalanceSummary,
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
import { groupsKey, useGroup } from '../api';
import { useGroupBalances } from '../balances';
import { groupTypeLabel, memberCountLabel } from '../groupTypes';
import { GroupCover } from '../components/GroupCover';

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

// headerRight is called as a function: render the button as a component.
const renderSettingsButton = () => <GroupSettingsHeaderButton />;

export function GroupDetailScreen({ route }: Props) {
  const { groupId } = route.params;
  const styles = useStyles(createStyles);
  const navigation = useNavigation();
  const { data: group, isError, refetch, isRefetching } = useGroup(groupId);
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
      title: group?.name ?? '',
      headerRight: group ? renderSettingsButton : undefined,
    });
  }, [navigation, group]);

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
      overlay={<FAB onPress={() => navigation.navigate('AddExpense')} />}
      onRefresh={refetch}
      refreshing={isRefetching}
    >
      <View style={styles.header}>
        <GroupCover type={group.type} uri={group.cover_url} size="xl" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {group.name}
          </Text>
          <Text color="textSecondary">
            {groupTypeLabel(group.type)} ·{' '}
            {memberCountLabel(group.members.length)}
          </Text>
          {group.description ? (
            <Text color="textSecondary" align="center">
              {group.description}
            </Text>
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
      <Divider />
      <EmptyState
        icon={Receipt}
        title="No expenses yet"
        message="Expenses you add to this group will show here."
      />
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.xl,
      backgroundColor: t.colors.surface,
    },
  });
