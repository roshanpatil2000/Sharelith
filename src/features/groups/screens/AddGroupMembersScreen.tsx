import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Banner, Button, Screen, Stack, toast } from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { toAppError } from '@/features/auth/errors';
import { useAddGroupMembers, useGroup } from '../api';
import { MemberPicker } from '../components/MemberPicker';

type Props = NativeStackScreenProps<RootStackParamList, 'AddGroupMembers'>;

export function AddGroupMembersScreen({ route }: Props) {
  const { groupId, addedFriendId } = route.params;
  const navigation = useNavigation();
  const { data: group } = useGroup(groupId);
  const addMembers = useAddGroupMembers(groupId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const memberIds = useMemo(
    () => new Set(group?.members.map(m => m.id)),
    [group],
  );

  // Someone just added by email: select them.
  useEffect(() => {
    if (addedFriendId) {
      setSelected(s => new Set(s).add(addedFriendId));
    }
  }, [addedFriendId]);

  const toggle = (id: string) =>
    setSelected(s => {
      const next = new Set(s);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  const toAdd = [...selected].filter(id => !memberIds.has(id));

  const onSave = () => {
    setFormError(null);
    addMembers.mutate(toAdd, {
      onSuccess: () => {
        toast.show(
          toAdd.length === 1
            ? 'Added 1 person'
            : `Added ${toAdd.length} people`,
          'success',
        );
        navigation.goBack();
      },
      onError: e => setFormError(toAppError(e).message),
    });
  };

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <MemberPicker
          selected={selected}
          onToggle={toggle}
          memberIds={memberIds}
          onAddByEmail={() =>
            navigation.navigate('AddFriend', {
              returnTo: { screen: 'AddGroupMembers', groupId },
            })
          }
        />
        <Button
          title={
            toAdd.length > 0
              ? `Add ${
                  toAdd.length === 1 ? '1 person' : `${toAdd.length} people`
                }`
              : 'Add people'
          }
          size="lg"
          fullWidth
          disabled={toAdd.length === 0}
          loading={addMembers.isPending}
          onPress={onSave}
          testID="group-add-members"
        />
      </Stack>
    </Screen>
  );
}
