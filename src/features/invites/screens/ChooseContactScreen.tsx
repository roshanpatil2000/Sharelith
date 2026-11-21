import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Contact } from 'lucide-react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  Avatar,
  Box,
  EmptyState,
  ListRow,
  ListRowSkeleton,
  Screen,
  SearchBar,
} from '@/components';
import {
  allowContacts,
  loadContactEmails,
  searchContacts,
  type ContactEmail,
} from '../contacts';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseContact'>;

type State =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'ready'; rows: ContactEmail[] };

/**
 * Pick someone from the phone's contacts (those with an email). Their name
 * and email go back to Add friend; nothing leaves the phone until then.
 */
export function ChooseContactScreen({ navigation, route }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      if (!(await allowContacts())) {
        live && setState({ status: 'denied' });
        return;
      }
      const rows = await loadContactEmails().catch(() => []);
      live && setState({ status: 'ready', rows });
    })();
    return () => {
      live = false;
    };
  }, []);

  const visible = useMemo(
    () => (state.status === 'ready' ? searchContacts(state.rows, query) : []),
    [state, query],
  );

  if (state.status === 'denied') {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <EmptyState
          icon={Contact}
          title="Contacts are off"
          message="Allow Sharelith to see your contacts in Settings, or type your friend’s email instead."
          actionLabel="Open Settings"
          onAction={() => Linking.openSettings()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Box p="md">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          testID="contacts-search"
        />
      </Box>
      {state.status === 'loading' ? (
        <>
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={r => r.key}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.email}
              leading={<Avatar name={item.name} size="md" />}
              onPress={() =>
                navigation.popTo(
                  'AddFriend',
                  {
                    ...route.params,
                    contact: { email: item.email, name: item.name },
                  },
                  { merge: true },
                )
              }
              testID={`contact-${item.email}`}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={Contact}
              title={query ? 'No matches' : 'No contacts with an email'}
              message="Only contacts with an email address can be added."
            />
          }
        />
      )}
    </Screen>
  );
}
