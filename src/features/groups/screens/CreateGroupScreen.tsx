import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Banner, Button, Screen, Stack, Text, toast } from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import type { PickedImage } from '@/features/account/api';
import { toAppError } from '@/features/auth/errors';
import { uploadGroupCover, useCreateGroup } from '../api';
import type { GroupType } from '../groupTypes';
import {
  GroupDetailsFields,
  groupDetailsSchema,
  pickCoverImage,
  type GroupDetailsValues,
} from '../components/GroupDetailsFields';
import { MemberPicker } from '../components/MemberPicker';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export function CreateGroupScreen({ route }: Props) {
  const navigation = useNavigation();
  const createGroup = useCreateGroup();
  const [type, setType] = useState<GroupType>('trip');
  const [cover, setCover] = useState<(PickedImage & { uri?: string }) | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<GroupDetailsValues>({
    resolver: zodResolver(groupDetailsSchema),
    defaultValues: { name: '', description: '' },
  });

  // Someone just added by email: select them.
  const addedFriendId = route.params?.addedFriendId;
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

  const onSubmit = handleSubmit(async ({ name, description }) => {
    setFormError(null);
    try {
      const groupId = await createGroup.mutateAsync({
        name,
        type,
        description: description || undefined,
        memberIds: [...selected],
      });
      // The group needs an id before its cover can be uploaded.
      if (cover) {
        await uploadGroupCover(groupId, cover).catch(() =>
          toast.show(
            'Group created, but the cover photo didn’t upload',
            'error',
          ),
        );
      }
      toast.show(`Created ${name}`, 'success');
      navigation.goBack();
      navigation.navigate('GroupDetail', { groupId });
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="xl">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <GroupDetailsFields
          control={control}
          type={type}
          onTypeChange={setType}
          coverUri={cover?.uri}
          onPickCover={async () => setCover((await pickCoverImage()) ?? cover)}
        />
        <Stack gap="sm">
          <Text variant="heading">Add people</Text>
          <Text color="textSecondary" variant="caption">
            Everyone in a group becomes friends with each other. You’re the
            group’s admin.
          </Text>
          <MemberPicker
            selected={selected}
            onToggle={toggle}
            onAddByEmail={() =>
              navigation.navigate('AddFriend', {
                returnTo: { screen: 'CreateGroup' },
              })
            }
          />
        </Stack>
        <Button
          title={
            selected.size > 0
              ? `Create group with ${selected.size + 1} people`
              : 'Create group'
          }
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="group-create"
        />
      </Stack>
    </Screen>
  );
}
