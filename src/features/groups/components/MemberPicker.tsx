import React, { useMemo, useState } from 'react';
import { Mail } from 'lucide-react-native';
import {
  Avatar,
  Checkbox,
  Icon,
  ListRow,
  Pressable,
  Row,
  SearchBar,
  Stack,
  Text,
} from '@/components';
import { useFriends } from '@/features/friends/api';

type Props = {
  selected: ReadonlySet<string>;
  onToggle: (friendId: string) => void;
  /** Already in the group: shown ticked and can't be changed. */
  memberIds?: ReadonlySet<string>;
  onAddByEmail: () => void;
};

/** Pick friends to put in a group, or add someone new by email. */
export function MemberPicker({
  selected,
  onToggle,
  memberIds,
  onAddByEmail,
}: Props) {
  const { data: friends, isLoading } = useFriends();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (friends ?? []).filter(
      f =>
        !q ||
        f.full_name.toLowerCase().includes(q) ||
        f.email?.toLowerCase().includes(q),
    );
  }, [friends, query]);

  return (
    <Stack gap="sm">
      {friends && friends.length > 5 ? (
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search friends"
          testID="member-search"
        />
      ) : null}
      <Pressable
        onPress={onAddByEmail}
        accessibilityRole="button"
        accessibilityLabel="Add someone by email"
        testID="member-add-email"
      >
        <Row gap="md" align="center" py="sm">
          <Icon icon={Mail} color="primary" />
          <Text color="primaryText" variant="heading">
            Add someone by email
          </Text>
        </Row>
      </Pressable>
      {visible.map(f => {
        const isMember = memberIds?.has(f.id) ?? false;
        return (
          <ListRow
            key={f.id}
            testID={`member-${f.id}`}
            title={f.full_name}
            subtitle={
              isMember
                ? 'Already in the group'
                : f.invited
                ? 'Invited · hasn’t joined yet'
                : f.email ?? undefined
            }
            leading={<Avatar name={f.full_name} uri={f.avatar_url} size="sm" />}
            trailing={
              <Checkbox
                checked={isMember || selected.has(f.id)}
                disabled={isMember}
                onChange={() => onToggle(f.id)}
                testID={`member-check-${f.id}`}
              />
            }
            onPress={isMember ? undefined : () => onToggle(f.id)}
          />
        );
      })}
      {!isLoading && friends?.length === 0 ? (
        <Text color="textSecondary">
          You haven’t added any friends yet. Add people by email and they’ll
          become your friends too.
        </Text>
      ) : null}
    </Stack>
  );
}
