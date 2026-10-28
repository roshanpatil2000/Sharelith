import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { UserPlus } from 'lucide-react-native';
import {
  BalanceSummary,
  Box,
  Divider,
  EmptyState,
  FAB,
  Screen,
  toast,
} from '@/components';

export function FriendsScreen() {
  const navigation = useNavigation();
  return (
    <Screen>
      <Box p="lg">
        <BalanceSummary balances={[]} />
      </Box>
      <Divider />
      <EmptyState
        icon={UserPlus}
        title="No friends yet"
        message="Add friends to split expenses outside of a group."
        actionLabel="Add more friends"
        onAction={() => toast.show('Friends arrive in Phase 2')}
      />
      <FAB onPress={() => navigation.navigate('AddExpense')} />
    </Screen>
  );
}
