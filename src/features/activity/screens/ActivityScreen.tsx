import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Inbox } from 'lucide-react-native';
import { EmptyState, FAB, Screen } from '@/components';

export function ActivityScreen() {
  const navigation = useNavigation();
  return (
    <Screen>
      <EmptyState
        icon={Inbox}
        title="No activity yet"
        message="Expenses, payments and group changes will show up here."
      />
      <FAB onPress={() => navigation.navigate('AddExpense')} />
    </Screen>
  );
}
