import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Users } from 'lucide-react-native';
import {
  BalanceSummary,
  Box,
  Divider,
  EmptyState,
  FAB,
  Screen,
  toast,
} from '@/components';
import { VerifyEmailBanner } from '@/features/account/components/VerifyEmailBanner';

export function GroupsScreen() {
  const navigation = useNavigation();
  return (
    <Screen>
      <Box p="lg">
        <BalanceSummary balances={[]} />
      </Box>
      <Divider />
      <VerifyEmailBanner />
      <EmptyState
        icon={Users}
        title="No groups yet"
        message="Create a group for your trip, home or anything you share costs on."
        actionLabel="Start a new group"
        onAction={() => toast.show('Groups arrive in Phase 3')}
      />
      <FAB onPress={() => navigation.navigate('AddExpense')} testID="fab" />
    </Screen>
  );
}
